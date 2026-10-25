# Security

- Passwords are hashed with Argon2id.
- Sessions are signed JWTs in HTTP-only, SameSite cookies; production requires Secure cookies and HTTPS.
- Zod/Pydantic validate every public and internal payload.
- Owner checks are applied to every job, attempt, result, and schedule query.
- The executor exposes only allowlisted deterministic handlers; it never evaluates user code or shell commands.
- Internal executor calls require `EXECUTOR_SHARED_SECRET`.
- Request bodies, uploads, logs, and error messages are bounded and sanitized.
- Redis-backed rate limiting is enabled when Redis is configured; the API has a conservative in-process fallback for local development.

Remaining limitations are documented in `IMPLEMENTATION_STATUS.md`; production deployments must use managed TLS, secret storage, and persistent object storage for large outputs.
