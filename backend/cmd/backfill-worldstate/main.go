// Command backfill-worldstate replays msglogs/termlogs into world_state_* for a flow.
//
//	go run ./cmd/backfill-worldstate -flow 15
package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"os"

	"pentagi/pkg/database"
	"pentagi/pkg/worldstate"

	_ "github.com/lib/pq"
)

func main() {
	flowID := flag.Int64("flow", 0, "flow id to backfill")
	dsn := flag.String("dsn", os.Getenv("DATABASE_URL"), "postgres DSN")
	flag.Parse()

	if *flowID <= 0 {
		fmt.Fprintln(os.Stderr, "usage: backfill-worldstate -flow <id>")
		os.Exit(2)
	}
	if *dsn == "" {
		*dsn = "postgres://postgres:postgres@127.0.0.1:5432/redscopedb?sslmode=disable"
	}

	db, err := sql.Open("postgres", *dsn)
	if err != nil {
		fatal(err)
	}
	defer db.Close()

	ctx := context.Background()
	q := database.New(db)

	rows, err := db.QueryContext(ctx, `
		SELECT COALESCE(type::text,''), COALESCE(message,''), COALESCE(result,'')
		FROM msglogs WHERE flow_id=$1 ORDER BY id ASC`, *flowID)
	if err != nil {
		fatal(err)
	}
	defer rows.Close()

	n := 0
	for rows.Next() {
		var typ, msg, result string
		if err := rows.Scan(&typ, &msg, &result); err != nil {
			fatal(err)
		}
		blob := msg + "\n" + result
		worldstate.IngestToolResult(ctx, q, *flowID, typ, blob)
		n++
	}
	if err := rows.Err(); err != nil {
		fatal(err)
	}

	var ents, links, trs int
	_ = db.QueryRowContext(ctx, `SELECT COUNT(*) FROM world_state_entities WHERE flow_id=$1`, *flowID).Scan(&ents)
	_ = db.QueryRowContext(ctx, `SELECT COUNT(*) FROM world_state_links WHERE flow_id=$1`, *flowID).Scan(&links)
	_ = db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM world_state_transitions t
		JOIN world_state_entities e ON e.id=t.entity_id WHERE e.flow_id=$1`, *flowID).Scan(&trs)

	fmt.Printf("backfilled flow %d from %d msglogs → entities=%d links=%d transitions=%d\n",
		*flowID, n, ents, links, trs)
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
