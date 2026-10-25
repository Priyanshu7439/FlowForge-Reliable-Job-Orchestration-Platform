'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmation: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (form.password !== form.confirmation) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try { await api('/auth/register', { method: 'POST', body: JSON.stringify({ name: form.name, email: form.email, password: form.password }) }); router.push('/dashboard'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create account'); }
    finally { setBusy(false); }
  };
  return <main className="login"><form className="panel login-card" onSubmit={submit}>
    <div className="brand"><span className="brand-mark">F</span> FlowForge</div><div className="eyebrow">Candidate account</div><h1>Create your account</h1><p className="subtle">Create a candidate account to explore roles, review fit, and apply.</p>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="field"><label htmlFor="name">Name</label><input id="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required minLength={2} autoComplete="name" /></div>
    <div className="field"><label htmlFor="email">Email</label><input id="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" required autoComplete="email" /></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} type="password" required minLength={10} autoComplete="new-password" /></div>
    <div className="field"><label htmlFor="confirmation">Confirm password</label><input id="confirmation" value={form.confirmation} onChange={(event) => setForm((current) => ({ ...current, confirmation: event.target.value }))} type="password" required minLength={10} autoComplete="new-password" /></div>
    <button className="button primary" disabled={busy} type="submit">{busy ? 'Creating account...' : 'Create candidate account'}</button>
    <p className="subtle">Recruiter accounts are provisioned by the development seed. <Link href="/login">Back to sign in</Link>.</p>
  </form></main>;
}
