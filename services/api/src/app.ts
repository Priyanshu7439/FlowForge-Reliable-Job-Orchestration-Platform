import crypto from 'node:crypto';
import IORedis from 'ioredis';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { JOB_TYPES } from '@flowforge/contracts';
import { nextCronOccurrence, validateTimezone } from '@flowforge/contracts';
import { config } from './config.js';
import { hashPassword, requireAuth, requireRole, setSession, verifyPassword } from './auth.js';
import { addJobEventListener } from './events.js';
import { readRedisHealth } from './health.js';
import { calculateJobFit, jsonStringArray } from './recruitment.js';

export const prisma = new PrismaClient();
const createHealthRedis = () => new IORedis(config.REDIS_URL, { lazyConnect: true, connectTimeout: 1_000, maxRetriesPerRequest: 1, enableOfflineQueue: false });
let healthRedis = createHealthRedis();
export const app = express();
const jsonPayload = z.record(z.string(), z.unknown());
const jobInput = z.object({ type: z.enum(JOB_TYPES), payload: jsonPayload, idempotencyKey: z.string().min(1).max(200).optional(), scheduledAt: z.coerce.date().optional() });
const scheduleInput = z.object({ type: z.enum(JOB_TYPES), payload: jsonPayload, cronExpression: z.string().min(1).max(100), timezone: z.string().min(1).max(80), enabled: z.boolean().optional() });
const recruitmentJobInput = z.object({ title: z.string().min(3).max(120), company: z.string().min(2).max(120), description: z.string().min(40).max(20_000), requiredSkills: z.array(z.string().min(1).max(80)).min(1).max(30), qualifications: z.array(z.string().min(1).max(200)).max(20).optional(), salaryMin: z.number().int().nonnegative().optional(), salaryMax: z.number().int().nonnegative().optional(), currency: z.string().length(3).default('USD'), location: z.string().min(2).max(120), workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']), employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']), joiningInfo: z.string().max(500).optional(), experienceMin: z.number().int().nonnegative().max(50).optional(), deadline: z.coerce.date().optional(), status: z.enum(['DRAFT', 'OPEN']).default('DRAFT') }).refine((value) => value.salaryMin == null || value.salaryMax == null || value.salaryMax >= value.salaryMin, { message: 'salaryMax must be greater than or equal to salaryMin' });
const applicationInput = z.object({ coverNote: z.string().max(2_000).optional() });
const applicationStatusInput = z.object({ status: z.enum(['SCREENING', 'INTERVIEW', 'REJECTED', 'ACCEPTED']) });
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const dateField = z.coerce.date().optional().nullable();
const candidateProfileInput = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: optionalText(40), hometown: optionalText(120), currentLocation: optionalText(120),
  skills: z.array(z.string().trim().min(1).max(80)).max(50),
  expectedSalary: z.number().int().nonnegative().optional().nullable(), expectedSalaryCurrency: optionalText(3),
  currentSalary: z.number().int().nonnegative().optional().nullable(), currentSalaryCurrency: optionalText(3),
  targetRoles: z.array(z.string().trim().min(1).max(120)).max(20), preferredLocations: z.array(z.string().trim().min(1).max(120)).max(20),
  preferredWorkModes: z.array(z.enum(['REMOTE', 'HYBRID', 'ONSITE'])).max(3), noticePeriod: optionalText(80),
  experienceYears: z.number().int().nonnegative().max(70).optional().nullable(),
  educations: z.array(z.object({ institution: z.string().trim().min(2).max(160), degree: z.string().trim().min(2).max(120), specialization: optionalText(120), graduationYear: z.number().int().min(1900).max(2200).optional().nullable(), grade: optionalText(40) })).max(20),
  experiences: z.array(z.object({ company: z.string().trim().min(2).max(160), title: z.string().trim().min(2).max(120), startDate: z.coerce.date(), endDate: dateField, responsibilities: z.string().trim().min(10).max(5_000) })).max(30),
  certifications: z.array(z.object({ name: z.string().trim().min(2).max(160), issuer: z.string().trim().min(2).max(160), issueDate: dateField, credentialUrl: optionalText(500) })).max(30),
  languages: z.array(z.object({ language: z.string().trim().min(2).max(80), proficiency: z.string().trim().min(1).max(40) })).max(20),
});
const recruiterProfileInput = z.object({
  name: z.string().trim().min(2).max(80).optional(), designation: optionalText(120), workEmail: z.string().email().optional().nullable(),
  contactPreferences: z.record(z.string(), z.boolean()).optional(),
  company: z.object({ name: z.string().trim().min(2).max(160), website: optionalText(500), logoUrl: optionalText(500), industry: optionalText(120), description: optionalText(5_000), size: optionalText(80), type: optionalText(80), headquarters: optionalText(160), officeLocations: z.array(z.string().trim().min(2).max(160)).max(30), foundedYear: z.number().int().min(1800).max(2200).optional().nullable(), registrationDate: dateField, linkedInUrl: optionalText(500), culture: optionalText(5_000) }),
});
const publicUser = (user: { id: string; name: string; email: string; role: string }) => ({ id: user.id, name: user.name, email: user.email, role: user.role });

