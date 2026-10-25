ALTER TABLE "CandidateProfile"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "hometown" TEXT,
  ADD COLUMN "currentLocation" TEXT,
  ADD COLUMN "expectedSalary" INTEGER,
  ADD COLUMN "expectedSalaryCurrency" TEXT,
  ADD COLUMN "currentSalary" INTEGER,
  ADD COLUMN "currentSalaryCurrency" TEXT,
  ADD COLUMN "targetRoles" JSONB,
  ADD COLUMN "preferredLocations" JSONB,
  ADD COLUMN "preferredWorkModes" JSONB,
  ADD COLUMN "noticePeriod" TEXT;

CREATE TABLE "CandidateEducation" (
  "id" TEXT NOT NULL,
  "candidateProfileId" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "degree" TEXT NOT NULL,
  "specialization" TEXT,
  "graduationYear" INTEGER,
  "grade" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateEducation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CandidateExperience" (
  "id" TEXT NOT NULL,
  "candidateProfileId" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "responsibilities" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateExperience_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CandidateCertification" (
  "id" TEXT NOT NULL,
  "candidateProfileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3),
  "credentialUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateCertification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CandidateLanguage" (
  "id" TEXT NOT NULL,
  "candidateProfileId" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "proficiency" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateLanguage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RecruiterProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "designation" TEXT,
  "workEmail" TEXT,
  "contactPreferences" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruiterProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CompanyProfile" (
  "id" TEXT NOT NULL,
  "recruiterProfileId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "website" TEXT,
  "logoUrl" TEXT,
  "industry" TEXT,
  "description" TEXT,
  "size" TEXT,
  "type" TEXT,
  "headquarters" TEXT,
  "officeLocations" JSONB,
  "foundedYear" INTEGER,
  "registrationDate" TIMESTAMP(3),
  "linkedInUrl" TEXT,
  "culture" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecruiterProfile_userId_key" ON "RecruiterProfile"("userId");
CREATE UNIQUE INDEX "CompanyProfile_recruiterProfileId_key" ON "CompanyProfile"("recruiterProfileId");
CREATE INDEX "CandidateEducation_candidateProfileId_idx" ON "CandidateEducation"("candidateProfileId");
CREATE INDEX "CandidateExperience_candidateProfileId_startDate_idx" ON "CandidateExperience"("candidateProfileId", "startDate");
CREATE INDEX "CandidateCertification_candidateProfileId_idx" ON "CandidateCertification"("candidateProfileId");
CREATE INDEX "CandidateLanguage_candidateProfileId_idx" ON "CandidateLanguage"("candidateProfileId");

ALTER TABLE "CandidateEducation" ADD CONSTRAINT "CandidateEducation_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateExperience" ADD CONSTRAINT "CandidateExperience_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateCertification" ADD CONSTRAINT "CandidateCertification_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateLanguage" ADD CONSTRAINT "CandidateLanguage_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruiterProfile" ADD CONSTRAINT "RecruiterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_recruiterProfileId_fkey" FOREIGN KEY ("recruiterProfileId") REFERENCES "RecruiterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
