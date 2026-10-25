# FlowForge Engineering Metrics Report

Generated: 2026-10-24 17:16 IST

## Executive summary

FlowForge's existing automated suites passed 45 of 45 executed tests. API, worker, web, and Python executor tests all passed; TypeScript checks and Prisma validation passed, and the configured database reported all three migrations applied.

The original HTTP benchmark was a small, sequential, unauthenticated read-only probe. Subsequent isolated queue artifacts now provide bounded JSON_TRANSFORM measurements; they are local workflow benchmarks, not production or load tests.

## Architecture verified

- Next.js/React/TypeScript frontend.
- Express API with JWTs in HTTP-only cookies.
- Prisma/PostgreSQL as the authoritative store.
- Redis/BullMQ and a Node worker for asynchronous jobs.
- FastAPI executor for supported deterministic task handlers.
- Recruitment models for postings, candidate profiles, recruiter/company profiles, and applications.

## Automated tests

The table below preserves the earlier recorded audit run. A later user-observed validation reported API 21/21, worker 6/6, web 15/15, Python executor 6/6, and isolated integration tests 2/2. Those later results were not rerun during this documentation cleanup.

| Service | Executed | Passed | Failed | Skipped | Pass rate |
|---|---:|---:|---:|---:|---:|
| API | 18 | 18 | 0 | 0 | 100% |
| Worker | 6 | 6 | 0 | 0 | 100% |
| Web | 15 | 15 | 0 | 0 | 100% |
| Python executor | 6 | 6 | 0 | 0 | 100% |
| Total | 45 | 45 | 0 | 0 | 100% |

This is test pass rate, not code coverage. Coverage was not measured because no coverage tool is configured.

## API latency benchmark

Conditions: 10 sequential samples per endpoint, one warm-up request, concurrency 1, monotonic PowerShell Stopwatch, local API at `http://localhost:4000`, expected 401 responses counted as successful protocol outcomes. The API rate limiter was observed during an earlier discarded 30-sample run; those contaminated values are excluded.

| Endpoint | Expected | p50 | p95 | p99 | Max | RPS | Unexpected rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/health/live` | 200 | 8.378 ms | 10.202 ms | 10.202 ms | 10.202 ms | 116.166 | 0% |
| `/auth/me` unauthenticated | 401 | 1.898 ms | 2.886 ms | 2.886 ms | 2.886 ms | 505.178 | 0% |
| `/profile` unauthenticated | 401 | 1.527 ms | 1.823 ms | 1.823 ms | 1.823 ms | 657.384 | 0% |
| `/recruitment/jobs` unauthenticated | 401 | 2.157 ms | 3.266 ms | 3.266 ms | 3.266 ms | 455.446 | 0% |
| `/dashboard/summary` unauthenticated | 401 | 1.493 ms | 1.846 ms | 1.846 ms | 1.846 ms | 652.903 | 0% |

These are not authenticated endpoint or production SLA measurements.

## Asynchronous processing and throughput

At the time of the original report, job enqueue, queue wait, worker processing, end-to-end completion latency, jobs/second, and concurrency 1/5/10 were not measured. Later isolated artifacts provide bounded concurrency-1 and concurrency-5 results; they do not establish production scalability, uptime, or readiness.

## Reliability and security

- Retry behavior is unit-verified, including one deterministic failure-simulation recovery fixture: 1/1 recovery in that fixture (100%). This is not a full pipeline recovery rate.
- Cancellation and invalid state transitions passed API tests.
- Ownership isolation, role restrictions, unauthenticated access, cookie handling, invalid input, and SSE protection passed embedded API assertions.
- A separately tagged security pass rate was not measured; no penetration test is claimed.
- Idempotency duplicate suppression was not load-tested against a dedicated isolated database.

## Recruitment matching validation

The matching helper passed deterministic fixtures for skill overlap, missing skills, explicit experience thresholds, and incomplete profiles returning `score: null`. No accuracy, precision, recall, or F1 is claimed because no labeled ground-truth dataset exists.

The optional `scripts/benchmark-recruitment.ts` script measures pure matching-function computation only; it excludes HTTP, Prisma, network, and UI latency. No result is claimed here unless its output is recorded as benchmark evidence.

## Environment and limitations

- Windows 11 build 26200, Node v24.14.0, npm 11.9.0, Python 3.14.3, 12 logical processors.
- Docker CLI and RAM telemetry were unavailable in the audit shell.
- Prisma schema validation passed; read-only migration status reported three migrations and an up-to-date database.
- Authenticated recruitment workflow E2E was not measured because no Playwright setup or safe isolated test accounts were available.

## Commands executed

```text
npm.cmd test
npm.cmd --workspace services/api run test
npm.cmd --workspace services/worker run test
npm.cmd --workspace apps/web run test
python -m pytest services/executor/tests -q
npm.cmd run typecheck
npm.cmd exec prisma validate -- --schema database/prisma/schema.prisma
npm.cmd exec prisma migrate status -- --schema database/prisma/schema.prisma
```

The current API integration command is `npm.cmd --workspace services/api run test:integration`; its two isolated lifecycle tests cover normal completion and controlled retry recovery when the benchmark environment and opt-in credentials are enabled.

Raw structured measurements are in [`BENCHMARK_RESULTS.json`](./BENCHMARK_RESULTS.json).

## Benchmark continuation audit - 2026-10-24

### Isolation result: BLOCKED

The current shell could not access the Docker CLI. Host TCP ports 5432 and 6379 were reachable, but no separate PostgreSQL database, disposable Compose project, or isolated Redis namespace was configured or proven. Because those ports may belong to the existing development stack, no write traffic was sent to them and no queue benchmark was attempted.

### Safe validation run: VERIFIED

The existing isolated/unit suites were rerun without database or Redis writes:

- `npm.cmd test`: API 18/18 and worker 6/6 passed.
- `npm.cmd --workspace apps/web run test`: web 15/15 passed.
- `python -m pytest services/executor/tests -q`: 6/6 passed.
- `npm.cmd run typecheck`: passed.

These results were a new validation run at that time. They did not establish end-to-end queue latency, throughput, persisted success/failure rates, retry recovery in the worker pipeline, duplicate-request correctness against a database, or authenticated recruitment workflow completion; later isolated artifacts address the bounded queue items below.

At that continuation point, the requested priority metrics remained **BLOCKED**. The later isolated artifacts are recorded separately below and do not change the historical blocked record.

## Isolated queue benchmark - 2026-10-24

Status: **MEASURED**, with the limitations below.

The raw artifact [`benchmark-run-results.json`](./benchmark-run-results.json) records a local isolated benchmark against `http://127.0.0.1:4400/api/v1`. It used the dedicated benchmark database/Redis stack, `JSON_TRANSFORM`, 10 submitted jobs, concurrency 1, zero warm-up jobs, 100 ms polling, and no development data. This was a bounded sequential workflow measurement, not a production or load/scalability test. Total wall-clock duration was not separately retained by the runner.

