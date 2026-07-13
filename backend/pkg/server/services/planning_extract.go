package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"pentagi/pkg/providers"
	"pentagi/pkg/providers/pconfig"
	"pentagi/pkg/server/logger"
	"pentagi/pkg/server/response"

	"github.com/gin-gonic/gin"
)

// ─── LLM-tolerant JSON types ────────────────────────────────────────────────────
//
// LLM output drifts: a field documented as a string sometimes comes back as an
// array (e.g. "cookies": []) and vice-versa. flexString / flexStringSlice coerce
// either shape so a single field-type mismatch can't fail the whole extraction.
// They marshal back to plain string / array, so the frontend contract is unchanged.

type flexString string

func (f *flexString) UnmarshalJSON(b []byte) error {
	b = bytes.TrimSpace(b)
	if len(b) == 0 || string(b) == "null" {
		*f = ""
		return nil
	}
	switch b[0] {
	case '"':
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		*f = flexString(s)
	case '[':
		var arr []any
		if err := json.Unmarshal(b, &arr); err == nil {
			parts := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok && s != "" {
					parts = append(parts, s)
				}
			}
			*f = flexString(strings.Join(parts, "; "))
		}
	default:
		// number / bool / object — keep the raw token as a string
		*f = flexString(strings.Trim(string(b), `"`))
	}
	return nil
}

type flexBool bool

func (f *flexBool) UnmarshalJSON(b []byte) error {
	b = bytes.TrimSpace(b)
	if len(b) == 0 || string(b) == "null" {
		*f = false
		return nil
	}
	switch string(b) {
	case "true", "1":
		*f = true
	case "false", "0":
		*f = false
	default:
		// handle quoted strings: "true", "false", "yes", "no"
		var s string
		if err := json.Unmarshal(b, &s); err == nil {
			switch strings.ToLower(strings.TrimSpace(s)) {
			case "true", "yes", "1":
				*f = true
			default:
				*f = false
			}
			return nil
		}
		*f = false
	}
	return nil
}

func (f flexBool) MarshalJSON() ([]byte, error) {
	if f {
		return []byte("true"), nil
	}
	return []byte("false"), nil
}

type flexStringSlice []string

func (f *flexStringSlice) UnmarshalJSON(b []byte) error {
	b = bytes.TrimSpace(b)
	if len(b) == 0 || string(b) == "null" {
		*f = nil
		return nil
	}
	if b[0] == '[' {
		var arr []string
		if err := json.Unmarshal(b, &arr); err != nil {
			// tolerate arrays of mixed types
			var raw []any
			if err2 := json.Unmarshal(b, &raw); err2 != nil {
				return err
			}
			for _, v := range raw {
				if s, ok := v.(string); ok && s != "" {
					arr = append(arr, s)
				}
			}
		}
		*f = arr
		return nil
	}
	// a single string -> one-element slice (split on commas if present)
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		*f = nil
		return nil
	}
	s = strings.TrimSpace(s)
	if s == "" {
		*f = nil
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	*f = out
	return nil
}

// ─── Request / response types ───────────────────────────────────────────────────

type PlanningExtractRequest struct {
	Text string `json:"text"`
}

type extractedScopeItem struct {
	Value       flexString `json:"value"`
	AssetType   flexString `json:"assetType"`
	Environment flexString `json:"environment"`
	Exposure    flexString `json:"exposure"`
	Criticality flexString `json:"criticality"`
	Owner       flexString `json:"owner"`
	Notes       flexString `json:"notes"`
}

type extractedAssetItem struct {
	Name        flexString `json:"name"`
	Type        flexString `json:"type"`
	Identifier  flexString `json:"identifier"`
	Environment flexString `json:"environment"`
	Owner       flexString `json:"owner"`
	DataClass   flexString `json:"dataClass"`
	Criticality flexString `json:"criticality"`
	InScope     flexBool   `json:"inScope"`
	Notes       flexString `json:"notes"`
}

