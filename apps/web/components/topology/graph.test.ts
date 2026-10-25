import { describe, expect, it } from 'vitest';
import { mapTopologyNodes, topologyConnections } from './graph';

describe('topology health mapping', () => {
  it('marks only API-reported services as verified', () => {
    const nodes = mapTopologyNodes({ status: 'ok', services: { api: 'ok', postgres: 'ok', redis: 'unavailable' } });
    expect(nodes.find((node) => node.key === 'api')).toMatchObject({ status: 'ok', source: 'health-api' });
    expect(nodes.find((node) => node.key === 'worker')).toMatchObject({ status: 'unknown', source: 'not-exposed' });
    expect(nodes.find((node) => node.key === 'redis')).toMatchObject({ status: 'unknown', source: 'health-api' });
  });

  it('preserves verified unhealthy and unknown states', () => {
    const nodes = mapTopologyNodes({ status: 'degraded', services: { executor: 'unhealthy', sse: 'unknown' } });
    expect(nodes.find((node) => node.key === 'executor')).toMatchObject({ status: 'unhealthy', source: 'health-api' });
    expect(nodes.find((node) => node.key === 'sse')).toMatchObject({ status: 'unknown', source: 'health-api' });
  });

  it('keeps the directional execution path explicit', () => {
    expect(topologyConnections).toEqual(expect.arrayContaining([
      { from: 'api', to: 'postgres', label: 'persist job + outbox' },
      { from: 'redis', to: 'worker', label: 'BullMQ delivery' },
      { from: 'worker', to: 'executor', label: 'internal execution' },
    ]));
  });
});