### Job completion latency and throughput

| Metric | Measured value |
|---|---:|
| Sample size | 10 jobs |
| Concurrency | 1 |
| End-to-end p50 | 970.352 ms |
| End-to-end p95 | 1062.921 ms |
| End-to-end p99 | 1062.921 ms |
| End-to-end max | 1062.921 ms |
| Submitted throughput | 1.006 jobs/sec |
| Completed throughput | 1.006 jobs/sec |

Latency is measured from immediately before each API submission until the API polling loop observed a terminal job state. It includes request, outbox/queue, worker, executor, persistence, and polling delay. The raw runner used a nearest-rank percentile calculation over the 10 recorded samples; with this sample size p95 and p99 equal the maximum observed sample.

### Persisted outcomes

All 10 submissions returned `COMPLETED`; 0 returned `FAILED` and 0 returned `CANCELLED`. The raw artifact records `resultPersisted=true` from the final job response and each final state was obtained through `GET /jobs/:id`. The separate `GET /jobs/:id/result` endpoint was not called, so this is terminal job/result-summary evidence rather than an independent JobResult endpoint verification. The raw `attemptCount` field is null for every sample because the runner did not preserve the single-object attempt response count.

### Retry and idempotency

- Controlled retry: one isolated `FAILURE_SIMULATION` job ended `COMPLETED` after two attempts with statuses `FAILED`, `COMPLETED`. This is 1/1 recovery for one fixture, not a general reliability percentage.
- Idempotency: the repeated same-key request returned HTTP 202 with the same job ID; a conflicting payload using the same key returned HTTP 409. This verifies one isolated duplicate-suppression case, not a concurrency or stress rate.

The complete structured summary and the prior historical measurements remain in [`BENCHMARK_RESULTS.json`](./BENCHMARK_RESULTS.json). The earlier blocked execution attempt is preserved under `latestExecutionAttempt`.

## Repeated 50-job benchmark comparison - 2026-10-25

The repeat artifacts used the isolated API, database, Redis, worker, and executor stack with `JSON_TRANSFORM`, 50 jobs, zero warm-up jobs, and a 1000 ms polling interval. Concurrency 1 used one authenticated worker session; concurrency 5 used five. All 100 samples reported `resultPersisted: true` in the raw artifacts, and every sampled job reached `COMPLETED`.

| Run | Samples | Concurrency | p50 | p95 | p99 | Max | Submitted jobs/sec | Completed jobs/sec | Completed / failed / cancelled |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `benchmark-run-50-c1-repeat.json` | 50 | 1 | 1040.045 ms | 1063.622 ms | 2074.470 ms | 2074.470 ms | 0.921 | 0.921 | 50 / 0 / 0 |
| `benchmark-run-50-c5-repeat.json` | 50 | 5 | 1059.288 ms | 1133.206 ms | 1141.883 ms | 1141.883 ms | 4.552 | 4.552 | 50 / 0 / 0 |

The completed-throughput ratio is `4.552 / 0.921 = 4.942x` (approximately a 394.2% increase in this bounded comparison). This is not a scalability guarantee: the sample is local and small, no warm-up jobs were used, and latency includes the polling interval. The measured end-to-end time is from API submission through observed terminal status; it is not isolated executor CPU time.

The earlier non-repeat artifacts are preserved but are not used for the primary comparison because their conditions differ: `benchmark-run-50-c1.json` used a 2000 ms polling interval and measured 0.483 completed jobs/sec with p50 2069.603 ms; `benchmark-run-50-c5.json` measured 4.145 completed jobs/sec with p50 1071.173 ms. These values should not be combined with the repeat pair as one series.

## Reliability artifact - 2026-10-25

`benchmark-reliability.json` records a separate 10-job sequential isolated run with a 1000 ms polling interval. It observed 10/10 completed, 0 failed, 100% observed success, p50 1062.571 ms, p95/p99 1081.744 ms, and 0.926 submitted/completed jobs/sec. This is an observed result for a bounded local sample, not a production success-rate claim.

The same artifact records one controlled retry: attempt 1 `FAILED`, attempt 2 `COMPLETED`, two attempts total, and recovery verified. It also records idempotency behavior: the repeated request returned HTTP 202 with the same job ID, while conflicting payload reuse returned HTTP 409 and was suppressed. These are one-run correctness checks, not rates under concurrent contention.
