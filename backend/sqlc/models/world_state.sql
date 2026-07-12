-- name: GetWorldStateEntityByID :one
SELECT *
FROM world_state_entities
WHERE id = $1;

-- name: GetWorldStateEntityByKey :one
SELECT *
FROM world_state_entities
WHERE flow_id = $1 AND entity_key = $2;

-- name: GetWorldStateEntitiesByFlow :many
SELECT *
FROM world_state_entities
WHERE flow_id = $1
ORDER BY updated_at DESC;

-- name: GetWorldStateLinksByFlow :many
SELECT *
FROM world_state_links
WHERE flow_id = $1
ORDER BY id ASC;

-- name: GetWorldStateTransitionsByFlow :many
SELECT
  t.id,
  t.entity_id,
  t.from_state,
  t.to_state,
  t.agent,
  t.evidence,
  t.created_at,
  e.entity_key,
  e.type AS entity_type
FROM world_state_transitions t
INNER JOIN world_state_entities e ON e.id = t.entity_id
WHERE e.flow_id = $1
ORDER BY t.created_at DESC
LIMIT $2;

-- name: GetWorldStateTransitionsByEntity :many
SELECT *
FROM world_state_transitions
WHERE entity_id = $1
ORDER BY created_at ASC;

-- name: UpsertWorldStateEntity :one
INSERT INTO world_state_entities (
  flow_id,
  entity_key,
  type,
  state,
  properties,
  annotations
) VALUES (
  $1, $2, $3, $4, $5, $6
)
ON CONFLICT (flow_id, entity_key) DO UPDATE SET
  properties = world_state_entities.properties || EXCLUDED.properties,
  annotations = CASE
    WHEN EXCLUDED.annotations = '[]'::jsonb THEN world_state_entities.annotations
    ELSE EXCLUDED.annotations
  END,
  updated_at = CURRENT_TIMESTAMP,
  version = world_state_entities.version + 1
RETURNING *;

-- name: UpdateWorldStateEntityState :one
UPDATE world_state_entities
SET
  state = $1,
  updated_at = CURRENT_TIMESTAMP,
  version = version + 1
WHERE id = $2
RETURNING *;

-- name: CreateWorldStateTransition :one
INSERT INTO world_state_transitions (
  entity_id,
  from_state,
  to_state,
  agent,
  evidence
) VALUES (
  $1, $2, $3, $4, $5
)
RETURNING *;

-- name: UpsertWorldStateLink :one
INSERT INTO world_state_links (
  flow_id,
  source_id,
  target_id,
  type,
  properties
) VALUES (
  $1, $2, $3, $4, $5
)
ON CONFLICT (flow_id, source_id, target_id, type) DO UPDATE SET
  properties = world_state_links.properties || EXCLUDED.properties
RETURNING *;
