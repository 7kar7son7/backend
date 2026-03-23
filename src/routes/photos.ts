import * as https from 'node:https';
import { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { enqueueAkpaRequest } from '../utils/akpa-request-queue';

const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';
const FETCH_TIMEOUT_MS = 15000;
const PROXY_CACHE_TTL_MS = 60 * 60 * 1000;
const PROXY_CACHE_MAX =
  Number.parseInt(process.env.AKPA_PHOTO_PROXY_CACHE_MAX ?? '', 10) > 0
    ? Number.parseInt(process.env.AKPA_PHOTO_PROXY_CACHE_MAX ?? '', 10)
    : 200;

/** Klucz = URL zdjęcia z query (bez tokena dodawanego przy fetchu). */
const photoProxyCache = new Map<string, { buffer: Buffer; contentType: string; expiresAt: number }>();

function photoCacheGet(canonicalUrl: string): { buffer: Buffer; contentType: string } | null {
  const e = photoProxyCache.get(canonicalUrl);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    photoProxyCache.delete(canonicalUrl);
    return null;
  }
  return { buffer: e.buffer, contentType: e.contentType };
}

function photoCacheSet(canonicalUrl: string, buffer: Buffer, contentType: string) {
  if (photoProxyCache.size >= PROXY_CACHE_MAX) {
    const first = photoProxyCache.keys().next().value;
    if (first !== undefined) photoProxyCache.delete(first);
  }
  photoProxyCache.set(canonicalUrl, {
    buffer,
    contentType,
    expiresAt: Date.now() + PROXY_CACHE_TTL_MS,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildAkpaAuthHeaders(): Record<string, string> {
  const token = (env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN ?? '').trim();
  if (!token) return {};
  const authType = (env.AKPA_AUTH_TYPE ?? process.env.AKPA_AUTH_TYPE ?? 'Bearer').trim();
  if (authType === 'X-Api-Key') return { 'X-API-Key': token };
  if (authType === 'Token') return { Authorization: `Token ${token}` };
  return { Authorization: `Bearer ${token}` };
}

function getAuthQueryParamName(): string | undefined {
  const raw = env.AKPA_AUTH_QUERY_PARAM ?? process.env.AKPA_AUTH_QUERY_PARAM;
  if (!raw || !String(raw).trim()) return undefined;
  return String(raw).trim();
}

function photoUrlWithQueryAuth(url: URL, token: string): string {
  const paramName = getAuthQueryParamName();
  if (!paramName || !token) return url.toString();
  const u = new URL(url.toString());
  if (!u.searchParams.has(paramName)) u.searchParams.set(paramName, token);
  return u.toString();
}

/**
 * Pobierz zdjęcie z AKPA – zwykły https.request, domyślny agent, tylko token + Accept.
 * Działało wcześniej bez curla.
 */
function fetchWithHttps(
  url: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const opts: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        ...headers,
        Accept: 'image/*',
      },
      timeout: timeoutMs,
    };

    const req = https.request(opts, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: (res.headers['content-type'] as string) || 'image/jpeg',
        }),
      );
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

export default async function photosRoutes(app: FastifyInstance) {
  app.log.info('Photos proxy: zdjęcia z AKPA (token z env)');

  app.get('/proxy', async (request, reply) => {
    const urlRaw = (request.query as { url?: string }).url;
    if (!urlRaw || typeof urlRaw !== 'string') {
      return reply.code(400).send({ error: 'Missing url query parameter' });
    }
    let targetUrl: URL;
    try {
      targetUrl = new URL(urlRaw);
    } catch {
      return reply.code(400).send({ error: 'Invalid url' });
    }
    if (targetUrl.hostname !== AKPA_PHOTO_HOST && !targetUrl.hostname.endsWith('.akpa.pl')) {
      return reply.code(403).send({ error: 'Only AKPA photo URLs are allowed' });
    }

    const token = (env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN ?? '').trim();
    const authHeaders = buildAkpaAuthHeaders();
    if (!token || Object.keys(authHeaders).length === 0) {
      request.log.warn('Photos proxy: AKPA_API_TOKEN nie ustawiony');
      return reply.code(503).send({
        error: 'AKPA_API_TOKEN not configured',
        message: 'Ustaw AKPA_API_TOKEN w zmiennych środowiskowych.',
      });
    }

    const canonicalKey = targetUrl.toString();
    const cached = photoCacheGet(canonicalKey);
    if (cached) {
      return reply
        .header('Cache-Control', 'public, max-age=3600')
        .type(cached.contentType)
        .send(cached.buffer);
    }

    const fetchUrl = photoUrlWithQueryAuth(targetUrl, token);
    const headers = { ...authHeaders };

    let lastErr: unknown;
    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const { buffer, contentType } = await enqueueAkpaRequest(() =>
          fetchWithHttps(new URL(fetchUrl), headers, FETCH_TIMEOUT_MS),
        );
        photoCacheSet(canonicalKey, buffer, contentType);
        request.log.info({ url: canonicalKey, bytes: buffer.length }, 'Photos proxy: OK');
        return reply
          .header('Cache-Control', 'public, max-age=3600')
          .type(contentType)
          .send(buffer);
      } catch (err) {
        lastErr = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('HTTP 429') || errMsg.includes('HTTP 503')) {
          request.log.warn({ url: canonicalKey, attempt }, 'Photos proxy: rate limit / unavailable, retry');
          await sleep(Math.min(30_000, 1500 * (attempt + 1)));
          continue;
        }
        break;
      }
    }

    const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    const cause =
      lastErr instanceof Error && (lastErr as Error & { cause?: Error }).cause
        ? String((lastErr as Error & { cause?: Error }).cause?.message ?? '')
        : undefined;
    request.log.error({ err: lastErr, url: canonicalKey, cause }, 'Photos proxy: failed');
    return reply.code(502).send({
      error: 'Failed to fetch image from AKPA',
      message: errMsg,
      ...(cause ? { cause } : {}),
    });
  });
}