// PlanningExtractResponse mirrors the mergeable subset of the frontend PlanState.
// Field JSON tags match the frontend field names so the UI can merge directly.
type PlanningExtractResponse struct {
	Name                   flexString           `json:"name"`
	Client                 flexString           `json:"client"`
	AssessmentType         flexString           `json:"assessmentType"`
	EngagementModel        flexString           `json:"engagementModel"`
	StartDate              flexString           `json:"startDate"`
	EndDate                flexString           `json:"endDate"`
	PrimaryContact         flexString           `json:"primaryContact"`
	EmergencyContact       flexString           `json:"emergencyContact"`
	TestingWindow          flexString           `json:"testingWindow"`
	AllowedCategories      flexStringSlice      `json:"allowedCategories"`
	ProhibitedActivities   flexStringSlice      `json:"prohibitedActivities"`
	RateLimit              flexString           `json:"rateLimit"`
	SensitiveExclusions    flexString           `json:"sensitiveExclusions"`
	StopConditions         flexString           `json:"stopConditions"`
	EscalationProcess      flexString           `json:"escalationProcess"`
	EvidenceHandling       flexString           `json:"evidenceHandling"`
	DataHandling           flexString           `json:"dataHandling"`
	ReportingExpectations  flexString           `json:"reportingExpectations"`
	Frameworks             flexStringSlice      `json:"frameworks"`
	BusinessCriticalAssets flexString           `json:"businessCriticalAssets"`
	HighRiskRoles          flexString           `json:"highRiskRoles"`
	TrustBoundaries        flexString           `json:"trustBoundaries"`
	AuthFlows              flexString           `json:"authFlows"`
	ExternalIntegrations   flexString           `json:"externalIntegrations"`
	SensitiveDataTypes     flexString           `json:"sensitiveDataTypes"`
	KnownConcerns          flexString           `json:"knownConcerns"`
	Assumptions            flexString           `json:"assumptions"`
	Constraints            flexString           `json:"constraints"`
	CredAccounts           flexString           `json:"credAccounts"`
	CredRoles              flexString           `json:"credRoles"`
	CredAccessLimits       flexString           `json:"credAccessLimits"`
	Cookies                flexString           `json:"cookies"`
	Scope                  []extractedScopeItem `json:"scope"`
	Assets                 []extractedAssetItem `json:"assets"`
}

// ─── Service ──────────────────────────────────────────────────────────────────

type PlanningExtractService struct {
	providers providers.ProviderController
}

