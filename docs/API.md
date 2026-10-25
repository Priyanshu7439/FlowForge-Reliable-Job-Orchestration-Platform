# API

The public API is versioned under `/api/v1`. Responses use JSON. Errors have the shape `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.

Authentication uses an HTTP-only cookie named `flowforge_session`. Browser clients use `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, and `GET /auth/me`.

Jobs are created with `POST /jobs` and queried with `GET /jobs`, `GET /jobs/:id`, `GET /jobs/:id/attempts`, and `GET /jobs/:id/result`. Retry and cancellation are explicit `POST` actions. `GET /events` is an authenticated, owner-scoped SSE stream that sends `job` events and heartbeats; clients must refresh REST state after reconnecting.

Schedules are managed with `POST /schedules`, `GET /schedules`, `GET /schedules/:id`, `PATCH /schedules/:id`, and `DELETE /schedules/:id`. Schedule creation accepts `type`, `payload`, `cronExpression`, `timezone`, and optional `enabled`. Cron expressions use five fields and support wildcards, numeric literals, comma lists, and steps. The scheduler calculates occurrences in the requested IANA timezone and creates jobs transactionally with outbox events.

OpenAPI is exposed at `/api/v1/openapi.json`.
