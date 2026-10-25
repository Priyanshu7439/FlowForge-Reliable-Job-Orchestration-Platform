# Recruiter Project Highlights

These statements are intentionally limited to evidence retained in the repository. A recorded audit run passed 45/45 tests; a later user-observed validation reported API 21/21, worker 6/6, web 15/15, and executor 6/6, plus 2/2 isolated lifecycle integration tests. These are test results, not coverage or production reliability.

Isolated bounded queue benchmarks are now available for a 10-job reliability run and repeated 50-job concurrency runs. They are local workflow measurements, not production or load tests.

## Five defensible engineering achievements

1. Implemented a separated TypeScript/Express API, Prisma/PostgreSQL persistence layer, Redis/BullMQ worker, and FastAPI executor architecture.
2. Implemented HTTP-only JWT sessions with candidate/recruiter role checks and owner-scoped resource authorization in the API.
3. Implemented deterministic, explainable candidate-job matching from explicitly persisted skills and experience thresholds, including an incomplete-profile state instead of an unsupported score.
4. Added Prisma-backed candidate and recruiter/company profile models, recruitment postings, applications, and database uniqueness constraints for application pairs.
5. Maintained passing automated validation across API, worker, web, and Python executor suites, with a separate isolated integration run covering normal completion and controlled retry recovery.

## ATS-friendly resume bullets

- Engineered a TypeScript/Express, Prisma/PostgreSQL, Redis/BullMQ, and FastAPI orchestration platform with durable job lifecycle records, retry decisions, cancellation routes, and transactional outbox publication.
- Implemented HTTP-only JWT authentication with role-based candidate/recruiter authorization and owner-scoped API resource checks.
- Built deterministic candidate-job matching from explicit skill overlap and experience thresholds, returning explainable matched/missing skills and an honest incomplete-profile state.
- Recorded 45/45 suite tests and later user-observed 21 API, 6 worker, 15 web, and 6 executor tests passing, plus 2/2 isolated lifecycle integration tests; these are not code coverage or production throughput evidence.

## LinkedIn project description

FlowForge is a full-stack recruitment and reliable job-orchestration demo. Its source includes role-aware recruitment workflows, explainable rule-based matching, profile persistence, applications, durable job records, retries, an outbox publisher, and a constrained FastAPI task executor. It also includes bounded local queue measurements; authenticated recruitment E2E and production-scale behavior remain unverified.

## 60-second technical explanation

FlowForge separates the public Express API from asynchronous BullMQ workers and a constrained FastAPI executor. PostgreSQL is used for durable lifecycle state and recruitment records; the outbox publisher makes queue publication recoverable, while Redis provides queue coordination and best-effort event delivery. The recruitment layer uses the same authenticated API boundary: candidates and recruiters have distinct role permissions, and resources are owner-scoped. Matching is intentionally rule-based rather than marketed as AI: it compares persisted skills and explicit experience thresholds and returns no fit percentage when required evidence is incomplete. The recorded audit passed 45 of 45 automated tests, and isolated bounded runs measured 0.921 jobs/sec at concurrency 1 versus 4.552 jobs/sec at concurrency 5; those figures include polling and are not production-scale claims.

## Metrics safe to mention

- 45/45 tests passed in the recorded audit run across four service suites; this is not code coverage.
- Local read-only `/health/live` probe: p50 8.378 ms, p95 10.202 ms, p99 10.202 ms over 10 sequential samples after one warm-up.
- Deterministic matching rules validated by unit fixtures; no predictive accuracy claim.
- Controlled failure-simulation fixture recovered on attempt 2 in 1 of 1 cases; do not generalize this as production retry reliability.
- Isolated reliability run: 10/10 JSON_TRANSFORM jobs reached `COMPLETED`; p50 1062.571 ms, p95/p99 1081.744 ms, and completed throughput 0.926 jobs/sec at concurrency 1.
- Repeated 50-job comparison: concurrency 1 completed 0.921 jobs/sec with p50 1040.045 ms and p95 1063.622 ms; concurrency 5 completed 4.552 jobs/sec with p50 1059.288 ms and p95 1133.206 ms.
- The concurrency-5 repeat achieved 4.942x the concurrency-1 completed throughput, approximately a 394.2% increase under those bounded local conditions.
- Isolated idempotency check: the repeated same-key request returned the same job ID and conflicting payload reuse returned HTTP 409.

## Do not claim without new evidence

- Authenticated recruiter-to-candidate workflow completion.
- Production-scale load/scalability, uptime, or production-readiness claims.
- Duplicate suppression rate beyond the one isolated same-key/conflict case, SSE delivery rate, or production reliability percentage.
- AI matching accuracy, precision, recall, or F1.
