-- name: GetWorldStateEntityByFlowAndKey :one
SELECT *
FROM world_state_entities
WHERE flow_id = $1 AND entity_key = $2;

-- name: CreateWorldStateEntity :one
INSERT INTO world_state_entities (
  flow_id, entity_key, type, state, properties
)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateWorldStateEntity :one
UPDATE world_state_entities
SET
  type = $2,
  state = $3,
  properties = $4,
  version = version + 1
WHERE id = $1
RETURNING *;

-- name: ListWorldStateEntities :many
SELECT *
FROM world_state_entities
WHERE flow_id = $1
  AND (sqlc.narg(type_filter)::text IS NULL OR type = sqlc.narg(type_filter)::text)
  AND (sqlc.narg(state_filter)::text IS NULL OR state = sqlc.narg(state_filter)::text)
ORDER BY updated_at DESC, id DESC;

-- name: CountWorldStateEntitiesByState :many
SELECT state, COUNT(*)::bigint AS count
FROM world_state_entities
WHERE flow_id = $1
GROUP BY state
ORDER BY state;

-- name: CreateWorldStateTransition :one
INSERT INTO world_state_transitions (
  entity_id, from_state, to_state, agent, evidence
)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListRecentWorldStateTransitionsByFlow :many
SELECT
  t.id,
  t.entity_id,
  e.entity_key,
  e.type,
  t.from_state,
  t.to_state,
  t.agent,
  t.evidence,
  t.created_at
FROM world_state_transitions t
JOIN world_state_entities e ON e.id = t.entity_id
WHERE e.flow_id = $1
ORDER BY t.created_at DESC, t.id DESC
LIMIT $2;
