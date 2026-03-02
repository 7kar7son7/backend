import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { FastifyInstance } from 'fastify';
import { getStaticLogosDir, readLogoFromStatic, getStaticLogosDebug } from '../utils/static-logos';
import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';

import { env } from '../config/env';
import { AKPA_LOGOS_DEFAULTS } from '../config/akpa-logos-defaults';
import { fetchAndSaveAkpaLogoForChannel } from '../services/sync-akpa-logos-to-db.service';

function safeChannelId(id: string): boolean {
  return /^akpa_[a-zA-Z0-9_]+$/.test(id) && id.length <= 128;
}

function toBuffer(data: unknown): Buffer | null {
  if (data == null) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
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

const logosRoutes = fp(async (app: FastifyInstance) => {
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

  /** GET /logos/akpa/:channelId – najpierw static (szybko), potem baza, na końcu fetch z AKPA. */
  app.get('/akpa/:channelId', async (request, reply) => {
    const channelId = (request.params as { channelId: string }).channelId;
    if (!channelId || !safeChannelId(channelId)) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }
    const fromStatic = readLogoFromStatic(channelId);
    if (fromStatic) {
      return reply
        .header('Cache-Control', 'public, max-age=86400')
        .type(fromStatic.contentType)
        .send(fromStatic.body);
    }
    const channel = await app.prisma.channel.findUnique({
      where: { externalId: channelId },
      select: { logoData: true, logoContentType: true, name: true },
    });
    if (!channel) {
      return reply.code(404).send({ error: 'Logo not found' });
    }
    let data: Buffer | Uint8Array | null = channel.logoData as Buffer | Uint8Array | null;
    let contentType = (channel.logoContentType?.trim() || '') !== '' ? channel.logoContentType!.trim() : 'image/png';
    const hasData =
      data != null &&
      ((Buffer.isBuffer(data) && data.length > 0) || (data instanceof Uint8Array && data.length > 0));

    if (!hasData) {
      const raw = await app.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`SELECT "logoData", "logoContentType" FROM channels WHERE "externalId" = ${channelId} LIMIT 1`,
      );
      const row = raw[0];
      if (row) {
        const rawData = rowVal<unknown>(row, 'logoData', 'logodata');
        const rawCt = rowVal<string>(row, 'logoContentType', 'logocontenttype');
        if (rawData != null && typeof (rawData as Buffer).length === 'number' && (rawData as Buffer).length > 0) {
          data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData as ArrayBuffer);
          if (rawCt && String(rawCt).trim()) contentType = String(rawCt).trim();
        }
      }
    }

    const hasDataNow =
      data != null &&
      ((Buffer.isBuffer(data) && data.length > 0) || (data instanceof Uint8Array && data.length > 0));
    if (hasDataNow && data) {
      const body: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array);
      return reply
        .header('Cache-Control', 'public, max-age=86400')
        .type(contentType)
        .send(body);
    }
    const fetched = await fetchAndSaveAkpaLogoForChannel(app.prisma, app.log, channelId);
    if (fetched) {
      return reply
        .header('Cache-Control', 'public, max-age=86400')
        .type(fetched.contentType)
        .send(fetched.body);
    }
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
          const body = readFileSync(filePath);
          const ct = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/webp';
          return reply.header('Cache-Control', 'public, max-age=86400').type(ct).send(body);
        }
      }
    }
    return reply.code(404).send({ error: 'Logo not found' });
  });
});

export default logosRoutes;
