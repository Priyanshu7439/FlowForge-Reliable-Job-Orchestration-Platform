'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

type AccountType = 'candidate' | 'recruiter';
const accountOptions: Record<AccountType, { label: string; description: string; email: string; role: string }> = {
  candidate: { label: 'Candidate', description: 'Explore roles, see your fit, and track applications.', email: 'demo@flowforge.local', role: 'USER' },
  recruiter: { label: 'Recruiter', description: 'Publish roles and review candidate applications.', email: 'recruiter@flowforge.local', role: 'ADMIN' },
};

export default function Login() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>('candidate');
  const [email, setEmail] = useState(accountOptions.candidate.email);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selectAccountType = (type: AccountType) => { setAccountType(type); setEmail(accountOptions[type].email); setPassword(''); setError(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api<{ user: { role: string } }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (result.user.role !== accountOptions[accountType].role) {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setError(`This account is not a ${accountOptions[accountType].label.toLowerCase()} account. Choose the matching account type.`);
        return;
      }
      router.push('/dashboard');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to log in'); }
    finally { setBusy(false); }
  };
  return <main className="login"><form className="panel login-card" onSubmit={submit}>
    <div className="brand"><span className="brand-mark">F</span> FlowForge</div><div className="eyebrow">Recruitment workspace</div><h1>Sign in</h1><p className="subtle login-subtitle">Choose the workspace that matches your account.</p>
    <div className="login-selector" aria-label="Account type">{(Object.keys(accountOptions) as AccountType[]).map((type) => <button aria-pressed={accountType === type} className={`login-option ${accountType === type ? 'selected' : ''}`} key={type} type="button" onClick={() => selectAccountType(type)}><strong>{accountOptions[type].label}</strong><span>{type === 'candidate' ? 'Find your next role' : 'Build your hiring team'}</span></button>)}</div>
    <p className="subtle login-description">{accountOptions[accountType].description}</p>{error && <div className="error" role="alert">{error}</div>}
    <div className="field"><label htmlFor="email">Email</label><input id="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required autoComplete="current-password" /></div>
    <button className="button primary" disabled={busy} type="submit">{busy ? 'Signing in...' : 'Continue to FlowForge'}</button>
    <p className="subtle login-help">Need a candidate account? <Link href="/register">Create one</Link>. Recruiter access is provisioned through the development seed.</p>
  </form></main>;
}
