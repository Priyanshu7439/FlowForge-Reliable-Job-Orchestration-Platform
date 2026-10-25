# Engineering Learnings

## Docker and runtime drift

- **Symptom:** the host API was reachable, but dependency requests hung and health responses did not match checked-in source.
- **Investigation:** bounded HTTP probes, Docker Desktop host logs, Compose inspection from an authorized terminal, and source/runtime comparison.
- **Verified lesson:** a container can remain running while its application protocol or Linux Engine is unhealthy. The Docker API proxy logged timeouts to the Linux VM, and later the API response shape differed from the checked-in implementation.
- **Trade-off:** recovery preserved named volumes and avoided resets/rebuilds until a source/image mismatch was established.

## Authentication and CORS

- **Symptom:** protected dashboard requests returned 401 while public health worked.
- **Investigation:** inspected `api.ts`, cookie attributes, CORS headers, login/session tests, and protected route behavior.
- **Verified fix:** browser requests include credentials; the API uses an HTTP-only root-scoped development cookie; configured frontend origins include ports 3000 and 3002; unauthenticated dashboard access now routes to login.

## Honest service health

- **Symptom:** topology showed the SSE stream as an exception.
- **Investigation:** traced the health response and SSE route.
- **Verified lesson:** SSE is an authenticated per-user stream, not a globally probeable dependency. Reporting `unknown` is more accurate than fabricating a green service signal.

## Remaining uncertainty

The isolated benchmark job lifecycle and retry integration tests have passed. The repository still does not claim production-scale capacity, uptime, predictive matching accuracy, or a complete browser-level recruiter-to-candidate workflow unless separately evidenced.