func NewPlanningExtractService(pc providers.ProviderController) *PlanningExtractService {
	return &PlanningExtractService{providers: pc}
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const planningExtractionPrompt = `You are a senior penetration testing lead preparing an engagement plan.

Read the free-form text below (it may be an engagement brief, an email, a statement
of work, a scope document, or informal notes) and extract every detail that maps to
a structured penetration test planning form.

Return ONLY a single valid JSON object (no markdown fences, no explanation). Use this
exact shape. Leave a string empty ("") or an array empty ([]) when the text gives no
information for that field — DO NOT invent data.

{
  "name": "engagement name/title",
  "client": "client or organization name",
  "assessmentType": "one of: Web Application Pentest | Network Pentest | Cloud Security Assessment | API Security Assessment | Mobile App Assessment | External Attack Surface Review | Internal Security Assessment",
  "engagementModel": "one of: blackbox | greybox | whitebox",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "primaryContact": "name — email",
  "emergencyContact": "name / phone",
  "testingWindow": "one of: Business hours only (Mon–Fri 09:00–18:00) | After-hours only (Mon–Fri 18:00–09:00) | 24/7 allowed | Custom schedule",
  "allowedCategories": ["subset of: Reconnaissance, Vulnerability validation, Authenticated testing, API testing, Cloud configuration review, Source-assisted review"],
  "prohibitedActivities": ["subset of: Denial of Service, Phishing, Social engineering, Malware deployment, Persistence, Lateral movement, Data exfiltration, Destructive actions"],
  "rateLimit": "any rate limiting / throttling constraints",
  "sensitiveExclusions": "sensitive systems excluded from testing",
  "stopConditions": "conditions that require stopping the test",
  "escalationProcess": "emergency escalation process",
  "evidenceHandling": "how evidence is handled/stored",
  "dataHandling": "how discovered data is handled",
  "reportingExpectations": "reporting format and deadlines",
  "frameworks": ["subset of: STRIDE, MITRE ATT&CK mapping, OWASP Top 10, OWASP API Top 10, Cloud threat model, Custom model"],
  "businessCriticalAssets": "business-critical assets",
  "highRiskRoles": "high-risk user roles",
  "trustBoundaries": "trust boundaries",
  "authFlows": "authentication flows",
  "externalIntegrations": "external integrations",
  "sensitiveDataTypes": "sensitive data types (PII, PHI, PCI, etc.)",
  "knownConcerns": "known prior security concerns",
  "assumptions": "assumptions",
  "constraints": "constraints/limitations",
  "credAccounts": "test accounts/credentials provided",
  "credRoles": "role coverage for provided accounts",
  "credAccessLimits": "access limitations for provided accounts",
  "cookies": "any session cookies or auth tokens quoted in the text (e.g. name=value; name2=value2), else empty",
  "scope": [
    {
      "value": "the in-scope asset (domain, IP, CIDR, URL, API, cloud account)",
      "assetType": "one of: Domain | Subdomain | IP Address | CIDR Range | Web Application URL | API Endpoint | Cloud Account | Kubernetes Cluster | Mobile Application | Repository | Third-party Integration",
      "environment": "one of: Production | Staging | Development | Test",
      "exposure": "one of: External | Internal | VPN-only",
      "criticality": "one of: Low | Medium | High | Critical",
      "owner": "owning team/person if stated",
      "notes": "any note"
    }
  ],
  "assets": [
    {
      "name": "asset name",
      "type": "one of: Web Application | API | Server | Database | Cloud Resource | Container / Kubernetes | Identity Provider | CI/CD System | Repository | Third-party Service",
      "identifier": "URL / IP / identifier",
      "environment": "one of: Production | Staging | Development | Test",
      "owner": "owning team",
      "dataClass": "one of: Public | Internal | Confidential | Restricted",
      "criticality": "one of: Low | Medium | High | Critical",
      "inScope": true,
      "notes": "any note"
    }
  ]
}

Rules:
- Values for enum fields MUST be copied verbatim from the allowed options above.
- Every domain, subdomain, IP, CIDR, URL or API endpoint mentioned as a target belongs in "scope".
- If the engagement model is not stated, infer conservatively: no credentials mentioned -> "blackbox"; some test accounts -> "greybox"; source code/architecture docs provided -> "whitebox".
- Return the JSON object only.

TEXT:
%s`

// ─── Handler ────────────────────────────────────────────────────────────────

// ExtractPlanning calls the configured LLM to extract a structured engagement
// plan from free-form pasted text.
//
// @Summary Extract a structured engagement plan from free-form text using LLM
// @Tags planning
// @Accept json
// @Produce json
// @Param request body PlanningExtractRequest true "Free-form text to parse"
// @Success 200 {object} PlanningExtractResponse
// @Failure 400 {object} response.Error
// @Failure 500 {object} response.Error
// @Router /planning/extract [post]
func (s *PlanningExtractService) ExtractPlanning(c *gin.Context) {
	log := logger.FromContext(c)

	var req PlanningExtractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.WithError(err).Error("invalid planning extract request")
		response.Error(c, response.ErrPlanningInvalidRequest, err)
		return
	}

	text := strings.TrimSpace(req.Text)
	if text == "" {
		response.Error(c, response.ErrPlanningInvalidRequest, fmt.Errorf("text is empty"))
		return
	}
	// Truncate to avoid exceeding context limits
	if len(text) > 80000 {
		text = text[:80000] + "\n...[truncated]"
	}

	// Prefer OpenAI; fall back to any other configured provider
	defaultProviders := s.providers.DefaultProviders()
	prv, err := defaultProviders.Preferred()
	if err != nil {
		log.Error("no LLM providers configured")
		response.Error(c, response.ErrInternal, fmt.Errorf("no LLM providers configured"))
		return
	}

	// Call LLM
	prompt := fmt.Sprintf(planningExtractionPrompt, text)
	result, err := prv.Call(context.WithoutCancel(c.Request.Context()), pconfig.OptionsTypeSimple, prompt)
	if err != nil {
		log.WithError(err).Error("LLM planning extraction failed")
		response.Error(c, response.ErrInternal, fmt.Errorf("LLM call failed: %w", err))
		return
	}

	// Strip markdown fences if present, then isolate the JSON object
	result = strings.TrimSpace(result)
	if start := strings.Index(result, "{"); start >= 0 {
		result = result[start:]
	}
	if end := strings.LastIndex(result, "}"); end >= 0 {
		result = result[:end+1]
	}

	var plan PlanningExtractResponse
	if err := json.Unmarshal([]byte(result), &plan); err != nil {
		log.WithError(err).Errorf("failed to parse LLM JSON: %s", result)
		response.Error(c, response.ErrInternal, fmt.Errorf("LLM returned invalid JSON: %w", err))
		return
	}

	response.Success(c, http.StatusOK, plan)
}
