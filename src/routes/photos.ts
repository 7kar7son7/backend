import { FastifyInstance } from 'fastify';
import { env } from '../config/env';

const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';
const FETCH_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2; // przy "other side closed" / terminated – AKPA czasem zamyka połączenie

function isRetryableConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('terminated') || msg.includes('other side closed') || msg.includes('ECONNRESET') || msg.includes('socket hang up');
}

/** Ta sama logika co w akpa-importer: Bearer / Token / X-Api-Key */
function buildAkpaAuthHeaders(): Record<string, string> {
  const token = (env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN ?? '').trim();
  if (!token) return {};
  const authType = (env.AKPA_AUTH_TYPE ?? process.env.AKPA_AUTH_TYPE ?? 'Bearer').trim();
  if (authType === 'X-Api-Key') return { 'X-API-Key': token };
  if (authType === 'Token') return { Authorization: `Token ${token}` };
  return { Authorization: `Bearer ${token}` };
}

export default async function photosRoutes(app: FastifyInstance) {
  /**
   * GET /photos/proxy?url=<encoded_akpa_photo_url>
   * Pobiera zdjęcie z AKPA z tokenem (ten sam AKPA_API_TOKEN co import EPG) i zwraca klientowi.
   */
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

    const authHeaders = buildAkpaAuthHeaders();
    if (Object.keys(authHeaders).length === 0) {
      request.log.warn('Photos proxy: AKPA_API_TOKEN nie ustawiony – ustaw zmienną na serwerze (np. Railway/Docker env)');
      return reply.code(503).send({
        error: 'AKPA_API_TOKEN not configured',
        message: 'Ustaw AKPA_API_TOKEN (i ewentualnie AKPA_AUTH_TYPE) w zmiennych środowiskowych na serwerze.',
      });
    }

    const headers: Record<string, string> = {
      Accept: 'image/*',
      ...authHeaders,
    };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(targetUrl.toString(), {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          const text = await res.text();
          const is403 = res.status === 403;
          request.log.warn(
            { status: res.status, url: targetUrl.toString(), hasToken: true },
            is403 ? 'AKPA zwróciło 403 – sprawdź czy token jest ważny i AKPA_AUTH_TYPE (Bearer/Token/X-Api-Key)' : 'AKPA photo proxy upstream error',
          );
          return reply.code(is403 ? 502 : res.status).send({
            error: is403 ? 'AKPA 403 – token nieprawidłowy lub wygasły' : 'Upstream error',
            message: text.slice(0, 200),
          });
        }
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const buffer = Buffer.from(await res.arrayBuffer());
        return reply
          .header('Cache-Control', 'public, max-age=3600')
          .type(contentType)
          .send(buffer);
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const retryable = !isAbort && isRetryableConnectionError(err);
        if (retryable && attempt < MAX_RETRIES) {
          request.log.warn(
            { attempt: attempt + 1, maxRetries: MAX_RETRIES, url: targetUrl.toString() },
            'Photos proxy: połączenie zamknięte przez AKPA, ponawiam',
          );
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        request.log.error(
          { err, url: targetUrl.toString(), timeout: isAbort ? FETCH_TIMEOUT_MS : undefined },
          isAbort ? 'Photos proxy: timeout pobierania z AKPA' : 'Photos proxy: błąd pobierania z AKPA',
        );
        return reply.code(502).send({
          error: 'Failed to fetch image from AKPA',
          message: isAbort ? `Timeout ${FETCH_TIMEOUT_MS}ms` : (err instanceof Error ? err.message : 'Unknown error'),
        });
      }
    }
  });
}
