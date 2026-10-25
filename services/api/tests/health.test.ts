import { describe, expect, it, vi } from 'vitest';
import { readRedisHealth, type RedisHealthClient } from '../src/health.js';

function createClient(overrides: Partial<RedisHealthClient> = {}): RedisHealthClient {
  return {
    status: 'wait',
    connect: vi.fn(async () => undefined),
    ping: vi.fn(async () => 'PONG'),
    get: vi.fn(async () => null),
    disconnect: vi.fn(),
    ...overrides,
  };
}

describe('Redis health checks', () => {
  it('connects a waiting client and verifies Redis with PING', async () => {
    const client = createClient({ get: vi.fn(async () => 'heartbeat') });
    await expect(readRedisHealth(client)).resolves.toEqual({ redis: 'ok', worker: 'ok' });
    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.ping).toHaveBeenCalledOnce();
  });

  it('reuses a ready client without reconnecting', async () => {
    const client = createClient({ status: 'ready' });
    await expect(readRedisHealth(client)).resolves.toEqual({ redis: 'ok', worker: 'unknown' });
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('surfaces failed PING so the caller can replace the client', async () => {
    const client = createClient({ ping: vi.fn(async () => { throw new Error('connection failed'); }) });
    await expect(readRedisHealth(client)).rejects.toThrow('connection failed');
  });
});
