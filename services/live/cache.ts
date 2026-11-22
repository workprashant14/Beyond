/**
 * Tiny in-memory TTL cache with in-flight de-duplication, so a burst of users
 * opening the same object triggers one upstream request (and we stay polite to
 * NASA/JPL). Per server instance; Next's fetch cache sits underneath it.
 */
interface Entry {
  exp: number;
  value: unknown;
}
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 500;

export async function cached<T>(key: string, ttlMs: (v: T) => number, load: () => Promise<T>, now = Date.now): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > now()) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const p = load()
    .then((v) => {
      if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
      store.set(key, { exp: now() + ttlMs(v), value: v });
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function clearCache(): void {
  store.clear();
  inflight.clear();
}
