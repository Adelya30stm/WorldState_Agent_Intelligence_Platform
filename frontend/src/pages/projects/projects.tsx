import { useEffect, useMemo, useState } from 'react';

import { WorldStateGraph, WS_RISK_CLS } from './world-state-graph';

import { PlanningPhaseForm } from './planning-phase';

import {
    Activity,
    ChevronRight,
    Clock,
    Cookie,
    FileText,
    Globe,
    Layers,
    Play,
    Search,
    ShieldAlert,
    Target,
    X,
    Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusType, useFlowQuery } from '@/graphql/types';
import { type Finding } from '@/hooks/use-findings';
import { axios } from '@/lib/axios';
import { useSidebarFlows } from '@/providers/sidebar-flows-provider';

type PhaseStatus = 'pending' | 'active' | 'done';

interface TaskSection {
    label: string;
    items: string[];
}

interface PentestPhase {
    id: string;
    number: number;
    title: string;
    ptes: string;
    description: string;
    icon: React.ReactNode;
    status: PhaseStatus;
    tasks: string[];
    taskSections?: TaskSection[];
    prompt: (target: string) => string;
}

const PHASE_METADATA: PentestPhase[] = [
    {
        description: 'Scope, objectives, rules of engagement, authorization confirmation.',
        icon: <Target className="size-5" />,
        id: 'planning',
        number: 1,
        ptes: 'PTES: Pre-engagement Interactions',
        prompt: (t) =>
            `You are a professional penetration tester performing the planning phase for an authorized web application pentest of ${t}.

Define and document the following:

1. SCOPE — list all in-scope assets (domains, IPs, CIDRs, API endpoints). Explicitly list out-of-scope assets.
2. RULES OF ENGAGEMENT — allowed testing hours, prohibited techniques (DoS, destructive payloads), escalation contacts, emergency stop conditions.
3. TESTING TIMEFRAME — proposed start/end dates, phased milestones, buffer for remediation re-testing.
4. AUTHORIZATION — confirm written authorization exists, identify the signing authority, document the authorization reference number.
5. ASSET INVENTORY — enumerate all known assets within scope: web apps, APIs, authentication systems, third-party integrations.

Output a structured planning document in Markdown that a client can review and sign off on before testing begins.`,
        status: 'pending',
        tasks: ['Scope definition (domains, IPs, CIDRs)', 'Rules of engagement', 'Testing timeframe & duration', 'Authorization confirmation', 'Asset inventory'],
        title: 'Planning',
    },
    {
        description: 'Passive and active information gathering: headers, TLS, tech stack, endpoints.',
        icon: <Search className="size-5" />,
        id: 'recon',
        number: 2,
        ptes: 'PTES: Intelligence Gathering',
        prompt: (t) =>
            `You are a professional penetration tester performing an authorized intelligence gathering phase against ${t}.

Perform the following systematically:

1. PASSIVE OSINT
   - Enumerate DNS records: A, AAAA, MX, TXT, CNAME, NS (dig, dnsx)
   - Check Certificate Transparency logs (crt.sh, certspotter) for subdomains and certificate history
   - Search Shodan, Censys, FOFA for exposed services, open ports, and historical data
   - Harvest public metadata: LinkedIn (employee tech stack), GitHub (leaked secrets, source), job postings (tech mentions)
   - Check email security: SPF, DMARC, DKIM records; test for email spoofing vectors

2. SUBDOMAIN ENUMERATION
   - Active brute-force: subfinder, amass, dnsx with common wordlists
   - Permutation-based discovery (gotator, dnsgen): base domain variations and common prefixes (api., dev., staging., admin.)
   - Check for subdomain takeovers: CNAME pointing to unclaimed services (dangling DNS)
   - Identify subdomains pointing to internal/RFC1918 IPs (SSRF pivot candidates)

3. TECHNOLOGY FINGERPRINTING
   - Identify web server, framework, CMS, language, CDN, WAF (wappalyzer, whatweb, nuclei)
   - Extract version strings from HTTP headers (Server:, X-Powered-By:, X-Generator:), cookies, and HTML comments
   - Fingerprint load balancers, reverse proxies, and caching layers
   - Map third-party integrations (analytics, auth providers, payment SDKs); check for known CVEs per version

4. ENDPOINT & PARAMETER DISCOVERY
   - Crawl the site (gospider, hakrawler, katana) to map all reachable URLs and forms
   - Fuzz for hidden endpoints and files: feroxbuster / ffuf against common wordlists (/admin, /api/v*, /graphql, /.git, /.env)
   - Check robots.txt, sitemap.xml, .well-known/, crossdomain.xml, security.txt
   - Discover hidden parameters: arjun / x8 on all identified endpoints

5. API SURFACE MAPPING
   - Probe for API docs: /swagger, /openapi.json, /api-docs, /graphql introspection
   - Identify REST versioning (/v1/, /v2/) and test if older versions are still active
   - Map GraphQL schema: run introspection query; enumerate all types, queries, mutations, subscriptions
   - Identify authentication mechanisms per endpoint (Bearer, API key, cookie, none)

6. JS BUNDLE ANALYSIS
   - Download and deobfuscate JavaScript bundles (LinkFinder, js-beautify, relative-url-extractor)
   - Extract hardcoded secrets: API keys, tokens, S3 bucket names, internal URLs, credentials
   - Map client-side routing to discover unlisted frontend routes
   - Identify third-party SDKs and their versions for CVE matching

7. TLS/SSL ASSESSMENT
   - Run testssl.sh or sslyze against ${t}
   - Check for weak ciphers (RC4, DES, 3DES), deprecated protocol versions (SSLv2, SSLv3, TLS 1.0, TLS 1.1)
   - Check certificate validity, chain, expiry date, hostname match, and CT log presence
   - Check for missing security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy

Document all findings with exact tool commands and raw output. Flag critical exposures (leaked secrets, dangling subdomains, open admin panels) immediately.`,
        status: 'pending',
        tasks: ['Passive OSINT', 'Subdomain enumeration', 'Technology fingerprinting', 'Endpoint & parameter discovery', 'API surface mapping', 'JS bundle analysis', 'TLS/SSL assessment'],
        title: 'Reconnaissance',
    },
    {
        description: 'Map how an attacker traverses the system: trust chains, identity flows, east-west paths.',
        icon: <Layers className="size-5" />,
        id: 'threat-modeling',
        number: 3,
        ptes: 'PTES: Threat Modeling',
        prompt: (t) =>
            `You are a professional penetration tester building an attacker-centric threat model for ${t}.

The central question is: **"How will an attacker move through the system?"** — not just what assets exist, but how trust relationships between components can be abused as a traversal path.

1. TRUST BOUNDARY ANALYSIS
   - Map every trust boundary in the system: browser ↔ CDN ↔ frontend ↔ API gateway ↔ internal microservices ↔ databases ↔ cloud services
   - For each boundary: what credential/token is used to cross it? Is the caller's identity verified or assumed?
   - Identify implicit trust: services that accept requests from "internal" IPs without authentication
   - Flag boundaries where a compromised component on one side grants automatic trust on the other

2. ATTACK PATH IDENTIFICATION
   - Construct concrete attacker traversal paths from the lowest-trust entry point (unauthenticated browser) to the highest-value asset (database, admin console, cloud credentials)
   - For each path: entry point → exploited weakness → trust boundary crossed → next component reached → ultimate target
   - Rank paths by: number of hops required, exploitability of each hop, impact of reaching the end
   - Example path: XSS on frontend → session token theft → authenticated API access → SSRF to internal service → cloud metadata endpoint → IAM credentials → S3 bucket access

3. IDENTITY TRUST MAPPING
   - Map all identity principals in the system: user roles, service accounts, API keys, OAuth clients, JWT issuers
   - For each principal: what can it access? What trusts it? Can its identity be forged or replayed?
   - Identify JWT/token weaknesses: algorithm confusion (alg:none, RS256→HS256), missing expiry, overly broad scopes
   - Map OAuth trust chains: which third-party IdPs are trusted? Can an attacker register a malicious OAuth app?

4. EAST-WEST MOVEMENT PATHS
   - Assume the attacker has compromised one internal service — map all other services reachable from it
   - Which internal APIs have no authentication between microservices?
   - Which services share database credentials or API keys?
   - Which services trust requests from within the same VPC/subnet without further verification?

5. DATA FLOW ABUSE SCENARIOS
   - Trace the flow of sensitive data (PII, credentials, payment info) through the system
   - Identify where data is: logged in plaintext, cached without encryption, passed to third-party services, stored in client-accessible storage
   - For each flow: can an attacker intercept, modify, or exfiltrate the data by abusing a trust relationship?

Output a threat model document in Markdown with: trust boundary diagram (ASCII), ranked attack paths table, identity trust map, east-west reachability matrix, and top 5 most exploitable paths with STRIDE classification.`,
        status: 'pending',
        tasks: ['Trust boundary analysis', 'Attack path identification', 'Identity trust mapping', 'East-west movement paths', 'Data flow abuse scenarios'],
        title: 'Threat modeling',
    },
    {
        description: 'Identify weaknesses across authentication, access control, session management, business logic, and application attack surface.',
        icon: <ShieldAlert className="size-5" />,
        id: 'vuln-analysis',
        number: 4,
        ptes: 'PTES: Vulnerability Analysis · OWASP WSTG · Web/API Security',
        prompt: (t) =>
            `You are a professional penetration tester performing an authorized vulnerability analysis of ${t} following OWASP Top 10 2021 and OWASP WSTG.

═══ SECTOR 1: WEB & API SECURITY ═══

A01 BROKEN ACCESS CONTROL
   - Test IDOR: manipulate object references (IDs, UUIDs, filenames) to access other users' resources
   - Test horizontal and vertical privilege escalation: access admin endpoints as low-privilege user
   - Test path traversal: ../../../../etc/passwd, %2e%2e%2f variants
   - Test forced browsing: enumerate /admin, /api/internal, /v2/users/{id} without authorization

A03 INJECTION
   - SQL injection: test all inputs with ' " -- ; payloads; use sqlmap for automated detection
   - XSS (reflected, stored, DOM): inject <script>alert(1)</script> and event-handler variants in every input
   - SSTI: test with {{7*7}}, ${7*7}, #{7*7} across all template-rendered parameters
   - Command injection: ; id, && whoami, | cat /etc/passwd in filenames and system-adjacent inputs

A05 SECURITY MISCONFIGURATION
   - Check for default credentials on admin panels, databases, CMS installations
   - Check for exposed sensitive files (.git, .env, backup files, .DS_Store)
   - Check for verbose error messages disclosing stack traces, DB names, file paths
   - Verify HTTPS enforcement; check for mixed content and HTTP downgrade

A06 VULNERABLE & OUTDATED COMPONENTS
   - Match all component versions against CVE databases (NVD, Snyk, Exploit-DB)
   - Check for unpatched CMS plugins; prioritize components with public exploits

BUSINESS LOGIC & API SECURITY
   - Test price/quantity manipulation, workflow bypass, and state machine abuse
   - Test GraphQL introspection, batching abuse, and over-fetched fields
   - Test REST API: mass assignment, HTTP verb tampering, unauthenticated endpoints
   - Test for lack of rate limiting on sensitive operations (password reset, OTP)

═══ SECTOR 2: AUTHENTICATION & SESSION SECURITY ═══

AUTHENTICATION (WSTG-AUTHN)
   - Username enumeration: compare timing/response for valid vs invalid usernames
   - Brute-force protection: send 20+ rapid attempts, test X-Forwarded-For IP rotation bypass
   - MFA validation: test MFA bypass (response manipulation, code reuse, backup code abuse)
   - Password recovery: test token expiry (≤15 min), single-use enforcement, host-header injection

SESSION MANAGEMENT (WSTG-SESS)
   - Cookie flags: verify HttpOnly, Secure, SameSite=Strict/Lax on all session cookies
   - Session fixation: set pre-auth token, authenticate, confirm token rotates post-login
   - Logout invalidation: confirm old session token rejected server-side after logout
   - Session expiration: verify idle timeout and absolute session lifetime enforcement

TOKEN SECURITY
   - Token storage: HttpOnly cookie (secure) vs localStorage/sessionStorage (XSS-accessible)
   - JWT analysis: decode payload, test alg:none, weak HMAC secret (rockyou wordlist), RS256→HS256 confusion
   - Token replay: test JWT reuse across environments (dev/staging token on prod)
   - CSRF protection: verify tokens on all state-changing forms; test bypass (remove, empty, recycle)

ACCESS CONTROL & AUTHORIZATION
   - IDOR testing: manipulate all user-scoped resource references
   - RBAC / ABAC validation: attempt role escalation via parameter tampering (role=admin, isAdmin=true)
   - Tenant isolation breakout: access other tenants' data via ID manipulation or header injection
   - Object reference manipulation: test UUIDs, base64-encoded refs, sequential IDs

For each finding: provide exact HTTP request/response, CVSS v3.1 score, CWE ID, and OWASP Top 10 category.`,
        status: 'pending',
        taskSections: [
            {
                items: ['OWASP Top 10 coverage', 'Injection (SQLi, XSS, SSTI)', 'Security misconfiguration', 'Vulnerable components', 'Business logic flaws', 'API security validation', 'GraphQL / REST abuse'],
                label: 'Web & API Security',
            },
            {
                items: ['MFA validation & bypass', 'Session fixation analysis', 'Cookie security flags', 'Token storage validation', 'JWT analysis & signature', 'CSRF protection', 'Password recovery', 'Rate limiting & brute-force', 'Session expiration & invalidation'],
                label: 'Auth & Session Security',
            },
            {
                items: ['IDOR testing', 'RBAC / ABAC validation', 'Tenant isolation breakout', 'Horizontal & vertical access bypass', 'Forced browsing', 'Object reference manipulation'],
                label: 'Access Control & Authorization',
            },
        ],
        tasks: ['OWASP Top 10 coverage', 'Injection (SQLi, XSS, SSTI)', 'Security misconfiguration', 'Vulnerable components', 'Business logic flaws', 'API security', 'MFA & session security', 'JWT analysis', 'CSRF & token protection', 'IDOR & access control'],
        title: 'Vulnerability analysis',
    },
    {
        description: 'Realize theoretical attack paths from Threat Modeling: chain exploits, escalate privileges, and validate lateral movement.',
        icon: <Zap className="size-5" />,
        id: 'poc',
        number: 5,
        ptes: 'PTES: Exploitation',
        prompt: (t) =>
            `You are a senior penetration tester performing an authorized exploitation and attack path realization phase for ${t}.

This phase turns the theoretical attack paths identified in Threat Modeling into concrete, validated exploitation chains. Each attack chain must trace end-to-end impact.

1. EXPLOIT CHAINING
   - Start from an initial access vector (XSS, IDOR, SSRF, injection, misconfig)
   - Chain it with secondary findings to escalate impact (e.g., XSS → session theft → admin API → privileged action)
   - Document each hop: initial foothold → pivot → escalation → impact
   - For each chain: include exact payloads, HTTP requests (curl/Burp format), and observed response

2. PRIVILEGE ESCALATION
   - From any foothold (low-priv user, read-only token, guest session) attempt to reach higher privileges
   - Test: parameter tampering (role=admin), JWT alg:none / weak secret, IDOR to admin objects, mass assignment
   - Confirm: what operations became available after escalation? What data was exposed?

3. TRUST BOUNDARY BYPASS
   - Identify trust boundaries mapped in Threat Modeling (internal API, admin-only routes, service accounts)
   - Attempt to cross them: missing auth on internal endpoints, Host header injection, subdomain takeover, CORS misconfiguration
   - Document: which boundary was bypassed, how, and what was accessible behind it

4. SSRF PIVOTING
   - Exploit SSRF to pivot to internal services: cloud metadata (http://169.254.169.254), internal APIs, databases
   - Chain: SSRF → cloud metadata → IAM credentials → AWS/GCP/Azure API calls → S3/storage access or privilege escalation
   - Document exact URL payloads, redirects used, and data retrieved from internal resources

5. TOKEN REPLAY & SESSION ABUSE
   - Test for JWT token replay across endpoints, services, or environments (dev/staging tokens on prod)
   - Session fixation, session after logout (token not invalidated), cookie scope leakage
   - Cookie theft via XSS → replay in authenticated context → account takeover chain

6. LATERAL MOVEMENT VALIDATION
   - From a compromised service/account, enumerate accessible internal services and APIs
   - Test: service-to-service authentication bypass, shared secrets, reused credentials across services
   - Document: which internal services are reachable, what data/actions are accessible

7. CLOUD IAM ABUSE
   - If cloud metadata or credentials are accessible, enumerate IAM permissions
   - Test: over-privileged service accounts, instance metadata SSRF, misconfigured bucket policies, public snapshots
   - Demonstrate data exfiltration or privilege escalation via cloud IAM

8. SERVICE-TO-SERVICE IMPERSONATION
   - Identify internal service calls (X-Forwarded-For trust, internal JWT, API key reuse)
   - Attempt to impersonate a trusted internal service to access restricted resources
   - Document exact headers/tokens used and what was accessible

9. PAYLOAD EXECUTION
   - For any confirmed code execution surface (SSTI, command injection, RCE via deserialization) demonstrate controlled payload execution
   - Test blind execution: out-of-band callback (Burp Collaborator / interactsh) for DNS/HTTP pingback
   - For XSS: deliver a staged payload (keylogger, credential harvester, CSP bypass chain)
   - Document: execution context (user, permissions, environment), what code ran, and what was returned

10. AUTHENTICATION BYPASS
    - Test for authentication skip: direct object access without token, removing Authorization header, using null/empty Bearer
    - Test for logic flaws: multi-step auth bypass (skip step 2 of MFA), response manipulation (change "success":false to true)
    - Test OAuth misconfigurations: state parameter CSRF, open redirect in redirect_uri, implicit flow token leakage
    - Test SSO/SAML: signature wrapping, XML injection, audience bypass

11. DESERIALIZATION ABUSE
    - Identify deserialization endpoints: Java serialized objects (AC ED 00 05), PHP unserialize(), Python pickle, JSON with __class__ hints
    - Test with ysoserial (Java), PHPGGC (PHP), or custom gadget chains for the identified framework
    - For JSON deserialization: test polymorphic type injection (@class, @type, $type parameters)
    - Document: format detected, gadget chain used, achieved impact (RCE / SSRF / privilege escalation)

For every successful chain: provide executive-readable narrative + technical reproduction steps.
CVSS v3.1 score each realized attack path. Map to CWE and OWASP Top 10 2021.`,
        status: 'pending',
        tasks: ['Exploit chaining', 'Privilege escalation', 'Trust boundary bypass', 'SSRF pivoting', 'Token replay & session abuse', 'Lateral movement validation', 'Cloud IAM abuse', 'Service-to-service impersonation', 'Payload execution', 'Authentication bypass', 'Deserialization abuse'],
        title: 'Exploitation & Attack Paths',
    },
    {
        description: 'Quantify real-world impact: credential access, token harvesting, persistence, lateral movement, and cloud privilege escalation.',
        icon: <Activity className="size-5" />,
        id: 'post-exploitation',
        number: 6,
        ptes: 'PTES: Post Exploitation',
        prompt: (t) =>
            `You are a professional penetration tester performing an authorized post-exploitation and impact analysis phase for ${t}.

Your goal is NOT to cause damage but to accurately quantify the real-world business impact of confirmed access. Proceed as follows:

1. CREDENTIAL ACCESS
   - Extract credentials from any compromised endpoint: database connection strings, .env files, config files, hardcoded secrets in source
   - Dump credentials from in-memory stores if accessible: Redis, Memcached, environment variables exposed via SSRF/LFI
   - Test for credential reuse: try harvested credentials against other services discovered in recon (SSH, admin panels, cloud consoles)
   - Check for password spraying opportunity: harvested usernames + common password patterns

2. TOKEN HARVESTING
   - Collect all long-lived tokens accessible post-compromise: OAuth refresh tokens, API keys, service account keys, JWT with far future expiry
   - Extract tokens from browser storage (localStorage, sessionStorage, IndexedDB) via XSS or authenticated access
   - Identify tokens stored in plaintext in config files, environment variables, or database tables
   - Assess token scope: what does each harvested token grant access to?

3. CLOUD PRIVILEGE PERSISTENCE
   - If cloud credentials are accessible: enumerate IAM permissions (aws sts get-caller-identity, gcloud auth list)
   - Create persistent access mechanisms: add SSH key to EC2 metadata, create new IAM user/access key, attach permissive policy to compromised role
   - Check for overprivileged service accounts, instance profiles, and workload identity bindings
   - Test for privilege escalation via IAM misconfigs: iam:PassRole, lambda:InvokeFunction, sts:AssumeRole abuse

4. DATA EXPOSURE ASSESSMENT
   - Identify accessible sensitive data: PII, credentials, payment data, API keys, session tokens, business-confidential files
   - Enumerate database tables accessible via confirmed SQLi (sqlmap --tables, --dump with row limit)
   - Check for exposed cloud storage (S3 buckets, GCS, Azure Blob): list public buckets, test for unauthenticated read/write

5. PERSISTENCE MECHANISMS
   - Document whether an attacker could maintain access after session ends: OAuth token theft, JWT with long expiry, backdoor accounts
   - Identify webshell placement vectors, scheduled jobs, or webhook/serverless hooks an attacker could plant
   - Check for long-lived session tokens that survive logout or password change

6. LATERAL MOVEMENT PATHS
   - Map trust relationships: shared credentials, SSRF to internal services, API integrations, inter-service JWT
   - Test credential reuse across services discovered during recon
   - Document reachable internal services and what an attacker gains from each

7. BUSINESS IMPACT QUANTIFICATION
   - Translate findings to business language: "An attacker can extract the full customer DB (X records) without authentication"
   - Estimate regulatory exposure: GDPR Article 83 fines, PCI DSS scope impact, reputational damage
   - Assign Overall Risk Rating: Critical / High / Medium / Low based on combined impact

Document each finding: what was accessed, how, what data/access obtained, and business consequence.`,
        status: 'pending',
        tasks: ['Credential access', 'Token harvesting', 'Cloud privilege persistence', 'Data exposure scope', 'Persistence mechanisms', 'Lateral movement paths', 'Business impact & regulatory exposure'],
        title: 'Post-Exploitation',
    },
    {
        description: 'Consolidate findings, organize evidence, produce professional report.',
        icon: <FileText className="size-5" />,
        id: 'reporting',
        number: 7,
        ptes: 'PTES: Reporting',
        prompt: (t) =>
            `You are a professional penetration tester writing the final report for an authorized web application pentest of ${t}.

Produce a complete, client-ready penetration test report in Markdown:

# EXECUTIVE SUMMARY
One-page non-technical overview: what was tested, when, overall risk rating, top 3 critical findings, and the single most important immediate action.

# SCOPE & METHODOLOGY
In-scope assets, testing dates, methodology: PTES + OWASP WSTG, tools used.

# FINDINGS
For each finding (ordered Critical → High → Medium → Low → Info):
- **ID**: F-001, F-002…
- **Title**: concise vulnerability name
- **Severity**: Critical / High / Medium / Low / Info
- **CVSS v3.1**: score + vector string
- **CWE / OWASP Top 10 2021**: e.g. CWE-79 / A03:2021
- **Affected component**: exact URL, parameter, or endpoint
- **Description**: what the vulnerability is and why it exists
- **Evidence**: HTTP request/response or screenshot reference
- **Business impact**: what an attacker gains
- **Remediation**: specific actionable fix with code example
- **Effort**: Low / Medium / High

# ATTACK CHAINS
Multi-step paths that chain individual findings into higher-impact scenarios.

# REMEDIATION ROADMAP
| Finding ID | Severity | Remediation | Owner | Deadline |

# APPENDIX
Tool output references, raw scan results, PoC file inventory.

Write in clear professional English. The report must be ready for client delivery without further editing.`,
        status: 'pending',
        tasks: ['Finding consolidation & deduplication', 'Severity categorization (Critical→Low)', 'Remediation recommendations', 'PoC file compilation', 'Executive summary'],
        title: 'Report generation',
    },
];

