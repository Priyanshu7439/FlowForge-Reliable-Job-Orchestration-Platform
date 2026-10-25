export interface MatchingInput {
  requiredSkills: string[];
  candidateSkills: string[];
  experienceMin?: number | null;
  candidateExperience?: number | null;
  profileCompletion?: number;
}

export interface MatchingResult {
  status: 'READY' | 'INCOMPLETE';
  score: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  experienceGap: boolean;
  explanation: string;
  missingProfileFields: string[];
  profileCompletion: number;
}

export function calculateJobFit(input: MatchingInput): MatchingResult {
  const candidateSkills = new Set(input.candidateSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean));
  const normalizedRequired = input.requiredSkills.map((skill) => skill.trim()).filter(Boolean);
  const matchedSkills = normalizedRequired.filter((skill) => candidateSkills.has(skill.toLowerCase()));
  const missingSkills = normalizedRequired.filter((skill) => !candidateSkills.has(skill.toLowerCase()));
  const missingProfileFields = [
    ...(candidateSkills.size ? [] : ['technical skills']),
    ...(input.candidateExperience != null ? [] : ['experience history']),
  ];
  const profileCompletion = input.profileCompletion ?? (missingProfileFields.length === 0 ? 100 : Math.round(((2 - missingProfileFields.length) / 2) * 100));
  const experienceGap = input.experienceMin != null && input.candidateExperience != null && input.candidateExperience < input.experienceMin;
  if (missingProfileFields.length > 0) return { status: 'INCOMPLETE', score: null, matchedSkills, missingSkills, experienceGap, explanation: 'Complete your technical skills and experience profile before comparing this role.', missingProfileFields, profileCompletion };
  const skillScore = normalizedRequired.length ? matchedSkills.length / normalizedRequired.length : 1;
  const score = Math.max(0, Math.round((skillScore * 0.8 + (experienceGap ? 0 : 0.2)) * 100));
  return { status: 'READY', score, matchedSkills, missingSkills, experienceGap, explanation: 'Score combines required-skill overlap (80%) and meeting the stated experience threshold (20%).', missingProfileFields, profileCompletion };
}

export function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
