import { describe, expect, it } from 'vitest';
import { hiringPipelineCounts } from './hiring-dashboard';

describe('hiring pipeline counts', () => {
  it('maps persisted application statuses without inventing totals', () => {
    expect(hiringPipelineCounts([
      { id: '1', recruitmentJobId: 'job', candidateId: 'candidate', status: 'SUBMITTED', coverNote: null, createdAt: '', updatedAt: '' },
      { id: '2', recruitmentJobId: 'job', candidateId: 'candidate', status: 'SCREENING', coverNote: null, createdAt: '', updatedAt: '' },
      { id: '3', recruitmentJobId: 'job', candidateId: 'candidate', status: 'INTERVIEW', coverNote: null, createdAt: '', updatedAt: '' },
      { id: '4', recruitmentJobId: 'job', candidateId: 'candidate', status: 'ACCEPTED', coverNote: null, createdAt: '', updatedAt: '' },
      { id: '5', recruitmentJobId: 'job', candidateId: 'candidate', status: 'REJECTED', coverNote: null, createdAt: '', updatedAt: '' },
    ])).toEqual({ applied: 1, shortlisted: 1, interview: 1, selected: 1 });
  });
});
