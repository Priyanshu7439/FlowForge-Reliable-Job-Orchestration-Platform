import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Prisma, PrismaClient } from '@prisma/client';
import { nextCronOccurrence } from '@flowforge/contracts';
import { config } from './config.js';
import { parseExecutorResponse, shouldRetry, type ExecutionOutcome } from './processor.js';

const prisma = new PrismaClient();
const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('flowforge-jobs', { connection });
const eventChannel = 'flowforge:events';

async function publishEvent(event: { jobId: string; ownerId: string; status: string; attemptNumber?: number; resultAvailable?: boolean }) {
  await connection.publish(eventChannel, JSON.stringify({ ...event, occurredAt: new Date().toISOString() }));
}

async function scheduleDueJobs() {
  const now = new Date();
  const schedules = await prisma.scheduledJob.findMany({ where: { enabled: true, nextRunAt: { lte: now } }, orderBy: { nextRunAt: 'asc' }, take: 50 });
  for (const schedule of schedules) {
    try {
      const nextRunAt = nextCronOccurrence(schedule.cronExpression, schedule.timezone, schedule.nextRunAt);
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.scheduledJob.updateMany({ where: { id: schedule.id, enabled: true, nextRunAt: schedule.nextRunAt }, data: { lastRunAt: schedule.nextRunAt, nextRunAt } });
        if (!claimed.count) return;
        const job = await tx.job.create({ data: { ownerId: schedule.ownerId, type: schedule.type, payload: schedule.payload as Prisma.InputJsonValue, scheduledAt: schedule.nextRunAt, idempotencyKey: `schedule:${schedule.id}:${schedule.nextRunAt.toISOString()}` } });
        await tx.outboxEvent.create({ data: { aggregateId: job.id, eventType: 'JOB_CREATED', payload: { jobId: job.id, scheduledJobId: schedule.id } } });
      });
    } catch (cause) { console.error(JSON.stringify({ level: 'error', service: 'worker', scheduleId: schedule.id, error: cause instanceof Error ? cause.message : 'schedule failed' })); }
  }
}

async function publishOutbox() {
  const staleProcessingAt = new Date(Date.now() - 60_000);
  await prisma.outboxEvent.updateMany({
    where: { publishedAt: null, processingAt: { lt: staleProcessingAt } },
    data: { processingAt: null },
  });
  const events = await prisma.outboxEvent.findMany({ where: { publishedAt: null }, orderBy: { createdAt: 'asc' }, take: 50 });
  for (const event of events) {
    const claimed = await prisma.outboxEvent.updateMany({ where: { id: event.id, publishedAt: null, processingAt: null }, data: { processingAt: new Date() } });
    if (!claimed.count) continue;
    try { await queue.add('execute-job', { jobId: event.aggregateId }, { jobId: event.aggregateId, attempts: config.MAX_ATTEMPTS, backoff: { type: 'exponential', delay: 500 } }); await prisma.outboxEvent.update({ where: { id: event.id }, data: { publishedAt: new Date() } }); } catch (cause) { await prisma.outboxEvent.update({ where: { id: event.id }, data: { processingAt: null } }); console.error(JSON.stringify({ level: 'error', service: 'worker', eventId: event.id, error: cause instanceof Error ? cause.message : 'publish failed' })); }
  }
}

