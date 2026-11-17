export interface FixedWindowRateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}

/**
 * Bounded fixed-window limiter intended for low-volume, authenticated staff
 * operations in a serverless instance. It fails closed if the key table is full.
 * Production deployments should still apply an edge/WAF-wide limit as well.
 */
export function createFixedWindowRateLimiter(
  options: FixedWindowRateLimiterOptions
): (key: string, now?: number) => boolean {
  const { limit, windowMs, maxKeys = 5000 } = options;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
  if (!Number.isInteger(windowMs) || windowMs < 1) throw new Error('windowMs must be a positive integer');
  if (!Number.isInteger(maxKeys) || maxKeys < 1) throw new Error('maxKeys must be a positive integer');

  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (key: string, now = Date.now()): boolean => {
    if (!key) return false;

    const current = buckets.get(key);
    if (current && current.resetAt > now) {
      current.count += 1;
      return current.count <= limit;
    }

    // Reclaim expired identities before admitting a new key. Never evict an
    // active identity to make room, because that would reset its rate limit.
    if (!current && buckets.size >= maxKeys) {
      for (const [storedKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(storedKey);
      }
      if (buckets.size >= maxKeys) return false;
    }

    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  };
}
