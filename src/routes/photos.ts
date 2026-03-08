import * as child_process from 'node:child_process';
import * as https from 'node:https';
import { FastifyInstance } from 'fastify';
import { env } from '../config/env';

const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';
const FETCH_TIMEOUT_MS = 12000;
const CURL_TIMEOUT_SEC = 15;

/** AKPA zamyka połączenie na Node (fetch/https) – curl z tej samej maszyny działa. Pobieramy przez curl. */
function buildAuthHeader(): string {
  const token = (env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN ?? '').trim();
  if (!token) return '';
  const authType = (env.AKPA_AUTH_TYPE ?? process.env.AKPA_AUTH_TYPE ?? 'Bearer').trim();
  if (authType === 'X-Api-Key') return `X-API-Key: ${token}`;
  if (authType === 'Token') return `Authorization: Token ${token}`;
  return `Authorization: Bearer ${token}`;
}

/** Ścieżka do curla: w Alpine po apk add jest /usr/bin/curl (PATH w kontenerze może być ograniczony). */
const CURL_PATH = process.platform === 'win32' ? 'curl.exe' : '/usr/bin/curl';

/** Pobierz zdjęcie przez curl – AKPA przyjmuje request z curl, z Node zamyka połączenie. */
function fetchWithCurl(
  url: string,
  authHeader: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const args = [
      '-s',
      '-S',
      '-L',
      '-m', String(CURL_TIMEOUT_SEC),
      '-H', authHeader,
      '-H', 'Accept: image/*',
      '--url', url,
    ];
    const proc = child_process.spawn(CURL_PATH, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    proc.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr?.on('data', () => {});
    proc.on('error', reject);
    proc.on('close', (code, signal) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`curl exit ${code} ${signal ?? ''}`));
        return;
      }
      const buffer = Buffer.concat(chunks);
      const contentType = buffer.length > 0 ? 'image/jpeg' : 'image/jpeg';
      resolve({ buffer, contentType });
    });
  });
}

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

/** Gdy AKPA wymaga tokenu w URL (np. ?token=...) – jak w akpa-importer */
function getAuthQueryParamName(): string | undefined {
  const raw = env.AKPA_AUTH_QUERY_PARAM ?? process.env.AKPA_AUTH_QUERY_PARAM;
  if (!raw || !String(raw).trim()) return undefined;
  return String(raw).trim();
}

/** Dodaje token do URL tylko gdy jawnie ustawiono AKPA_AUTH_QUERY_PARAM (dla zdjęć zwykle Bearer w headerze). */
function photoUrlWithQueryAuth(url: URL, token: string): string {
  const paramName = getAuthQueryParamName();
  if (!paramName || !token) return url.toString();
  const u = new URL(url.toString());
  if (!u.searchParams.has(paramName)) u.searchParams.set(paramName, token);
  return u.toString();
}

const USER_AGENT = 'Mozilla/5.0 (compatible; BackOnTV/1.0; +https://backon.tv)';

/** Fallback: node:https (często AKPA i tak zamyka). */
function fetchWithNodeHttps(
  url: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const opts: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { ...headers, 'User-Agent': USER_AGENT },
      timeout: timeoutMs,
    };
    const req = https.request(opts, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers['content-type'] || 'image/jpeg',
      }));
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
  // Przy starcie: sprawdź czy curl jest w kontenerze (potrzebne do /photos/proxy)
  const check = child_process.spawn(CURL_PATH, ['--version'], { stdio: 'ignore' });
  check.on('error', () => {
    app.log.warn({ curlPath: CURL_PATH }, 'Photos proxy: curl NOT found – rebuild Docker image without cache');
  });
  check.on('close', (code) => {
    if (code === 0) app.log.info('Photos proxy: curl available');
  });

  /**
   * GET /photos/proxy?url=<encoded_akpa_photo_url>
   * Zdjęcia programów – ZAWSZE z AKPA, z tokenem z env (AKPA_API_TOKEN). Nie zwracamy zdjęć z bazy.
   * Backend: Authorization: Bearer <AKPA_API_TOKEN> → GET api-epg.akpa.pl/... → zwraca bajty obrazka.
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

    const token = (env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN ?? '').trim();
    const authHeaders = buildAkpaAuthHeaders();
    const hasToken = token.length > 0 && Object.keys(authHeaders).length > 0;
    if (!hasToken) {
      request.log.warn('Photos proxy: AKPA_API_TOKEN nie ustawiony – ustaw zmienną na serwerze (np. Railway/Docker env)');
      return reply
        .header('X-Photo-Proxy-Token', 'missing')
        .code(503)
        .send({
          error: 'AKPA_API_TOKEN not configured',
          message: 'Ustaw AKPA_API_TOKEN (i ewentualnie AKPA_AUTH_TYPE) w zmiennych środowiskowych na serwerze.',
        });
    }

    const authHeader = buildAuthHeader();
    const photoUrl = targetUrl.toString();

    /** 1. Curl – na tej maszynie zwraca 200, Node dostaje "other side closed". */
    try {
      const { buffer, contentType } = await fetchWithCurl(photoUrl, authHeader);
      if (buffer.length > 0) {
        request.log.info({ url: photoUrl, bytes: buffer.length }, 'Photos proxy: curl OK');
        return reply
          .header('X-Photo-Proxy-Token', 'present')
          .header('Cache-Control', 'public, max-age=3600')
          .type(contentType)
          .send(buffer);
      }
    } catch (curlErr) {
      request.log.warn({ err: curlErr, url: photoUrl }, 'Photos proxy: curl failed, trying node');
    }

    /** 2. Fallback: node:https (może nie zadziałać – AKPA zamyka). */
    const fetchUrl = photoUrlWithQueryAuth(targetUrl, token);
    const headers: Record<string, string> = {
      Accept: 'image/*',
      ...authHeaders,
    };
    try {
      const parsed = new URL(fetchUrl);
      const nodeResult = await fetchWithNodeHttps(parsed, headers, FETCH_TIMEOUT_MS);
      request.log.info({ url: photoUrl }, 'Photos proxy: node:https OK');
      return reply
        .header('X-Photo-Proxy-Token', 'present')
        .header('Cache-Control', 'public, max-age=3600')
        .type(nodeResult.contentType)
        .send(nodeResult.buffer);
    } catch (nodeErr) {
      request.log.warn({ err: nodeErr, url: photoUrl }, 'Photos proxy: node:https failed');
    }

    /** 3. Ostatnia deska: fetch (zwykle też "other side closed"). */
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: { ...headers, 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const text = await res.text();
        const is403 = res.status === 403;
        return reply.code(is403 ? 502 : res.status).send({
          error: is403 ? 'AKPA 403 – token nieprawidłowy lub wygasły' : 'Upstream error',
          message: text.slice(0, 200),
        });
      }
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await res.arrayBuffer());
      return reply
        .header('X-Photo-Proxy-Token', 'present')
        .header('Cache-Control', 'public, max-age=3600')
        .type(contentType)
        .send(buffer);
    } catch (err) {
      clearTimeout(timeoutId);
      const errMsg = err instanceof Error ? err.message : String(err);
      const errCause = err instanceof Error && (err as Error & { cause?: Error }).cause
        ? String((err as Error & { cause?: Error }).cause?.message ?? (err as Error & { cause?: unknown }).cause)
        : undefined;
      request.log.error({ err, url: photoUrl, cause: errCause }, 'Photos proxy: fetch failed');
      return reply.code(502).send({
        error: 'Failed to fetch image from AKPA',
        message: errMsg,
        ...(errCause ? { cause: errCause } : {}),
      });
    }
  });
}
