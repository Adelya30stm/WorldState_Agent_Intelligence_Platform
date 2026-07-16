package worldstate

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"pentagi/pkg/database"
)

type Store struct {
	db database.Querier
}

func NewStore(db database.Querier) *Store {
	return &Store{db: db}
}

func (s *Store) Query(
	ctx context.Context,
	flowID int64,
	typeFilter, stateFilter *string,
) ([]database.WorldStateEntity, error) {
	return s.db.ListWorldStateEntities(ctx, database.ListWorldStateEntitiesParams{
		FlowID: flowID,
		TypeFilter: sql.NullString{
			String: ptrString(typeFilter),
			Valid:  typeFilter != nil && *typeFilter != "",
		},
		StateFilter: sql.NullString{
			String: ptrString(stateFilter),
			Valid:  stateFilter != nil && *stateFilter != "",
		},
	})
}

func (s *Store) UpsertEntity(
	ctx context.Context,
	flowID int64,
	entityKey, entityType string,
	to State,
	properties json.RawMessage,
	agent string,
	evidence json.RawMessage,
) (database.WorldStateEntity, error) {
	if entityKey == "" || entityType == "" {
		return database.WorldStateEntity{}, fmt.Errorf("worldstate: entity_key and type are required")
	}
	if !IsKnownState(to) {
		return database.WorldStateEntity{}, ErrUnknownState
	}
	if len(properties) == 0 {
		properties = json.RawMessage(`{}`)
	}
	if len(evidence) == 0 {
		evidence = json.RawMessage(`{}`)
	}

	entity, err := s.db.GetWorldStateEntityByFlowAndKey(ctx, database.GetWorldStateEntityByFlowAndKeyParams{
		FlowID:    flowID,
		EntityKey: entityKey,
	})
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return database.WorldStateEntity{}, fmt.Errorf("worldstate: load entity: %w", err)
		}

		created, createErr := s.db.CreateWorldStateEntity(ctx, database.CreateWorldStateEntityParams{
			FlowID:    flowID,
			EntityKey: entityKey,
			Type:      entityType,
			State:     string(StateUnknown),
			Properties: properties,
		})
		if createErr != nil {
			return database.WorldStateEntity{}, fmt.Errorf("worldstate: create entity: %w", createErr)
		}
		entity = created
	}

	from := State(entity.State)
	if err := ValidateTransition(from, to); err != nil {
		return database.WorldStateEntity{}, err
	}

	if _, err := s.db.CreateWorldStateTransition(ctx, database.CreateWorldStateTransitionParams{
		EntityID:  entity.ID,
		FromState: string(from),
		ToState:   string(to),
		Agent:     agent,
		Evidence:  evidence,
	}); err != nil {
		return database.WorldStateEntity{}, fmt.Errorf("worldstate: write transition: %w", err)
	}

	updated, err := s.db.UpdateWorldStateEntity(ctx, database.UpdateWorldStateEntityParams{
		ID:         entity.ID,
		Type:       entityType,
		State:      string(to),
		Properties: properties,
	})
	if err != nil {
		return database.WorldStateEntity{}, fmt.Errorf("worldstate: update entity: %w", err)
	}

	return updated, nil
}

func ptrString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
