import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FastifyInstance } from 'fastify';
import { getStaticLogosDir, readLogoFromStatic, getStaticLogosDebug } from '../utils/static-logos';
import { Prisma } from '@prisma/client';

import { env } from '../config/env';
import { AKPA_LOGOS_DEFAULTS } from '../config/akpa-logos-defaults';
import { fetchAndSaveAkpaLogoForChannel } from '../services/sync-akpa-logos-to-db.service';
import { fetchLogoFromAkpaFolder } from '../services/akpa-logo-fetcher';
import { loadAkpaLogoFolderMap } from '../utils/akpa-logo-folders';

function safeChannelId(id: string): boolean {
  return /^akpa_[a-zA-Z0-9_]+$/.test(id) && id.length <= 128;
}

function toBuffer(data: unknown): Buffer | null {
  if (data == null) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (typeof data === 'string') {
    let hex = data;
    if (hex.startsWith('\\x')) hex = hex.slice(2);
    if (hex.startsWith('\u005Cx')) hex = hex.slice(2);
    if (/^[0-9a-fA-F]+$/.test(hex)) return Buffer.from(hex, 'hex');
    try {
      return Buffer.from(data, 'base64');
    } catch {
      return null;
    }
  }
  if (typeof (data as Uint8Array).length === 'number') return Buffer.from(data as Uint8Array);
  return null;
}

/** pg w raw query często zwraca nazwy kolumn w lowercase – odczytaj po dowolnej wersji */
function rowVal<T>(row: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k)) return row[k] as T;
  }
  for (const k of keys) {
    const low = k.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(row, low)) return row[low] as T;
  }
  return undefined;
}

/** Logotypy z DB/AKPA są wolne (BLOB + sieć). Drugie żądanie tego samego id w tym samym procesie serwujemy z RAM. */
const LOGO_SLOW_PATH_CACHE_MAX = 96;
const logoSlowPathCache = new Map<string, { body: Buffer; contentType: string }>();

function logoSlowPathCacheGet(channelId: string): { body: Buffer; contentType: string } | null {
  const v = logoSlowPathCache.get(channelId);
  if (!v) return null;
  logoSlowPathCache.delete(channelId);
  logoSlowPathCache.set(channelId, v);
  return v;
}

function logoSlowPathCachePut(channelId: string, body: Buffer, contentType: string) {
  if (logoSlowPathCache.has(channelId)) logoSlowPathCache.delete(channelId);
  while (logoSlowPathCache.size >= LOGO_SLOW_PATH_CACHE_MAX) {
    const first = logoSlowPathCache.keys().next().value;
    if (first === undefined) break;
    logoSlowPathCache.delete(first);
  }
  logoSlowPathCache.set(channelId, { body: Buffer.from(body), contentType });
}

/** URL /logos/akpa/{id} jest stały – agresywny cache po stronie klienta / CDN. */
const LOGO_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800, immutable';

/** Ścieżki do JSON z embedded logos – __dirname lub cwd. Ładujemy raz przy starcie. */
const embeddedJsonCandidates = [
  resolve(
    typeof __dirname !== 'undefined' ? __dirname : join(process.cwd(), 'src', 'routes'),
    '..',
    'data',
    'embedded-akpa-logos.json',
  ),
  join(process.cwd(), 'src', 'data', 'embedded-akpa-logos.json'),
];
let embeddedLogosMap: Record<string, { contentType: string; base64: string }> = {};
for (const embeddedJsonPath of embeddedJsonCandidates) {
  if (!existsSync(embeddedJsonPath)) continue;
  try {
    embeddedLogosMap = JSON.parse(readFileSync(embeddedJsonPath, 'utf8')) as Record<
      string,
      { contentType: string; base64: string }
    >;
    if (Object.keys(embeddedLogosMap).length > 0) {
      console.log('[logos] załadowano embedded JSON:', Object.keys(embeddedLogosMap).length, 'logotypów');
      break;
    }
  } catch (e) {
    console.warn('[logos] błąd JSON:', e instanceof Error ? e.message : e);
  }
}

