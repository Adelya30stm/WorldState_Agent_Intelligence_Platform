package services

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"pentagi/pkg/graphiti"
	"pentagi/pkg/server/response"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/gorm"
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Response types ───────────────────────────────────────────────────────────

type attackPathNode struct {
	UUID string `json:"uuid"`
	Name string `json:"name"`
	Type string `json:"type"`
}

type attackPath struct {
	ID         string              `json:"id"`
	EntryPoint attackPathNode      `json:"entryPoint"`
	Target     attackPathNode      `json:"target"`
	Chain      []graphiti.EdgeResult `json:"chain"`
	RiskScore  float64             `json:"riskScore"`
	Steps      int                 `json:"steps"`
}

type attackPathsResponse struct {
	FlowID      uint64       `json:"flowId"`
	TotalPaths  int          `json:"totalPaths"`
	EntryPoints int          `json:"entryPoints"`
	Targets     int          `json:"targets"`
	Paths       []attackPath `json:"paths"`
}

// ─── Risk classification ──────────────────────────────────────────────────────

// riskNodeType returns a semantic type string for a graph node based on its
// labels and name, reusing the same keyword lists defined in worldstate.go.
func riskNodeType(labels []string, name string) string {
	combined := strings.ToLower(name + " " + strings.Join(labels, " "))
	if containsAny(combined, neo4jFindingKW) {
		return "vulnerability"
	}
	if containsAny(combined, neo4jEndpointKW) {
		return "endpoint"
	}
	if containsAny(combined, neo4jDomainKW) {
		return "host"
	}
	if containsAny(combined, neo4jToolKW) {
		return "service"
	}
	// Actor / credential heuristics not covered by existing keyword lists
	lowerName := strings.ToLower(name)
	if containsAny(lowerName, []string{"user", "actor", "attacker", "admin", "role", "account"}) {
		return "actor"
	}
	if containsAny(lowerName, []string{"data", "database", "credential", "secret", "key", "token", "password"}) {
		return "data"
	}
	return "unknown"
}

// ─── Service ──────────────────────────────────────────────────────────────────

// AttackPathService surfaces graph-based attack paths for a flow.
type AttackPathService struct {
	db      *gorm.DB
	graphiti graphitiSearcher
}

// NewAttackPathService constructs an AttackPathService. Both arguments may be
// nil (the handler returns a graceful empty response in that case).
func NewAttackPathService(db *gorm.DB, g graphitiSearcher) *AttackPathService {
	return &AttackPathService{db: db, graphiti: g}
}