app.use((request, _response, next) => { request.id = request.header('x-request-id') ?? crypto.randomUUID(); next(); });
app.use(helmet());
const allowedWebOrigins = new Set(config.WEB_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean));
app.use(cors({ origin: (origin, callback) => callback(null, origin ? allowedWebOrigins.has(origin) && origin : true), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

const error = (request: express.Request, response: express.Response, status: number, code: string, message: string) => response.status(status).json({ error: { code, message, requestId: request.id } });
const routeParam = (request: express.Request, name: string): string | null => { const value = request.params[name]; return typeof value === 'string' && value.length > 0 ? value : null; };

app.get('/health/live', (_request, response) => response.json({ status: 'ok' }));
app.get('/api/v1/system/health', async (request, response) => {
  let postgres: 'ok' | 'unhealthy' = 'ok';
  let redis: 'ok' | 'unhealthy' = 'ok';
  let worker: 'ok' | 'unhealthy' | 'unknown' = 'unknown';
  let executor: 'ok' | 'unhealthy' = 'unhealthy';
  try { await prisma.$queryRaw`SELECT 1`; } catch { postgres = 'unhealthy'; }
  try {
    const redisHealth = await readRedisHealth(healthRedis);
    worker = redisHealth.worker;
    redis = redisHealth.redis;
  } catch {
    healthRedis.disconnect();
    healthRedis = createHealthRedis();
    redis = 'unhealthy';
  }
  try {
    const result = await fetch(`${config.EXECUTOR_URL}/health/live`, { signal: AbortSignal.timeout(2_000) });
    executor = result.ok ? 'ok' : 'unhealthy';
  } catch { executor = 'unhealthy'; }
  const services = { api: 'ok' as const, postgres, redis, worker, executor, sse: 'unknown' as const };
  const status = Object.values(services).some((service) => service === 'unhealthy' || service === 'unknown') ? 'degraded' : 'ok';
  if (postgres === 'unhealthy') return error(request, response, 503, 'NOT_READY', 'Database unavailable');
  response.json({ status, services });
});
app.get('/api/v1/openapi.json', (_request, response) => response.json({ openapi: '3.0.3', info: { title: 'FlowForge API', version: '1.0.0' }, paths: { '/api/v1/jobs': { get: {}, post: {} }, '/api/v1/auth/login': { post: {} } } }));

app.post('/api/v1/auth/register', async (request, response) => { const body = z.object({ name: z.string().min(2).max(80), email: z.string().email().transform((value) => value.toLowerCase()), password: z.string().min(10).max(128) }).safeParse(request.body); if (!body.success) return error(request, response, 400, 'INVALID_INPUT', 'Invalid registration details'); try { const { password, ...userData } = body.data; const user = await prisma.user.create({ data: { ...userData, passwordHash: await hashPassword(password) } }); setSession(response, { userId: user.id, role: user.role }); response.status(201).json({ user: publicUser(user) }); } catch (cause) { if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === 'P2002') return error(request, response, 409, 'EMAIL_EXISTS', 'Email is already registered'); throw cause; } });
app.post('/api/v1/auth/login', async (request, response) => { const body = z.object({ email: z.string().email(), password: z.string() }).safeParse(request.body); if (!body.success) return error(request, response, 400, 'INVALID_INPUT', 'Invalid login details'); const user = await prisma.user.findUnique({ where: { email: body.data.email.toLowerCase() } }); if (!user || !(await verifyPassword(user.passwordHash, body.data.password))) return error(request, response, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect'); setSession(response, { userId: user.id, role: user.role }); response.json({ user: publicUser(user) }); });
app.post('/api/v1/auth/logout', (_request, response) => { response.clearCookie('flowforge_session'); response.status(204).end(); });
app.get('/api/v1/auth/me', requireAuth, async (request, response) => { const user = await prisma.user.findUnique({ where: { id: request.session!.userId } }); if (!user) return error(request, response, 401, 'UNAUTHENTICATED', 'Authentication required'); response.json({ user: publicUser(user) }); });

app.post('/api/v1/jobs', requireAuth, async (request, response) => { const body = jobInput.safeParse(request.body); if (!body.success) return error(request, response, 400, 'INVALID_INPUT', 'Unsupported job payload'); const ownerId = request.session!.userId; try { const job = await prisma.$transaction(async (tx) => { if (body.data.idempotencyKey) { const existing = await tx.job.findFirst({ where: { ownerId, idempotencyKey: body.data.idempotencyKey } }); if (existing) { if (JSON.stringify(existing.payload) !== JSON.stringify(body.data.payload) || existing.type !== body.data.type) throw new Error('IDEMPOTENCY_CONFLICT'); return existing; } } const created = await tx.job.create({ data: { ownerId, type: body.data.type, payload: body.data.payload as Prisma.InputJsonValue, idempotencyKey: body.data.idempotencyKey, scheduledAt: body.data.scheduledAt } }); await tx.outboxEvent.create({ data: { aggregateId: created.id, eventType: 'JOB_CREATED', payload: { jobId: created.id } } }); return created; }); response.status(202).json({ job: { id: job.id, type: job.type, status: job.status, createdAt: job.createdAt } }); } catch (cause) { if (cause instanceof Error && cause.message === 'IDEMPOTENCY_CONFLICT') return error(request, response, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with a different payload'); throw cause; } });
app.get('/api/v1/jobs', requireAuth, async (request, response) => { const limit = Math.min(Number(request.query.limit ?? 20), 100); const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined; const status = typeof request.query.status === 'string' ? request.query.status : undefined; const jobs = await prisma.job.findMany({ where: { ownerId: request.session!.userId, ...(status ? { status: status as never } : {}) }, orderBy: { createdAt: 'desc' }, take: limit + 1, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), include: { _count: { select: { attempts: true } } } }); const next = jobs.length > limit ? jobs.pop()!.id : null; response.json({ jobs, nextCursor: next }); });
app.get('/api/v1/jobs/:id', requireAuth, async (request, response) => { const jobId = routeParam(request, 'id'); if (!jobId) return error(request, response, 400, 'INVALID_INPUT', 'Job ID is required'); const job = await prisma.job.findFirst({ where: { id: jobId, ownerId: request.session!.userId }, include: { attempts: { orderBy: { attemptNumber: 'asc' } }, result: true } }); if (!job) return error(request, response, 404, 'NOT_FOUND', 'Job not found'); response.json({ job }); });
app.get('/api/v1/jobs/:id/attempts', requireAuth, async (request, response) => { const jobId = routeParam(request, 'id'); if (!jobId) return error(request, response, 400, 'INVALID_INPUT', 'Job ID is required'); const job = await prisma.job.findFirst({ where: { id: jobId, ownerId: request.session!.userId }, select: { id: true } }); if (!job) return error(request, response, 404, 'NOT_FOUND', 'Job not found'); response.json({ attempts: await prisma.jobAttempt.findMany({ where: { jobId: job.id }, orderBy: { attemptNumber: 'asc' } }) }); });
app.get('/api/v1/jobs/:id/result', requireAuth, async (request, response) => { const jobId = routeParam(request, 'id'); if (!jobId) return error(request, response, 400, 'INVALID_INPUT', 'Job ID is required'); const result = await prisma.jobResult.findFirst({ where: { jobId, job: { ownerId: request.session!.userId } } }); if (!result) return error(request, response, 404, 'NOT_FOUND', 'Result not found'); response.json({ result }); });
app.post('/api/v1/jobs/:id/cancel', requireAuth, async (request, response) => { const jobId = routeParam(request, 'id'); if (!jobId) return error(request, response, 400, 'INVALID_INPUT', 'Job ID is required'); const job = await prisma.job.updateMany({ where: { id: jobId, ownerId: request.session!.userId, status: { in: ['QUEUED', 'RETRYING'] } }, data: { status: 'CANCELLED', cancellationRequestedAt: new Date(), completedAt: new Date() } }); if (!job.count) return error(request, response, 409, 'INVALID_STATE', 'Job cannot be cancelled'); response.json({ status: 'CANCELLED' }); });
app.post('/api/v1/jobs/:id/retry', requireAuth, async (request, response) => { const jobId = routeParam(request, 'id'); if (!jobId) return error(request, response, 400, 'INVALID_INPUT', 'Job ID is required'); const job = await prisma.$transaction(async (tx) => { const current = await tx.job.findFirst({ where: { id: jobId, ownerId: request.session!.userId } }); if (!current || current.status !== 'FAILED') return null; const updated = await tx.job.update({ where: { id: current.id }, data: { status: 'QUEUED', completedAt: null } }); await tx.outboxEvent.create({ data: { aggregateId: updated.id, eventType: 'JOB_CREATED', payload: { jobId: updated.id } } }); return updated; }); if (!job) return error(request, response, 409, 'INVALID_STATE', 'Only failed jobs can be retried'); response.status(202).json({ job }); });

app.post('/api/v1/schedules', requireAuth, async (request, response) => {
  const body = scheduleInput.safeParse(request.body);
  if (!body.success || !validateTimezone(body.success ? body.data.timezone : '')) return error(request, response, 400, 'INVALID_INPUT', 'Invalid schedule details');
  try {
    const nextRunAt = nextCronOccurrence(body.data.cronExpression, body.data.timezone, new Date());
    const schedule = await prisma.scheduledJob.create({ data: { ownerId: request.session!.userId, type: body.data.type, payload: body.data.payload as Prisma.InputJsonValue, cronExpression: body.data.cronExpression, timezone: body.data.timezone, enabled: body.data.enabled ?? true, nextRunAt } });
    response.status(201).json({ schedule });
  } catch (cause) { error(request, response, 400, 'INVALID_SCHEDULE', cause instanceof Error ? cause.message : 'Invalid schedule expression'); }
});
app.get('/api/v1/schedules', requireAuth, async (request, response) => { response.json({ schedules: await prisma.scheduledJob.findMany({ where: { ownerId: request.session!.userId }, orderBy: { nextRunAt: 'asc' } }) }); });
app.get('/api/v1/schedules/:id', requireAuth, async (request, response) => { const scheduleId = routeParam(request, 'id'); if (!scheduleId) return error(request, response, 400, 'INVALID_INPUT', 'Schedule ID is required'); const schedule = await prisma.scheduledJob.findFirst({ where: { id: scheduleId, ownerId: request.session!.userId } }); if (!schedule) return error(request, response, 404, 'NOT_FOUND', 'Schedule not found'); response.json({ schedule }); });
app.patch('/api/v1/schedules/:id', requireAuth, async (request, response) => {
  const scheduleId = routeParam(request, 'id'); if (!scheduleId) return error(request, response, 400, 'INVALID_INPUT', 'Schedule ID is required');
  const current = await prisma.scheduledJob.findFirst({ where: { id: scheduleId, ownerId: request.session!.userId } }); if (!current) return error(request, response, 404, 'NOT_FOUND', 'Schedule not found');
  const body = scheduleInput.partial().safeParse(request.body); if (!body.success) return error(request, response, 400, 'INVALID_INPUT', 'Invalid schedule details');
  const timezone = body.data.timezone ?? current.timezone; const cronExpression = body.data.cronExpression ?? current.cronExpression;
  if (!validateTimezone(timezone)) return error(request, response, 400, 'INVALID_INPUT', 'Invalid timezone');
  try { const nextRunAt = body.data.cronExpression || body.data.timezone ? nextCronOccurrence(cronExpression, timezone, new Date()) : current.nextRunAt; const schedule = await prisma.scheduledJob.update({ where: { id: current.id }, data: { ...body.data, payload: body.data.payload as Prisma.InputJsonValue | undefined, timezone, cronExpression, nextRunAt } }); response.json({ schedule }); } catch (cause) { error(request, response, 400, 'INVALID_SCHEDULE', cause instanceof Error ? cause.message : 'Invalid schedule expression'); }
});
app.delete('/api/v1/schedules/:id', requireAuth, async (request, response) => { const scheduleId = routeParam(request, 'id'); if (!scheduleId) return error(request, response, 400, 'INVALID_INPUT', 'Schedule ID is required'); const deleted = await prisma.scheduledJob.deleteMany({ where: { id: scheduleId, ownerId: request.session!.userId } }); if (!deleted.count) return error(request, response, 404, 'NOT_FOUND', 'Schedule not found'); response.status(204).end(); });

app.get('/api/v1/profile', requireAuth, async (request, response) => {
  if (request.session!.role === 'USER') {
    const user = await prisma.user.findUnique({ where: { id: request.session!.userId }, include: { candidateProfile: { include: { educations: true, experiences: true, certifications: true, languages: true } } } });
    if (!user) return error(request, response, 404, 'NOT_FOUND', 'Account not found');
    return response.json({ user: publicUser(user), profile: user.candidateProfile });
  }
  const user = await prisma.user.findUnique({ where: { id: request.session!.userId }, include: { recruiterProfile: { include: { company: true } }, recruiterJobs: { orderBy: { createdAt: 'desc' }, select: { id: true, title: true, company: true, status: true, createdAt: true } } } });
  if (!user) return error(request, response, 404, 'NOT_FOUND', 'Account not found');
  return response.json({ user: publicUser(user), profile: user.recruiterProfile, jobs: user.recruiterJobs });
});

app.put('/api/v1/profile/candidate', requireRole('USER'), async (request, response) => {
  const body = candidateProfileInput.safeParse(request.body);
  if (!body.success) return error(request, response, 400, 'INVALID_INPUT', 'Invalid candidate profile details');
  const data = body.data;
  const profile = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: request.session!.userId }, data: data.name ? { name: data.name } : {} });
    const current = await tx.candidateProfile.upsert({
      where: { userId: request.session!.userId },
      update: { phone: data.phone, hometown: data.hometown, currentLocation: data.currentLocation, skills: data.skills, expectedSalary: data.expectedSalary, expectedSalaryCurrency: data.expectedSalaryCurrency, currentSalary: data.currentSalary, currentSalaryCurrency: data.currentSalaryCurrency, targetRoles: data.targetRoles, preferredLocations: data.preferredLocations, preferredWorkModes: data.preferredWorkModes, noticePeriod: data.noticePeriod, experienceYears: data.experienceYears, education: data.educations[0]?.degree ?? null },
      create: { userId: request.session!.userId, skills: data.skills, phone: data.phone, hometown: data.hometown, currentLocation: data.currentLocation, expectedSalary: data.expectedSalary, expectedSalaryCurrency: data.expectedSalaryCurrency, currentSalary: data.currentSalary, currentSalaryCurrency: data.currentSalaryCurrency, targetRoles: data.targetRoles, preferredLocations: data.preferredLocations, preferredWorkModes: data.preferredWorkModes, noticePeriod: data.noticePeriod, experienceYears: data.experienceYears, education: data.educations[0]?.degree ?? null },
    });
    await tx.candidateEducation.deleteMany({ where: { candidateProfileId: current.id } });
    await tx.candidateExperience.deleteMany({ where: { candidateProfileId: current.id } });
    await tx.candidateCertification.deleteMany({ where: { candidateProfileId: current.id } });
    await tx.candidateLanguage.deleteMany({ where: { candidateProfileId: current.id } });
    if (data.educations.length) await tx.candidateEducation.createMany({ data: data.educations.map((item) => ({ ...item, candidateProfileId: current.id })) });
    if (data.experiences.length) await tx.candidateExperience.createMany({ data: data.experiences.map((item) => ({ ...item, candidateProfileId: current.id })) });
    if (data.certifications.length) await tx.candidateCertification.createMany({ data: data.certifications.map((item) => ({ ...item, candidateProfileId: current.id })) });
    if (data.languages.length) await tx.candidateLanguage.createMany({ data: data.languages.map((item) => ({ ...item, candidateProfileId: current.id })) });
    return tx.candidateProfile.findUnique({ where: { id: current.id }, include: { educations: true, experiences: true, certifications: true, languages: true } });
  });
  response.json({ profile });
});

app.put('/api/v1/profile/recruiter', requireRole('ADMIN'), async (request, response) => {
  const body = recruiterProfileInput.safeParse(request.body);
  if (!body.success) return error(request, response, 400, 'INVALID_INPUT', 'Invalid recruiter or company profile details');
  const data = body.data;
  const profile = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: request.session!.userId }, data: data.name ? { name: data.name } : {} });
    const recruiter = await tx.recruiterProfile.upsert({ where: { userId: request.session!.userId }, update: { designation: data.designation, workEmail: data.workEmail, contactPreferences: data.contactPreferences }, create: { userId: request.session!.userId, designation: data.designation, workEmail: data.workEmail, contactPreferences: data.contactPreferences } });
    await tx.companyProfile.upsert({ where: { recruiterProfileId: recruiter.id }, update: data.company, create: { recruiterProfileId: recruiter.id, ...data.company } });
    return tx.recruiterProfile.findUnique({ where: { id: recruiter.id }, include: { company: true } });
  });
  response.json({ profile });
});

