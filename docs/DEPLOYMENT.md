# Deployment

Build the web, API, worker, and executor as separate services. The Compose `migrate` service runs `prisma migrate deploy` once PostgreSQL is healthy, and API/worker depend on successful migration completion before processing work. Configure PostgreSQL and Redis using private network endpoints, set `COOKIE_SECURE=true`, and provide a strong `JWT_SECRET` and `EXECUTOR_SHARED_SECRET` through the platform secret manager.

Required readiness checks are `/api/v1/system/health`, `/health/live`, and `/health/ready` on the executor. Docker Compose is intended for local development; no deployment was performed in this environment.