const worker = new Worker('flowforge-jobs', async (job) => {
  const current = await prisma.job.findUnique({ where: { id: job.data.jobId } });
  if (!current || current.status === 'CANCELLED' || current.status === 'COMPLETED') return;
  const attemptNumber = (await prisma.jobAttempt.count({ where: { jobId: current.id } })) + 1;
  const started = new Date();
  await prisma.$transaction(async (tx) => { const changed = await tx.job.updateMany({ where: { id: current.id, status: { in: ['QUEUED', 'RETRYING'] } }, data: { status: 'RUNNING', startedAt: started } }); if (!changed.count) throw new Error('JOB_NOT_EXECUTABLE'); await tx.jobAttempt.create({ data: { jobId: current.id, attemptNumber, status: 'RUNNING', startedAt: started } }); });
  await publishEvent({ jobId: current.id, ownerId: current.ownerId, status: 'RUNNING', attemptNumber }).catch(console.error);
  let outcome: ExecutionOutcome;
  try { const result = await fetch(`${config.EXECUTOR_URL}/internal/execute`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.EXECUTOR_SHARED_SECRET}` }, signal: AbortSignal.timeout(30_000), body: JSON.stringify({ jobId: current.id, type: current.type, payload: current.payload, attempt: attemptNumber }) }); const body = await result.json(); if (!result.ok) throw new Error('Executor request failed'); outcome = parseExecutorResponse(body); } catch (cause) { outcome = { ok: false, error: { code: 'EXECUTOR_UNAVAILABLE', message: cause instanceof Error ? cause.message : 'Executor unavailable', retryable: true } }; }
  const finished = new Date();
  if (outcome.ok) { await prisma.$transaction([prisma.jobAttempt.update({ where: { jobId_attemptNumber: { jobId: current.id, attemptNumber } }, data: { status: 'COMPLETED', finishedAt: finished, durationMs: finished.getTime() - started.getTime(), resultSummary: outcome.summary } }), prisma.jobResult.upsert({ where: { jobId: current.id }, create: { jobId: current.id, resultJson: outcome.result, contentType: 'application/json' }, update: { resultJson: outcome.result, contentType: 'application/json' } }), prisma.job.update({ where: { id: current.id }, data: { status: 'COMPLETED', completedAt: finished, resultSummary: outcome.summary } })]); await publishEvent({ jobId: current.id, ownerId: current.ownerId, status: 'COMPLETED', attemptNumber, resultAvailable: true }).catch(console.error); return; }
  const retryable = shouldRetry(outcome, job.attemptsMade, config.MAX_ATTEMPTS);
  await prisma.$transaction([prisma.jobAttempt.update({ where: { jobId_attemptNumber: { jobId: current.id, attemptNumber } }, data: { status: 'FAILED', finishedAt: finished, durationMs: finished.getTime() - started.getTime(), errorCode: outcome.error?.code ?? 'EXECUTION_FAILED', errorMessage: outcome.error?.message ?? 'Execution failed' } }), prisma.job.update({ where: { id: current.id }, data: { status: retryable ? 'RETRYING' : 'FAILED', completedAt: retryable ? null : finished } })]);
  await publishEvent({ jobId: current.id, ownerId: current.ownerId, status: retryable ? 'RETRYING' : 'FAILED', attemptNumber }).catch(console.error);
  if (!retryable) throw new Error(outcome.error?.message ?? 'Execution failed');
  throw new Error(outcome.error?.message ?? 'Retryable execution failure');
}, { connection, concurrency: 4 });

worker.on('failed', (job, error) => console.error(JSON.stringify({ level: 'error', service: 'worker', jobId: job?.data?.jobId, error: error.message })));
const heartbeat = setInterval(() => connection.set('flowforge:health:worker', new Date().toISOString(), 'EX', 15).catch((cause) => console.error(JSON.stringify({ level: 'error', service: 'worker', error: cause instanceof Error ? cause.message : 'heartbeat failed' }))), 5_000);
connection.set('flowforge:health:worker', new Date().toISOString(), 'EX', 15).catch(console.error);
const timer = setInterval(() => publishOutbox().catch((cause) => console.error(cause)), 1000);
const scheduler = setInterval(() => scheduleDueJobs().catch(console.error), 10_000);
publishOutbox().catch(console.error);
scheduleDueJobs().catch(console.error);
const shutdown = async () => { clearInterval(timer); clearInterval(heartbeat); clearInterval(scheduler); await connection.del('flowforge:health:worker'); await worker.close(); await queue.close(); await connection.quit(); await prisma.$disconnect(); process.exit(0); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