app.post('/api/v1/recruitment/jobs', requireRole('ADMIN'), async (request, response) => {
  const body = recruitmentJobInput.safeParse(request.body);
  if (!body.success) return error(request, response, 400, 'INVALID_INPUT', 'Invalid job posting details');
  const job = await prisma.recruitmentJob.create({ data: { ...body.data, requiredSkills: body.data.requiredSkills, qualifications: body.data.qualifications, recruiterId: request.session!.userId, deadline: body.data.deadline } });
  response.status(201).json({ job });
});

app.get('/api/v1/recruitment/jobs', requireAuth, async (request, response) => {
  const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
  const profile = request.session!.role === 'USER' ? await prisma.candidateProfile.findUnique({ where: { userId: request.session!.userId } }) : null;
  const jobs = await prisma.recruitmentJob.findMany({ where: { status: 'OPEN', ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { company: { contains: search, mode: 'insensitive' } }, { location: { contains: search, mode: 'insensitive' } }] } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 });
  const profileCompletion = profile ? Math.round(([jsonStringArray(profile.skills).length > 0, profile.experienceYears != null, Boolean(profile.currentLocation), jsonStringArray(profile.targetRoles).length > 0].filter(Boolean).length / 4) * 100) : 0;
  response.json({ jobs: jobs.map((job) => ({ ...job, fit: request.session!.role === 'USER' ? calculateJobFit({ requiredSkills: jsonStringArray(job.requiredSkills), candidateSkills: profile ? jsonStringArray(profile.skills) : [], experienceMin: job.experienceMin, candidateExperience: profile?.experienceYears, profileCompletion }) : null })) });
});

