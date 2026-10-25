import { describe, expect, it } from 'vitest';
import { calculateJobFit } from '../src/recruitment.js';

describe('recruitment matching', () => {
  it('returns explainable skill matches and experience gaps', () => {
    expect(calculateJobFit({ requiredSkills: ['TypeScript', 'PostgreSQL', 'Redis'], candidateSkills: ['typescript', 'React'], experienceMin: 3, candidateExperience: 1 })).toEqual({
      status: 'READY',
      score: 27,
      matchedSkills: ['TypeScript'],
      missingSkills: ['PostgreSQL', 'Redis'],
      experienceGap: true,
      explanation: 'Score combines required-skill overlap (80%) and meeting the stated experience threshold (20%).',
      missingProfileFields: [],
      profileCompletion: 100,
    });
  });

  it('returns an honest incomplete state when profile evidence is missing', () => {
    expect(calculateJobFit({ requiredSkills: ['TypeScript'], candidateSkills: [], candidateExperience: null, profileCompletion: 0 })).toEqual({
      status: 'INCOMPLETE', score: null, matchedSkills: [], missingSkills: ['TypeScript'], experienceGap: false,
      explanation: 'Complete your technical skills and experience profile before comparing this role.', missingProfileFields: ['technical skills', 'experience history'], profileCompletion: 0,
    });
  });

  it('is deterministic for identical profile and job data', () => {
    const input = { requiredSkills: ['React', 'TypeScript'], candidateSkills: ['typescript'], experienceMin: 2, candidateExperience: 3 };
    expect(calculateJobFit(input)).toEqual(calculateJobFit(input));
  });
});
