export type JobStatus = 'QUEUED' | 'RUNNING' | 'RETRYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface JobAttempt {
  id: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultSummary: Record<string, unknown> | null;
}

export interface JobResult {
  id: string;
  jobId: string;
  resultJson: unknown;
  contentType: string | null;
  createdAt: string;
}

export interface Job {
  id: string;
  ownerId: string;
  type: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cancellationRequestedAt: string | null;
  resultSummary: Record<string, unknown> | null;
  attempts: JobAttempt[];
  result: JobResult | null;
  _count?: { attempts: number };
}

export interface JobListResponse {
  jobs: Job[];
  nextCursor: string | null;
}

export interface DashboardSummary {
  total: number;
  completed: number;
  failed: number;
  running: number;
  queued: number;
  successRate: number;
}

export interface SystemHealth {
  status: string;
  services: Record<string, string>;
}

export interface Schedule { id: string; ownerId: string; type: string; payload: Record<string, unknown>; cronExpression: string; timezone: string; enabled: boolean; nextRunAt: string; lastRunAt: string | null; createdAt: string; updatedAt: string; }
export interface AuthUser { id: string; name: string; email: string; role: string; }
export interface JobFit { status: 'READY' | 'INCOMPLETE'; score: number | null; matchedSkills: string[]; missingSkills: string[]; experienceGap: boolean; explanation: string; missingProfileFields: string[]; profileCompletion: number; }
export interface RecruitmentJob { id: string; recruiterId: string; title: string; company: string; description: string; requiredSkills: string[]; qualifications: string[] | null; salaryMin: number | null; salaryMax: number | null; currency: string; location: string; workMode: string; employmentType: string; joiningInfo: string | null; experienceMin: number | null; deadline: string | null; status: 'DRAFT' | 'OPEN' | 'CLOSED'; createdAt: string; updatedAt: string; fit?: JobFit | null; }
export interface RecruitmentApplication { id: string; recruitmentJobId: string; candidateId: string; status: string; coverNote: string | null; createdAt: string; updatedAt: string; recruitmentJob?: RecruitmentJob; }
export interface CandidateEducation { id: string; institution: string; degree: string; specialization: string | null; graduationYear: number | null; grade: string | null; }
export interface CandidateExperience { id: string; company: string; title: string; startDate: string; endDate: string | null; responsibilities: string; }
export interface CandidateCertification { id: string; name: string; issuer: string; issueDate: string | null; credentialUrl: string | null; }
export interface CandidateLanguage { id: string; language: string; proficiency: string; }
export interface CandidateProfile { id: string; userId: string; phone: string | null; hometown: string | null; currentLocation: string | null; skills: unknown; education: string | null; experienceYears: number | null; expectedSalary: number | null; expectedSalaryCurrency: string | null; currentSalary: number | null; currentSalaryCurrency: string | null; targetRoles: unknown; preferredLocations: unknown; preferredWorkModes: unknown; noticePeriod: string | null; educations: CandidateEducation[]; experiences: CandidateExperience[]; certifications: CandidateCertification[]; languages: CandidateLanguage[]; }
export interface RecruiterCompany { id: string; name: string; website: string | null; logoUrl: string | null; industry: string | null; description: string | null; size: string | null; type: string | null; headquarters: string | null; officeLocations: unknown; foundedYear: number | null; registrationDate: string | null; linkedInUrl: string | null; culture: string | null; }
export interface RecruiterProfile { id: string; userId: string; designation: string | null; workEmail: string | null; contactPreferences: unknown; company: RecruiterCompany | null; }
export interface RecruiterJobSummary { id: string; title: string; company: string; status: 'DRAFT' | 'OPEN' | 'CLOSED'; createdAt: string; }
