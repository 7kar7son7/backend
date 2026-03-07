import { FastifyInstance } from 'fastify';
import { env } from '../config/env';

const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';

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
   * Pobiera zdjęcie z AKPA z tokenem i zwraca klientowi (bez 403).
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
    const headers: Record<string, string> = {
      Accept: 'image/*',
      ...authHeaders,
    };

    try {
      const res = await fetch(targetUrl.toString(), { method: 'GET', headers });
      if (!res.ok) {
        const text = await res.text();
        app.log.warn({ status: res.status, url: targetUrl.toString() }, 'AKPA photo proxy upstream error');
        return reply.code(res.status === 403 ? 502 : res.status).send({
          error: res.status === 403 ? 'AKPA returned 403 – check AKPA_API_TOKEN in .env' : 'Upstream error',
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
      request.log.error(err, 'Photo proxy fetch failed');
      return reply.code(502).send({ error: 'Failed to fetch image from AKPA' });
    }
  });
}
