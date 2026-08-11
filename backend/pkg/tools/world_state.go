package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"pentagi/pkg/database"
	"pentagi/pkg/worldstate"
)

type worldStateTool struct {
	flowID int64
	db     database.Querier
}

func NewWorldStateTool(flowID int64, db database.Querier) Tool {
	return &worldStateTool{
		flowID: flowID,
		db:     db,
	}
}

func (w *worldStateTool) IsAvailable() bool {
	return w.db != nil
}

func (w *worldStateTool) Handle(ctx context.Context, name string, args json.RawMessage) (string, error) {
	if !w.IsAvailable() {
		return "", fmt.Errorf("world state tool is not available")
	}

	store := worldstate.NewStore(w.db)

	switch name {
	case WorldStateQueryToolName:
		var action WorldStateQueryAction
		if err := json.Unmarshal(args, &action); err != nil {
			return "", fmt.Errorf("failed to unmarshal world_state_query args: %w", err)
		}

		entities, err := store.Query(ctx, w.flowID, nilIfEmpty(action.Type), nilIfEmpty(action.State))
		if err != nil {
			return "", err
		}

		payload := map[string]any{
			"count":    len(entities),
			"entities": entities,
		}
		data, err := json.Marshal(payload)
		if err != nil {
			return "", fmt.Errorf("failed to marshal world_state_query response: %w", err)
		}
		return string(data), nil

	case WorldStateUpdateToolName:
		var action WorldStateUpdateAction
		if err := json.Unmarshal(args, &action); err != nil {
			return "", fmt.Errorf("failed to unmarshal world_state_update args: %w", err)
		}

		evidence := action.Links
		if len(evidence) == 0 {
			evidence = json.RawMessage(`{}`)
		}
		entity, err := store.UpsertEntity(
			ctx,
			w.flowID,
			action.EntityKey,
			action.Type,
			worldstate.State(action.ToState),
			defaultJSONObject(action.Properties),
			resolveWorldStateActor(ctx),
			evidence,
		)
		if err != nil {
			return "", err
		}

		data, err := json.Marshal(entity)
		if err != nil {
			return "", fmt.Errorf("failed to marshal world_state_update response: %w", err)
		}
		return string(data), nil

	default:
		return "", fmt.Errorf("unknown world state tool: %s", name)
	}
}

func nilIfEmpty(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func defaultJSONObject(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage(`{}`)
	}
	return raw
}

func resolveWorldStateActor(ctx context.Context) string {
	agentCtx, ok := GetAgentContext(ctx)
	if !ok {
		return "human"
	}

	switch agentCtx.CurrentAgentType {
	case database.MsgchainTypeSearcher,
		database.MsgchainTypeMemorist,
		database.MsgchainTypeEnricher,
		database.MsgchainTypeGenerator,
		database.MsgchainTypeRefiner:
		return "researcher"

	case database.MsgchainTypePentester,
		database.MsgchainTypeCoder,
		database.MsgchainTypeInstaller,
		database.MsgchainTypeAssistant,
		database.MsgchainTypePrimaryAgent:
		return "executor"

	default:
		return "agent"
	}
}
