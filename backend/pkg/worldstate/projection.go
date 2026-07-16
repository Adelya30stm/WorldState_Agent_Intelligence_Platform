package worldstate

import (
	"context"
	"fmt"
	"strings"

	"pentagi/pkg/database"
)

func BuildPlannerSnapshot(ctx context.Context, db database.Querier, flowID int64, transitionsLimit int64) string {
	if transitionsLimit <= 0 {
		transitionsLimit = 5
	}

	counts, err := db.CountWorldStateEntitiesByState(ctx, flowID)
	if err != nil {
		return ""
	}

	var total int64
	parts := make([]string, 0, len(counts))
	for _, c := range counts {
		total += c.Count
		parts = append(parts, fmt.Sprintf("%s:%d", c.State, c.Count))
	}
	if total == 0 {
		return "World State: no entities yet."
	}

	transitions, err := db.ListRecentWorldStateTransitionsByFlow(ctx, database.ListRecentWorldStateTransitionsByFlowParams{
		FlowID: flowID,
		Limit:  transitionsLimit,
	})
	if err != nil {
		return fmt.Sprintf("World State entities: { %s }", strings.Join(parts, ", "))
	}

	var b strings.Builder
	b.WriteString("Current environment state:\n")
	b.WriteString(fmt.Sprintf("Entities: { %s }\n", strings.Join(parts, ", ")))
	if len(transitions) == 0 {
		b.WriteString("Recent transitions: none")
		return b.String()
	}

	b.WriteString(fmt.Sprintf("Recent transitions (last %d):\n", len(transitions)))
	for _, t := range transitions {
		b.WriteString(fmt.Sprintf("- %s: %s -> %s by %s\n", t.EntityKey, t.FromState, t.ToState, t.Agent))
	}
	return strings.TrimSpace(b.String())
}
