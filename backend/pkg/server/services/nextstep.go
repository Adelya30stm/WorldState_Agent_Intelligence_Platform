package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"pentagi/pkg/providers"
	"pentagi/pkg/providers/pconfig"
	"pentagi/pkg/server/logger"
	"pentagi/pkg/server/response"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/gorm"
)

// ─── Response types ─────────────────────────────────────────────────────────────
// flexString / flexStringSlice are defined in planning_extract.go (same package)
// and reused here so LLM type-drift can't fail the whole request.

type nextStepRecommendation struct {
	Step      flexString `json:"step"`
	Rationale flexString `json:"rationale"`
	Priority  flexString `json:"priority"`
	Phase     flexString `json:"phase"`
	Command   flexString `json:"command"`
}

type NextStepResponse struct {
	FlowID          int64                    `json:"flowId"`
	CurrentPhase    flexString               `json:"currentPhase"`
	Summary         flexString               `json:"summary"`
	Recommendations []nextStepRecommendation `json:"recommendations"`
	Caution         flexString               `json:"caution"`
}

// ─── Service ──────────────────────────────────────────────────────────────────

type NextStepService struct {
	db        *gorm.DB
	providers providers.ProviderController
}

func NewNextStepService(db *gorm.DB, pc providers.ProviderController) *NextStepService {
	return &NextStepService{db: db, providers: pc}
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const nextStepPrompt = `You are the lead penetration tester coordinating an ongoing engagement.

Below is everything that has been done and discovered so far on this flow (task and
subtask results — recon output, findings, exploited issues, tool runs).

Analyze the current state and predict the NEXT best steps: what the operator should
do now to make progress, given what is already known. Prioritize high-impact,
in-scope actions that build on confirmed findings. Do NOT repeat work already done.

Return ONLY a single valid JSON object (no markdown fences, no prose). Shape:
{
  "currentPhase": "the PTES phase the engagement is currently in (e.g. Recon, Mapping, Vulnerability Analysis, Exploitation, Post-Exploitation, Reporting)",
  "summary": "2-3 sentence summary of what has been established so far",
  "recommendations": [
    {
      "step": "concrete next action to take",
      "rationale": "why this is the right next step given the findings",
      "priority": "High | Medium | Low",
      "phase": "the phase this step belongs to",
      "command": "an example command or technique to run, if applicable, else empty string"
    }
  ],
  "caution": "any scope/safety caveat the operator must respect (else empty string)"
}

Give 3-5 recommendations, most important first. If there is little data yet, recommend
appropriate reconnaissance steps for the target.

ENGAGEMENT STATE:
%s`

// ─── Handler ────────────────────────────────────────────────────────────────

// PredictNextStep gathers a flow's task/subtask results and asks the LLM to
// recommend the next steps based on what has already been discovered.
//
// @Summary Predict the next pentest step for a flow using LLM
// @Tags nextstep
// @Produce json
// @Param flowID path int true "Flow ID"
// @Success 200 {object} NextStepResponse
// @Failure 400 {object} response.Error
// @Failure 500 {object} response.Error
// @Router /flows/{flowID}/nextstep [get]
func (s *NextStepService) PredictNextStep(c *gin.Context) {
	log := logger.FromContext(c)

	flowID, err := strconv.ParseInt(c.Param("flowID"), 10, 64)
	if err != nil {
		log.WithError(err).Error("invalid flowID")
		response.Error(c, response.ErrFlowsInvalidRequest, err)
		return
	}

	var tasks []findingsTaskRow
	if err := s.db.Raw(`
		SELECT t.id, t.title, COALESCE(t.result, '') AS result
		FROM tasks t
		INNER JOIN flows f ON t.flow_id = f.id
		WHERE t.flow_id = ? AND f.deleted_at IS NULL
		ORDER BY t.created_at ASC
	`, flowID).Scan(&tasks).Error; err != nil {
		log.WithError(err).Error("failed to query tasks")
		response.Error(c, response.ErrInternal, err)
		return
	}

	var subtasks []findingsSubtaskRow
	if err := s.db.Raw(`
		SELECT s.id, s.title, COALESCE(s.result, '') AS result, s.task_id
		FROM subtasks s
		INNER JOIN tasks t ON s.task_id = t.id
		WHERE t.flow_id = ?
		ORDER BY s.created_at ASC
	`, flowID).Scan(&subtasks).Error; err != nil {
		log.WithError(err).Error("failed to query subtasks")
		response.Error(c, response.ErrInternal, err)
		return
	}

	subsByTask := make(map[int64][]findingsSubtaskRow)
	for _, sub := range subtasks {
		subsByTask[sub.TaskID] = append(subsByTask[sub.TaskID], sub)
	}

	var sb strings.Builder
	for _, task := range tasks {
		subs := subsByTask[task.ID]
		if task.Result == "" && len(subs) == 0 {
			continue
		}
		fmt.Fprintf(&sb, "=== %s ===\n", task.Title)
		if task.Result != "" {
			sb.WriteString(task.Result)
			sb.WriteString("\n\n")
		}
		for _, sub := range subs {
			if sub.Result != "" {
				fmt.Fprintf(&sb, "--- %s ---\n%s\n\n", sub.Title, sub.Result)
			}
		}
	}

	stateText := sb.String()
	if strings.TrimSpace(stateText) == "" {
		stateText = "(No task results recorded yet — the engagement has just started.)"
	}
	if len(stateText) > 60000 {
		stateText = stateText[:60000] + "\n...[truncated]"
	}

	defaultProviders := s.providers.DefaultProviders()
	prv, err := defaultProviders.Preferred()
	if err != nil {
		log.Error("no LLM providers configured")
		response.Error(c, response.ErrInternal, fmt.Errorf("no LLM providers configured"))
		return
	}

	prompt := fmt.Sprintf(nextStepPrompt, stateText)
	result, err := prv.Call(context.WithoutCancel(c.Request.Context()), pconfig.OptionsTypeSimple, prompt)
	if err != nil {
		log.WithError(err).Error("LLM next-step prediction failed")
		response.Error(c, response.ErrInternal, fmt.Errorf("LLM call failed: %w", err))
		return
	}

	result = strings.TrimSpace(result)
	if start := strings.Index(result, "{"); start >= 0 {
		result = result[start:]
	}
	if end := strings.LastIndex(result, "}"); end >= 0 {
		result = result[:end+1]
	}

	var out NextStepResponse
	if err := json.Unmarshal([]byte(result), &out); err != nil {
		log.WithError(err).Errorf("failed to parse LLM JSON: %s", result)
		response.Error(c, response.ErrInternal, fmt.Errorf("LLM returned invalid JSON: %w", err))
		return
	}
	out.FlowID = flowID

	response.Success(c, http.StatusOK, out)
}
