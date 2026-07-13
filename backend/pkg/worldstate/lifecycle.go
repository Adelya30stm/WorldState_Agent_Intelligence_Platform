// Package worldstate provides the persistent, agent-mutable World State
// that gates pentest agent planning.
//
// This file defines the lifecycle state machine. Allowed transitions are
// enforced here and must be checked by the store before any UPDATE on
// world_state_entities.state. The DB schema (world_state_lifecycle ENUM)
// names must stay in sync with the constants below.
package worldstate

import "errors"

// State is one of the enum values defined in the world_state_lifecycle
// Postgres type. The string value MUST match the ENUM label exactly.
type State string

const (
	StateUnknown    State = "unknown"
	StateDiscovered State = "discovered"
	StateScanning   State = "scanning"
	StateAssessed   State = "assessed"
	StateVulnerable State = "vulnerable"
	StateExploited  State = "exploited"
	StateRemediated State = "remediated"
)

// Agent identifies the author of a transition. Values are written verbatim
// into world_state_transitions.agent.
const (
	AgentResearcher = "researcher"
	AgentDeveloper  = "developer"
	AgentExecutor   = "executor"
	AgentHuman      = "human"
	AgentSystem     = "system"
)

// ErrInvalidTransition is returned by ValidateTransition when the requested
// (from, to) pair is not in the allowed transitions table.
var ErrInvalidTransition = errors.New("worldstate: invalid lifecycle transition")

// ErrUnknownState is returned when a state value is not a recognized enum label.
var ErrUnknownState = errors.New("worldstate: unknown state")

// allowedTransitions encodes the lifecycle graph:
//
//	unknown → discovered → scanning → assessed → vulnerable → exploited → remediated
//
// Branches:
//   - discovered may go directly to assessed (passive recon yielded enough)
//   - assessed may go to remediated without an exploit (clean target)
//   - vulnerable may go to remediated without an exploit (patched in time)
//   - remediated is terminal
var allowedTransitions = map[State]map[State]bool{
	StateUnknown:    {StateDiscovered: true},
	StateDiscovered: {StateScanning: true, StateAssessed: true},
	StateScanning:   {StateAssessed: true},
	StateAssessed:   {StateVulnerable: true, StateRemediated: true},
	StateVulnerable: {StateExploited: true, StateRemediated: true},
	StateExploited:  {StateRemediated: true},
	StateRemediated: {},
}

// IsKnown reports whether s is a recognized state.
func (s State) IsKnown() bool {
	_, ok := allowedTransitions[s]
	return ok
}

// IsTerminal reports whether no further transitions are permitted from s.
// A state is terminal iff it appears in the transitions map with an empty
// outbound set.
func (s State) IsTerminal() bool {
	out, ok := allowedTransitions[s]
	return ok && len(out) == 0
}

// AllowedNext returns the set of states reachable from s in one step.
// The returned slice is a fresh copy; callers may mutate it freely.
func AllowedNext(s State) []State {
	out := allowedTransitions[s]
	if len(out) == 0 {
		return nil
	}
	result := make([]State, 0, len(out))
	for next := range out {
		result = append(result, next)
	}
	return result
}

// ValidateTransition returns nil iff (from → to) is a permitted lifecycle
// transition. Both states must be recognized; otherwise ErrUnknownState
// is returned. If both are recognized but the edge is disallowed,
// ErrInvalidTransition is returned.
//
// Same-state "transitions" (from == to) are disallowed: a no-op transition
// would still produce a row in world_state_transitions, which would lie
// about progress. Callers updating only properties/annotations must not
// call this function.
func ValidateTransition(from, to State) error {
	if !from.IsKnown() {
		return ErrUnknownState
	}
	if !to.IsKnown() {
		return ErrUnknownState
	}
	if !allowedTransitions[from][to] {
		return ErrInvalidTransition
	}
	return nil
}
