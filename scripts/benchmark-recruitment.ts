import { calculateJobFit } from '../services/api/src/recruitment.js';

const iterations = 10_000;
const start = performance.now();
for (let index = 0; index < iterations; index += 1) {
  calculateJobFit({ requiredSkills: ['TypeScript', 'PostgreSQL', 'Redis', 'React'], candidateSkills: ['TypeScript', 'React'], experienceMin: 3, candidateExperience: 2 });
}
const elapsed = performance.now() - start;
console.log(JSON.stringify({ metric: 'matching_compute', iterations, totalMs: Number(elapsed.toFixed(3)), averageMs: Number((elapsed / iterations).toFixed(6)), environment: `${process.version} ${process.platform}` }));
