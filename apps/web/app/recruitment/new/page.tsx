'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import { AppShell } from '../../../components/shell';

const initial = { title: '', company: '', description: '', requiredSkills: '', qualifications: '', salaryMin: '', salaryMax: '', currency: 'USD', location: '', workMode: 'HYBRID', employmentType: 'FULL_TIME', joiningInfo: '', experienceMin: '', deadline: '' };

export default function NewRecruitmentJob() {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');
  const update = (key: keyof typeof initial, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    const requiredSkills = form.requiredSkills.split(',').map((skill) => skill.trim()).filter(Boolean);
    const qualifications = form.qualifications.split('\n').map((item) => item.trim()).filter(Boolean);
    if (requiredSkills.length === 0 || form.description.trim().length < 40) { setError('Add at least one required skill and a description of 40 characters or more.'); setBusy(false); return; }
    try { const result = await api<{ job: { id: string } }>('/recruitment/jobs', { method: 'POST', body: JSON.stringify({ ...form, requiredSkills, qualifications, salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined, salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined, experienceMin: form.experienceMin ? Number(form.experienceMin) : undefined, deadline: form.deadline || undefined, status: 'OPEN' }) }); setCreatedId(result.job.id); }
    catch (cause) { setError(cause instanceof ApiError && cause.status === 403 ? 'Only recruiter accounts can publish job postings.' : cause instanceof Error ? cause.message : 'Unable to publish job'); }
    finally { setBusy(false); }
  };

  return <AppShell active="/recruitment/new"><main className="main"><div className="topline"><div><div className="eyebrow">Recruiter workspace</div><h1>Post a role</h1><p className="subtle">Publish a structured posting candidates can understand and match against.</p></div><Link className="button" href="/recruitment">Explore jobs</Link></div>{createdId ? <section className="panel state"><strong>Job published</strong><span className="subtle">The posting was persisted and is now available to candidates.</span><div className="actions"><Link className="button primary" href="/recruitment">View open roles</Link></div></section> : <form className="panel form-grid" onSubmit={submit}><label>Job title<input required value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Senior Platform Engineer" /></label><label>Company<input required value={form.company} onChange={(event) => update('company', event.target.value)} placeholder="Northstar Labs" /></label><label className="wide">Description<textarea required minLength={40} rows={8} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe the mission, responsibilities, and impact..." /></label><label>Required skills<input required value={form.requiredSkills} onChange={(event) => update('requiredSkills', event.target.value)} placeholder="TypeScript, PostgreSQL, Redis" /><span className="subtle">Separate skills with commas.</span></label><label>Qualifications<textarea rows={4} value={form.qualifications} onChange={(event) => update('qualifications', event.target.value)} placeholder="One qualification per line" /></label><label>Location<input required value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Bengaluru, India" /></label><label>Work mode<select value={form.workMode} onChange={(event) => update('workMode', event.target.value)}><option>REMOTE</option><option>HYBRID</option><option>ONSITE</option></select></label><label>Employment type<select value={form.employmentType} onChange={(event) => update('employmentType', event.target.value)}><option>FULL_TIME</option><option>PART_TIME</option><option>CONTRACT</option><option>INTERNSHIP</option></select></label><label>Minimum experience<input type="number" min="0" value={form.experienceMin} onChange={(event) => update('experienceMin', event.target.value)} placeholder="3" /></label><label>Salary minimum<input type="number" min="0" value={form.salaryMin} onChange={(event) => update('salaryMin', event.target.value)} /></label><label>Salary maximum<input type="number" min="0" value={form.salaryMax} onChange={(event) => update('salaryMax', event.target.value)} /></label><label>Currency<input maxLength={3} value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></label><label>Application deadline<input type="date" value={form.deadline} onChange={(event) => update('deadline', event.target.value)} /></label><label className="wide">Joining information<input value={form.joiningInfo} onChange={(event) => update('joiningInfo', event.target.value)} placeholder="Expected joining window or notice period" /></label>{error && <div className="error wide" role="alert">{error}</div>}<button className="button primary wide" disabled={busy} type="submit">{busy ? 'Publishing...' : 'Publish job'}</button></form>}</main></AppShell>;
}
