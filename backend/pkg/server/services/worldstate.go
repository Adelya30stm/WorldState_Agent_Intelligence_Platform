package services

import (
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"pentagi/pkg/server/logger"
	"pentagi/pkg/server/models"
	"pentagi/pkg/server/response"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/gorm"
)

// ─── Response types ───────────────────────────────────────────────────────────

type worldStateEntity struct {
	ID               string            `json:"id"`
	Type             string            `json:"type"`
	Label            string            `json:"label"`
	Status           string            `json:"status,omitempty"`
	Metadata         map[string]string `json:"metadata"`
	RiskLevel        string            `json:"riskLevel"`
	AvailableActions []string          `json:"availableActions"`
}

type worldStateLink struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label,omitempty"`
	Type   string `json:"type"`
}

type worldStateResponse struct {
	Version   int                `json:"version"`
	FlowID    uint64             `json:"flowId"`
	UpdatedAt time.Time          `json:"updatedAt"`
	Entities  []worldStateEntity `json:"entities"`
	Links     []worldStateLink   `json:"links"`
}

// ─── Entity action definitions ────────────────────────────────────────────────

var entityActions = map[string][]string{
	"flow":     {"add-note"},
	"task":     {"add-note", "create-subflow"},
	"subtask":  {"add-note"},
	"tool":     {"add-note"},
	"domain":   {"safe-probe", "deep-scan", "enumerate-endpoints", "mark-high-priority", "add-note", "create-subflow"},
	"endpoint": {"safe-probe", "deep-scan", "mark-high-priority", "add-note", "create-subflow"},
	"finding":  {"mark-high-priority", "add-note", "create-subflow"},
}

// ─── Extraction helpers ───────────────────────────────────────────────────────

var (
	domainRE = regexp.MustCompile(`\b([a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+)\b`)
	ipv4RE   = regexp.MustCompile(`\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`)
	urlRE    = regexp.MustCompile(`https?://[^\s'"` + "`" + `,<>)]+`)
)

var noiseDomains = map[string]bool{
	"localhost": true, "example.com": true, "github.com": true,
	"npmjs.com": true, "docker.io": true, "golang.org": true,
	"pkg.go.dev": true, "ubuntu.com": true, "debian.org": true,
}

// Code method/attribute names that match the domain regex but are not real TLDs
var codeSuffixes = map[string]bool{
	"get": true, "set": true, "put": true, "delete": true, "post": true, "patch": true,
	"now": true, "utc": true, "parse": true, "format": true, "encode": true, "decode": true,
	"resolve": true, "resolver": true, "lookup": true, "query": true, "fetch": true,
	"insert": true, "append": true, "extend": true, "update": true, "remove": true,
	"open": true, "close": true, "read": true, "write": true, "load": true, "dump": true,
	"url": true, "path": true, "text": true, "json": true, "xml": true, "data": true,
	"status": true, "headers": true, "content": true, "body": true, "params": true,
	"error": true, "result": true, "response": true, "request": true, "handler": true,
	"method": true, "fields": true, "values": true, "items": true,
	"preference": true, "exchange": true, "gethostbyaddr": true, "getaddrinfo": true,
	"tool": true, "utils": true, "helper": true, "base": true, "core": true,
	"stdout": true, "stderr": true, "stdin": true,
}

func isLikelyCodeRef(candidate string) bool {
	parts := strings.Split(candidate, ".")
	tld := strings.ToLower(parts[len(parts)-1])
	// TLDs > 8 chars are almost certainly code identifiers
	if len(tld) > 8 {
		return true
	}
	// Known code method/attribute names
	if codeSuffixes[tld] {
		return true
	}
	// More than 3 dot-separated segments is usually code (e.g. dns.resolver.resolve)
	if len(parts) > 3 {
		return true
	}
	// Underscores never appear in valid hostnames
	if strings.Contains(candidate, "_") {
		return true
	}
	return false
}

var toolPatterns = []struct {
	name string
	re   *regexp.Regexp
	risk string
}{
	{"nmap", regexp.MustCompile(`\bnmap\b`), "high"},
	{"gobuster", regexp.MustCompile(`\bgobuster\b`), "medium"},
	{"ffuf", regexp.MustCompile(`\bffuf\b`), "medium"},
	{"sqlmap", regexp.MustCompile(`\bsqlmap\b`), "critical"},
	{"nikto", regexp.MustCompile(`\bnikto\b`), "high"},
	{"hydra", regexp.MustCompile(`\bhydra\b`), "critical"},
	{"metasploit", regexp.MustCompile(`msfconsole|msfvenom`), "critical"},
	{"nuclei", regexp.MustCompile(`\bnuclei\b`), "high"},
	{"amass", regexp.MustCompile(`\bamass\b`), "low"},
	{"httpx", regexp.MustCompile(`\bhttpx\b`), "low"},
	{"sublist3r", regexp.MustCompile(`\bsublist3r\b`), "low"},
	{"curl", regexp.MustCompile(`\bcurl\b`), "low"},
	{"wget", regexp.MustCompile(`\bwget\b`), "low"},
	{"wapiti", regexp.MustCompile(`\bwapiti\b`), "high"},
	{"dirsearch", regexp.MustCompile(`\bdirsearch\b`), "medium"},
}

