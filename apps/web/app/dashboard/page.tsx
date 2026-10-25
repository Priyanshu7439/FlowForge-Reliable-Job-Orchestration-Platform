'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../lib/api';
import { AppShell, EmptyState, LoadingState, StatusBadge } from '../../components/shell';
import { hiringPipelineCounts, type HiringPipelineCounts } from '../../lib/hiring-dashboard';
import type { AuthUser, DashboardSummary, RecruitmentApplication, RecruitmentJob, RecruiterJobSummary } from '../../lib/types';

export default function Dashboard() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary>();
  const [postings, setPostings] = useState<Array<RecruitmentJob | RecruiterJobSummary>>([]);
  const [pipeline, setPipeline] = useState<HiringPipelineCounts>({ applied: 0, shortlisted: 0, interview: 0, selected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [session, nextSummary] = await Promise.all([
        api<{ user: AuthUser }>('/auth/me'),
        api<DashboardSummary>('/dashboard/summary'),
      ]);
      let nextPostings: Array<RecruitmentJob | RecruiterJobSummary> = [];
      let applications: RecruitmentApplication[] = [];
      if (session.user.role === 'ADMIN') {
        const profile = await api<{ jobs?: RecruiterJobSummary[] }>('/profile');
        nextPostings = profile.jobs ?? [];
        const applicationGroups = await Promise.all(nextPostings.map((job) => api<{ applications: RecruitmentApplication[] }>(`/recruitment/jobs/${job.id}/applications`)));
        applications = applicationGroups.flatMap((group) => group.applications);
      } else {
        const [jobs, applicationResult] = await Promise.all([
          api<{ jobs: RecruitmentJob[] }>('/recruitment/jobs'),
          api<{ applications: RecruitmentApplication[] }>('/recruitment/applications'),
        ]);
        nextPostings = jobs.jobs;
        applications = applicationResult.applications;
      }
      setSummary(nextSummary); setPostings(nextPostings); setPipeline(hiringPipelineCounts(applications));
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { router.replace('/login'); return; }
      setError(cause instanceof Error ? cause.message : 'Unable to load dashboard');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [router]);

  return <AppShell active="/dashboard"><main className="main"><div className="topline"><div><div className="eyebrow">Overview / hiring workspace</div><h1>Hiring command center</h1><p className="subtle">Move from open roles to stronger candidate matches.</p></div><Link className="button primary" href="/recruitment/new">+ Post a Job</Link></div>{loading ? <LoadingState label="Loading operational data..." /> : error ? <section className="panel state"><strong>Operational data unavailable</strong><span className="subtle" role="alert">{error}</span><div className="actions">{error.includes('session') ? <Link className="button primary" href="/login">Sign in</Link> : <button className="button primary" onClick={() => void load()}>Retry</button>}</div></section> : <><div className="grid stats">{[['Total jobs', summary?.total ?? 0], ['Completed', summary?.completed ?? 0], ['Failed', summary?.failed ?? 0], ['In flight', (summary?.running ?? 0) + (summary?.queued ?? 0)], ['Success rate', `${Math.round((summary?.successRate ?? 0) * 100)}%`]].map(([label, value]) => <div className="panel" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>)}</div><div className="grid content-grid"><section className="panel"><h2 className="panel-title">Recent Job Postings</h2>{postings.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Role</th><th>Status</th><th>Posted</th></tr></thead><tbody>{postings.map((job) => <tr key={job.id}><td><Link href="/recruitment">{job.title}</Link></td><td><StatusBadge status={job.status} /></td><td className="subtle">{new Date(job.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <EmptyState title="No job postings yet" description="Published recruitment roles will appear here." />}</section><section className="panel"><h2 className="panel-title">Recruitment workspace</h2><p className="subtle">Explore open roles, review explainable fit, or publish a new posting.</p><div className="actions"><Link className="button" href="/recruitment">Explore Jobs</Link><Link className="button primary" href="/recruitment/new">Post a Job</Link></div><h2 className="panel-title" style={{ marginTop: '28px' }}>Hiring Pipeline</h2><div className="health-list"><div className="health-row"><span>Applied</span><strong>{pipeline.applied}</strong></div><div className="health-row"><span>Shortlisted</span><strong>{pipeline.shortlisted}</strong></div><div className="health-row"><span>Interview</span><strong>{pipeline.interview}</strong></div><div className="health-row"><span>Selected</span><strong>{pipeline.selected}</strong></div></div></section></div></>}</main></AppShell>;
}
