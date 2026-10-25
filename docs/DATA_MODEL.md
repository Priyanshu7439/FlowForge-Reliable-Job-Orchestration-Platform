# Data Model

The Prisma schema in `database/prisma/schema.prisma` owns the application database. Jobs belong to users and have one optional result plus many attempts. An idempotency key is unique per user. Outbox rows are immutable event intents with a nullable publication timestamp.

Lifecycle states are `QUEUED`, `RUNNING`, `RETRYING`, `COMPLETED`, `FAILED`, and `CANCELLED`. Terminal states cannot be overwritten by stale worker messages. Scheduled definitions produce ordinary jobs and remain durable across restarts.
