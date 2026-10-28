import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

type UserRecord = { id: string; name: string; email: string; passwordHash: string; role: 'USER' | 'ADMIN' };
type JobRecord = { id: string; ownerId: string; type: string; status: 'QUEUED' | 'RUNNING' | 'RETRYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; payload: Record<string, unknown>; completedAt: Date | null; cancellationRequestedAt: Date | null; createdAt: Date };
type ScheduleRecord = { id: string; ownerId: string; type: string; payload: Record<string, unknown>; cronExpression: string; timezone: string; enabled: boolean; nextRunAt: Date; lastRunAt: Date | null; createdAt: Date; updatedAt: Date };

const fake = vi.hoisted(() => {
  const users = new Map<string, UserRecord>();
  const jobs = new Map<string, JobRecord>();
  const outbox: Array<{ aggregateId: string }> = [];
  const schedules = new Map<string, ScheduleRecord>();
  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}-${++sequence}`;
  const transactionClient = {
    user: {
      create: vi.fn(async ({ data }: { data: Omit<UserRecord, 'id'> }) => { const user = { id: nextId('user'), ...data }; users.set(user.id, user); return user; }),
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => [...users.values()].find((user) => (where.id ? user.id === where.id : user.email === where.email)) ?? null),
    },
    job: {
      create: vi.fn(async ({ data }: { data: { ownerId: string; type: string; payload: Record<string, unknown> } }) => { const job: JobRecord = { id: nextId('job'), ...data, status: 'QUEUED', completedAt: null, cancellationRequestedAt: null, createdAt: new Date() }; jobs.set(job.id, job); return job; }),
      findFirst: vi.fn(async ({ where }: { where: { id?: string; ownerId?: string; status?: { in: JobRecord['status'][] } } }) => [...jobs.values()].find((job) => (!where.id || job.id === where.id) && (!where.ownerId || job.ownerId === where.ownerId) && (!where.status || where.status.in.includes(job.status))) ?? null),
      findMany: vi.fn(async () => [...jobs.values()]),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; ownerId: string; status?: { in: JobRecord['status'][] } }; data: Partial<JobRecord> }) => { const job = jobs.get(where.id); if (!job || job.ownerId !== where.ownerId || (where.status && !where.status.in.includes(job.status))) return { count: 0 }; Object.assign(job, data); return { count: 1 }; }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<JobRecord> }) => { const job = jobs.get(where.id); if (!job) throw new Error('missing job'); Object.assign(job, data); return job; }),
    },
    outboxEvent: {
      create: vi.fn(async ({ data }: { data: { aggregateId: string } }) => { outbox.push(data); return data; }),
    },
    scheduledJob: {
      create: vi.fn(async ({ data }: { data: Omit<ScheduleRecord, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt'> }) => { const schedule = { id: nextId('schedule'), ...data, lastRunAt: null, createdAt: new Date(), updatedAt: new Date() }; schedules.set(schedule.id, schedule); return schedule; }),
      findMany: vi.fn(async ({ where }: { where: { ownerId: string } }) => [...schedules.values()].filter((schedule) => schedule.ownerId === where.ownerId)),
      findFirst: vi.fn(async ({ where }: { where: { id: string; ownerId: string } }) => [...schedules.values()].find((schedule) => schedule.id === where.id && schedule.ownerId === where.ownerId) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<ScheduleRecord> }) => { const schedule = schedules.get(where.id); if (!schedule) throw new Error('missing schedule'); Object.assign(schedule, data, { updatedAt: new Date() }); return schedule; }),
      deleteMany: vi.fn(async ({ where }: { where: { id: string; ownerId: string } }) => { const schedule = schedules.get(where.id); if (!schedule || schedule.ownerId !== where.ownerId) return { count: 0 }; schedules.delete(where.id); return { count: 1 }; }),
    },
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    reset: () => { users.clear(); jobs.clear(); schedules.clear(); outbox.length = 0; sequence = 0; },
    users,
    jobs,
    outbox,
    schedules,
  };
  const client = {
    ...transactionClient,
    $transaction: vi.fn(async <T>(operation: ((transaction: typeof transactionClient) => Promise<T>) | Promise<unknown>[]) => Array.isArray(operation) ? Promise.all(operation) : operation(transactionClient)),
  };
  return client;
});

vi.mock('@prisma/client', () => ({ PrismaClient: class { constructor() { return fake; } }, Prisma: { PrismaClientKnownRequestError: class extends Error {} } }));
vi.mock('argon2', () => ({ default: { hash: async (value: string) => `hash:${value}`, verify: async (hash: string, value: string) => hash === `hash:${value}` } }));
vi.mock('ioredis', () => ({ default: class { status = 'ready'; async connect() {} async ping() { return 'PONG'; } async get() { return null; } disconnect() {} } }));

let app: typeof import('../src/app.js').app;
beforeAll(async () => { process.env.DATABASE_URL = 'postgresql://test'; process.env.JWT_SECRET = 'test-secret-that-is-long-enough'; process.env.EXECUTOR_SHARED_SECRET = 'test-executor-secret'; process.env.WEB_ORIGIN = 'http://localhost:3000,http://localhost:3002'; ({ app } = await import('../src/app.js')); });
beforeEach(() => { fake.reset(); });

async function register(email: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/register').send({ name: 'Test User', email, password: 'password-12345' }).expect(201);
  return agent;
}

describe('FlowForge API', () => {
  it('reports liveness without database access', async () => { await request(app).get('/health/live').expect(200, { status: 'ok' }); });

  it('allows each configured frontend origin without allowing arbitrary origins', async () => {
    const allowed = await request(app).get('/health/live').set('Origin', 'http://localhost:3002').expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3002');
    const denied = await request(app).get('/health/live').set('Origin', 'http://malicious.example').expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects unauthenticated protected requests', async () => { const response = await request(app).get('/api/v1/jobs'); expect(response.status).toBe(401); expect(response.body.error.code).toBe('UNAUTHENTICATED'); });

  it('sets an HTTP-only session cookie and accepts it for account access', async () => {
    await request(app).post('/api/v1/auth/register').send({ name: 'Login User', email: 'login@example.test', password: 'password-12345' }).expect(201);
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: 'login@example.test', password: 'password-12345' }).expect(200);
    expect(login.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringMatching(/^flowforge_session=.*HttpOnly/i)]));
    expect(login.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringMatching(/Path=\//i), expect.stringMatching(/SameSite=Lax/i)]));
    const account = await agent.get('/api/v1/auth/me').expect(200);
    expect(account.body.user.email).toBe('login@example.test');
  });

  it('hashes registration passwords without passing plaintext to Prisma', async () => {
    await request(app).post('/api/v1/auth/register').send({ name: 'Secure User', email: 'secure@example.test', password: 'password-12345' }).expect(201);
    const stored = [...fake.users.values()].find((user) => user.email === 'secure@example.test');
    expect(stored).toEqual(expect.objectContaining({ passwordHash: 'hash:password-12345' }));
    expect(stored).not.toHaveProperty('password');
  });

  it('protects the SSE endpoint when no session cookie is present', async () => { await request(app).get('/api/v1/events').expect(401); });
  it('protects profile reads when no session cookie is present', async () => { await request(app).get('/api/v1/profile').expect(401); });

  it('validates job input and creates a job plus outbox event', async () => { const agent = await register('owner@example.test'); await agent.post('/api/v1/jobs').send({ type: 'NOT_SUPPORTED', payload: {} }).expect(400); const response = await agent.post('/api/v1/jobs').send({ type: 'JSON_TRANSFORM', payload: { records: [{ name: 'Ada' }] }, idempotencyKey: 'job-1' }).expect(202); expect(response.body.job.status).toBe('QUEUED'); expect(fake.jobs.size).toBe(1); expect(fake.outbox).toHaveLength(1); });

  it('does not expose or modify another owner’s job', async () => { const first = await register('first@example.test'); const second = await register('second@example.test'); const created = await first.post('/api/v1/jobs').send({ type: 'JSON_TRANSFORM', payload: { records: [] } }).expect(202); const jobId = created.body.job.id as string; await second.get(`/api/v1/jobs/${jobId}`).expect(404); await second.post(`/api/v1/jobs/${jobId}/cancel`).expect(409); expect(fake.jobs.get(jobId)?.status).toBe('QUEUED'); });

  it('rejects invalid job IDs and invalid state transitions', async () => { const agent = await register('state@example.test'); await agent.get('/api/v1/jobs/not-a-real-job').expect(404); const created = await agent.post('/api/v1/jobs').send({ type: 'JSON_TRANSFORM', payload: { records: [] } }).expect(202); const jobId = created.body.job.id as string; await agent.post(`/api/v1/jobs/${jobId}/retry`).expect(409); await agent.post(`/api/v1/jobs/${jobId}/cancel`).expect(200); await agent.post(`/api/v1/jobs/${jobId}/cancel`).expect(409); });
  it('validates, persists, and owner-scopes schedules', async () => { const owner = await register('schedule-owner@example.test'); const other = await register('schedule-other@example.test'); await owner.post('/api/v1/schedules').send({ type: 'JSON_TRANSFORM', payload: { records: [] }, cronExpression: 'invalid', timezone: 'UTC' }).expect(400); const created = await owner.post('/api/v1/schedules').send({ type: 'JSON_TRANSFORM', payload: { records: [] }, cronExpression: '*/5 * * * *', timezone: 'UTC' }).expect(201); const scheduleId = created.body.schedule.id as string; expect(fake.schedules.size).toBe(1); await other.get(`/api/v1/schedules/${scheduleId}`).expect(404); await owner.patch(`/api/v1/schedules/${scheduleId}`).send({ enabled: false }).expect(200); expect(fake.schedules.get(scheduleId)?.enabled).toBe(false); await owner.delete(`/api/v1/schedules/${scheduleId}`).expect(204); });
  it('blocks candidate accounts from publishing recruiter postings', async () => { const candidate = await register('candidate@example.test'); await candidate.post('/api/v1/recruitment/jobs').send({ title: 'Platform Engineer', company: 'Northstar Labs', description: 'A sufficiently detailed role description for validation.', requiredSkills: ['TypeScript'], location: 'Remote', workMode: 'REMOTE', employmentType: 'FULL_TIME', status: 'OPEN' }).expect(403); });
  it('keeps recruiter and candidate profile writes role-scoped', async () => { const candidate = await register('profile-candidate@example.test'); const recruiter = await register('profile-recruiter@example.test'); await candidate.put('/api/v1/profile/recruiter').send({}).expect(403); await recruiter.put('/api/v1/profile/candidate').send({ skills: [], targetRoles: [], preferredLocations: [], preferredWorkModes: [], educations: [], experiences: [], certifications: [], languages: [] }).expect(403); });
});
