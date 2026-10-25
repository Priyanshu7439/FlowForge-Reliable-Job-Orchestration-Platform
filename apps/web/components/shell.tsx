'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { AuthUser } from '../lib/types';

const navigation = [
  ['Overview', '/dashboard'],
  ['Explore Jobs', '/recruitment'],
  ['Post a Job', '/recruitment/new'],
  ['Profile', '/profile'],
  ['Settings', '/settings'],
] as const;

export function AppShell({ active, children }: { active: string; children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    let activeRequest = true;
    void api<{ user: AuthUser }>('/auth/me').then((result) => { if (activeRequest) setUser(result.user); }).catch(() => undefined);
    return () => { activeRequest = false; };
  }, []);
  const visibleNavigation = navigation.filter(([, href]) => href !== '/recruitment/new' || user?.role === 'ADMIN');
  return <div className="shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">F</span> FlowForge</div><nav className="nav" aria-label="Primary navigation">{visibleNavigation.map(([label, href]) => <Link className={active === href ? 'active' : ''} href={href} key={href}>{label}</Link>)}</nav></aside>{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`pill pill-${status.toLowerCase()}`}>{status}</span>;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="state state-loading" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="state"><strong>{title}</strong><span className="subtle">{description}</span></div>;
}