func slugify(s string) string {
	re := regexp.MustCompile(`[^a-z0-9]+`)
	s = strings.ToLower(s)
	s = re.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > 64 {
		s = s[:64]
	}
	return s
}

func extractDomains(text string) []string {
	seen := map[string]bool{}
	var out []string

	for _, m := range domainRE.FindAllStringSubmatch(text, -1) {
		v := strings.ToLower(m[1])
		if !noiseDomains[v] && strings.Contains(v, ".") && !isLikelyCodeRef(v) && !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	for _, m := range ipv4RE.FindAllStringSubmatch(text, -1) {
		v := m[1]
		if !strings.HasPrefix(v, "127.") && !strings.HasPrefix(v, "0.") && !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	return out
}

func extractURLs(text string) []string {
	seen := map[string]bool{}
	var out []string
	for _, u := range urlRE.FindAllString(text, -1) {
		u = strings.TrimRight(u, ".,'\"`")
		if len(u) > 12 && !seen[u] {
			seen[u] = true
			out = append(out, u)
		}
	}
	return out
}

func detectTool(cmd string) (name, risk string) {
	for _, p := range toolPatterns {
		if p.re.MatchString(cmd) {
			return p.name, p.risk
		}
	}
	return "", ""
}

// ─── Service ──────────────────────────────────────────────────────────────────

type WorldStateService struct {
	db *gorm.DB
}

func NewWorldStateService(db *gorm.DB) *WorldStateService {
	return &WorldStateService{db: db}
}

// GetWorldState aggregates flow data into a normalized World State
// @Summary Get World State for a flow
// @Tags WorldState
// @Produce json
// @Security BearerAuth
// @Param flowID path int true "flow id" minimum(0)
// @Success 200 {object} response.successResp{data=worldStateResponse} "world state received successfully"
// @Failure 403 {object} response.errorResp "not permitted"
// @Failure 404 {object} response.errorResp "flow not found"
// @Failure 500 {object} response.errorResp "internal error"
// @Router /flows/{flowID}/worldstate [get]
func (s *WorldStateService) GetWorldState(c *gin.Context) {
	flowID, err := strconv.ParseUint(c.Param("flowID"), 10, 64)
	if err != nil {
		response.Error(c, response.ErrFlowsInvalidRequest, err)
		return
	}

	uid := c.GetUint64("uid")
	privs := c.GetStringSlice("prm")

	var flow models.Flow
	var scope func(db *gorm.DB) *gorm.DB
	if slices.Contains(privs, "flows.admin") {
		scope = func(db *gorm.DB) *gorm.DB { return db.Where("id = ?", flowID) }
	} else if slices.Contains(privs, "flows.view") {
		scope = func(db *gorm.DB) *gorm.DB { return db.Where("id = ? AND user_id = ?", flowID, uid) }
	} else {
		response.Error(c, response.ErrNotPermitted, nil)
		return
	}

	if err = s.db.Model(&flow).Scopes(scope).Take(&flow).Error; err != nil {
		if gorm.IsRecordNotFoundError(err) {
			response.Error(c, response.ErrFlowsNotFound, err)
		} else {
			response.Error(c, response.ErrInternal, err)
		}
		return
	}

	// Fetch tasks
	var tasks []models.Task
	if err = s.db.Where("flow_id = ?", flowID).Find(&tasks).Error; err != nil {
		logger.FromContext(c).WithError(err).Errorf("error fetching tasks for world state")
		response.Error(c, response.ErrInternal, err)
		return
	}

	// Fetch subtasks (join through tasks to scope by flowID)
	var subtasks []models.Subtask
	if err = s.db.
		Joins("INNER JOIN tasks t ON t.id = subtasks.task_id").
		Where("t.flow_id = ?", flowID).
		Find(&subtasks).Error; err != nil {
		logger.FromContext(c).WithError(err).Errorf("error fetching subtasks for world state")
		response.Error(c, response.ErrInternal, err)
		return
	}

	// Fetch stdin terminal logs
	var termlogs []models.Termlog
	if err = s.db.Where("flow_id = ? AND type = ?", flowID, models.TermlogTypeStdin).
		Limit(500).Find(&termlogs).Error; err != nil {
		logger.FromContext(c).WithError(err).Errorf("error fetching termlogs for world state")
		response.Error(c, response.ErrInternal, err)
		return
	}

	// ── Build world state ─────────────────────────────────────────────────────
	entities := []worldStateEntity{}
	links := []worldStateLink{}
	seenIDs := map[string]bool{}
	seenDomains := map[string]bool{}
	seenURLs := map[string]bool{}
	seenTools := map[string]bool{}

	addEntity := func(e worldStateEntity) {
		if !seenIDs[e.ID] {
			seenIDs[e.ID] = true
			entities = append(entities, e)
		}
	}

	// Flow entity
	flowEntityID := "flow-" + strconv.FormatUint(flowID, 10)
	addEntity(worldStateEntity{
		ID:               flowEntityID,
		Type:             "flow",
		Label:            flow.Title,
		Status:           string(flow.Status),
		Metadata:         map[string]string{"flowId": strconv.FormatUint(flowID, 10)},
		RiskLevel:        "none",
		AvailableActions: entityActions["flow"],
	})

	// Tasks
	for _, task := range tasks {
		taskID := "task-" + strconv.FormatUint(task.ID, 10)
		addEntity(worldStateEntity{
			ID:               taskID,
			Type:             "task",
			Label:            task.Title,
			Status:           string(task.Status),
			Metadata:         map[string]string{"taskId": strconv.FormatUint(task.ID, 10)},
			RiskLevel:        "none",
			AvailableActions: entityActions["task"],
		})
		links = append(links, worldStateLink{
			ID:     "fl-tk-" + strconv.FormatUint(task.ID, 10),
			Source: flowEntityID,
			Target: taskID,
			Type:   "contains",
		})
	}

	// Subtasks
	for _, st := range subtasks {
		stID := "subtask-" + strconv.FormatUint(st.ID, 10)
		parentID := "task-" + strconv.FormatUint(st.TaskID, 10)
		addEntity(worldStateEntity{
			ID:               stID,
			Type:             "subtask",
			Label:            st.Title,
			Status:           string(st.Status),
			Metadata:         map[string]string{"subtaskId": strconv.FormatUint(st.ID, 10)},
			RiskLevel:        "none",
			AvailableActions: entityActions["subtask"],
		})
		if seenIDs[parentID] {
			links = append(links, worldStateLink{
				ID:     "tk-st-" + strconv.FormatUint(st.ID, 10),
				Source: parentID,
				Target: stID,
				Type:   "contains",
			})
		}
	}

	// Terminal logs → tools + domains + endpoints
	for _, log := range termlogs {
		cmd := strings.TrimSpace(log.Text)
		if len(cmd) < 3 {
			continue
		}

		toolName, toolRisk := detectTool(cmd)
		var toolNodeID string
		if toolName != "" && !seenTools[toolName] {
			seenTools[toolName] = true
			toolNodeID = "tool-" + toolName
			addEntity(worldStateEntity{
				ID:               toolNodeID,
				Type:             "tool",
				Label:            toolName,
				Metadata:         map[string]string{"tool": toolName},
				RiskLevel:        toolRisk,
				AvailableActions: entityActions["tool"],
			})
		} else if toolName != "" {
			toolNodeID = "tool-" + toolName
		}

		for _, domain := range extractDomains(cmd) {
			if seenDomains[domain] {
				continue
			}
			seenDomains[domain] = true
			domID := "domain-" + slugify(domain)
			addEntity(worldStateEntity{
				ID:               domID,
				Type:             "domain",
				Label:            domain,
				Metadata:         map[string]string{"domain": domain},
				RiskLevel:        "medium",
				AvailableActions: entityActions["domain"],
			})
			if toolNodeID != "" {
				links = append(links, worldStateLink{
					ID:     "tl-dm-" + toolName + "-" + slugify(domain),
					Source: toolNodeID,
					Target: domID,
					Type:   "discovered",
				})
			}
		}

		for _, u := range extractURLs(cmd) {
			epID := "endpoint-" + slugify(u)
			if seenURLs[epID] {
				continue
			}
			seenURLs[epID] = true
			label := u
			if len(label) > 60 {
				label = label[:57] + "…"
			}
			addEntity(worldStateEntity{
				ID:               epID,
				Type:             "endpoint",
				Label:            label,
				Metadata:         map[string]string{"url": u},
				RiskLevel:        "medium",
				AvailableActions: entityActions["endpoint"],
			})
		}
	}

	resp := worldStateResponse{
		Version:   1,
		FlowID:    flowID,
		UpdatedAt: time.Now(),
		Entities:  entities,
		Links:     links,
	}

	response.Success(c, http.StatusOK, resp)
}
