'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { AppShell, EmptyState, LoadingState, StatusBadge } from '../../components/shell';
import type { Job, JobListResponse, JobStatus } from '../../lib/types';

const filters = ['ALL', 'QUEUED', 'RUNNING', 'RETRYING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<(typeof filters)[number]>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setLoading(true); setError(''); const query = status === 'ALL' ? '' : `?status=${status}`; api<JobListResponse>(`/jobs${query}`).then((result) => { setJobs(result.jobs); setNextCursor(result.nextCursor); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load jobs')).finally(() => setLoading(false)); }, [status]);
  const loadMore = async () => { if (!nextCursor) return; setLoadingMore(true); try { const query = status === 'ALL' ? '' : `&status=${status}`; const result = await api<JobListResponse>(`/jobs?cursor=${encodeURIComponent(nextCursor)}${query}`); setJobs((current) => [...current, ...result.jobs]); setNextCursor(result.nextCursor); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load more jobs'); } finally { setLoadingMore(false); } };

  return <AppShell active="/jobs"><main className="main"><div className="topline"><div><div className="eyebrow">Operations / history</div><h1>Job explorer</h1><p className="subtle">Filter and inspect jobs from the authoritative store.</p></div><Link className="button primary" href="/jobs/new">+ Create job</Link></div><div className="filter-bar" aria-label="Job status filters">{filters.map((filter) => <button className={`filter ${status === filter ? 'selected' : ''}`} key={filter} onClick={() => setStatus(filter)}>{filter}</button>)}</div>{error && <div className="error" role="alert">{error}</div>}<section className="panel">{loading ? <LoadingState label="Loading jobs…" /> : jobs.length ? <><div className="table-wrap"><table className="table"><thead><tr><th>Job</th><th>Type</th><th>Status</th><th>Attempts</th><th>Created</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td><Link href={`/jobs/${job.id}`}>{job.id.slice(0, 8)}…</Link></td><td>{job.type.replaceAll('_', ' ')}</td><td><StatusBadge status={job.status} /></td><td>{job._count?.attempts ?? job.attempts.length}</td><td className="subtle">{new Date(job.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>{nextCursor && <button className="button load-more" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>}</> : <EmptyState title="No matching jobs" description={status === 'ALL' ? 'Create a job in Job Studio to see it here.' : `No jobs are currently ${status.toLowerCase()}.`} />}</section></main></AppShell>;
}
