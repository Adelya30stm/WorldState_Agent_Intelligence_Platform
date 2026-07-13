package worldstate

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"testing"

	"pentagi/pkg/database"

	_ "github.com/lib/pq"
)

// TestStoreObserveAndTransition exercises the real Postgres schema when
// DATABASE_URL is set (e.g. postgres://postgres:postgres@localhost:5432/redscopedb?sslmode=disable).
func TestStoreObserveAndTransition(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		t.Skipf("db unavailable: %v", err)
	}

	q := database.New(db)
	ctx := context.Background()

	var flowID int64
	if err := db.QueryRowContext(ctx, `SELECT id FROM flows ORDER BY id DESC LIMIT 1`).Scan(&flowID); err != nil {
		t.Skipf("no flows: %v", err)
	}

	key := "host:worldstate-test.example.invalid"
	_, _ = db.ExecContext(ctx, `DELETE FROM world_state_entities WHERE flow_id=$1 AND entity_key=$2`, flowID, key)

	store := NewStore(q)
	entity, err := store.Observe(ctx, flowID, EntityTypeHost, key, AgentSystem, map[string]any{
		"host": "worldstate-test.example.invalid",
	}, map[string]any{"test": true})
	if err != nil {
		t.Fatalf("Observe: %v", err)
	}
	if entity.State != database.WorldStateLifecycleDiscovered {
		t.Fatalf("want discovered, got %s", entity.State)
	}

	entity, err = store.Transition(ctx, entity.ID, StateScanning, AgentExecutor, json.RawMessage(`{"tool":"nmap"}`))
	if err != nil {
		t.Fatalf("Transition scanning: %v", err)
	}
	if entity.State != database.WorldStateLifecycleScanning {
		t.Fatalf("want scanning, got %s", entity.State)
	}

	_, err = store.Transition(ctx, entity.ID, StateVulnerable, AgentExecutor, json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("expected invalid transition scanning→vulnerable")
	}

	trs, err := q.GetWorldStateTransitionsByEntity(ctx, entity.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(trs) < 2 {
		t.Fatalf("want >=2 transitions, got %d", len(trs))
	}

	_, _ = db.ExecContext(ctx, `DELETE FROM world_state_entities WHERE id=$1`, entity.ID)
}
