export const JOB_TYPES = ['JSON_TRANSFORM', 'CSV_VALIDATE', 'REPORT_GENERATE', 'FAILURE_SIMULATION'] as const;
export type JobType = (typeof JOB_TYPES)[number];
export const JOB_STATUSES = ['QUEUED', 'RUNNING', 'RETRYING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export type JobPayload = Record<string, unknown>;
export interface JobMessage { jobId: string; attempt: number; type: JobType; payload: JobPayload; }
export interface ExecutorRequest { jobId: string; type: JobType; payload: JobPayload; attempt: number; }
export interface ExecutorResponse { ok: boolean; summary: Record<string, unknown>; result?: unknown; error?: { code: string; message: string; retryable: boolean }; }
export interface ApiError { error: { code: string; message: string; requestId: string }; }
export { nextCronOccurrence, parseCron, validateTimezone } from './schedule.js';
