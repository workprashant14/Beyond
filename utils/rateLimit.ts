/** Fixed-window per-key limiter (in memory, per instance). Good enough to protect the upstream APIs from abuse. */
const MAX_KEYS = 10_000;
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 40, windowMs = 60_000, now = Date.now()): { ok: boolean; retryAfter: number } {
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  // Hard cap: if many keys are still live (a flood from many addresses), drop the oldest so memory stays bounded.
  if (hits.size > MAX_KEYS) for (const k of hits.keys()) { hits.delete(k); if (hits.size <= MAX_KEYS) break; }
  const h = hits.get(key);
  if (!h || h.reset <= now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  h.count += 1;
  return h.count > limit ? { ok: false, retryAfter: Math.ceil((h.reset - now) / 1000) } : { ok: true, retryAfter: 0 };
}
