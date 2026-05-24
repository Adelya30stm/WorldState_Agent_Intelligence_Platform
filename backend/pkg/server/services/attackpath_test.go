package services

import "testing"

func TestNewAttackPathService(t *testing.T) {
	svc := NewAttackPathService(nil, nil)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
}
