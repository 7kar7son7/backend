/**
 * Prosty rate limiter w pamięci (per key).
 * Okno 1 minuta: POST /events, POST /events/:id/confirm.
 * Okno 1 godzina: limit zgłoszeń na użytkownika (ochrona przed nadużyciami).
 */
const store = new Map<string, { count: number; resetAt: number }>();
const storeHourly = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const WINDOW_HOUR_MS = 60 * 60_000;

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

export function checkRateLimitHourly(key: string, maxPerHour: number): boolean {
  const now = Date.now();
  let entry = storeHourly.get(key);

  if (entry && now >= entry.resetAt) {
    storeHourly.delete(key);
    entry = undefined;
  }

  if (!entry) {
    storeHourly.set(key, { count: 1, resetAt: now + WINDOW_HOUR_MS });
    return true;
  }

  entry.count += 1;
  if (entry.count > maxPerHour) {
    return false;
  }
  return true;
}

