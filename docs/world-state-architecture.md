# World State architecture

## Overview

Compared with `main`, this branch adds durable World State delivery without replacing
the existing orchestration backbone. The runtime remains:

`Flow worker → Task worker → Subtask worker → Primary agent → provider/LLM/tool loop`

The additions are deliberately at three seams:

1. World State mutations now write an ordered, durable event journal in the same
   transaction as the entity/link mutation and transition audit.
2. Only primary-agent chains receive bounded journal/projection updates, at the
   next model-turn boundary, with a durable per-chain cursor.
3. A primary `ask` wait is durable and can be resolved by the first committed user
   answer or World State change, then resumed through the existing controller
   hierarchy.

## Architecture and data flow

1. Tool output is passed to deterministic extraction in
   `backend/pkg/worldstate/extract.go`. It finds hosts, endpoints, findings, and
   credential-shaped observations without an LLM. `ingest.go` is best effort:
   ingestion failures are logged and do not fail tool execution.
2. `backend/pkg/worldstate/store.go` and `store_helpers.go` lock or insert the
   entity/link, merge meaningful property changes, validate lifecycle transitions,
   write transition audit rows, and create journal facts in one PostgreSQL
   transaction. Successful meaningful commits may invoke an optional post-commit
   hint; the dispatcher also polls, so delivery does not depend on a hint.
3. `backend/pkg/worldstate/delivery.go` captures one repeatable-read snapshot of
   the event head and source data. It builds a baseline, delta, or checkpoint
   payload for the flow and the recipient chain's cursor.
4. `backend/pkg/providers/performer.go` calls the injector before each provider
   model turn. `world_state_delivery.go` verifies that the chain belongs to the
   flow and is a primary chain, appends a `<world_state>` envelope, and atomically
   persists the message chain and cursor.
5. `backend/pkg/worldstate/wake_dispatcher.go` leases eligible primary waits,
   compares their flow event head, resolves changed waits, and hands accepted
   resumes to `backend/pkg/controller/flows.go`. Flow, task, and subtask workers
   then use their existing execution path to run the primary again.

The older compact World State snapshot remains in execution-context assembly in
`backend/pkg/providers/helpers.go`. Planner prompts also use
`worldstate.BuildProjection`; journal delivery is additive and is not a replacement
for those compatibility paths.

## Persistence schema

The existing World State tables remain the source of current truth:
`world_state_entities`, `world_state_links`, and `world_state_transitions`.
`backend/migrations/sql/20260815_210000_world_state_delivery.sql` adds:

- `world_state_events`: flow-scoped facts with globally ordered `BIGINT` revisions,
  event kind, actor, optional originating message chain, provenance, and indexes by
  flow/revision. Revision allocation is serialized by a PostgreSQL advisory lock.
- `world_state_chain_cursors`: one revision cursor per message chain. A database
  trigger rejects backward movement.
- `agent_task_updates`: durable target selectors, selected facts, source revisions,
  and pending/delivered/rejected receipt shape. The table and queries provide a
  compatibility/future routing boundary; automatic subagent task-update delivery
  is **not implemented in this branch**.
- `agent_chain_waits`: tool/idle wait kind, exact pending tool call, resolution
  winner/reference, lease and retry fields, resume-pending state, and JSON resume
  intent. Database constraints and triggers enforce winner immutability and valid
  state shapes.

The migration also adds enum types, sequences, indexes, lifecycle constraints, and
cleanup functions. SQLC output is updated in
`backend/pkg/database/world_state_delivery.sql.go`, `models.go`, `querier.go`,
`transactions.go`, and the related World State/message-chain generated model/query
files.

## Delivery semantics

`PrimaryDeliveryBuilder` uses these default limits:

- at most 64 journal events;
- at most 128 projected entities and 128 links;
- at most 64 KiB serialized payload.

With no cursor, the builder emits a **baseline** projection. With a cursor behind
the captured head, it emits a **delta** containing revisions `(cursor, head]` when
the event and byte limits fit. It emits a **checkpoint** projection when the event
count or byte limit would be exceeded. When the cursor equals the captured head,
delivery is empty. A cursor ahead of the captured head is rejected.

Projection and event ordering is canonicalized, and the payload records its
`through_revision`. The provider store locks and reloads the message chain inside a
transaction, rechecks the current cursor, appends to a pending human message when
possible (otherwise adds a human message), updates the chain, and advances the
cursor before commit. A retry therefore cannot acknowledge a revision without the
corresponding envelope.