app.get('/api/v1/recruitment/jobs/:id', requireAuth, async (request, response) => {
  const jobId = routeParam(request, 'id'); if (!jobId) return error(request, response, 400, 'INVALID_INPUT', 'Job ID is required');
  const job = await prisma.recruitmentJob.findFirst({ where: { id: jobId, OR: [{ status: 'OPEN' }, { recruiterId: request.session!.userId }] } });
  if (!job) return error(request, response, 404, 'NOT_FOUND', 'Job posting not found');
  response.json({ job });
});

app.post('/api/v1/recruitment/jobs/:id/applications', requireRole('USER'), async (request, response) => {
  const jobId = routeParam(request, 'id'); if (!jobId) return error(request, response, 400, 'INVALID_INPUT', 'Job ID is required');
  const body = applicationInput.safeParse(request.body); if (!body.success) return error(request, response, 400, 'INVALID_INPUT', 'Invalid application details');
  const job = await prisma.recruitmentJob.findFirst({ where: { id: jobId, status: 'OPEN' }, select: { id: true } }); if (!job) return error(request, response, 404, 'NOT_FOUND', 'Job posting not found');
  try { const application = await prisma.application.create({ data: { recruitmentJobId: job.id, candidateId: request.session!.userId, coverNote: body.data.coverNote } }); response.status(201).json({ application }); }
  catch (cause) { if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === 'P2002') return error(request, response, 409, 'ALREADY_APPLIED', 'You have already applied to this job'); throw cause; }
});

