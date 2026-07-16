package worldstate

import "errors"

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

var (
	ErrInvalidTransition = errors.New("worldstate: invalid transition")
	ErrUnknownState      = errors.New("worldstate: unknown state")
)

var allowedTransitions = map[State]map[State]struct{}{
	StateUnknown: {
		StateDiscovered: {},
	},
	StateDiscovered: {
		StateScanning: {},
	},
	StateScanning: {
		StateAssessed: {},
	},
	StateAssessed: {
		StateVulnerable: {},
		StateRemediated: {},
	},
	StateVulnerable: {
		StateExploited:  {},
		StateRemediated: {},
	},
	StateExploited: {
		StateRemediated: {},
	},
	StateRemediated: {},
}

func IsKnownState(s State) bool {
	_, ok := allowedTransitions[s]
	return ok
}

func ValidateTransition(from, to State) error {
	if !IsKnownState(from) || !IsKnownState(to) {
		return ErrUnknownState
	}
	if from == to {
		return ErrInvalidTransition
	}
	if _, ok := allowedTransitions[from][to]; !ok {
		return ErrInvalidTransition
	}
	return nil
}