const statusColors: Record<PhaseStatus, string> = {
    active: 'bg-blue-500/10 border-blue-500/30',
    done: 'bg-green-500/10 border-green-500/30',
    pending: 'bg-muted/40 border-border',
};

// ── Donut chart (SVG) ──────────────────────────────────────────────
const SEV_COLORS: Record<Finding['severity'], string> = {
    Critical: '#ef4444',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#3b82f6',
    Info: '#94a3b8',
};

const DonutChart = ({ segments }: { segments: Array<{ color: string; label: string; pct: number }> }) => {
    const cx = 50;
    const cy = 50;
    const ro = 44;
    const ri = 28;
    let cum = 0;

    const paths = segments.map(({ color, pct }) => {
        const a1 = ((cum / 100) * 2 * Math.PI) - Math.PI / 2;
        cum += pct;
        const a2 = ((cum / 100) * 2 * Math.PI) - Math.PI / 2;
        const large = pct > 50 ? 1 : 0;
        const ox1 = cx + ro * Math.cos(a1);
        const oy1 = cy + ro * Math.sin(a1);
        const ox2 = cx + ro * Math.cos(a2);
        const oy2 = cy + ro * Math.sin(a2);
        const ix1 = cx + ri * Math.cos(a2);
        const iy1 = cy + ri * Math.sin(a2);
        const ix2 = cx + ri * Math.cos(a1);
        const iy2 = cy + ri * Math.sin(a1);
        const d = `M${ox1} ${oy1} A${ro} ${ro} 0 ${large} 1 ${ox2} ${oy2} L${ix1} ${iy1} A${ri} ${ri} 0 ${large} 0 ${ix2} ${iy2}Z`;
        return { color, d };
    });

    return (
        <svg
            className="size-28 shrink-0"
            viewBox="0 0 100 100"
        >
            {paths.map(({ color, d }, i) => (
                <path
                    d={d}
                    fill={color}
                    key={i}
                />
            ))}
        </svg>
    );
};