app.get('/api/v1/recruitment/applications', requireRole('USER'), async (request, response) => { const applications = await prisma.application.findMany({ where: { candidateId: request.session!.userId }, include: { recruitmentJob: true }, orderBy: { createdAt: 'desc' } }); response.json({ applications }); });
app.get('/api/v1/recruitment/jobs/:id/applications', requireRole('ADMIN'), async (request, response) => { const jobId = routeParam(request, 'id'); if (!jobId) return error(request, response, 400, 'INVALID_INPUT', 'Job ID is required'); const applications = await prisma.application.findMany({ where: { recruitmentJobId: jobId, recruitmentJob: { recruiterId: request.session!.userId } }, include: { candidate: { select: { id: true, name: true, email: true, candidateProfile: true } } }, orderBy: { createdAt: 'asc' } }); response.json({ applications }); });
app.patch('/api/v1/recruitment/applications/:id', requireRole('ADMIN'), async (request, response) => { const applicationId = routeParam(request, 'id'); if (!applicationId) return error(request, response, 400, 'INVALID_INPUT', 'Application ID is required'); const body = applicationStatusInput.safeParse(request.body); if (!body.success) return error(request, response, 400, 'INVALID_INPUT', 'Invalid application status'); const application = await prisma.application.updateMany({ where: { id: applicationId, recruitmentJob: { recruiterId: request.session!.userId } }, data: { status: body.data.status } }); if (!application.count) return error(request, response, 404, 'NOT_FOUND', 'Application not found'); response.json({ status: body.data.status }); });

