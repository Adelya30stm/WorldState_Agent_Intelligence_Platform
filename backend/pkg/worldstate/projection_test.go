package worldstate

import "testing"

func TestProjectionTextEmpty(t *testing.T) {
	p := &Projection{Empty: true, CountsByState: map[State]int{}, CountsByType: map[string]int{}}
	txt := p.Text()
	if !containsAll(txt, "world_state", "empty") {
		t.Fatalf("unexpected empty projection: %s", txt)
	}
}

func TestProjectionTextWithFrontier(t *testing.T) {
	p := &Projection{
		FlowID:        16,
		TotalEntities: 2,
		Empty:         false,
		CountsByState: map[State]int{StateDiscovered: 1, StateScanning: 1},
		CountsByType:  map[string]int{"host": 2},
		Frontier: []FrontierItem{
			{Key: "host:example.test", Type: "host", State: StateDiscovered, Why: "scan"},
		},
		RecentTransitions: []TransitionItem{
			{EntityKey: "host:example.test", From: StateUnknown, To: StateDiscovered, Agent: "executor"},
		},
	}
	txt := p.Text()
	for _, want := range []string{"frontier", "host:example.test", "discovered", "recent_transitions"} {
		if !containsAll(txt, want) {
			t.Fatalf("missing %q in:\n%s", want, txt)
		}
	}
}

func containsAll(s string, parts ...string) bool {
	for _, p := range parts {
		if !stringContains(s, p) {
			return false
		}
	}
	return true
}

func stringContains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
