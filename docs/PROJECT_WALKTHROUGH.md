# Project Walkthrough

## Product

FlowForge is evolving from reliable background-job orchestration into a two-sided recruitment demo. Recruiters publish structured roles; candidates explore open roles, receive an explainable deterministic fit assessment, and apply without duplicate submissions.

## Architecture

- Next.js App Router provides authenticated candidate and recruiter workspaces.
- Express owns authentication, role checks, validation, recruitment APIs, and ownership rules.
- Prisma/PostgreSQL stores users, profiles, postings, and applications. Existing orchestration tables remain separate.
- Redis/BullMQ and the Python executor remain available for the original job-orchestration workflows.

## Demo scenario

1. Apply the recruitment migration and seed in an isolated development environment.
2. Sign in as the seeded recruiter and publish an open role from **Post a job**.
3. Sign in as the seeded candidate and open **Explore jobs**.
4. Review matched skills, missing skills, and experience gaps.
5. Apply once and verify the duplicate-application conflict on a second attempt.
6. Review the persisted application from the recruiter workflow/API.

## Design decisions

- Existing `ADMIN` users act as recruiters and `USER` users act as candidates to avoid breaking the current authentication enum.
- Matching is deterministic and explainable; no paid LLM or external key is required.
- Resume upload is not advertised because secure object storage is not currently implemented.
- Recruitment tables do not reuse orchestration `Job` records, preventing the worker from executing job postings.

## Limitations

- Recruiter application review has API support; a dedicated recruiter applicant-management screen remains follow-up work.
- Secure resume object storage, external market data, and password recovery are not implemented.

## Interview explanation

The hardest verified engineering challenge was separating runtime infrastructure failures from application bugs: liveness and container status were insufficient, so the investigation used bounded protocol checks, dependency-specific health evidence, authorization tests, and source/runtime comparison. The same discipline is applied to recruitment matching and role-scoped ownership instead of faking success in the UI.