// ── Trend line chart (SVG) ─────────────────────────────────────────
const TrendChart = () => {
    const points = [10, 25, 40, 60, 80, 110, 145];
    const labels = ['May 5', 'May 12', 'May 19', 'May 26', 'Jun 2'];
    const w = 200;
    const h = 80;
    const pad = { b: 20, l: 4, r: 4, t: 4 };
    const maxVal = 150;
    const xs = points.map((_, i) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r));
    const ys = points.map((v) => pad.t + (1 - v / maxVal) * (h - pad.t - pad.b));
    const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
    const area = `${xs[0]},${h - pad.b} ` + xs.map((x, i) => `${x},${ys[i]}`).join(' ') + ` ${xs[xs.length - 1]},${h - pad.b}`;

    return (
        <svg
            className="w-full"
            viewBox={`0 0 ${w} ${h}`}
        >
            <defs>
                <linearGradient
                    id="trendGrad"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                >
                    <stop
                        offset="0%"
                        stopColor="#3b82f6"
                        stopOpacity="0.25"
                    />
                    <stop
                        offset="100%"
                        stopColor="#3b82f6"
                        stopOpacity="0"
                    />
                </linearGradient>
            </defs>
            <polygon
                fill="url(#trendGrad)"
                points={area}
            />
            <polyline
                fill="none"
                points={polyline}
                stroke="#3b82f6"
                strokeWidth="2"
            />
            {xs.map((x, i) => (
                <circle
                    cx={x}
                    cy={ys[i]}
                    fill="#3b82f6"
                    key={i}
                    r="2.5"
                />
            ))}
            {labels.map((label, i) => {
                const idx = Math.round((i / (labels.length - 1)) * (points.length - 1));
                return (
                    <text
                        fill="#94a3b8"
                        fontSize="7"
                        key={label}
                        textAnchor="middle"
                        x={xs[idx]}
                        y={h - 4}
                    >
                        {label}
                    </text>
                );
            })}
        </svg>
    );
};

