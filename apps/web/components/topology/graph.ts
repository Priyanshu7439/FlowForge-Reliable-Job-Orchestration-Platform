import type { SystemHealth } from '../../lib/types';

export type TopologyNodeKey = 'api' | 'postgres' | 'redis' | 'worker' | 'executor' | 'sse';
export type TopologyStatus = 'ok' | 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface TopologyNode {
  key: TopologyNodeKey;
  label: string;
  description: string;
  status: TopologyStatus;
  source: 'health-api' | 'not-exposed';
}

export interface TopologyConnection {
  from: TopologyNodeKey;
  to: TopologyNodeKey;
  label: string;
}

export const topologyConnections: TopologyConnection[] = [
  { from: 'api', to: 'postgres', label: 'persist job + outbox' },
  { from: 'api', to: 'sse', label: 'stream updates' },
  { from: 'postgres', to: 'redis', label: 'outbox publication' },
  { from: 'redis', to: 'worker', label: 'BullMQ delivery' },
  { from: 'worker', to: 'executor', label: 'internal execution' },
  { from: 'executor', to: 'worker', label: 'structured result' },
  { from: 'worker', to: 'postgres', label: 'persist outcome' },
];

const definitions: Array<Pick<TopologyNode, 'key' | 'label' | 'description'>> = [
  { key: 'api', label: 'API Gateway', description: 'Express public API' },
  { key: 'postgres', label: 'PostgreSQL', description: 'authoritative state' },
  { key: 'redis', label: 'Redis / BullMQ', description: 'queue and ephemeral events' },
  { key: 'worker', label: 'Node Worker', description: 'job execution coordinator' },
  { key: 'executor', label: 'FastAPI Executor', description: 'supported task handlers' },
  { key: 'sse', label: 'SSE Event Stream', description: 'best-effort live updates' },
];

const statusFor = (value: string | undefined): TopologyStatus => {
  if (value === 'ok' || value === 'healthy' || value === 'degraded') return value;
  if (value === 'unhealthy') return 'unhealthy';
  return 'unknown';
};

export function mapTopologyNodes(health?: SystemHealth): TopologyNode[] {
  return definitions.map((definition) => {
    const reported = health?.services[definition.key];
    const status = statusFor(reported);
    return { ...definition, status, source: reported !== undefined ? 'health-api' : 'not-exposed' };
  });
}

export function statusLabel(status: TopologyStatus): string {
  return status === 'unknown' ? 'Unknown' : status[0].toUpperCase() + status.slice(1);
}
