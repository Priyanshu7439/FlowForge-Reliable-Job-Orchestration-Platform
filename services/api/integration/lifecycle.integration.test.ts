import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;
type ApiResponse = { status: number; body: JsonValue; headers: Headers };

const enabled = process.env.FLOWFORGE_INTEGRATION_TESTS === '1';
const integration = enabled ? describe : describe.skip;
const apiUrl = (process.env.FLOWFORGE_BENCHMARK_API_URL ?? 'http://127.0.0.1:4400/api/v1').replace(/\/$/, '');
const parsedApiUrl = new URL(enabled ? apiUrl : 'http://127.0.0.1:4400/api/v1');
const integrationEmail = process.env.FLOWFORGE_INTEGRATION_EMAIL;
const integrationPassword = process.env.FLOWFORGE_INTEGRATION_PASSWORD;
const pollTimeoutMs = Number(process.env.FLOWFORGE_INTEGRATION_TIMEOUT_MS ?? 60_000);

function assertBenchmarkApiTarget(): void {
  if (parsedApiUrl.protocol !== 'http:' || parsedApiUrl.hostname !== '127.0.0.1' || parsedApiUrl.port !== '4400' || parsedApiUrl.pathname !== '/api/v1') {
    throw new Error('Integration tests require FLOWFORGE_BENCHMARK_API_URL to target http://127.0.0.1:4400/api/v1.');
  }
  if (!integrationEmail || !integrationPassword) throw new Error('Set FLOWFORGE_INTEGRATION_EMAIL and FLOWFORGE_INTEGRATION_PASSWORD for the isolated benchmark account.');
  if (!Number.isInteger(pollTimeoutMs) || pollTimeoutMs < 5_000 || pollTimeoutMs > 300_000) throw new Error('FLOWFORGE_INTEGRATION_TIMEOUT_MS must be between 5000 and 300000.');
}

function originUrl(): string { return `${parsedApiUrl.protocol}//${parsedApiUrl.host}`; }

function readCookie(headers: Headers): string {
  const setCookie = headers.get('set-cookie') ?? '';
  const match = /(?:^|,\s*)flowforge_session=([^;]+)/i.exec(setCookie);
  if (!match) throw new Error('Login did not return the expected HTTP-only session cookie.');
  return `flowforge_session=${match[1]}`;
}

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }

async function request(path: string, init: RequestInit = {}, cookie?: string): Promise<ApiResponse> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  const text = await response.text();
  let body: JsonValue = null;
  if (text) body = JSON.parse(text) as JsonValue;
  return { status: response.status, body, headers: response.headers };
}

async function jsonRequest(path: string, method: string, body: Record<string, unknown>, cookie?: string): Promise<ApiResponse> {
  return request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, cookie);
}

