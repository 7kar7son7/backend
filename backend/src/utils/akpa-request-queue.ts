/**
 * Kolejka żądań do API AKPA (api-epg.akpa.pl): max ~2 req/s z jednego IP (rate_limit po stronie AKPA).
 * Wszystkie wywołania z tego procesu do EPG/zdjęć AKPA powinny przechodzić przez enqueueAkpaRequest.
 */
const DEFAULT_MIN_MS = 550;

function minIntervalMs(): number {
  const v = Number.parseInt(process.env.AKPA_MIN_REQUEST_INTERVAL_MS ?? '', 10);
  return Number.isFinite(v) && v >= 100 ? v : DEFAULT_MIN_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let queue: Promise<void> = Promise.resolve();
let lastEnd = 0;

export function enqueueAkpaRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const gap = minIntervalMs();
    const wait = Math.max(0, gap - (Date.now() - lastEnd));
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastEnd = Date.now();
    }
  });
  queue = run.then(() => {}).catch(() => {});
  return run as Promise<T>;
}
