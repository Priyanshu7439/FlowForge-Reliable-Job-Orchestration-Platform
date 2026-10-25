# Demo guide

## Recruitment flow

1. Apply the current Prisma migrations and seed an isolated development database.
2. Sign in with the configured recruiter account and open **Post a Job**.
3. Publish an open role with required skills and experience criteria.
4. Sign in with the configured candidate account and open **Explore Jobs**.
5. Review matched skills, missing skills, profile completeness, and the deterministic fit explanation.
6. Apply once, then verify the duplicate-application response on a second submission.

## Orchestration flow

1. Open **Job Studio** and submit a JSON transformation.
2. Inspect queued, running, and completed states on the job detail page.
3. Review the persisted result and attempt history.
4. Submit the controlled failure simulation and inspect the failed first attempt followed by retry recovery.
5. Open **System Topology** to inspect only backend health signals supported by the API.

Use environment-controlled demo credentials only in local or isolated environments. Never copy development credentials into production.
