import { describe, expect, it } from 'vitest';
import { parseExecutorResponse, shouldRetry } from '../src/processor.js';
import { nextCronOccurrence, parseCron } from '@flowforge/contracts';

describe('worker execution decisions', () => {
  it('accepts a successful executor response', () => { const outcome = parseExecutorResponse({ ok: true, summary: { records: 2 }, result: [{ id: 1 }] }); expect(outcome.ok).toBe(true); expect(outcome.summary?.records).toBe(2); });
  it('retries a retryable failure before the attempt limit', () => { const outcome = parseExecutorResponse({ ok: false, error: { code: 'TEMPORARY', message: 'try again', retryable: true } }); expect(shouldRetry(outcome, 0, 3)).toBe(true); expect(shouldRetry(outcome, 2, 3)).toBe(false); });
  it('does not retry a permanent failure', () => { const outcome = parseExecutorResponse({ ok: false, error: { code: 'INVALID_INPUT', message: 'bad payload', retryable: false } }); expect(shouldRetry(outcome, 0, 3)).toBe(false); });
  it('rejects malformed executor responses', () => { expect(() => parseExecutorResponse({ ok: 'yes' })).toThrow('Invalid executor response'); expect(() => parseExecutorResponse({ ok: false, error: { code: 'BROKEN' } })).toThrow('Invalid executor error'); });
  it('calculates the next supported cron occurrence in its timezone', () => { expect(parseCron('*/5 * * * *').minute).toContain(55); const next = nextCronOccurrence('*/5 * * * *', 'UTC', new Date('2026-10-16T10:01:00.000Z')); expect(next.toISOString()).toBe('2026-10-16T10:05:00.000Z'); });
  it('rejects invalid schedule expressions and timezones', () => { expect(() => parseCron('* * *')).toThrow('five fields'); expect(() => nextCronOccurrence('* * * * *', 'Not/AZone', new Date())).toThrow('Invalid timezone'); });
});
