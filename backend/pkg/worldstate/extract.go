package worldstate

import (
	"net/url"
	"regexp"
	"strings"
)

const (
	EntityTypeHost       = "host"
	EntityTypeEndpoint   = "endpoint"
	EntityTypeFinding    = "finding"
	EntityTypeCredential = "credential"
)

// Candidate is a deterministic extraction from tool output.
type Candidate struct {
	Type       string
	Key        string // canonical entity_key, e.g. host:example.com
	Properties map[string]any
}

var (
	urlRE           = regexp.MustCompile(`https?://[^\s'"` + "`" + `,<>)\]]+`)
	ipv4RE          = regexp.MustCompile(`\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`)
	hostRE          = regexp.MustCompile(`\b([a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+)\b`)
	cveRE           = regexp.MustCompile(`(?i)\bCVE-\d{4}-\d{4,7}\b`)
	passwordRE      = regexp.MustCompile(`(?i)(?:password|passwd|pwd)\s*[=:]\s*([^\s"'\\,]{3,64})`)
	authorizationRE = regexp.MustCompile(`(?i)\bAuthorization:\s*(Basic|Bearer|Digest|Token)\s+([A-Za-z0-9+/=._~-]+)`)
	cookieHeaderRE  = regexp.MustCompile(`(?i)\b(?:Cookie|Set-Cookie):\s*([^\r\n]+)`)
	secretFieldRE   = regexp.MustCompile(`(?i)\b(access[_-]?token|refresh[_-]?token|token|api[_-]?key|apikey|client[_-]?secret|private[_-]?key|authorization|auth|secret|cookie|session(?:[_-]?id)?)\s*[=:]\s*([^\s"'\\,;]{3,128})`)
	userPassRE      = regexp.MustCompile(`(?i)\b(?:user(?:name)?|login)\s*[=:]\s*([^\s"'\\,]{2,64}).{0,80}?(?:password|passwd|pwd)\s*[=:]\s*([^\s"'\\,]{3,64})`)
	findingHintRE   = regexp.MustCompile(`(?i)\b(SQL injection|XSS|CSRF|RCE|SSRF|IDOR|path traversal|remote code execution|authentication bypass)\b`)
)

var noiseHosts = map[string]bool{
	"localhost": true, "example.com": true, "github.com": true,
	"npmjs.com": true, "docker.io": true, "golang.org": true,
	"pkg.go.dev": true, "ubuntu.com": true, "debian.org": true,
	"symfony.com": true, "google.com": true, "googleapis.com": true,
	"w3.org": true, "schema.org": true, "microsoft.com": true,
}

// ExtractCandidates pulls hosts and endpoints from raw tool output.
// Deterministic only — no LLM.
func ExtractCandidates(toolName, result string) []Candidate {
	seen := map[string]bool{}
	out := make([]Candidate, 0, 8)
	safeResult := maskCredentialMaterial(result)

	add := func(c Candidate) {
		if c.Key == "" || seen[c.Key] {
			return
		}
		seen[c.Key] = true
		out = append(out, c)
	}

	for _, raw := range urlRE.FindAllString(safeResult, -1) {
		raw = strings.TrimRight(raw, ".,;:)]}\"'>")
		u, err := url.Parse(raw)
		if err != nil || u.Host == "" {
			continue
		}
		host := canonicalHost(u.Hostname())
		if host == "" || noiseHosts[host] {
			continue
		}
		add(Candidate{
			Type: EntityTypeHost,
			Key:  "host:" + host,
			Properties: map[string]any{
				"host":   host,
				"source": "url",
			},
		})
		path := u.Path
		if path == "" {
			path = "/"
		}
		epKey := "endpoint:" + strings.ToLower(u.Scheme) + "://" + host + path
		add(Candidate{
			Type: EntityTypeEndpoint,
			Key:  epKey,
			Properties: map[string]any{
				"url":    strings.ToLower(u.Scheme) + "://" + host + path,
				"host":   host,
				"path":   path,
				"scheme": u.Scheme,
			},
		})
	}

	for _, ip := range ipv4RE.FindAllString(safeResult, -1) {
		if isPrivateOrNoiseIP(ip) {
			continue
		}
		add(Candidate{
			Type: EntityTypeHost,
			Key:  "host:" + ip,
			Properties: map[string]any{
				"host":   ip,
				"source": "ipv4",
			},
		})
	}

	// Bare hostnames (skip if already covered via URL).
	if looksLikeReconTool(toolName) {
		for _, h := range hostRE.FindAllString(safeResult, -1) {
			host := canonicalHost(h)
			if host == "" || noiseHosts[host] {
				continue
			}
			add(Candidate{
				Type: EntityTypeHost,
				Key:  "host:" + host,
				Properties: map[string]any{
					"host":   host,
					"source": "hostname",
				},
			})
		}
	}

	for _, cve := range cveRE.FindAllString(safeResult, -1) {
		cve = strings.ToUpper(cve)
		add(Candidate{
			Type: EntityTypeFinding,
			Key:  "finding:" + strings.ToLower(cve),
			Properties: map[string]any{
				"cve":    cve,
				"source": "cve",
			},
		})
	}

	for _, m := range findingHintRE.FindAllString(safeResult, -1) {
		slug := strings.ToLower(strings.ReplaceAll(m, " ", "_"))
		add(Candidate{
			Type: EntityTypeFinding,
			Key:  "finding:" + slug,
			Properties: map[string]any{
				"title":  m,
				"source": "keyword",
			},
		})
	}

	for _, m := range userPassRE.FindAllStringSubmatch(result, -1) {
		if len(m) < 3 {
			continue
		}
		user := strings.TrimSpace(m[1])
		pass := strings.TrimSpace(m[2])
		if user == "" || pass == "" || looksLikePlaceholder(pass) {
			continue
		}
		key := "credential:" + strings.ToLower(user)
		add(Candidate{
			Type: EntityTypeCredential,
			Key:  key,
			Properties: map[string]any{
				"username": user,
				"password": pass,
				"source":   "user_pass",
			},
		})
	}

	for _, m := range passwordRE.FindAllStringSubmatch(result, -1) {
		if len(m) < 2 {
			continue
		}
		pass := strings.TrimSpace(m[1])
		if pass == "" || looksLikePlaceholder(pass) {
			continue
		}
		add(Candidate{
			Type: EntityTypeCredential,
			Key:  credentialEntityKey("password"),
			Properties: map[string]any{
				"password": pass,
				"source":   "password_field",
			},
		})
	}

	for _, m := range authorizationRE.FindAllStringSubmatch(result, -1) {
		if len(m) < 3 {
			continue
		}
		scheme := strings.ToLower(strings.TrimSpace(m[1]))
		token := strings.TrimSpace(m[2])
		if token == "" {
			continue
		}
		add(Candidate{
			Type: EntityTypeCredential,
			Key:  credentialEntityKey(scheme),
			Properties: map[string]any{
				"auth":   scheme,
				"token":  token,
				"source": "authorization_header",
			},
		})
	}

	for _, m := range secretFieldRE.FindAllStringSubmatch(result, -1) {
		if len(m) < 3 {
			continue
		}
		kind := credentialFieldIdentity(m[1])
		value := strings.TrimSpace(m[2])
		if kind == "" || value == "" || looksLikePlaceholder(value) {
			continue
		}
		add(Candidate{
			Type: EntityTypeCredential,
			Key:  credentialEntityKey(kind),
			Properties: map[string]any{
				kind:     value,
				"source": "credential_field",
			},
		})
	}

	for _, m := range cookieHeaderRE.FindAllStringSubmatch(result, -1) {
		if len(m) < 2 {
			continue
		}
		cookie := strings.TrimSpace(m[1])
		if cookie == "" || looksLikePlaceholder(cookie) {
			continue
		}
		add(Candidate{
			Type: EntityTypeCredential,
			Key:  credentialEntityKey("cookie"),
			Properties: map[string]any{
				"cookie": cookie,
				"source": "cookie_header",
			},
		})
	}

	return out
}

