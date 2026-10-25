'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { AppShell, EmptyState, LoadingState, StatusBadge } from '../../components/shell';
import { mapTopologyNodes, statusLabel, topologyConnections, type TopologyNodeKey } from '../../components/topology/graph';
import type { SystemHealth } from '../../lib/types';

const TopologyScene = dynamic(() => import('../../components/topology/scene').then((module) => module.TopologyScene), { ssr: false, loading: () => <LoadingState label="Loading 3D topology…" /> });

function supportsWebgl(): boolean {
  if (typeof window === 'undefined') return false;
  try { const canvas = document.createElement('canvas'); return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl')); } catch { return false; }
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(query.matches); update(); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  return reduced;
}

function TopologyFallback({ selectedKey, onSelect, nodes }: { selectedKey: TopologyNodeKey; onSelect: (key: TopologyNodeKey) => void; nodes: ReturnType<typeof mapTopologyNodes> }) {
  return <div className="topology-fallback" role="region" aria-label="FlowForge service topology diagram"><div className="fallback-flow">{topologyConnections.slice(0, 5).map((connection) => <span key={`${connection.from}-${connection.to}`} aria-hidden="true">→</span>)}</div><div className="fallback-nodes">{nodes.map((node) => <button type="button" className={`fallback-node ${node.key === selectedKey ? 'selected' : ''}`} key={node.key} onClick={() => onSelect(node.key)}><strong>{node.label}</strong><StatusBadge status={node.status} /><span>{node.description}</span></button>)}</div><p className="subtle">WebGL is unavailable, so the accessible topology map is shown instead.</p></div>;
}

export default function Topology() {
  const [health, setHealth] = useState<SystemHealth>();
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<TopologyNodeKey>('api');
  const [webgl, setWebgl] = useState(false);
  const reducedMotion = useReducedMotion();
  const nodes = useMemo(() => mapTopologyNodes(health), [health]);
  const selected = nodes.find((node) => node.key === selectedKey) ?? nodes[0];

  useEffect(() => { setWebgl(supportsWebgl()); api<SystemHealth>('/system/health').then(setHealth).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Health data unavailable')); }, []);

  return <AppShell active="/topology"><main className="main"><div className="topline"><div><div className="eyebrow">Infrastructure / live view</div><h1>System topology</h1><p className="subtle">Directional links show the designed execution path. Node status is limited to backend-reported health.</p></div>{health && <StatusBadge status={health.status} />}</div>{error && <div className="error" role="alert">{error}</div>}{!health && !error ? <LoadingState label="Checking service health…" /> : <div className="topology-layout"><section className="panel topology-panel"><div className="topology-legend"><span><i className="legend-dot verified" />Verified health</span><span><i className="legend-dot unavailable" />Unknown / unverified</span></div>{webgl ? <div className="topology-canvas"><TopologyScene nodes={nodes} connections={topologyConnections} selectedKey={selectedKey} onSelect={setSelectedKey} reducedMotion={reducedMotion} /></div> : <TopologyFallback nodes={nodes} selectedKey={selectedKey} onSelect={setSelectedKey} />}</section><aside className="panel topology-detail" aria-live="polite"><div className="eyebrow">Selected service</div><h2>{selected.label}</h2><p className="subtle">{selected.description}</p><div className="topology-status"><StatusBadge status={selected.status} /><span>{statusLabel(selected.status)}</span></div><dl className="details"><div><dt>Evidence</dt><dd>{selected.source === 'health-api' ? 'System health API' : 'Not exposed by API'}</dd></div><div><dt>Role</dt><dd>{selected.description}</dd></div></dl>{selected.status === 'unknown' && <EmptyState title="No verified signal" description="FlowForge does not expose a current authoritative health signal for this service." />}</aside></div>}</main></AppShell>;
}
