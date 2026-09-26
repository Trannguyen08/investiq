# Security, Authentication, and Validation Rules

Apply to every trust boundary. Security-control reductions, auth model changes, and secret handling
require explicit review and cannot be introduced merely to make a failing call work.

## Identity and access

- Verify token/session signature plus expected algorithm, issuer, audience, expiry, and revocation.
  Decoding claims without verification is untrusted input.
- Resolve actor ID and role from verified context. Never trust client-supplied user IDs or roles.
- Authentication never substitutes for resource-level authorization; verify ownership/tenant scope
  for every portfolio, alert, export, admin, and model-management action.
- Return uniform login/recovery errors to prevent account enumeration. Regenerate/rotate sessions
  after login and privilege changes; revoke on logout, password change, and account disablement.
- Store refresh/reset/verification token hashes, not replayable raw tokens. Use short-lived access
  tokens and rotate refresh-token families with reuse detection.
- Prefer Argon2id for passwords with tuned parameters and a breached-password check. Never build
  cryptographic primitives; use maintained platform/library APIs and CSPRNG-generated tokens.
- Choose one browser auth model explicitly. Cookie auth requires `HttpOnly`, `Secure`, appropriate
  `SameSite`, and CSRF protection; bearer auth must not expose privileged credentials to client code.

## Boundary protection

- Validate and bound body, query, path, header, upload, list length, nesting depth, and file size.
  Reject unknown write fields and serialize responses through explicit allowlisted schemas.
- Parameterize SQL. Resolve filesystem paths against a fixed root and verify containment.
- Treat outbound user-controlled URLs as SSRF: prefer destination allowlists and reject private,
  loopback, link-local, metadata, unsafe schemes, and unsafe redirects after DNS resolution.
- CORS uses exact trusted origins, methods, and headers. Never combine wildcard origins with credentials.
- Apply contextual output escaping and maintained sanitizers; never bypass React escaping for
  untrusted HTML without a reviewed sanitizer.
- Rate-limit auth, recovery, admin, export, prediction/training, and other abuse- or cost-sensitive
  endpoints using shared atomic counters across replicas; return `429` with `Retry-After`.

## Secrets and auditability

- Secrets live in environment/secret stores, never source, images, URLs, client bundles, fixtures,
  logs, agent memory, or committed env files. Fail startup when required secrets are missing.
- Central logger redaction covers authorization, cookies, API keys, passwords, tokens, and personal
  financial fields; raw request payloads are not logged.
- Record authentication failures, authorization denials, role changes, admin actions, data exports,
  and credential rotations with actor, target, request ID, timestamp, and outcome—without secrets.
- Use least-privilege database, broker, cloud, and CI credentials and separate roles by workload.
