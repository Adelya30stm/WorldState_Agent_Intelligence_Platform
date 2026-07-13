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

// ─── Response types ───────────────────────────────────────────────────────────

type ExtractedFinding struct {
	Title       string `json:"title"`
	Severity    string `json:"severity"`
	Target      string `json:"target"`
	Description string `json:"description"`
	CVE         string `json:"cve"`
	Remediation string `json:"remediation"`
	Phase       string `json:"phase"`
}

type FindingsExtractResponse struct {
	FlowID   int64              `json:"flow_id"`
	Findings []ExtractedFinding `json:"findings"`
}

// ─── Service ──────────────────────────────────────────────────────────────────

type FindingsExtractService struct {
	db        *gorm.DB
	providers providers.ProviderController
}

func NewFindingsExtractService(db *gorm.DB, pc providers.ProviderController) *FindingsExtractService {
	return &FindingsExtractService{db: db, providers: pc}
}

// ─── DB row types ─────────────────────────────────────────────────────────────

type findingsTaskRow struct {
	ID     int64  `gorm:"column:id"`
	Title  string `gorm:"column:title"`
	Result string `gorm:"column:result"`
}

type findingsSubtaskRow struct {
	ID     int64  `gorm:"column:id"`
	Title  string `gorm:"column:title"`
	Result string `gorm:"column:result"`
	TaskID int64  `gorm:"column:task_id"`
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const findingsExtractionPrompt = `You are a senior penetration tester writing a security findings report.

Analyze the raw pentest output below and extract ALL security-relevant findings about the TARGET SYSTEMS.

INCLUDE these as findings (these are real security issues):
- Outdated or end-of-life software versions on target hosts (e.g. "OpenSSH 7.2p2", "MySQL 5.7.31", "PHP 7.2.24" — treat any EOL/outdated version as High or Critical)
- Exposed sensitive ports accessible from the Internet (SSH/22, RDP/3389, MySQL/3306, SMB/445, Telnet/23, etc.)
- Weak TLS/SSL configuration, self-signed certificates, or missing HTTPS
- Missing security headers (CSP, HSTS, X-Frame-Options, etc.)
- Misconfigured DNS/email (SPF "~all" or missing, missing DMARC/DKIM)
- Open redirects, injection flaws, authentication weaknesses
- Information disclosure (server banners, version strings, directory listings)
- Subdomains pointing to internal/private IPs (potential SSRF)
- Any CVE-linked vulnerabilities for identified software versions

DO NOT include:
- Tool execution errors, pipeline failures, or missing tool artifacts
- Pentest process observations ("nmap failed", "diagram rendering failed")
- Issues with the pentest infrastructure itself

For version-based findings: use your knowledge of CVEs and EOL dates to assign severity and list relevant CVEs.
For each exposed port: assess whether external Internet exposure is a risk given the service type.

Return ONLY a valid JSON array (no markdown, no explanation). Each element:
{
  "title":       "concise vulnerability name (e.g. End-of-Life OpenSSH 7.2p2 on 51.250.11.251)",
  "severity":    "Critical|High|Medium|Low|Info",
  "target":      "host:port or URL where found (e.g. 51.250.11.251:22)",
  "description": "what the vulnerability is and why it matters",
  "cve":         "CVE-XXXX-XXXXX if applicable, else empty string",
  "remediation": "specific fix recommendation",
  "phase":       "Recon|Mapping|Testing|Validation|Attack Paths|Reporting"
}

If the output contains no information about target systems at all, return [].

PENTEST OUTPUT:
%s`

// ExtractFindings calls the configured LLM to extract structured findings from a flow's task results.
//
// @Summary Extract security findings from a flow using LLM
// @Tags findings
// @Produce json
// @Param flowID path int true "Flow ID"
// @Success 200 {object} FindingsExtractResponse
// @Failure 400 {object} response.Error
// @Failure 500 {object} response.Error
// @Router /flows/{flowID}/extract-findings [get]
func (s *FindingsExtractService) ExtractFindings(c *gin.Context) {
	log := logger.FromContext(c)

	flowIDStr := c.Param("flowID")
	flowID, err := strconv.ParseInt(flowIDStr, 10, 64)
	if err != nil {
		log.WithError(err).Error("invalid flowID")
		response.Error(c, response.ErrFlowsInvalidRequest, err)
		return
	}

	// Load tasks
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

	if len(tasks) == 0 {
		response.Success(c, http.StatusOK, FindingsExtractResponse{
			FlowID:   flowID,
			Findings: []ExtractedFinding{},
		})
		return
	}

	// Load subtasks
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

	// Group subtasks by task
	subsByTask := make(map[int64][]findingsSubtaskRow)
	for _, sub := range subtasks {
		subsByTask[sub.TaskID] = append(subsByTask[sub.TaskID], sub)
	}

	// Build condensed report text
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

	reportText := sb.String()
	if len(reportText) == 0 {
		response.Success(c, http.StatusOK, FindingsExtractResponse{
			FlowID:   flowID,
			Findings: []ExtractedFinding{},
		})
		return
	}
	// Truncate to avoid exceeding context limits
	if len(reportText) > 80000 {
		reportText = reportText[:80000] + "\n...[truncated]"
	}

	// Prefer OpenAI; fall back to any other configured provider
	defaultProviders := s.providers.DefaultProviders()
	prv, err := defaultProviders.Preferred()
	if err != nil {
		log.Error("no LLM providers configured")
		response.Success(c, http.StatusOK, FindingsExtractResponse{
			FlowID:   flowID,
			Findings: []ExtractedFinding{},
		})
		return
	}

	// Call LLM
	prompt := fmt.Sprintf(findingsExtractionPrompt, reportText)
	result, err := prv.Call(context.WithoutCancel(c.Request.Context()), pconfig.OptionsTypeSimple, prompt)
	if err != nil {
		log.WithError(err).Error("LLM extraction failed")
		response.Error(c, response.ErrInternal, fmt.Errorf("LLM call failed: %w", err))
		return
	}

	// Strip markdown fences if present, then extract JSON array
	result = strings.TrimSpace(result)
	if start := strings.Index(result, "["); start >= 0 {
		result = result[start:]
	}
	if end := strings.LastIndex(result, "]"); end >= 0 {
		result = result[:end+1]
	}

	log.Infof("LLM raw response for flow %d (len=%d): %s", flowID, len(result), result)

	var findings []ExtractedFinding
	if err := json.Unmarshal([]byte(result), &findings); err != nil {
		log.WithError(err).Errorf("failed to parse LLM JSON: %s", result)
		response.Error(c, response.ErrInternal, fmt.Errorf("LLM returned invalid JSON: %w", err))
		return
	}

	log.Infof("extracted %d findings for flow %d", len(findings), flowID)

	response.Success(c, http.StatusOK, FindingsExtractResponse{
		FlowID:   flowID,
		Findings: findings,
	})
}