// GetAttackPaths is the REST handler for GET /flows/:flowID/attackpaths.
//
// @Summary      Get attack paths for a flow
// @Tags         AttackPaths
// @Produce      json
// @Security     BearerAuth
// @Param        flowID path int true "flow id" minimum(0)
// @Success      200 {object} response.successResp{data=attackPathsResponse} "attack paths retrieved successfully"
// @Failure      400 {object} response.errorResp "invalid request"
// @Failure      500 {object} response.errorResp "internal error"
// @Router       /flows/{flowID}/attackpaths [get]
func (s *AttackPathService) GetAttackPaths(c *gin.Context) {
	flowID, err := strconv.ParseUint(c.Param("flowID"), 10, 64)
	if err != nil {
		response.Error(c, response.ErrFlowsInvalidRequest, err)
		return
	}

	// Return an empty result set if graphiti is unavailable.
	if s.graphiti == nil || !s.graphiti.IsEnabled() {
		response.Success(c, http.StatusOK, attackPathsResponse{
			FlowID:      flowID,
			TotalPaths:  0,
			EntryPoints: 0,
			Targets:     0,
			Paths:       []attackPath{},
		})
		return
	}

	groupID := fmt.Sprintf("flow-%d", flowID)
	ctx := c.Request.Context()

	// ── 3a. Entry point search ────────────────────────────────────────────────
	entryResp, err := s.graphiti.EntityByLabelSearch(ctx, graphiti.EntityByLabelSearchRequest{
		Query:      "external exposure internet-facing public endpoint login",
		GroupID:    &groupID,
		NodeLabels: []string{"Entity"},
		MaxResults: 30,
	})
	if err != nil {
		response.Error(c, response.ErrInternal, err)
		return
	}

	// ── 3b. Target search ─────────────────────────────────────────────────────
	targetResp, err := s.graphiti.EntityByLabelSearch(ctx, graphiti.EntityByLabelSearchRequest{
		Query:      "credentials database sensitive data critical asset high value",
		GroupID:    &groupID,
		NodeLabels: []string{"Entity"},
		MaxResults: 30,
	})
	if err != nil {
		response.Error(c, response.ErrInternal, err)
		return
	}

	// Index targets by UUID for fast lookup.
	targetIndex := make(map[string]graphiti.NodeResult, len(targetResp.Nodes))
	for _, n := range targetResp.Nodes {
		targetIndex[n.UUID] = n
	}

	// ── 4–6. Build attack paths ───────────────────────────────────────────────
	var paths []attackPath

	for _, ep := range entryResp.Nodes {
		relResp, err := s.graphiti.EntityRelationshipsSearch(ctx, graphiti.EntityRelationshipSearchRequest{
			Query:          "attack path exploitation chain",
			GroupID:        &groupID,
			MaxResults:     20,
			MaxDepth:       3,
			CenterNodeUUID: ep.UUID,
		})
		if err != nil {
			// Skip this entry point on error rather than aborting entirely.
			continue
		}

		// Collect all nodes returned by the relationship search.
		reachableTargets := make(map[string]graphiti.NodeResult)
		for _, n := range relResp.Nodes {
			if _, isTarget := targetIndex[n.UUID]; isTarget {
				reachableTargets[n.UUID] = n
			}
		}

		// Build one path per reachable target.
		for targetUUID, targetNode := range reachableTargets {
			// Gather edges that connect the entry point to this target (best-effort
			// using the edges already returned by the relationship search).
			var chain []graphiti.EdgeResult
			for _, edge := range relResp.Edges {
				chain = append(chain, edge)
			}

			score := computeRiskScore(ep.Name, chain)

			paths = append(paths, attackPath{
				ID:         fmt.Sprintf("ap-%s-%s", ep.UUID, targetUUID),
				EntryPoint: attackPathNode{UUID: ep.UUID, Name: ep.Name, Type: riskNodeType(ep.Labels, ep.Name)},
				Target:     attackPathNode{UUID: targetNode.UUID, Name: targetNode.Name, Type: riskNodeType(targetNode.Labels, targetNode.Name)},
				Chain:      chain,
				RiskScore:  score,
				Steps:      len(chain),
			})
		}
	}

	// ── 7. Sort by risk score descending ─────────────────────────────────────
	sort.Slice(paths, func(i, j int) bool {
		return paths[i].RiskScore > paths[j].RiskScore
	})

	// ── 8. Build and return response ──────────────────────────────────────────
	resp := attackPathsResponse{
		FlowID:      flowID,
		TotalPaths:  len(paths),
		EntryPoints: len(entryResp.Nodes),
		Targets:     len(targetResp.Nodes),
		Paths:       paths,
	}
	if resp.Paths == nil {
		resp.Paths = []attackPath{}
	}

	response.Success(c, http.StatusOK, resp)
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

var riskEdgeKW = []string{"vulnerability", "exploit", "injection"}

// computeRiskScore returns a score in [0, 10].
//   - Base: 5.0
//   - +2.0 if the entry-point name contains "login", "auth", or "admin"
//   - +1.0 per edge whose Fact contains a risk keyword (vulnerability/exploit/injection)
//   - Capped at 10.0
func computeRiskScore(entryName string, chain []graphiti.EdgeResult) float64 {
	score := 5.0

	lowerEntry := strings.ToLower(entryName)
	if strings.Contains(lowerEntry, "login") ||
		strings.Contains(lowerEntry, "auth") ||
		strings.Contains(lowerEntry, "admin") {
		score += 2.0
	}

	for _, edge := range chain {
		if containsAny(strings.ToLower(edge.Fact), riskEdgeKW) {
			score += 1.0
		}
	}

	if score > 10.0 {
		score = 10.0
	}
	return score
}
