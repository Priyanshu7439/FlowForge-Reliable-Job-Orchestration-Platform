import IORedis from 'ioredis';
import { config } from './config.js';

export interface JobEvent {
  jobId: string;
  ownerId: string;
  status: string;
  attemptNumber?: number;
  occurredAt: string;
  resultAvailable?: boolean;
}

type Listener = (event: JobEvent) => void;
const listeners = new Map<string, Set<Listener>>();
let subscriber: IORedis | undefined;
let subscriptionPromise: Promise<void> | undefined;

async function ensureSubscription() {
  if (!subscriber) subscriber = new IORedis(config.REDIS_URL, { lazyConnect: true, connectTimeout: 1_000, maxRetriesPerRequest: 1 });
  if (!subscriptionPromise) {
    subscriptionPromise = (async () => {
      if (subscriber!.status === 'wait') await subscriber!.connect();
      await subscriber!.subscribe('flowforge:events');
      subscriber!.on('message', (_channel, raw) => {
        try {
          const event = JSON.parse(raw) as JobEvent;
          for (const listener of listeners.get(event.ownerId) ?? []) listener(event);
        } catch { /* Ignore malformed best-effort notifications. */ }
      });
    })().catch(() => { subscriptionPromise = undefined; throw new Error('Event subscription unavailable'); });
  }
  return subscriptionPromise;
}

export async function addJobEventListener(ownerId: string, listener: Listener): Promise<() => void> {
  try { await ensureSubscription(); } catch { return () => undefined; }
  const ownerListeners = listeners.get(ownerId) ?? new Set<Listener>();
  ownerListeners.add(listener);
  listeners.set(ownerId, ownerListeners);
  return () => { ownerListeners.delete(listener); if (!ownerListeners.size) listeners.delete(ownerId); };
}
