export interface RedisHealthClient {
  status: string;
  connect(): Promise<unknown>;
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  disconnect(): void;
}

export interface RedisHealthResult {
  redis: 'ok';
  worker: 'ok' | 'unknown';
}

export async function readRedisHealth(client: RedisHealthClient): Promise<RedisHealthResult> {
  if (client.status !== 'ready') await client.connect();
  await client.ping();
  return { redis: 'ok', worker: (await client.get('flowforge:health:worker')) ? 'ok' : 'unknown' };
}
