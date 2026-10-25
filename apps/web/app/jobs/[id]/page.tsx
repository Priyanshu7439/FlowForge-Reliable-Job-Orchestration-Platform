'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, apiBase } from '../../../lib/api';
import { AppShell, LoadingState, StatusBadge } from '../../../components/shell';
import type { Job } from '../../../lib/types';

function formatDate(value: string | null) { return value ? new Date(value).toLocaleString() : '—'; }

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api<{ job: Job }>(`/jobs/${id}`).then((result) => { setJob(result.job); return result.job; }).catch((cause: unknown) => { setError(cause instanceof Error ? cause.message : 'Unable to load job'); return undefined; });
  useEffect(() => { let timer: ReturnType<typeof setInterval> | undefined; const refresh = async () => { const current = await load(); if (current && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(current.status) && timer) clearInterval(timer); }; void refresh(); timer = setInterval(() => { void refresh(); }, 5000); const events = new EventSource(`${apiBase}/events`, { withCredentials: true }); const onJob = (event: MessageEvent<string>) => { try { const update = JSON.parse(event.data) as { jobId?: string }; if (update.jobId === id) void refresh(); } catch { setError('Live event payload was invalid; continuing with refresh fallback'); } }; events.addEventListener('job', onJob); events.onerror = () => events.close(); return () => { if (timer) clearInterval(timer); events.removeEventListener('job', onJob); events.close(); }; }, [id]);
  const action = async (path: 'retry' | 'cancel') => { setBusy(true); setError(''); try { await api(`/jobs/${id}/${path}`, { method: 'POST' }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Action failed'); } finally { setBusy(false); } };

  if (!job) return <AppShell active="/jobs"><main className="main">{error ? <div className="error" role="alert">{error}</div> : <LoadingState label="Loading job…" />}<Link className="button" href="/jobs">Back to jobs</Link></main></AppShell>;
  return <AppShell active="/jobs"><main className="main"><div className="topline"><div><div className="eyebrow">Execution inspector</div><h1>{job.type.replaceAll('_', ' ')}</h1><p className="subtle mono">{job.id}</p></div><StatusBadge status={job.status} /></div>{error && <div className="error" role="alert">{error}</div>}<div className="grid content-grid"><section className="panel"><h2 className="panel-title">Lifecycle</h2><dl className="details"><div><dt>Created</dt><dd>{formatDate(job.createdAt)}</dd></div><div><dt>Started</dt><dd>{formatDate(job.startedAt)}</dd></div><div><dt>Completed</dt><dd>{formatDate(job.completedAt)}</dd></div><div><dt>Duration</dt><dd>{job.startedAt && job.completedAt ? `${new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()} ms` : '—'}</dd></div></dl><div className="actions">{job.status === 'FAILED' && <button className="button primary" disabled={busy} onClick={() => action('retry')}>{busy ? 'Retrying…' : 'Retry eligible job'}</button>}{['QUEUED', 'RETRYING'].includes(job.status) && <button className="button" disabled={busy} onClick={() => action('cancel')}>Cancel</button>}</div></section><section className="panel"><h2 className="panel-title">Attempts <span className="subtle">({job.attempts.length})</span></h2>{job.attempts.length ? <div className="attempt-list">{job.attempts.map((attempt) => <div className="attempt" key={attempt.id}><div className="attempt-heading"><strong>Attempt {attempt.attemptNumber}</strong><StatusBadge status={attempt.status} /></div><div className="subtle">Started {formatDate(attempt.startedAt)}{attempt.durationMs !== null ? ` · ${attempt.durationMs} ms` : ''}</div>{attempt.errorMessage && <div className="error">{attempt.errorCode ? `${attempt.errorCode}: ` : ''}{attempt.errorMessage}</div>}</div>)}</div> : <div className="subtle">No execution attempts yet.</div>}</section></div><section className="panel result-panel"><h2 className="panel-title">Result</h2>{job.result ? <pre className="result">{JSON.stringify(job.result.resultJson, null, 2)}</pre> : <div className="subtle">The result will appear after a successful execution.</div>}</section><button className="button" onClick={() => router.push('/jobs')}>Back to jobs</button></main></AppShell>;
}
