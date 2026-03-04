/**
 * Prosty rate limiter w pamięci (per key, sliding window 1 minuta).
 * Używany do ograniczenia spamowania POST /events i POST /events/:id/confirm.
 */
const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;

export function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  let entry = store.get(key);

  if (entry && now >= entry.resetAt) {
    store.delete(key);
    entry = undefined;
  }

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  entry.count += 1;
  if (entry.count > maxPerMinute) {
    return false;
  }
  return true;
}
