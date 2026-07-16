package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

type WorldStateEntity struct {
	ID         int64           `json:"id"`
	FlowID     int64           `json:"flow_id"`
	EntityKey  string          `json:"entity_key"`
	Type       string          `json:"type"`
	State      string          `json:"state"`
	Properties json.RawMessage `json:"properties"`
	Version    int32           `json:"version"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type WorldStateTransition struct {
	ID        int64           `json:"id"`
	EntityID  int64           `json:"entity_id"`
	FromState string          `json:"from_state"`
	ToState   string          `json:"to_state"`
	Agent     string          `json:"agent"`
	Evidence  json.RawMessage `json:"evidence"`
	CreatedAt time.Time       `json:"created_at"`
}

type GetWorldStateEntityByFlowAndKeyParams struct {
	FlowID    int64  `json:"flow_id"`
	EntityKey string `json:"entity_key"`
}

type CreateWorldStateEntityParams struct {
	FlowID     int64           `json:"flow_id"`
	EntityKey  string          `json:"entity_key"`
	Type       string          `json:"type"`
	State      string          `json:"state"`
	Properties json.RawMessage `json:"properties"`
}

type UpdateWorldStateEntityParams struct {
	ID         int64           `json:"id"`
	Type       string          `json:"type"`
	State      string          `json:"state"`
	Properties json.RawMessage `json:"properties"`
}

type ListWorldStateEntitiesParams struct {
	FlowID      int64          `json:"flow_id"`
	TypeFilter  sql.NullString `json:"type_filter"`
	StateFilter sql.NullString `json:"state_filter"`
}

type CountWorldStateEntitiesByStateRow struct {
	State string `json:"state"`
	Count int64  `json:"count"`
}

type CreateWorldStateTransitionParams struct {
	EntityID  int64           `json:"entity_id"`
	FromState string          `json:"from_state"`
	ToState   string          `json:"to_state"`
	Agent     string          `json:"agent"`
	Evidence  json.RawMessage `json:"evidence"`
}

type ListRecentWorldStateTransitionsByFlowParams struct {
	FlowID int64 `json:"flow_id"`
	Limit  int64 `json:"limit"`
}

type ListRecentWorldStateTransitionsByFlowRow struct {
	ID        int64           `json:"id"`
	EntityID  int64           `json:"entity_id"`
	EntityKey string          `json:"entity_key"`
	Type      string          `json:"type"`
	FromState string          `json:"from_state"`
	ToState   string          `json:"to_state"`
	Agent     string          `json:"agent"`
	Evidence  json.RawMessage `json:"evidence"`
	CreatedAt time.Time       `json:"created_at"`
}

func scanWorldStateEntity(row interface {
	Scan(dest ...any) error
}) (WorldStateEntity, error) {
	var e WorldStateEntity
	err := row.Scan(
		&e.ID, &e.FlowID, &e.EntityKey, &e.Type, &e.State, &e.Properties, &e.Version, &e.CreatedAt, &e.UpdatedAt,
	)
	return e, err
}

func (q *Queries) GetWorldStateEntityByFlowAndKey(ctx context.Context, arg GetWorldStateEntityByFlowAndKeyParams) (WorldStateEntity, error) {
	row := q.db.QueryRowContext(ctx, `
SELECT id, flow_id, entity_key, type, state, properties, version, created_at, updated_at
FROM world_state_entities
WHERE flow_id = $1 AND entity_key = $2
`, arg.FlowID, arg.EntityKey)
	return scanWorldStateEntity(row)
}

func (q *Queries) CreateWorldStateEntity(ctx context.Context, arg CreateWorldStateEntityParams) (WorldStateEntity, error) {
	row := q.db.QueryRowContext(ctx, `
INSERT INTO world_state_entities (flow_id, entity_key, type, state, properties)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, flow_id, entity_key, type, state, properties, version, created_at, updated_at
`, arg.FlowID, arg.EntityKey, arg.Type, arg.State, arg.Properties)
	return scanWorldStateEntity(row)
}

func (q *Queries) UpdateWorldStateEntity(ctx context.Context, arg UpdateWorldStateEntityParams) (WorldStateEntity, error) {
	row := q.db.QueryRowContext(ctx, `
UPDATE world_state_entities
SET type = $2, state = $3, properties = $4, version = version + 1
WHERE id = $1
RETURNING id, flow_id, entity_key, type, state, properties, version, created_at, updated_at
`, arg.ID, arg.Type, arg.State, arg.Properties)
	return scanWorldStateEntity(row)
}

func (q *Queries) ListWorldStateEntities(ctx context.Context, arg ListWorldStateEntitiesParams) ([]WorldStateEntity, error) {
	rows, err := q.db.QueryContext(ctx, `
SELECT id, flow_id, entity_key, type, state, properties, version, created_at, updated_at
FROM world_state_entities
WHERE flow_id = $1
  AND ($2::text IS NULL OR type = $2::text)
  AND ($3::text IS NULL OR state = $3::text)
ORDER BY updated_at DESC, id DESC
`, arg.FlowID, arg.TypeFilter, arg.StateFilter)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []WorldStateEntity
	for rows.Next() {
		e, scanErr := scanWorldStateEntity(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		items = append(items, e)
	}
	return items, rows.Err()
}

func (q *Queries) CountWorldStateEntitiesByState(ctx context.Context, flowID int64) ([]CountWorldStateEntitiesByStateRow, error) {
	rows, err := q.db.QueryContext(ctx, `
SELECT state, COUNT(*)::bigint AS count
FROM world_state_entities
WHERE flow_id = $1
GROUP BY state
ORDER BY state
`, flowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []CountWorldStateEntitiesByStateRow
	for rows.Next() {
		var r CountWorldStateEntitiesByStateRow
		if scanErr := rows.Scan(&r.State, &r.Count); scanErr != nil {
			return nil, scanErr
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (q *Queries) CreateWorldStateTransition(ctx context.Context, arg CreateWorldStateTransitionParams) (WorldStateTransition, error) {
	row := q.db.QueryRowContext(ctx, `
INSERT INTO world_state_transitions (entity_id, from_state, to_state, agent, evidence)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, entity_id, from_state, to_state, agent, evidence, created_at
`, arg.EntityID, arg.FromState, arg.ToState, arg.Agent, arg.Evidence)

	var t WorldStateTransition
	if err := row.Scan(&t.ID, &t.EntityID, &t.FromState, &t.ToState, &t.Agent, &t.Evidence, &t.CreatedAt); err != nil {
		return WorldStateTransition{}, err
	}
	return t, nil
}

func (q *Queries) ListRecentWorldStateTransitionsByFlow(ctx context.Context, arg ListRecentWorldStateTransitionsByFlowParams) ([]ListRecentWorldStateTransitionsByFlowRow, error) {
	if arg.Limit <= 0 {
		return nil, fmt.Errorf("limit must be > 0")
	}
	rows, err := q.db.QueryContext(ctx, `
SELECT t.id, t.entity_id, e.entity_key, e.type, t.from_state, t.to_state, t.agent, t.evidence, t.created_at
FROM world_state_transitions t
JOIN world_state_entities e ON e.id = t.entity_id
WHERE e.flow_id = $1
ORDER BY t.created_at DESC, t.id DESC
LIMIT $2
`, arg.FlowID, arg.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ListRecentWorldStateTransitionsByFlowRow
	for rows.Next() {
		var r ListRecentWorldStateTransitionsByFlowRow
		if scanErr := rows.Scan(
			&r.ID, &r.EntityID, &r.EntityKey, &r.Type, &r.FromState, &r.ToState, &r.Agent, &r.Evidence, &r.CreatedAt,
		); scanErr != nil {
			return nil, scanErr
		}
		items = append(items, r)
	}
	return items, rows.Err()
}
