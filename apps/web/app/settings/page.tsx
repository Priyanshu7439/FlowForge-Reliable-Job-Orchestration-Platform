'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../lib/api';
import { AppShell, LoadingState } from '../../components/shell';
import type { AuthUser } from '../../lib/types';
import { accountFields } from '../../lib/settings';

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    setUnauthenticated(false);
    return api<{ user: AuthUser }>('/auth/me')
      .then((result) => setUser(result.user))
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) {
          setUnauthenticated(true);
          setError('Your session has expired. Sign in again to view account details.');
          return;
        }
        setError(cause instanceof Error ? cause.message : 'Unable to load account');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { void load(); }, []);

  const logout = async () => {
    setBusy(true);
    try { await api('/auth/logout', { method: 'POST' }); router.push('/login'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to log out'); }
    finally { setBusy(false); }
  };

  const fields = user ? accountFields(user) : [];
  return <AppShell active="/settings"><main className="main"><div className="topline"><div><div className="eyebrow">Account / security</div><h1>Settings</h1><p className="subtle">Authenticated account details and session controls.</p></div></div>{loading ? <LoadingState label="Loading account..." /> : error ? <section className="panel state"><strong>Account unavailable</strong><span className="subtle" role="alert">{error}</span><div className="actions">{unauthenticated ? <Link className="button primary" href="/login">Sign in</Link> : <button className="button primary" onClick={() => void load()}>Retry</button>}</div></section> : <div className="grid content-grid"><section className="panel"><h2 className="panel-title">Profile</h2><dl className="details">{fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd className={field.label === 'User ID' ? 'mono' : undefined}>{field.value}</dd></div>)}</dl></section><section className="panel"><h2 className="panel-title">Session</h2><p className="subtle">FlowForge uses an HTTP-only session cookie. Tokens are not stored in the browser.</p><button className="button" disabled={busy} onClick={logout}>{busy ? 'Signing out...' : 'Sign out'}</button></section></div>}</main></AppShell>;
}
