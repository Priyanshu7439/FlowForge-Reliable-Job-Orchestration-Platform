import type { RecruitmentApplication } from './types';

export interface HiringPipelineCounts {
  applied: number;
  shortlisted: number;
  interview: number;
  selected: number;
}

export function hiringPipelineCounts(applications: RecruitmentApplication[]): HiringPipelineCounts {
  return applications.reduce((counts, application) => {
    if (application.status === 'SUBMITTED') counts.applied += 1;
    if (application.status === 'SCREENING') counts.shortlisted += 1;
    if (application.status === 'INTERVIEW') counts.interview += 1;
    if (application.status === 'ACCEPTED') counts.selected += 1;
    return counts;
  }, { applied: 0, shortlisted: 0, interview: 0, selected: 0 });
}
