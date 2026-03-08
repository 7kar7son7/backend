import * as https from 'node:https';
import { FastifyInstance } from 'fastify';
import { env } from '../config/env';

const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';
const FETCH_TIMEOUT_MS = 15000;

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

    const fetchUrl = photoUrlWithQueryAuth(targetUrl, token);
    const headers = { ...authHeaders };

    try {
      const { buffer, contentType } = await fetchWithHttps(
        new URL(fetchUrl),
        headers,
        FETCH_TIMEOUT_MS,
      );
      request.log.info({ url: targetUrl.toString(), bytes: buffer.length }, 'Photos proxy: OK');
      return reply
        .header('Cache-Control', 'public, max-age=3600')
        .type(contentType)
        .send(buffer);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const cause = err instanceof Error && (err as Error & { cause?: Error }).cause
        ? String((err as Error & { cause?: Error }).cause?.message ?? '')
        : undefined;
      request.log.error({ err, url: targetUrl.toString(), cause }, 'Photos proxy: failed');
      return reply.code(502).send({
        error: 'Failed to fetch image from AKPA',
        message: errMsg,
        ...(cause ? { cause } : {}),
      });
    }
  });
}
