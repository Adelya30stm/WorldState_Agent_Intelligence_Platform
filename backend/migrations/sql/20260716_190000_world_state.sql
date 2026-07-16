-- +goose Up
-- +goose StatementBegin
CREATE TABLE world_state_entities (
  id BIGSERIAL PRIMARY KEY,
  flow_id BIGINT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  entity_key TEXT NOT NULL,
  type TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'unknown',
  properties JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (flow_id, entity_key)
);

CREATE TABLE world_state_transitions (
  id BIGSERIAL PRIMARY KEY,
  entity_id BIGINT NOT NULL REFERENCES world_state_entities(id) ON DELETE CASCADE,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  agent TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX world_state_entities_flow_id_idx ON world_state_entities(flow_id);
CREATE INDEX world_state_entities_flow_type_state_idx ON world_state_entities(flow_id, type, state);
CREATE INDEX world_state_transitions_entity_id_created_at_idx ON world_state_transitions(entity_id, created_at DESC);
CREATE INDEX world_state_transitions_created_at_idx ON world_state_transitions(created_at DESC);

CREATE OR REPLACE TRIGGER update_world_state_entities_modified
  BEFORE UPDATE ON world_state_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS update_world_state_entities_modified ON world_state_entities;
DROP INDEX IF EXISTS world_state_transitions_created_at_idx;
DROP INDEX IF EXISTS world_state_transitions_entity_id_created_at_idx;
DROP INDEX IF EXISTS world_state_entities_flow_type_state_idx;
DROP INDEX IF EXISTS world_state_entities_flow_id_idx;
DROP TABLE IF EXISTS world_state_transitions;
DROP TABLE IF EXISTS world_state_entities;
-- +goose StatementEnd
