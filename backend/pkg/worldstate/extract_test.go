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

func TestCredentialIdentifiersUseStableNonSecretKeys(t *testing.T) {
	result := `username=analyst password=synthetic-password-sentinel
token=synthetic-token-sentinel
api_key=synthetic-api-key-sentinel
Authorization: Bearer synthetic-bearer-sentinel
Cookie: session=synthetic-cookie-sentinel`
	candidates := ExtractCandidates("terminal", result)
	wantKeys := map[string]bool{
		"credential:analyst":  false,
		"credential:password": false,
		"credential:token":    false,
		"credential:api_key":  false,
		"credential:bearer":   false,
		"credential:cookie":   false,
	}
	for _, candidate := range candidates {
		if candidate.Type != EntityTypeCredential {
			continue
		}
		if strings.Contains(candidate.Key, "synthetic-") {
			t.Fatalf("credential key contains secret material")
		}
		if _, ok := wantKeys[candidate.Key]; ok {
			wantKeys[candidate.Key] = true
		}
	}
	for key, found := range wantKeys {
		if !found {
			t.Fatalf("missing stable credential identity %q", key)
		}
	}
}

func TestIngestionFailureFieldsSanitizeCredentialIdentifiers(t *testing.T) {
	fields := ingestionFailureFields(17, "credential:password:synthetic-password-sentinel", "terminal")
	if fields["entity_key"] != "credential:password" {
		t.Fatalf("unexpected ingestion entity key: %v", fields["entity_key"])
	}
}
