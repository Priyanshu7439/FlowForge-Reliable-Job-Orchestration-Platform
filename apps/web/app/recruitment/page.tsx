'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { AppShell, EmptyState, LoadingState } from '../../components/shell';
import type { RecruitmentApplication, RecruitmentJob } from '../../lib/types';
import { isCandidateRole } from '../../lib/recruitment';

function salary(job: RecruitmentJob): string {
  if (job.salaryMin == null && job.salaryMax == null) return 'Salary not disclosed';
  return `${job.currency} ${job.salaryMin?.toLocaleString() ?? '—'} – ${job.salaryMax?.toLocaleString() ?? '—'}`;
}

export default function RecruitmentJobs() {
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [applications, setApplications] = useState<RecruitmentApplication[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState<string>();
  const [notice, setNotice] = useState('');
  const [role, setRole] = useState<string>();

  const load = async (query = search) => {
    setLoading(true); setError('');
    try {
      const [session, result] = await Promise.all([
        api<{ user: { role: string } }>('/auth/me'),
        api<{ jobs: RecruitmentJob[] }>(`/recruitment/jobs${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`),
      ]);
      setRole(session.user.role); setJobs(result.jobs);
      if (isCandidateRole(session.user.role)) {
        const applicationResult = await api<{ applications: RecruitmentApplication[] }>('/recruitment/applications');
        setApplications(applicationResult.applications);
      } else setApplications([]);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401 ? 'Sign in to explore roles and applications.' : cause instanceof Error ? cause.message : 'Unable to load jobs');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(''); }, []);

  const apply = async (jobId: string) => {
    setApplying(jobId); setNotice(''); setError('');
    try { await api(`/recruitment/jobs/${jobId}/applications`, { method: 'POST', body: JSON.stringify({}) }); setNotice('Application submitted.'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to submit application'); }
    finally { setApplying(undefined); }
  };

  return <AppShell active="/recruitment"><main className="main">
    <div className="topline"><div><div className="eyebrow">Talent / opportunities</div><h1>Explore roles</h1><p className="subtle">Discover open roles and understand your fit before applying.</p></div><Link className="button" href="/profile">{isCandidateRole(role) ? 'Complete profile' : 'View profile'}</Link></div>
    <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); void load(); }}><label className="sr-only" htmlFor="job-search">Search roles</label><input id="job-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, company, or location" /><button className="button primary" type="submit">Search</button></form>
    {notice && <div className="success" role="status">{notice}</div>}{error && <div className="error" role="alert">{error}</div>}
    {!loading && applications.length > 0 && <section className="panel application-summary"><h2 className="panel-title">Your applications</h2><div className="application-list">{applications.map((application) => <div className="application-row" key={application.id}><span>{application.recruitmentJob?.title ?? application.recruitmentJobId}</span><span className="pill pill-queued">{application.status}</span></div>)}</div></section>}
    {loading ? <LoadingState label="Loading open roles..." /> : jobs.length ? <div className="grid content-grid">{jobs.map((job) => <article className="panel" key={job.id}>
      <div className="eyebrow">{job.company} · {job.workMode}</div><h2 className="panel-title">{job.title}</h2><p className="subtle">{job.location} · {job.employmentType} · {salary(job)}</p><p>{job.description}</p>
      <div className="tag-list">{job.requiredSkills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div>
      {job.fit?.status === 'READY' ? <div className="panel state"><strong>{job.fit.score}% skill and experience fit</strong><span className="subtle">Matched: {job.fit.matchedSkills.join(', ') || 'No matching skills yet'}</span>{job.fit.missingSkills.length > 0 && <span className="subtle">Missing skills: {job.fit.missingSkills.join(', ')}</span>}{job.fit.experienceGap && <span className="subtle">Experience requirement is above your current profile.</span>}<span className="subtle">{job.fit.explanation}</span></div> : job.fit?.status === 'INCOMPLETE' ? <div className="panel state"><strong>Complete your profile to see a fit score</strong><span className="subtle">Profile completion: {job.fit.profileCompletion}%</span><span className="subtle">Still needed: {job.fit.missingProfileFields.join(', ')}</span><Link className="button" href="/profile">Complete candidate profile</Link></div> : !isCandidateRole(role) ? <div className="state"><strong>Recruiter view</strong><span className="subtle">Review your published role and applicants from the recruiter workspace.</span></div> : null}
      {isCandidateRole(role) && <button className="button primary" disabled={applying === job.id} onClick={() => void apply(job.id)}>{applying === job.id ? 'Applying...' : 'Apply now'}</button>}
    </article>)}</div> : <EmptyState title="No open roles found" description="Try a broader search or check back when new roles are published." />}
  </main></AppShell>;
}