app.get('/api/v1/dashboard/summary', requireAuth, async (request, response) => { const ownerId = request.session!.userId; const [total, completed, failed, running, queued] = await Promise.all([prisma.job.count({ where: { ownerId } }), prisma.job.count({ where: { ownerId, status: 'COMPLETED' } }), prisma.job.count({ where: { ownerId, status: 'FAILED' } }), prisma.job.count({ where: { ownerId, status: 'RUNNING' } }), prisma.job.count({ where: { ownerId, status: { in: ['QUEUED', 'RETRYING'] } } })]); response.json({ total, completed, failed, running, queued, successRate: total ? completed / total : 0 }); });
app.get('/api/v1/events', requireAuth, async (request, response) => {
  response.setHeader('Content-Type', 'text/event-stream'); response.setHeader('Cache-Control', 'no-cache'); response.setHeader('Connection', 'keep-alive'); response.flushHeaders();
  response.write(`event: ready\ndata: ${JSON.stringify({ requestId: request.id })}\n\n`);
  const unsubscribe = await addJobEventListener(request.session!.userId, (event) => { if (!response.writableEnded) response.write(`event: job\ndata: ${JSON.stringify(event)}\n\n`); });
  const heartbeat = setInterval(() => { if (!response.writableEnded) response.write(': heartbeat\n\n'); }, 20_000);
  request.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});

app.use((cause: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const prismaCode = cause instanceof Prisma.PrismaClientKnownRequestError ? cause.code : undefined;
  console.error(JSON.stringify({ level: 'error', requestId: request.id, error: cause instanceof Error ? cause.message : 'unknown', code: prismaCode }));
  if (request.path.startsWith('/api/v1/profile') && (prismaCode === 'P2021' || prismaCode === 'P2022')) return error(request, response, 503, 'PROFILE_SCHEMA_UNAVAILABLE', 'Profile storage is not ready. Apply the profiles migration before using profile features.');
  error(request, response, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
});
