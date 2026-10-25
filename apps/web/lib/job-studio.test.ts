import { describe, expect, it } from 'vitest';
import { buildStudioPayload, createStudioRecord, validateStudioInput, type StudioFormValues } from './job-studio';

const base: StudioFormValues = { records: [{ name: 'Ada', team: 'Platform', value: '' }], select: 'name, team', csv: '', failUntilAttempt: 1 };

describe('job studio payloads', () => {
  it('builds the JSON transformation contract from structured records', () => {
    expect(buildStudioPayload('JSON_TRANSFORM', base)).toEqual({ records: [{ name: 'Ada', team: 'Platform' }], select: ['name', 'team'] });
  });

  it('builds CSV and failure simulation payloads', () => {
    expect(buildStudioPayload('CSV_VALIDATE', { ...base, csv: 'name\nAda\n' })).toEqual({ csv: 'name\nAda\n' });
    expect(buildStudioPayload('FAILURE_SIMULATION', { ...base, failUntilAttempt: 2 })).toEqual({ failUntilAttempt: 2 });
  });

  it('validates required inputs', () => {
    expect(validateStudioInput('JSON_TRANSFORM', { ...base, records: [createStudioRecord()] })).toBe('Add at least one record.');
    expect(validateStudioInput('CSV_VALIDATE', { ...base, csv: ' ' })).toContain('CSV');
    expect(validateStudioInput('FAILURE_SIMULATION', { ...base, failUntilAttempt: 4 })).toContain('between 1 and 3');
  });
});
