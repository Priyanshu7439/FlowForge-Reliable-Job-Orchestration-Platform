# FlowForge Implementation Status

Updated: 2026-10-25

## Current product

FlowForge contains two related workflows:

- Recruitment: role-aware recruiter postings, candidate discovery, deterministic fit explanations, profiles, applications, and application status APIs.
- Orchestration: authenticated job submission, scheduling, transactional outbox publication, BullMQ processing, FastAPI execution, retries, cancellation, results, SSE notifications, and topology health reporting.

Recruitment postings are stored separately from executable orchestration jobs. Candidates use `USER`; recruiters use the existing `ADMIN` role. Matching is rule-based and does not claim predictive accuracy.

## Verified implementation areas

- Prisma owns the PostgreSQL schema and migrations.
- API authentication uses Argon2 password hashing and HTTP-only JWT session cookies.
- Owner and role checks protect jobs, profiles, schedules, postings, and applications.
- The API and worker images include the Prisma schema and migration history.
- The isolated benchmark stack uses separate PostgreSQL, Redis, executor, API, and worker resources.
- The API registration handler stores only `passwordHash`; plaintext passwords are not passed to Prisma.

## Historical engineering investigations

- Docker/runtime drift was investigated through bounded protocol checks and source/runtime comparison; verified lessons are summarized in [`docs/ENGINEERING_LEARNINGS.md`](docs/ENGINEERING_LEARNINGS.md).
- Authentication and CORS behavior was traced from browser requests through HTTP-only cookies and protected API routes; the retained security implications are documented in [`docs/ENGINEERING_LEARNINGS.md`](docs/ENGINEERING_LEARNINGS.md).
- SSE was treated as an authenticated per-user stream whose global health cannot be inferred as a standalone service; evidence boundaries are recorded in [`docs/METRICS_EVIDENCE_AUDIT.md`](docs/METRICS_EVIDENCE_AUDIT.md).
- Benchmark and reliability claims were separated from unit-test evidence, with bounded local measurements and unsupported production claims distinguished in [`docs/METRICS_EVIDENCE_AUDIT.md`](docs/METRICS_EVIDENCE_AUDIT.md).

## User-observed validation evidence

These results were supplied from the user's PowerShell environment and were not rerun during the documentation cleanup:

- `npm.cmd test`: API 21/21 and worker 6/6 passed.
- `npm.cmd --workspace apps/web run test`: web 15/15 passed.
- `python -m pytest services/executor/tests`: 6/6 passed, with one pytest cache warning (`WinError 183`).
- `npm.cmd run typecheck`: contracts build and API, worker, and web typechecks completed without visible errors.
- `npm.cmd run build`: contracts, API, worker, and Next.js production build completed successfully; Next.js generated 15 static pages.
- `npm.cmd --workspace services/api run test:integration`: 2/2 isolated lifecycle tests passed. The normal lifecycle completed in 899 ms; controlled retry recovery completed in 1543 ms. The retry test verified attempt 1 `FAILED`, attempt 2 `COMPLETED`, and final job `COMPLETED`.

The optional direct Prisma assertions in the integration test were not enabled for that run and are not claimed here.

### Integration test prerequisites

Integration tests require the isolated benchmark environment and must not target development services. Configuration names are:

- `FLOWFORGE_INTEGRATION_TESTS`
- `FLOWFORGE_BENCHMARK_API_URL`
- `FLOWFORGE_INTEGRATION_EMAIL`
- `FLOWFORGE_INTEGRATION_PASSWORD`
- `FLOWFORGE_INTEGRATION_DATABASE_URL` (optional; only when guarded database assertions are enabled)

## Benchmark evidence

Raw artifacts are preserved under `docs/` and summarized in [`docs/ENGINEERING_METRICS_REPORT.md`](docs/ENGINEERING_METRICS_REPORT.md), [`docs/BENCHMARK_RESULTS.json`](docs/BENCHMARK_RESULTS.json), and [`docs/METRICS_EVIDENCE_AUDIT.md`](docs/METRICS_EVIDENCE_AUDIT.md).

Recorded bounded isolated results include:

- 10-job reliability run: 10/10 completed, 0 failed, p50 1062.571 ms, p95/p99 1081.744 ms, and 0.926 completed jobs/sec.
- Repeated 50-job runs: concurrency 1 completed 0.921 jobs/sec; concurrency 5 completed 4.552 jobs/sec, a 4.942x throughput ratio under those conditions.
- One controlled retry recovered from `FAILED` to `COMPLETED` on attempt 2.
- One idempotency check returned the same job ID for a repeated key and rejected conflicting reuse with HTTP 409.

These are local bounded measurements, not production-scale, uptime, or scalability claims. Observed latency includes the benchmark polling interval.

## Documentation set

- [`README.md`](README.md): setup and command entry point.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): service boundaries and lifecycle.
- [`docs/API.md`](docs/API.md): public API conventions.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md): durable entities and lifecycle states.
- [`docs/SECURITY.md`](docs/SECURITY.md): security controls and deployment limitations.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): deployment requirements and readiness checks.
- [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md): recruitment and orchestration demonstrations.
- [`docs/ENGINEERING_LEARNINGS.md`](docs/ENGINEERING_LEARNINGS.md): verified debugging lessons.
- [`docs/PROJECT_WALKTHROUGH.md`](docs/PROJECT_WALKTHROUGH.md): interview-oriented product and architecture explanation.
- [`docs/RECRUITER_PROJECT_HIGHLIGHTS.md`](docs/RECRUITER_PROJECT_HIGHLIGHTS.md): defensible resume language.

## Remaining limitations

- No CI run, production deployment, penetration test, code coverage measurement, or production-scale load test is claimed.
- The complete browser-level recruiter-to-candidate workflow has not been verified, and SSE reconnect/cross-user delivery remains unverified.
- Secure resume object storage, external market-data integration, password recovery, and predictive matching are not implemented.
- Recruiter applicant review has API support; a dedicated applicant-management screen remains follow-up work.

## Safe local commands

```powershell
npm.cmd test
npm.cmd --workspace apps/web run test
python -m pytest services/executor/tests
npm.cmd run typecheck
npm.cmd run build
```

Integration testing requires explicit opt-in and the isolated benchmark environment:

```powershell
npm.cmd --workspace services/api run test:integration
```

Do not run seeds or migrations against development data without first checking the target database and environment.
