package worldstate

import (
	"strings"
	"testing"
)

func TestExtractCandidatesFromURL(t *testing.T) {
	result := `HTTP/2 200
location: https://dh91a5qq5somh28whqwy.testapp.site/web/login
x-powered-by: PHP/5.6.40
`
	cands := ExtractCandidates("terminal", result)
	if len(cands) == 0 {
		t.Fatal("expected candidates")
	}
	var sawHost, sawEP bool
	for _, c := range cands {
		if c.Key == "host:dh91a5qq5somh28whqwy.testapp.site" {
			sawHost = true
		}
		if c.Type == EntityTypeEndpoint && strings.Contains(c.Key, "dh91a5qq5somh28whqwy.testapp.site") {
			sawEP = true
		}
	}
	if !sawHost {
		t.Fatalf("missing host candidate: %+v", cands)
	}
	if !sawEP {
		t.Fatalf("missing endpoint candidate: %+v", cands)
	}
}

func TestExtractSkipsNoise(t *testing.T) {
	cands := ExtractCandidates("browser", "See docs at https://github.com/foo/bar and https://symfony.com/doc")
	for _, c := range cands {
		if c.Type == EntityTypeHost {
			t.Fatalf("unexpected host from noise domains: %s", c.Key)
		}
	}
}

func TestLooksLikeActiveScan(t *testing.T) {
	if !looksLikeActiveScan("terminal", "running nmap -sV target") {
		t.Fatal("expected active scan")
	}
	if looksLikeActiveScan("browser", "page title Login") {
		t.Fatal("did not expect active scan")
	}
}