Injection is **primary-only**: non-primary provider options and non-primary message
chains pass through unchanged. Injection happens before the next model call, so an
already-running LLM call is not interrupted. Delivery errors are logged and fail
soft at the provider seam; the prior chain and cursor remain usable.

## Primary wait and wake semantics

When the primary calls `ask`, `RegisterPrimaryAskWait` verifies the exact pending
tool call and transactionally persists the chain plus an `agent_chain_waits` row.
User input first attempts `ResolvePrimaryWaitWithUser`, which locks the wait row,
records `user` as the winner, replaces the exact tool result, removes the wait, and
commits. If World State already won, late user input is appended instead of being
lost.

The dispatcher polls every 500 ms, leases up to 32 waits for 10 seconds, and also
accepts a best-effort hint. For a leased wait it reads the flow event head and calls
`ResolveLeasedPrimaryWorldStateWait`. The database row lock and immutable-winner
constraint make the first committed user-versus-World-State arrival authoritative.
World State resolution stores the winning revision and a resume intent, replaces
the exact `ask` tool result with a structured “world_state_changed” response, and
commits both changes. Failed handling releases the lease with bounded exponential
retry delay.

Resolved World State waits are leased separately for controller resume. The flow
controller finds the loaded flow; task/subtask workers claim and validate the resume
generation and message-chain identity; then the normal Flow → Task → Subtask →
Primary path runs again. If resume fails after the claim, the existing wait state is
restored for retry.

## Redaction and projection safety

Safety is enforced before persistence and again at delivery boundaries:

- `redact.go` recursively redacts credential-like keys and authorization material,
  normalizes malformed UTF-8, and converts credential entity identifiers to stable
  kind-only keys rather than secret-bearing identities.
- Extraction masks credential material before searching for hosts and findings;
  credential candidates are still persisted only through the redacting store path.
- Journal facts use an allowlist of small scalar properties, with field-count,
  string-size, and total-property-size limits. Delivery re-redacts event facts and
  applies the same bounded property projection to entities and links.
- Projection validates flow ownership, link endpoints, JSON object shapes, and
  canonical ordering. Count and byte truncation reports omitted items instead of
  silently claiming a complete projection.
- Planner snapshots are bounded to 12 frontier items and 8 recent transitions;
  projection failures are soft and do not block planning.

No secret, credential value, environment value, or provider configuration is part of
this document.

## Changed files and components

- **Persistence:** the delivery migration and SQLC/generated database files listed
  above.
- **World State:** `store.go`, `store_helpers.go`, `delivery.go`, `primary_wait.go`,
  `wake_dispatcher.go`, plus extraction, ingestion, projection, snapshot, and
  redaction updates.
- **Provider integration:** `providers.go` constructs an optional per-flow primary
  injector; `provider.go`, `performer.go`, and `world_state_delivery.go` implement
  planner context, turn-boundary injection, cursor persistence, and user-wait
  handling.
- **Controller integration:** `flow.go`, `flows.go`, `task.go`, and `subtask.go`
  add durable primary-wait resume and controller handoff.

## Compatibility and non-goals

- The existing worker/provider orchestration remains the backbone; this is an
  additive persistence and delivery seam.
- Automatic World State injection is primary-only. There is no automatic delivery
  to subagents, assistants, or other agent chains.
- Subagent task-update routing is not implemented, despite the durable task-update
  schema/query surface.
- In-flight model calls are not interrupted or restarted by a journal event.
- The existing snapshot/planner context paths remain supported for compatibility;
  the event journal is not a general broadcast stream.
- This branch does not introduce a new external transport, environment contract,
  UI protocol, or LLM-based extraction path.

## Verification status

The branch includes focused coverage for lifecycle/store journaling, concurrent
revision ordering, redaction and projection limits, baseline/delta/checkpoint
selection, primary-only/fail-soft provider injection, cursor restart behavior,
wait leasing, user-versus-event races, late input preservation, and controller
resume. The principal test files are:

- `backend/pkg/worldstate/delivery_test.go`, `redact_test.go`, and
  `store_journal_test.go`;
- `backend/pkg/providers/world_state_delivery_test.go` and
  `world_state_wake_integration_test.go`;
- `backend/migrations/world_state_delivery_test.go` and
  `world_state_wake_test.go`; and
- `backend/pkg/controller/world_state_wake_test.go`.

For this documentation task, `git diff --check` is the required repository check;
it passes after adding this file. No runtime or generated source files were modified
by this task.