function sleep(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function waitForTerminalJob(jobId: string, cookie: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + pollTimeoutMs;
  while (Date.now() < deadline) {
    const response = await request(`/jobs/${encodeURIComponent(jobId)}`, {}, cookie);
    expect(response.status).toBe(200);
    if (!isObject(response.body) || !isObject(response.body.job)) throw new Error('Job response did not contain a job object.');
    const job = response.body.job;
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(String(job.status))) return job;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for job ${jobId} to reach a terminal state.`);
}

function assertSafeDatabaseUrl(value: string): URL {
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, '').split('?')[0]);
  if (databaseName !== 'flowforge_benchmark') throw new Error('FLOWFORGE_INTEGRATION_DATABASE_URL must target the flowforge_benchmark database.');
  if (url.hostname !== 'benchmark-postgres' && !(url.hostname === '127.0.0.1' && url.port !== '5432')) throw new Error('FLOWFORGE_INTEGRATION_DATABASE_URL must target benchmark-postgres or a non-development localhost port.');
  return url;
}

async function verifyDatabaseRecords(jobId: string, userId: string): Promise<void> {
  const configuredDatabaseUrl = process.env.FLOWFORGE_INTEGRATION_DATABASE_URL;
  if (!configuredDatabaseUrl) return;
  const databaseUrl = assertSafeDatabaseUrl(configuredDatabaseUrl);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl.toString() } } });
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.ownerId).toBe(userId);
    expect(job?.status).toBe('COMPLETED');
    expect(await prisma.jobAttempt.count({ where: { jobId, status: 'COMPLETED' } })).toBeGreaterThanOrEqual(1);
    expect(await prisma.jobResult.findUnique({ where: { jobId } })).not.toBeNull();
    expect(await prisma.outboxEvent.findFirst({ where: { aggregateId: jobId, eventType: 'JOB_CREATED', publishedAt: { not: null } } })).not.toBeNull();
  } finally {
    await prisma.$disconnect();
  }
}

integration('isolated benchmark job lifecycle', () => {
  it('executes JSON_TRANSFORM through API, outbox, BullMQ, worker, executor, and result persistence', async () => {
    assertBenchmarkApiTarget();

    const health = await fetch(`${originUrl()}/health/live`, { signal: AbortSignal.timeout(5_000) });
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const login = await jsonRequest('/auth/login', 'POST', { email: integrationEmail, password: integrationPassword });
    expect(login.status).toBe(200);
    const loginUser = isObject(login.body) && isObject(login.body.user) ? login.body.user : null;
    if (!loginUser || typeof loginUser.id !== 'string') throw new Error('Login response did not contain a user object.');
    const userId = loginUser.id;
    const cookie = readCookie(login.headers);
    const idempotencyKey = `integration-${randomUUID()}`;
    const jobPayload = { records: [{ name: 'FlowForge Integration', team: 'Platform' }], select: ['name'] };

    const created = await jsonRequest('/jobs', 'POST', { type: 'JSON_TRANSFORM', payload: jobPayload, idempotencyKey }, cookie);
    expect(created.status).toBe(202);
    const createdJob = isObject(created.body) && isObject(created.body.job) ? created.body.job : null;
    if (!createdJob || typeof createdJob.id !== 'string') throw new Error('Job creation response did not contain a job object.');
    const jobId = createdJob.id;
    expect(jobId).toBeTruthy();

    const job = await waitForTerminalJob(jobId, cookie);
    expect(job.status).toBe('COMPLETED');

    const attempts = await request(`/jobs/${encodeURIComponent(jobId)}/attempts`, {}, cookie);
    expect(attempts.status).toBe(200);
    if (!isObject(attempts.body) || !Array.isArray(attempts.body.attempts)) throw new Error('Attempts response did not contain an attempts array.');
    expect(attempts.body.attempts.length).toBeGreaterThanOrEqual(1);
    expect((attempts.body.attempts as Array<Record<string, unknown>>).some((attempt) => attempt.status === 'COMPLETED')).toBe(true);

    const result = await request(`/jobs/${encodeURIComponent(jobId)}/result`, {}, cookie);
    expect(result.status).toBe(200);
    const persistedResult = isObject(result.body) && isObject(result.body.result) ? result.body.result : null;
    if (!persistedResult) throw new Error('Result response did not contain a result object.');
    expect(persistedResult.resultJson).toEqual([{ name: 'FlowForge Integration' }]);

    await verifyDatabaseRecords(jobId, userId);
  }, pollTimeoutMs + 15_000);

  it('recovers from a controlled first-attempt failure through a successful retry', async () => {
    assertBenchmarkApiTarget();

    const health = await fetch(`${originUrl()}/health/live`, { signal: AbortSignal.timeout(5_000) });
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const login = await jsonRequest('/auth/login', 'POST', { email: integrationEmail, password: integrationPassword });
    expect(login.status).toBe(200);
    const cookie = readCookie(login.headers);
    const idempotencyKey = `integration-retry-${randomUUID()}`;

    const created = await jsonRequest('/jobs', 'POST', {
      type: 'FAILURE_SIMULATION',
      payload: { failUntilAttempt: 1 },
      idempotencyKey,
    }, cookie);
    expect(created.status).toBe(202);
    const createdJob = isObject(created.body) && isObject(created.body.job) ? created.body.job : null;
    if (!createdJob || typeof createdJob.id !== 'string') throw new Error('Retry test response did not contain a job object.');

    const job = await waitForTerminalJob(createdJob.id, cookie);
    expect(job.status).toBe('COMPLETED');

    const attempts = await request(`/jobs/${encodeURIComponent(createdJob.id)}/attempts`, {}, cookie);
    expect(attempts.status).toBe(200);
    if (!isObject(attempts.body) || !Array.isArray(attempts.body.attempts)) throw new Error('Retry test response did not contain an attempts array.');
    const attemptHistory = attempts.body.attempts as Array<Record<string, unknown>>;
    expect(attemptHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({ attemptNumber: 1, status: 'FAILED' }),
      expect.objectContaining({ attemptNumber: 2, status: 'COMPLETED' }),
    ]));
  }, pollTimeoutMs + 15_000);
});
