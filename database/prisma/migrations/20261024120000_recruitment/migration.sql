CREATE TYPE "RecruitmentJobStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'SCREENING', 'INTERVIEW', 'REJECTED', 'ACCEPTED');

CREATE TABLE "RecruitmentJob" (
    "id" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiredSkills" JSONB NOT NULL,
    "qualifications" JSONB,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "location" TEXT NOT NULL,
    "workMode" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "joiningInfo" TEXT,
    "experienceMin" INTEGER,
    "deadline" TIMESTAMP(3),
    "status" "RecruitmentJobStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecruitmentJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skills" JSONB NOT NULL,
    "education" TEXT,
    "experienceYears" INTEGER,
    "preferences" JSONB,
    "resumeFileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "recruitmentJobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "coverNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidateProfile_userId_key" ON "CandidateProfile"("userId");
CREATE UNIQUE INDEX "Application_recruitmentJobId_candidateId_key" ON "Application"("recruitmentJobId", "candidateId");
CREATE INDEX "RecruitmentJob_status_createdAt_idx" ON "RecruitmentJob"("status", "createdAt");
CREATE INDEX "RecruitmentJob_recruiterId_createdAt_idx" ON "RecruitmentJob"("recruiterId", "createdAt");
CREATE INDEX "Application_candidateId_createdAt_idx" ON "Application"("candidateId", "createdAt");
CREATE INDEX "Application_recruitmentJobId_status_idx" ON "Application"("recruitmentJobId", "status");

ALTER TABLE "RecruitmentJob" ADD CONSTRAINT "RecruitmentJob_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_recruitmentJobId_fkey" FOREIGN KEY ("recruitmentJobId") REFERENCES "RecruitmentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