async function logosRoutes(app: FastifyInstance) {
  app.get('/ping', async (_request, reply) => {
    return reply.send({
      ok: true,
      mapSize: Object.keys(embeddedLogosMap).length,
      hasAkpa367: !!embeddedLogosMap['akpa_367'],
    });
  });

  /** Diagnostyka: GET /logos/debug/db → ile kanałów AKPA ma logoData w bazie (raw SQL). Na produkcji sprawdź czy backend widzi dane. */
  app.get('/debug/db', async (_request, reply) => {
    try {
      const countResult = await app.prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(*) as count FROM channels WHERE "externalId" LIKE 'akpa_%' AND "logoData" IS NOT NULL AND length("logoData") > 0`,
      );
      const count = Number(countResult[0]?.count ?? 0);
      const dbHost = process.env.DATABASE_URL?.replace(/^[^@]+@/, '***@').split('/')[0] ?? 'unknown';
      return reply.send({
        ok: true,
        channelsWithLogo: count,
        databaseHost: dbHost,
        message: count >= 60 ? 'Baza OK – backend widzi logotypy.' : `Tylko ${count} kanałów z logoData – sprawdź DATABASE_URL.`,
      });
    } catch (err) {
      return reply.code(500).send({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        message: 'Błąd połączenia z bazą lub zapytania.',
      });
    }
  });

  /** Diagnostyka: GET /logos/debug/akpa/:channelId → JSON czy baza zwraca logoData (na produkcji sprawdź czy Prisma widzi dane). */
  app.get('/debug/akpa/:channelId', async (request, reply) => {
    const channelId = (request.params as { channelId: string }).channelId;
    if (!channelId || !safeChannelId(channelId)) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }
    const ch = await app.prisma.channel.findUnique({
      where: { externalId: channelId },
      select: { name: true, logoData: true, logoContentType: true },
    });
    const hasData = ch?.logoData != null;
    const len = hasData && Buffer.isBuffer(ch!.logoData)
      ? ch!.logoData.length
      : hasData && ch!.logoData instanceof Uint8Array
        ? ch!.logoData.length
        : null;
    let rawLogoDataLength: number | null = null;
    let hexLength: number | null = null;
    if (ch) {
      const raw = await app.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`SELECT "logoData", "logoContentType" FROM channels WHERE "externalId" = ${channelId} LIMIT 1`,
      );
      const row = raw[0];
      if (row) {
        const rawData = rowVal<unknown>(row, 'logoData', 'logodata');
        if (rawData != null && typeof (rawData as Buffer).length === 'number') rawLogoDataLength = (rawData as Buffer).length;
      }
      const hexRow = await app.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`SELECT encode("logoData", 'hex') as hex_data FROM channels WHERE "externalId" = ${channelId} LIMIT 1`,
      );
      const h = hexRow[0];
      const hexVal = h ? rowVal<string>(h, 'hex_data', 'hex_data') : null;
      if (hexVal && typeof hexVal === 'string') hexLength = hexVal.length;
    }
    const baseUrl = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? AKPA_LOGOS_DEFAULTS.BASE_URL).trim();
    const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? AKPA_LOGOS_DEFAULTS.USER).trim();
    const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? AKPA_LOGOS_DEFAULTS.PASSWORD).trim();
    return reply.send({
      channelId,
      channelFound: !!ch,
      hasLogoData: hasData,
      hasContentType: !!(ch?.logoContentType),
      logoDataLength: len,
      rawLogoDataLength,
      hexLength,
      name: ch?.name ?? null,
      akpaLogosConfigured: !!(baseUrl && user && password),
    });
  });

  /** Diagnostyka: GET /logos/debug/embedded – czy build ma wbudowaną mapę (60 kanałów AKPA = pełny zestaw). */
  app.get('/debug/embedded', async (_request, reply) => {
    let count = 0;
    try {
      const mod = require('../data/embedded-akpa-logos');
      count = typeof mod.EMBEDDED_AKPA_LOGOS_COUNT === 'number' ? mod.EMBEDDED_AKPA_LOGOS_COUNT : Object.keys(mod.EMBEDDED_AKPA_LOGOS ?? {}).length;
    } catch (e) {
      app.log.warn({ err: e }, 'Failed to load embedded-akpa-logos (missing or OOM)');
    }
    return reply.send({
      ok: true,
      embeddedLogosCount: count,
      message:
        count >= 60
          ? 'Embedded logos OK – GET /logos/akpa/:id powinien serwować z mapy.'
          : `Tylko ${count} w mapie – sprawdź npm run logos:embed i deploy.`,
    });
  });

  /** Diagnostyka: GET /logos/debug/static – ścieżki i czy katalog static istnieje (na produkcji). */
  app.get('/debug/static', async (_request, reply) => {
    const debug = getStaticLogosDebug();
    return reply.send({
      ok: true,
      ...debug,
      message: debug.cwdExists || debug.fromDistExists
        ? (debug.sampleExists ? 'Static OK – logotypy powinny się serwować.' : 'Katalog istnieje, brak pliku akpa_85 – sprawdź zawartość.')
        : 'Brak katalogu static/logos/akpa – sprawdź COPY w Dockerfile i deploy.',
    });
  });

  /** GET /logos/akpa/:channelId – najpierw embedded, potem static, baza, AKPA. */
  app.get('/akpa/:channelId', async (request, reply) => {
    const channelId = (request.params as { channelId: string }).channelId;
    if (!channelId || !safeChannelId(channelId)) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }
    const embeddedEntry = embeddedLogosMap[channelId];
    if (embeddedEntry?.base64) {
      return reply
        .header('Cache-Control', LOGO_CACHE_CONTROL)
        .type(embeddedEntry.contentType || 'image/png')
        .send(Buffer.from(embeddedEntry.base64, 'base64'));
    }
    const jsonPath = join(process.cwd(), 'src', 'data', 'embedded-akpa-logos.json');
    if (existsSync(jsonPath)) {
      try {
        const parsed = JSON.parse(readFileSync(jsonPath, 'utf8')) as Record<string, { contentType?: string; base64?: string }>;
        const entry = parsed[channelId];
        if (entry?.base64) {
          return reply
            .header('Cache-Control', LOGO_CACHE_CONTROL)
            .type(entry.contentType || 'image/png')
            .send(Buffer.from(entry.base64, 'base64'));
        }
      } catch {
        // ignore
      }
    }
    const fromStatic = readLogoFromStatic(channelId);
    if (fromStatic) {
      return reply
        .header('Cache-Control', LOGO_CACHE_CONTROL)
        .type(fromStatic.contentType)
        .send(fromStatic.body);
    }
    const cachedSlow = logoSlowPathCacheGet(channelId);
    if (cachedSlow) {
      return reply.header('Cache-Control', LOGO_CACHE_CONTROL).type(cachedSlow.contentType).send(cachedSlow.body);
    }
    app.log.info({ channelId }, '[logo] static miss, reading DB');
    const channel = await app.prisma.channel.findUnique({
      where: { externalId: channelId },
      select: { logoData: true, logoContentType: true, name: true },
    });
    if (!channel) {
      app.log.info({ channelId }, '[logo] channel not in DB – trying AKPA from builtin map');
      const folderMap = loadAkpaLogoFolderMap();
      const folder = folderMap[channelId];
      const baseUrlRaw = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? AKPA_LOGOS_DEFAULTS.BASE_URL).trim();
      const baseUrl = (baseUrlRaw || AKPA_LOGOS_DEFAULTS.BASE_URL).replace(/\/+$/, '');
      const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? AKPA_LOGOS_DEFAULTS.USER).trim() || AKPA_LOGOS_DEFAULTS.USER;
      const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? AKPA_LOGOS_DEFAULTS.PASSWORD).trim() || AKPA_LOGOS_DEFAULTS.PASSWORD;
      if (folder && baseUrl && user && password) {
        const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
        let result = await fetchLogoFromAkpaFolder(baseUrl, authHeader, folder, (msg, meta) =>
          app.log.warn({ ...meta, channelId }, `[logo] akpa ${msg}`));
        if (!result) {
          const newBaseRaw = (env.AKPA_LOGOS_NEW_BASE_URL ?? process.env.AKPA_LOGOS_NEW_BASE_URL ?? AKPA_LOGOS_DEFAULTS.NEW_BASE_URL).trim();
          const newBase = (newBaseRaw || AKPA_LOGOS_DEFAULTS.NEW_BASE_URL).replace(/\/+$/, '');
          const newUser = (env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER ?? AKPA_LOGOS_DEFAULTS.NEW_USER).trim() || AKPA_LOGOS_DEFAULTS.NEW_USER;
          const newPassword = (env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD ?? AKPA_LOGOS_DEFAULTS.NEW_PASSWORD).trim() || AKPA_LOGOS_DEFAULTS.NEW_PASSWORD;
          if (newBase && newUser && newPassword) {
            const newAuth = 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64');
            result = await fetchLogoFromAkpaFolder(newBase, newAuth, folder, (msg, meta) =>
              app.log.warn({ ...meta, channelId }, `[logo] akpa new ${msg}`));
          }
        }
        if (result) {
          app.log.info({ channelId, folder }, '[logo] 200 from AKPA (no DB channel)');
          logoSlowPathCachePut(channelId, result.body, result.contentType);
          return reply.header('Cache-Control', LOGO_CACHE_CONTROL).type(result.contentType).send(result.body);
        }
      }
      app.log.warn({ channelId }, '[logo] 404 channel not in DB and no AKPA fallback');
      return reply.code(404).send({ error: 'Logo not found' });
    }
    let data: Buffer | null = toBuffer(channel.logoData);
    let contentType = (channel.logoContentType?.trim() || '') !== '' ? channel.logoContentType!.trim() : 'image/png';

    if (!data || data.length === 0) {
      app.log.info({ channelId }, '[logo] no logoData from Prisma, trying raw SQL');
      const raw = await app.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`SELECT "logoData", "logoContentType" FROM channels WHERE "externalId" = ${channelId} LIMIT 1`,
      );
      const row = raw[0];
      if (row) {
        const rawData = rowVal<unknown>(row, 'logoData', 'logodata');
        const rawCt = rowVal<string>(row, 'logoContentType', 'logocontenttype');
        const decoded = toBuffer(rawData);
        if (decoded && decoded.length > 0) {
          data = decoded;
          if (rawCt && String(rawCt).trim()) contentType = String(rawCt).trim();
        }
      }
    }

    if (data && data.length > 0) {
      app.log.info({ channelId }, '[logo] 200 from DB');
      logoSlowPathCachePut(channelId, data, contentType);
      return reply.header('Cache-Control', LOGO_CACHE_CONTROL).type(contentType).send(data);
    }
    app.log.info({ channelId, channelName: channel.name }, '[logo] no DB logo, calling fetchAndSaveAkpaLogo');
    const fetched = await fetchAndSaveAkpaLogoForChannel(app.prisma, app.log, channelId);
    if (fetched) {
      app.log.info({ channelId }, '[logo] 200 from AKPA fetch');
      logoSlowPathCachePut(channelId, fetched.body, fetched.contentType);
      return reply.header('Cache-Control', LOGO_CACHE_CONTROL).type(fetched.contentType).send(fetched.body);
    }
    app.log.info({ channelId }, '[logo] fetchAndSaveAkpaLogo null – trying direct AKPA from map');
    const folderMap = loadAkpaLogoFolderMap();
    const folder = folderMap[channelId];
    const baseUrl = ((env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? AKPA_LOGOS_DEFAULTS.BASE_URL).trim() || AKPA_LOGOS_DEFAULTS.BASE_URL).replace(/\/+$/, '');
    const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? AKPA_LOGOS_DEFAULTS.USER).trim() || AKPA_LOGOS_DEFAULTS.USER;
    const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? AKPA_LOGOS_DEFAULTS.PASSWORD).trim() || AKPA_LOGOS_DEFAULTS.PASSWORD;
    if (folder && baseUrl && user && password) {
      const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
      let directResult = await fetchLogoFromAkpaFolder(baseUrl, authHeader, folder, (msg, meta) =>
        app.log.warn({ ...meta, channelId }, `[logo] direct akpa ${msg}`));
      if (!directResult) {
        const newBase = ((env.AKPA_LOGOS_NEW_BASE_URL ?? process.env.AKPA_LOGOS_NEW_BASE_URL ?? AKPA_LOGOS_DEFAULTS.NEW_BASE_URL).trim() || AKPA_LOGOS_DEFAULTS.NEW_BASE_URL).replace(/\/+$/, '');
        const newUser = (env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER ?? AKPA_LOGOS_DEFAULTS.NEW_USER).trim() || AKPA_LOGOS_DEFAULTS.NEW_USER;
        const newPassword = (env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD ?? AKPA_LOGOS_DEFAULTS.NEW_PASSWORD).trim() || AKPA_LOGOS_DEFAULTS.NEW_PASSWORD;
        if (newBase && newUser && newPassword) {
          const newAuth = 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64');
          directResult = await fetchLogoFromAkpaFolder(newBase, newAuth, folder, (msg, meta) =>
            app.log.warn({ ...meta, channelId }, `[logo] direct akpa new ${msg}`));
        }
      }
      if (directResult) {
        app.log.info({ channelId, folder }, '[logo] 200 from direct AKPA (after fetchAndSave null)');
        logoSlowPathCachePut(channelId, directResult.body, directResult.contentType);
        return reply.header('Cache-Control', LOGO_CACHE_CONTROL).type(directResult.contentType).send(directResult.body);
      }
    }
    app.log.warn(
      { channelId },
      '[logo] fetchAndSaveAkpaLogo returned null – sprawdź logi (credentials, folder, HTTP status)',
    );
    const staticDir = getStaticLogosDir();
    const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const baseNames = [channelId];
    if (channel.name?.trim()) {
      const nameSlug = channel.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
      if (nameSlug) baseNames.push(nameSlug);
    }
    for (const base of baseNames) {
      for (const ext of exts) {
        const filePath = join(staticDir, `${base}${ext}`);
        if (existsSync(filePath)) {
          app.log.info({ channelId, filePath }, '[logo] 200 from static dir file');
          const body = readFileSync(filePath);
          const ct = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/webp';
          logoSlowPathCachePut(channelId, body, ct);
          return reply.header('Cache-Control', LOGO_CACHE_CONTROL).type(ct).send(body);
        }
      }
    }
    app.log.warn({ channelId, staticDir, baseNames }, '[logo] 404 final – brak wszędzie');
    return reply.code(404).send({ error: 'Logo not found' });
  });
}

export default logosRoutes;