// ── Scope tag input ────────────────────────────────────────────────
const ScopeTagInput = ({
    items,
    onChange,
}: {
    items: string[];
    onChange: (items: string[]) => void;
}) => {
    const [draft, setDraft] = useState('');

    const commit = (val: string) => {
        const trimmed = val.trim().replace(/,+$/, '');
        if (trimmed && !items.includes(trimmed)) onChange([...items, trimmed]);
        setDraft('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit(draft);
        } else if (e.key === 'Backspace' && !draft && items.length > 0) {
            onChange(items.slice(0, -1));
        }
    };

    return (
        <div className="flex flex-col gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5">
            <div className="flex items-center gap-1.5">
                <Target className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                    placeholder={items.length === 0 ? 'Add scope: domain, IP, CIDR… (Enter)' : 'Add more…'}
                    value={draft}
                    onBlur={() => { if (draft.trim()) commit(draft); }}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>
            {items.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {items.map((item) => (
                        <span
                            className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            key={item}
                        >
                            {item}
                            <button
                                className="ml-0.5 hover:text-blue-900"
                                type="button"
                                onClick={() => onChange(items.filter((i) => i !== item))}
                            >
                                <X className="size-2.5" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Phase card ─────────────────────────────────────────────────────
interface PhaseCardProps {
    cookies?: string;
    disabled: boolean;
    launchLabel?: string;
    onCookiesChange?: (v: string) => void;
    onLaunch: () => void;
    phase: PentestPhase;
    scopeItems?: string[];
    onScopeChange?: (items: string[]) => void;
}

const PhaseCard = ({ cookies, disabled, launchLabel, onCookiesChange, onLaunch, phase, scopeItems, onScopeChange }: PhaseCardProps) => (
    <Card className={`flex h-full flex-col border transition-shadow hover:shadow-md ${statusColors[phase.status]}`}>
        <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-background/60 text-xs font-bold text-muted-foreground">
                        {phase.number}
                    </span>
                    <div className="text-foreground">{phase.icon}</div>
                </div>
                <Badge variant="outline">
                    <Clock className="mr-1 size-3" />
                    Pending
                </Badge>
            </div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{phase.ptes}</p>
            <CardTitle className="text-base">{phase.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{phase.description}</p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 pt-0">
            <div className="flex-1">
                {phase.taskSections ? (
                    <div className="space-y-3">
                        {phase.taskSections.map((section) => (
                            <div key={section.label}>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{section.label}</p>
                                <ul className="space-y-0.5">
                                    {section.items.map((item) => (
                                        <li
                                            className="flex items-center gap-2 text-xs text-muted-foreground"
                                            key={item}
                                        >
                                            <ChevronRight className="size-3 shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : (
                    <ul className="space-y-1">
                        {phase.tasks.map((task) => (
                            <li
                                className="flex items-center gap-2 text-xs text-muted-foreground"
                                key={task}
                            >
                                <ChevronRight className="size-3 shrink-0" />
                                {task}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {phase.id === 'planning' && onScopeChange && (
                <ScopeTagInput
                    items={scopeItems ?? []}
                    onChange={onScopeChange}
                />
            )}
            {phase.id === 'recon' && onCookiesChange && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                    <Cookie className="size-3.5 shrink-0 text-muted-foreground" />
                    <Input
                        className="h-6 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                        placeholder="Session cookies (optional)"
                        value={cookies}
                        onChange={(e) => onCookiesChange(e.target.value)}
                    />
                </div>
            )}
            {phase.id === 'reporting' && (
                <a
                    className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    href="http://www.pentest-standard.org/"
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    The Penetration Testing Execution Standard (PTES)
                </a>
            )}
            <Button
                className="mt-1 w-full gap-2"
                disabled={disabled}
                size="sm"
                onClick={onLaunch}
            >
                <Play className="size-3.5" />
                {launchLabel ?? 'Launch'}
            </Button>
        </CardContent>
    </Card>
);

// ── World State section ────────────────────────────────────────────

interface WorldStateEntity {
    id: string;
    type: string;
    label: string;
    riskLevel: string;
    metadata: Record<string, string>;
}

interface WorldStateLink {
    id: string;
    source: string;
    target: string;
    label?: string;
    type: string;
}

interface WorldStateResponse {
    data?: {
        entities: WorldStateEntity[];
        links: WorldStateLink[];
        flowId: number;
    };
}

const WS_RISK_DOT: Record<string, string> = {
    critical: 'bg-red-500',
    high:     'bg-orange-500',
    medium:   'bg-yellow-500',
    low:      'bg-blue-500',
    none:     'bg-slate-400',
};


const WS_RISK_ORDER = ['critical', 'high', 'medium', 'low', 'none'];

// Section definitions: order and display config for each entity type
const WS_SECTIONS: Array<{
    key: string;
    types: string[];
    label: string;
}> = [
    { key: 'target',        types: ['target'],        label: 'Attack Surface'  },
    { key: 'vulnerability', types: ['vulnerability'], label: 'Vulnerabilities' },
    { key: 'threat',        types: ['threat'],         label: 'Threats'         },
    { key: 'finding',       types: ['finding'],        label: 'Findings'        },
    { key: 'endpoint',      types: ['endpoint'],       label: 'Endpoints'       },
    { key: 'domain',        types: ['domain'],         label: 'Network'         },
];

const WorldStateDashboardSection = () => {
    const { flows } = useSidebarFlows();
    const [selectedFlowId, setSelectedFlowId] = useState<string>('');
    const [entities, setEntities] = useState<WorldStateEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['target', 'vulnerability', 'threat']));
    const [links, setLinks] = useState<WorldStateLink[]>([]);
    const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');

    const candidateFlows = useMemo(
        () => [...flows].sort((a, b) => {
            const order = [StatusType.Finished, StatusType.Running, StatusType.Waiting, StatusType.Created, StatusType.Failed];
            return order.indexOf(a.status) - order.indexOf(b.status);
        }),
        [flows],
    );

    useEffect(() => {
        if (!selectedFlowId && candidateFlows.length > 0) {
            setSelectedFlowId(candidateFlows[0]?.id ?? '');
        }
    }, [candidateFlows, selectedFlowId]);

    useEffect(() => {
        if (!selectedFlowId) return;
        setLoading(true);
        axios
            .get<never, WorldStateResponse>(`/flows/${selectedFlowId}/worldstate`)
            .then((res) => {
                setEntities(res.data?.entities ?? []);
                setLinks(res.data?.links ?? []);
            })
            .catch(() => { setEntities([]); setLinks([]); })
            .finally(() => setLoading(false));
    }, [selectedFlowId]);

    const neo4jEntities = useMemo(
        () => entities.filter((e) => e.metadata?.source === 'neo4j'),
        [entities],
    );

    const byType = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const e of neo4jEntities) counts[e.type] = (counts[e.type] ?? 0) + 1;
        return counts;
    }, [neo4jEntities]);

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const totalRelevant = (byType['target'] ?? 0) + (byType['vulnerability'] ?? 0) + (byType['threat'] ?? 0) + (byType['finding'] ?? 0);

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div>
                            <CardTitle className="text-sm font-semibold">World State</CardTitle>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                                Attack surface from knowledge graph
                            </p>
                        </div>
                        {neo4jEntities.length > 0 && (
                            <div className="flex items-center gap-2 text-[11px]">
                                {(byType['target']        ?? 0) > 0 && <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{byType['target']} targets</span>}
                                {(byType['vulnerability'] ?? 0) > 0 && <span className="rounded-md bg-red-50 px-2 py-0.5 font-medium text-red-700">{byType['vulnerability']} vulns</span>}
                                {(byType['threat']        ?? 0) > 0 && <span className="rounded-md bg-orange-50 px-2 py-0.5 font-medium text-orange-700">{byType['threat']} threats</span>}
                                {(byType['finding']       ?? 0) > 0 && <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">{byType['finding']} findings</span>}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {candidateFlows.length > 0 && (
                            <select
                                className="rounded border bg-background px-2 py-1 text-[11px] text-foreground"
                                onChange={(e) => setSelectedFlowId(e.target.value)}
                                value={selectedFlowId}
                            >
                                {candidateFlows.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        #{f.id} {f.title.length > 38 ? f.title.slice(0, 38) + '…' : f.title}
                                    </option>
                                ))}
                            </select>
                        )}
                        <div className="flex overflow-hidden rounded border text-[11px]">
                            <button
                                className={`px-2 py-1 ${viewMode === 'graph' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                                onClick={() => setViewMode('graph')}
                                type="button"
                            >Graph</button>
                            <button
                                className={`border-l px-2 py-1 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                                onClick={() => setViewMode('table')}
                                type="button"
                            >Table</button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {loading ? (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                        Loading knowledge graph…
                    </div>
                ) : totalRelevant === 0 && neo4jEntities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                        <p className="text-xs font-medium text-muted-foreground">
                            No pentest-relevant entities found
                        </p>
                        <p className="max-w-xs text-[11px] text-muted-foreground">
                            World State is populated after Recon phase completes.
                        </p>
                    </div>
                ) : viewMode === 'graph' ? (
                    <WorldStateGraph entities={neo4jEntities} links={links} />
                ) : (
                    <div className="flex flex-col divide-y">
                        {WS_SECTIONS.map((section) => {
                            const rows = neo4jEntities
                                .filter((e) => section.types.includes(e.type))
                                .sort((a, b) => WS_RISK_ORDER.indexOf(a.riskLevel) - WS_RISK_ORDER.indexOf(b.riskLevel));
                            if (rows.length === 0) return null;
                            const key = section.key;
                            const expanded = expandedSections.has(key);
                            return (
                                <div key={key}>
                                    {/* Section header */}
                                    <button
                                        className="flex w-full items-center gap-2 py-2 text-left"
                                        onClick={() => toggleSection(key)}
                                        type="button"
                                    >
                                        <span className="text-[11px] font-semibold text-foreground">{section.label}</span>
                                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{rows.length}</span>
                                        <ChevronRight className={`ml-auto size-3 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                                    </button>
                                    {/* Rows */}
                                    {expanded && (
                                        <div className="mb-2 overflow-hidden rounded-lg border">
                                            <table className="w-full text-xs">
                                                <tbody>
                                                    {rows.map((e) => {
                                                        const risk = e.riskLevel || 'none';
                                                        return (
                                                            <tr
                                                                className="border-b last:border-0 hover:bg-muted/30"
                                                                key={e.id}
                                                            >
                                                                <td className="w-28 px-3 py-2">
                                                                    {risk !== 'none' ? (
                                                                        <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${WS_RISK_CLS[risk] ?? WS_RISK_CLS.none}`}>
                                                                            <span className={`size-1.5 rounded-full ${WS_RISK_DOT[risk] ?? WS_RISK_DOT.none}`} />
                                                                            {risk}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-muted-foreground">—</span>
                                                                    )}
                                                                </td>
                                                                <td className="max-w-[180px] px-2 py-2 font-medium text-foreground">
                                                                    <p className="truncate" title={e.label}>{e.label}</p>
                                                                </td>
                                                                <td className="px-2 py-2 text-muted-foreground">
                                                                    <p className="line-clamp-2 text-[10px]">{e.metadata?.summary}</p>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// ── Shared finding types (mirror Findings page) ───────────────────
interface ExtractedFinding {
    title: string;
    severity: string;
    target: string;
    description: string;
    cve: string;
    remediation: string;
    phase: string;
}
interface FindingsExtractResponse { flow_id: number; findings: ExtractedFinding[]; }

const SEVERITIES_ORDER: Finding['severity'][] = ['Critical', 'High', 'Medium', 'Low', 'Info'];
const SEV_STYLE_DASH: Record<Finding['severity'], string> = {
    Critical: 'bg-red-100 text-red-700 border-red-200',
    High:     'bg-orange-100 text-orange-700 border-orange-200',
    Medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    Low:      'bg-blue-100 text-blue-700 border-blue-200',
    Info:     'bg-gray-100 text-gray-600 border-gray-200',
};
const llmCacheKey = (id: string) => `llm-findings-v2-${id}`;

// ── Dashboard section (real data) ─────────────────────────────────
const DashboardSection = () => {
    const { flows } = useSidebarFlows();
    const [selectedFlowId, setSelectedFlowId] = useState('');
    const [llmFindings, setLlmFindings] = useState<ExtractedFinding[]>([]);
    const [llmLoading, setLlmLoading] = useState(false);

    useEffect(() => {
        if (!selectedFlowId && flows.length > 0) {
            setSelectedFlowId(flows[0]?.id ?? '');
        }
    }, [flows, selectedFlowId]);

    // Fetch LLM findings for selected flow (with localStorage cache)
    useEffect(() => {
        if (!selectedFlowId) { setLlmFindings([]); return; }
        try {
            const cached = localStorage.getItem(llmCacheKey(selectedFlowId));
            if (cached) {
                const parsed = JSON.parse(cached) as Array<{ severity?: string; title?: string; target?: string; description?: string; cve?: string; remediation?: string; phase?: string }>;
                setLlmFindings(parsed.map((f) => ({
                    title: f.title ?? '',
                    severity: f.severity ?? 'Info',
                    target: f.target ?? '',
                    description: f.description ?? '',
                    cve: f.cve ?? '',
                    remediation: f.remediation ?? '',
                    phase: f.phase ?? '',
                })));
                return;
            }
        } catch { /* ignore */ }
        setLlmLoading(true);
        setLlmFindings([]);
        axios
            .get<never, { data: FindingsExtractResponse }>(`/flows/${selectedFlowId}/extract-findings/`)
            .then((res) => {
                const f = res.data?.findings ?? [];
                setLlmFindings(f);
                localStorage.setItem(llmCacheKey(selectedFlowId), JSON.stringify(f));
            })
            .catch(() => setLlmFindings([]))
            .finally(() => setLlmLoading(false));
    }, [selectedFlowId]);

    const { loading } = useFlowQuery({
        variables: { id: selectedFlowId },
        skip: !selectedFlowId,
    });

    // Severity counts from LLM findings (real security findings)
    const findingCounts = useMemo(() => {
        const c: Record<Finding['severity'], number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
        llmFindings.forEach((f) => {
            const sev = SEVERITIES_ORDER.includes(f.severity as Finding['severity']) ? f.severity as Finding['severity'] : 'Info';
            c[sev] = (c[sev] ?? 0) + 1;
        });
        return c;
    }, [llmFindings]);

    const findingTotal = llmFindings.length;

    const donutSegments = useMemo(() =>
        SEVERITIES_ORDER
            .map((sev) => ({ color: SEV_COLORS[sev], label: sev, pct: findingTotal > 0 ? Math.round((findingCounts[sev] / findingTotal) * 100) : 0 }))
            .filter((s) => s.pct > 0),
    [findingCounts, findingTotal]);

    return (
        <>
            {/* Flow selector */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground shrink-0">Flow</span>
                <select
                    className="h-8 max-w-sm flex-1 rounded-md border border-border bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    value={selectedFlowId}
                    onChange={(e) => setSelectedFlowId(e.target.value)}
                >
                    <option value="">— select a flow —</option>
                    {flows.map((f) => (
                        <option key={f.id} value={f.id}>
                            #{f.id} {f.title.length > 55 ? f.title.slice(0, 55) + '…' : f.title}
                        </option>
                    ))}
                </select>
                {(loading || llmLoading) && <span className="text-[11px] text-muted-foreground animate-pulse">Loading…</span>}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Security Findings</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 pt-0">
                        <div className="text-4xl font-bold">{findingTotal}</div>
                        <div className="text-xs text-muted-foreground">from selected flow</div>
                        <div className="flex gap-3 text-sm font-semibold">
                            <span className="text-red-600">{findingCounts.Critical}</span>
                            <span className="text-orange-500">{findingCounts.High}</span>
                            <span className="text-yellow-500">{findingCounts.Medium}</span>
                            <span className="text-blue-500">{findingCounts.Low}</span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                            <span>Critical</span><span>High</span><span>Medium</span><span>Low</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Findings by Severity</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-3 pt-0">
                        {findingTotal > 0 ? (
                            <>
                                <DonutChart segments={donutSegments} />
                                <div className="flex flex-col gap-1.5 text-xs">
                                    {donutSegments.map(({ color, label, pct }) => (
                                        <div className="flex items-center gap-1.5" key={label}>
                                            <span className="inline-block size-2 rounded-full" style={{ background: color }} />
                                            <span className="text-muted-foreground">{label} ({pct}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="py-2 text-xs text-muted-foreground">
                                {selectedFlowId ? (llmLoading ? 'Analyzing…' : 'No findings for this flow.') : 'Select a flow above.'}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Findings Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <TrendChart />
                    </CardContent>
                </Card>
            </div>

            {/* LLM-extracted Security Findings list */}
            {(llmFindings.length > 0 || llmLoading) && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">Security Findings</CardTitle>
                            {llmLoading && <span className="text-[11px] text-muted-foreground animate-pulse">AI is analyzing…</span>}
                            {!llmLoading && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{llmFindings.length}</span>}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {llmLoading ? (
                            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">Analyzing flow with AI…</div>
                        ) : (
                            <div className="flex flex-col divide-y">
                                {llmFindings.map((f, i) => {
                                    const sev = (SEVERITIES_ORDER.includes(f.severity as Finding['severity']) ? f.severity : 'Info') as Finding['severity'];
                                    return (
                                        <div className="flex items-start gap-3 py-2.5" key={i}>
                                            <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SEV_STYLE_DASH[sev]}`}>{sev}</span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-medium leading-snug">{f.title}</p>
                                                {f.target && <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{f.target}</p>}
                                                {f.description && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{f.description}</p>}
                                            </div>
                                            {f.cve && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{f.cve}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <WorldStateDashboardSection />
        </>
    );
};

// ── Main page ──────────────────────────────────────────────────────
const WebPentest = ({ mode = 'dashboard' }: { mode?: 'dashboard' | 'phases' }) => {
    const navigate = useNavigate();
    const [target, setTarget] = useState('');
    const [cookies, setCookies] = useState('');
    const [planningScope, setPlanningScope] = useState<string[]>([]);
    const [showPlanning, setShowPlanning] = useState(false);

    const handleLaunch = (phase: PentestPhase) => {
        const t = target.trim();
        if (!t) return;
        let promptText = phase.prompt(t);
        if (phase.id === 'planning' && planningScope.length > 0) {
            promptText += ` The scope includes the following targets: ${planningScope.join(', ')}.`;
        }
        if (phase.id === 'recon' && cookies.trim()) {
            promptText += ` Use the following session cookies for authenticated reconnaissance: ${cookies.trim()}`;
        }
        if (phase.id === 'auth-testing' && cookies.trim()) {
            promptText += ` The application uses the following authentication tokens/cookies — include these in your testing: ${cookies.trim()}`;
        }
        navigate(`/flows/new?prompt=${encodeURIComponent(promptText)}`);
    };

    const noTarget = !target.trim();;

    return (
        <>
            <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbPage>{mode === 'phases' ? 'Phases' : 'Dashboard'}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </header>

            <div className="flex flex-col gap-5 p-6">

                {/* ── PHASES mode ── */}
                {mode === 'phases' && !showPlanning && (
                    <>
                        {/* Page title */}
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                                <Globe className="size-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold">Web Application Pentest</h1>
                                <p className="text-sm text-muted-foreground">8-phase PTES methodology · OWASP WSTG-aligned</p>
                            </div>
                        </div>

                        {/* Target input */}
                        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
                            <Globe className="size-4 shrink-0 text-muted-foreground" />
                            <Input
                                className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                                placeholder="Target: e.g. example.com or 10.0.0.1"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                            />
                        </div>

                        {/* Phase grid */}
                        <div className="grid grid-cols-3 gap-4">
                            {PHASE_METADATA.map((phase) => (
                                <PhaseCard
                                    key={phase.id}
                                    phase={phase}
                                    disabled={phase.id === 'planning' ? false : noTarget}
                                    launchLabel={phase.id === 'planning' ? 'Open Planning' : undefined}
                                    cookies={phase.id === 'recon' || phase.id === 'auth-testing' ? cookies : undefined}
                                    onCookiesChange={phase.id === 'recon' || phase.id === 'auth-testing' ? setCookies : undefined}
                                    scopeItems={phase.id === 'planning' ? planningScope : undefined}
                                    onScopeChange={phase.id === 'planning' ? setPlanningScope : undefined}
                                    onLaunch={() => phase.id === 'planning' ? setShowPlanning(true) : handleLaunch(phase)}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* ── PLANNING form (inline expansion) ── */}
                {mode === 'phases' && showPlanning && (
                    <PlanningPhaseForm onBack={() => setShowPlanning(false)} />
                )}

                {/* ── DASHBOARD mode ── */}
                {mode === 'dashboard' && <DashboardSection />}

            </div>
        </>
    );
};

export const WebPentestPhases = () => <WebPentest mode="phases" />;
export default WebPentest;
