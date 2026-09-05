package docker

import (
	"slices"
	"testing"
)

func resetAllocatedPorts() {
	allocatedPortsMu.Lock()
	allocatedPorts = map[int64][]int{}
	allocatedPortsMu.Unlock()
}

func TestDefaultPrimaryContainerPorts(t *testing.T) {
	got := defaultPrimaryContainerPorts(8)
	want := []int{28016, 28017}
	if !slices.Equal(got, want) {
		t.Fatalf("defaultPrimaryContainerPorts(8) = %v, want %v", got, want)
	}
}

func TestChoosePrimaryContainerPortsSkipsOccupied(t *testing.T) {
	resetAllocatedPorts()
	t.Cleanup(resetAllocatedPorts)

	used := map[int]struct{}{
		28016: {},
		28017: {},
	}
	got := choosePrimaryContainerPorts(8, used)
	want := []int{28018, 28019}
	if !slices.Equal(got, want) {
		t.Fatalf("choosePrimaryContainerPorts(8) = %v, want %v", got, want)
	}
	if !slices.Equal(GetPrimaryContainerPorts(8), want) {
		t.Fatalf("GetPrimaryContainerPorts(8) = %v, want registered %v", GetPrimaryContainerPorts(8), want)
	}
}

func TestChoosePrimaryContainerPortsReusesRegistration(t *testing.T) {
	resetAllocatedPorts()
	t.Cleanup(resetAllocatedPorts)
	registerAllocatedPorts(8, []int{28018, 28019})

	got := choosePrimaryContainerPorts(8, map[int]struct{}{28016: {}, 28017: {}})
	want := []int{28018, 28019}
	if !slices.Equal(got, want) {
		t.Fatalf("choosePrimaryContainerPorts(8) = %v, want %v", got, want)
	}
}

func TestPrimaryTerminalFlowID(t *testing.T) {
	id, ok := primaryTerminalFlowID("/pentagi-terminal-8")
	if !ok || id != 8 {
		t.Fatalf("primaryTerminalFlowID(/pentagi-terminal-8) = %d, %v", id, ok)
	}
	if _, ok := primaryTerminalFlowID("/pentagi-pentagi-terminal-8"); ok {
		t.Fatal("expected pentagi-pentagi-terminal-8 to be ignored")
	}
}
