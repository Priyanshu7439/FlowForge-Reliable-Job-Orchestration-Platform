import type { Prisma } from '@prisma/client';

export interface ExecutionError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ExecutionOutcome {
  ok: boolean;
  summary?: Prisma.InputJsonObject;
  result?: Prisma.InputJsonValue;
  error?: ExecutionError;
}

function isJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every((item) => item === null || isJsonValue(item));
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every((item) => item === null || isJsonValue(item));
}

function isJsonObject(value: unknown): value is Prisma.InputJsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && isJsonValue(value));
}

export function parseExecutorResponse(value: unknown): ExecutionOutcome {
  if (!value || typeof value !== 'object' || !('ok' in value) || typeof value.ok !== 'boolean') throw new Error('Invalid executor response');
  const response = value as { ok: boolean; summary?: unknown; result?: unknown; error?: unknown };
  if (response.summary !== undefined && !isJsonObject(response.summary)) throw new Error('Invalid executor summary');
  if (response.result !== undefined && !isJsonValue(response.result)) throw new Error('Invalid executor result');
  if (response.error !== undefined) {
    if (!response.error || typeof response.error !== 'object' || !('code' in response.error) || !('message' in response.error) || !('retryable' in response.error) || typeof response.error.code !== 'string' || typeof response.error.message !== 'string' || typeof response.error.retryable !== 'boolean') throw new Error('Invalid executor error');
    return { ok: response.ok, summary: response.summary, result: response.result, error: response.error as ExecutionError };
  }
  return { ok: response.ok, summary: response.summary, result: response.result };
}

export function shouldRetry(outcome: ExecutionOutcome, attemptsMade: number, maxAttempts: number): boolean {
  return !outcome.ok && Boolean(outcome.error?.retryable) && attemptsMade + 1 < maxAttempts;
}
