-- +goose Up
-- +goose StatementBegin

CREATE TYPE WORLD_STATE_LIFECYCLE AS ENUM (
  'unknown',
  'discovered',
  'scanning',
  'assessed',
  'vulnerable',
  'exploited',
  'remediated'
);

CREATE TABLE world_state_entities (
  id            BIGINT                  PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  flow_id       BIGINT                  NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  entity_key    TEXT                    NOT NULL,
  type          TEXT                    NOT NULL,
  state         WORLD_STATE_LIFECYCLE   NOT NULL DEFAULT 'unknown',
  properties    JSONB                   NOT NULL DEFAULT '{}'::jsonb,
  annotations   JSONB                   NOT NULL DEFAULT '[]'::jsonb,
  version       INTEGER                 NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT world_state_entities_flow_key_unique UNIQUE (flow_id, entity_key)
);

CREATE INDEX world_state_entities_flow_state_idx ON world_state_entities(flow_id, state);
CREATE INDEX world_state_entities_flow_type_idx  ON world_state_entities(flow_id, type);

CREATE TABLE world_state_links (
  id            BIGINT       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  flow_id       BIGINT       NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  source_id     BIGINT       NOT NULL REFERENCES world_state_entities(id) ON DELETE CASCADE,
  target_id     BIGINT       NOT NULL REFERENCES world_state_entities(id) ON DELETE CASCADE,
  type          TEXT         NOT NULL,
  properties    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT world_state_links_unique UNIQUE (flow_id, source_id, target_id, type)
);

CREATE INDEX world_state_links_flow_id_idx ON world_state_links(flow_id);

CREATE TABLE world_state_transitions (
  id            BIGINT                  PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entity_id     BIGINT                  NOT NULL REFERENCES world_state_entities(id) ON DELETE CASCADE,
  from_state    WORLD_STATE_LIFECYCLE   NOT NULL,
  to_state      WORLD_STATE_LIFECYCLE   NOT NULL,
  agent         TEXT                    NOT NULL,
  evidence      JSONB                   NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ             NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX world_state_transitions_entity_id_idx  ON world_state_transitions(entity_id);
CREATE INDEX world_state_transitions_created_at_idx ON world_state_transitions(created_at);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS world_state_transitions;
DROP TABLE IF EXISTS world_state_links;
DROP TABLE IF EXISTS world_state_entities;
DROP TYPE IF EXISTS WORLD_STATE_LIFECYCLE;

-- +goose StatementEnd
