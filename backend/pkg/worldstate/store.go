package worldstate

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"pentagi/pkg/database"
)

// Store persists World State entities and enforces lifecycle transitions.
type Store struct {
	db database.Querier
}

func NewStore(db database.Querier) *Store {
	return &Store{db: db}
}

var emptyObject = json.RawMessage(`{}`)
var emptyArray = json.RawMessage(`[]`)

// Observe ensures an entity exists for (flowID, type, key).
// New entities are created as unknown then transitioned to discovered.
// Existing entities only merge properties; state changes go through Transition.
func (s *Store) Observe(
	ctx context.Context,
	flowID int64,
	entityType string,
	entityKey string,
	agent string,
	properties map[string]any,
	evidence map[string]any,
) (database.WorldStateEntity, error) {
	if entityKey == "" || entityType == "" {
		return database.WorldStateEntity{}, fmt.Errorf("worldstate: empty entity type or key")
	}

	props, err := marshalJSON(properties)
	if err != nil {
		return database.WorldStateEntity{}, err
	}
	ev, err := marshalJSON(evidence)
	if err != nil {
		return database.WorldStateEntity{}, err
	}

	existing, err := s.db.GetWorldStateEntityByKey(ctx, database.GetWorldStateEntityByKeyParams{
		FlowID:    flowID,
		EntityKey: entityKey,
	})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return database.WorldStateEntity{}, fmt.Errorf("worldstate: get entity: %w", err)
	}

	if errors.Is(err, sql.ErrNoRows) {
		created, err := s.db.UpsertWorldStateEntity(ctx, database.UpsertWorldStateEntityParams{
			FlowID:      flowID,
			EntityKey:   entityKey,
			Type:        entityType,
			State:       database.WorldStateLifecycleUnknown,
			Properties:  props,
			Annotations: emptyArray,
		})
		if err != nil {
			return database.WorldStateEntity{}, fmt.Errorf("worldstate: create entity: %w", err)
		}
		return s.transitionLoaded(ctx, created, StateDiscovered, agent, ev)
	}

	updated, err := s.db.UpsertWorldStateEntity(ctx, database.UpsertWorldStateEntityParams{
		FlowID:      flowID,
		EntityKey:   entityKey,
		Type:        entityType,
		State:       existing.State,
		Properties:  props,
		Annotations: emptyArray,
	})
	if err != nil {
		return database.WorldStateEntity{}, fmt.Errorf("worldstate: merge entity: %w", err)
	}

	if State(updated.State) == StateUnknown {
		return s.transitionLoaded(ctx, updated, StateDiscovered, agent, ev)
	}
	return updated, nil
}

// Transition moves an entity along the lifecycle FSM and appends an audit row.
func (s *Store) Transition(
	ctx context.Context,
	entityID int64,
	to State,
	agent string,
	evidence json.RawMessage,
) (database.WorldStateEntity, error) {
	entity, err := s.db.GetWorldStateEntityByID(ctx, entityID)
	if err != nil {
		return database.WorldStateEntity{}, fmt.Errorf("worldstate: load entity %d: %w", entityID, err)
	}
	return s.transitionLoaded(ctx, entity, to, agent, evidence)
}

func (s *Store) transitionLoaded(
	ctx context.Context,
	entity database.WorldStateEntity,
	to State,
	agent string,
	evidence json.RawMessage,
) (database.WorldStateEntity, error) {
	from := State(entity.State)
	if err := ValidateTransition(from, to); err != nil {
		return database.WorldStateEntity{}, err
	}
	if evidence == nil {
		evidence = emptyObject
	}
	if agent == "" {
		agent = AgentSystem
	}

	if _, err := s.db.CreateWorldStateTransition(ctx, database.CreateWorldStateTransitionParams{
		EntityID:  entity.ID,
		FromState: database.WorldStateLifecycle(from),
		ToState:   database.WorldStateLifecycle(to),
		Agent:     agent,
		Evidence:  evidence,
	}); err != nil {
		return database.WorldStateEntity{}, fmt.Errorf("worldstate: write transition: %w", err)
	}

	updated, err := s.db.UpdateWorldStateEntityState(ctx, database.UpdateWorldStateEntityStateParams{
		State: database.WorldStateLifecycle(to),
		ID:    entity.ID,
	})
	if err != nil {
		return database.WorldStateEntity{}, fmt.Errorf("worldstate: update state: %w", err)
	}
	return updated, nil
}

// PromoteScanning moves discovered → scanning when active enumeration starts.
// No-op (nil error) if the transition is not allowed from the current state.
func (s *Store) PromoteScanning(ctx context.Context, entityID int64, agent string, evidence map[string]any) error {
	ev, err := marshalJSON(evidence)
	if err != nil {
		return err
	}
	_, err = s.Transition(ctx, entityID, StateScanning, agent, ev)
	if errors.Is(err, ErrInvalidTransition) || errors.Is(err, ErrUnknownState) {
		return nil
	}
	return err
}

// Link upserts a typed edge between two entities in the same flow.
func (s *Store) Link(
	ctx context.Context,
	flowID, sourceID, targetID int64,
	linkType string,
	properties map[string]any,
) (database.WorldStateLink, error) {
	props, err := marshalJSON(properties)
	if err != nil {
		return database.WorldStateLink{}, err
	}
	return s.db.UpsertWorldStateLink(ctx, database.UpsertWorldStateLinkParams{
		FlowID:     flowID,
		SourceID:   sourceID,
		TargetID:   targetID,
		Type:       linkType,
		Properties: props,
	})
}

func marshalJSON(v map[string]any) (json.RawMessage, error) {
	if v == nil {
		return emptyObject, nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("worldstate: marshal json: %w", err)
	}
	return b, nil
}
