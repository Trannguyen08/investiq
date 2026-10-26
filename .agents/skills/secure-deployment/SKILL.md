---
name: secure-deployment
description: Verify and enforce web application deployment security, prevent sensitive credential leaks, and protect web services against malicious attacks based on industry gold standards (OWASP, Gitleaks, API Security Checklist). Use before, during, or after web deployments.
---

# Web Deployment Security & Attack Mitigation

Apply this skill whenever preparing, validating, or auditing web deployments to eliminate sensitive information leaks and harden web services against common web attacks. Grounded in industry-standard practices from high-starred open-source security repositories:
- **OWASP/CheatSheetSeries** (~33k★): Web Application Security Controls & Secure Headers
- **gitleaks/gitleaks** (~30k★) & **trufflesecurity/trufflehog** (~28k★): Secret Leak Prevention & Pipeline Scanning
- **shieldfy/API-Security-Checklist** (~23k★): API Hardening & Access Protection
- **OWASP/Top10** & **OWASP/API-Security**: Application & API Vulnerability Defenses

Read `../../rules/security.md`, `../../rules/devops.md`, and `../../rules/privacy.md` alongside this skill.

---

## 1. Zero Sensitive Information & Secret Leakage

### A. Environment & Secret Management
- **Never commit secrets**: No API keys, database credentials, private keys (`.pem`, `.key`), JWT secrets, or cloud tokens may exist in Git commits, Dockerfiles, or client bundles.
- **Run automated secret scanners**: Verify branches and commits with Gitleaks or TruffleHog patterns before pushing to remote.
- **Isolate environment files**: Keep `.env*`, `.neon`, `.credentials`, and local configuration files strictly ignored in both `.gitignore` and `.dockerignore`.
- **Runtime injection only**: Inject secrets strictly at runtime via encrypted environment variables or dedicated secret managers (e.g. Render Secret Files/Env, AWS Secrets Manager, HashiCorp Vault).

### B. Frontend Bundle Sanitization
- **Audit public prefixes**: In Next.js, verify that `NEXT_PUBLIC_*` variables contain ONLY public constants (e.g. public WebSocket URL, analytics ID). Never prefix server secrets, database URLs, or signing keys with `NEXT_PUBLIC_`.
- **Disable production source maps**: Ensure `productionBrowserSourceMaps: false` in production builds (`next.config.js`) to prevent exposing unminified code, internal logic, and backend route names to end users.
- **BFF (Backend-For-Frontend) Isolation**: Keep session decryption and token exchanges server-side. The browser should only receive encrypted, HTTP-only session cookies.

### C. Error & Response Masking
- **Suppress stack traces**: Production API and web servers must NEVER return raw tracebacks, database schema names, SQL query strings, or runtime versions in HTTP 4xx/5xx responses.
- **Use correlation IDs**: Log detailed errors internally with a unique request/trace ID (`x-request-id`), returning only a generic user-safe error message and the ID to the client.

---

## 2. Web Attack Defenses & Hardening

### A. Strict HTTP Security Headers
Ensure the web server, proxy, or Next.js/FastAPI middleware delivers modern defense-in-depth headers:
- `Content-Security-Policy (CSP)`: Restrict script, object, and style sources; block `unsafe-inline` where practical.
- `Strict-Transport-Security (HSTS)`: `max-age=31536000; includeSubDomains; preload` to enforce HTTPS.
- `X-Content-Type-Options: nosniff`: Prevent MIME-type sniffing attacks.
- `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`): Prevent clickjacking attacks.
- `Referrer-Policy: strict-origin-when-cross-origin`: Prevent leaking URL query parameters to third parties.
- `Permissions-Policy`: Restrict unauthorized camera, microphone, and geolocation access (`camera=(), microphone=(), geolocation=()`).

### B. CORS & Request Restriction
- **Explicit origin whitelist**: Never configure `Access-Control-Allow-Origin: *` when `Access-Control-Allow-Credentials: true` is enabled. Match only verified, trusted origin domains.
- **Strict method and header filtering**: Allow only required HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`) and essential custom headers (`Content-Type`, `Authorization`, `X-CSRF-Token`).

### C. Rate Limiting & DoS Mitigation
- **Throttling sensitive endpoints**: Enforce strict rate limits on authentication (`/login`, `/register`, `/auth-api/*`), password reset, and external proxy routes using Redis or in-memory fixed-window fallback.
- **Payload size caps**: Limit incoming request body size (e.g. `LimitRequestBody 1048576` / 1MB in Nginx/FastAPI) to prevent buffer exhaustion and memory exhaustion attacks.

### D. Injection & Server-Side Request Forgery (SSRF) Defenses
- **SQL Injection**: Exclusively use parameterized queries (`%s`, `$1`, or ORM query builders); never concatenate raw user strings into SQL statements.
- **SSRF Prevention on Crawlers/Fetchers**: For services crawling external RSS feeds, news URLs, or webhooks:
  - Whitelist HTTP/HTTPS schemes only.
  - Resolve IP addresses and immediately reject private/internal IP ranges (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`), and cloud metadata IP (`169.254.169.254`).

### E. Session & Cookie Defense
- Cookies must always be configured with:
  - `HttpOnly`: Prevents client-side script theft (XSS).
  - `Secure`: Transmitted only over HTTPS.
  - `SameSite=Lax` or `SameSite=Strict`: Protects against Cross-Site Request Forgery (CSRF).
  - `__Host-` prefix where path is `/` and domain is omitted, locking cookies to the origin.

### F. Container & Runtime Isolation
- **Non-root execution**: Run application containers as an unprivileged user (e.g. `USER nonroot` or `UID 10001`).
- **Minimal attack surface**: Use minimal base images (Alpine, Distroless); omit compilers, build tools, package managers, and debug utilities from the final production stage.
- **Least privilege**: Avoid mounting the host Docker socket (`/var/run/docker.sock`) or granting root capabilities.

---

## 3. Deployment Security Verification Checklist

Execute this checklist before approving any production release:

1. **Pre-Deploy Code & Git Audit**:
   - [ ] No uncommitted or committed `.env` files in git history.
   - [ ] `git diff` contains no hardcoded credentials, test passwords, or private keys.
   - [ ] Dependencies audited for known vulnerabilities (`npm audit`, `pip audit`).
2. **Build & Config Verification**:
   - [ ] Production build succeeds without emitting unminified source maps to public assets.
   - [ ] Cloud environment variables populated exclusively in provider secret dashboard.
   - [ ] Health checks (`/healthz`, `/readyz`) verified not to leak environment dump or connection strings.
3. **Live Probe (Post-Deploy)**:
   - [ ] Inspect HTTP response headers via `curl -I https://<domain>` to confirm CSP, HSTS, and X-Content-Type-Options.
   - [ ] Test unauthenticated access to protected routes: returns clean `401 Unauthorized` without server details.
   - [ ] Trigger intentional error route: returns generic error message with no stack trace or SQL snippet.