func looksLikePlaceholder(s string) bool {
	l := strings.ToLower(s)
	for _, p := range []string{"***", "redacted", "null", "none", "password", "changeme", "{password}", "<password>"} {
		if l == p {
			return true
		}
	}
	return false
}

func credentialFieldIdentity(field string) string {
	normalized := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(field), "-", "_"))
	switch normalized {
	case "access_token", "refresh_token", "token":
		return "token"
	case "api_key", "apikey":
		return "api_key"
	case "client_secret", "secret":
		return "secret"
	case "private_key":
		return "private"
	case "authorization", "auth":
		return "authorization"
	case "cookie":
		return "cookie"
	case "session_id", "session":
		return "session"
	default:
		return ""
	}
}

func maskCredentialMaterial(result string) string {
	masked := passwordRE.ReplaceAllString(result, "password=[REDACTED]")
	masked = authorizationRE.ReplaceAllString(masked, "$1 [REDACTED]")
	masked = secretFieldRE.ReplaceAllString(masked, "$1=[REDACTED]")
	masked = cookieHeaderRE.ReplaceAllString(masked, "Cookie: [REDACTED]")
	return masked
}

func canonicalHost(h string) string {
	h = strings.ToLower(strings.TrimSpace(h))
	h = strings.TrimPrefix(h, "www.")
	if strings.Contains(h, ":") {
		h = strings.Split(h, ":")[0]
	}
	if len(h) < 3 || !strings.Contains(h, ".") {
		return ""
	}
	return h
}

func isPrivateOrNoiseIP(ip string) bool {
	parts := strings.Split(ip, ".")
	if len(parts) != 4 {
		return true
	}
	// 0.x, 127.x, 10.x, 192.168.x, 172.16-31.x
	if parts[0] == "0" || parts[0] == "127" || parts[0] == "10" {
		return true
	}
	if parts[0] == "192" && parts[1] == "168" {
		return true
	}
	if parts[0] == "172" {
		return true // coarse; good enough for noise filter
	}
	return false
}

func looksLikeReconTool(name string) bool {
	n := strings.ToLower(name)
	for _, k := range []string{"terminal", "browser", "nmap", "gobuster", "ffuf", "nuclei", "curl", "whatweb", "http"} {
		if strings.Contains(n, k) {
			return true
		}
	}
	return false
}

func looksLikeActiveScan(toolName, result string) bool {
	blob := strings.ToLower(toolName + " " + result)
	for _, k := range []string{"nmap", "gobuster", "feroxbuster", "ffuf", "masscan", "nuclei", "dirb", "wfuzz"} {
		if strings.Contains(blob, k) {
			return true
		}
	}
	return false
}
