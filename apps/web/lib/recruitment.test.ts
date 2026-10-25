import { describe, expect, it } from 'vitest';
import { isCandidateRole } from './recruitment';

describe('recruitment role behavior', () => {
  it('loads candidate-only application data for candidates', () => {
    expect(isCandidateRole('USER')).toBe(true);
  });

  it('does not treat recruiter or unknown sessions as candidates', () => {
    expect(isCandidateRole('ADMIN')).toBe(false);
    expect(isCandidateRole(undefined)).toBe(false);
  });
});
