import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
async function main() {
  const email = process.env.DEMO_EMAIL ?? 'demo@flowforge.local';
  const password = process.env.DEMO_PASSWORD ?? 'change-me-locally';
  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { name: 'FlowForge Demo', email, passwordHash: await argon2.hash(password) } });
  const count = await prisma.job.count({ where: { ownerId: user.id } });
  if (!count) await prisma.job.create({ data: { ownerId: user.id, type: 'JSON_TRANSFORM', status: 'COMPLETED', payload: { records: [{ name: 'Ada', team: 'Platform' }], select: ['name'] }, completedAt: new Date(), resultSummary: { records: 1 } } });
  const recruiterEmail = process.env.RECRUITER_EMAIL ?? 'recruiter@flowforge.local';
  const recruiterPassword = process.env.RECRUITER_PASSWORD ?? 'recruiter-change-me-locally';
  const recruiter = await prisma.user.upsert({ where: { email: recruiterEmail }, update: { role: 'ADMIN' }, create: { name: 'FlowForge Recruiter', email: recruiterEmail, passwordHash: await argon2.hash(recruiterPassword), role: 'ADMIN' } });
  await prisma.candidateProfile.upsert({ where: { userId: user.id }, update: { skills: ['TypeScript', 'PostgreSQL', 'React'], experienceYears: 2, education: 'Computer Science' }, create: { userId: user.id, skills: ['TypeScript', 'PostgreSQL', 'React'], experienceYears: 2, education: 'Computer Science' } });
  const existingPosting = await prisma.recruitmentJob.findFirst({ where: { recruiterId: recruiter.id, title: 'Platform Engineer' } });
  if (!existingPosting) await prisma.recruitmentJob.create({ data: { recruiterId: recruiter.id, title: 'Platform Engineer', company: 'Northstar Labs', description: 'Build reliable developer infrastructure and product experiences for teams shipping critical workloads.', requiredSkills: ['TypeScript', 'PostgreSQL', 'Redis'], qualifications: ['Experience building production web services', 'Strong debugging and communication skills'], salaryMin: 120000, salaryMax: 155000, currency: 'USD', location: 'Remote - India', workMode: 'REMOTE', employmentType: 'FULL_TIME', experienceMin: 2, status: 'OPEN' } });
  console.log(`Seeded development candidate ${email} and recruiter ${recruiterEmail}`);
}
main().finally(() => prisma.$disconnect());
