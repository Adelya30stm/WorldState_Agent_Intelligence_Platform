package scanners

func strPtr(s string) *string { return &s }

func severityLabel(n int) string {
	switch n {
	case 4:
		return "Critical"
	case 3:
		return "High"
	case 2:
		return "Medium"
	case 1:
		return "Low"
	default:
		return "Info"
	}
}
