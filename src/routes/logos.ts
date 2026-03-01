import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';

import { env } from '../config/env';
import { AKPA_LOGOS_DEFAULTS } from '../config/akpa-logos-defaults';

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

  /** GET /logos/akpa/:channelId – jedyna rejestracja (w pluginie), serwowanie z bazy (encode hex). */
  app.get('/akpa/:channelId', async (request, reply) => {
    const channelId = (request.params as { channelId: string }).channelId;
    if (!channelId || !safeChannelId(channelId)) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }
    const channel = await app.prisma.channel.findUnique({
      where: { externalId: channelId },
      select: { logoContentType: true },
    });
    if (!channel) {
      return reply.code(404).send({ error: 'Logo not found' });
    }
    const hexRow = await app.prisma.$queryRaw<Array<Record<string, unknown>>>(
      Prisma.sql`SELECT encode("logoData", 'hex') as hex_data, "logoContentType" as logo_content_type FROM channels WHERE "externalId" = ${channelId} LIMIT 1`,
    );
    const row = hexRow[0];
    if (!row) {
      return reply.code(404).send({ error: 'Logo not found' });
    }
    const hexVal = rowVal<string>(row, 'hex_data', 'hex_data');
    const ctVal = rowVal<unknown>(row, 'logo_content_type', 'logo_content_type');
    const hexStr = hexVal == null ? '' : Buffer.isBuffer(hexVal) ? hexVal.toString('utf8') : String(hexVal).trim();
    if (hexStr.length === 0) {
      return reply.code(404).send({ error: 'Logo not found' });
    }
    const buf = Buffer.from(hexStr, 'hex');
    if (buf.length === 0) {
      return reply.code(404).send({ error: 'Logo not found' });
    }
    const contentType = (ctVal != null && String(ctVal).trim()) ? String(ctVal).trim() : 'image/png';
    return reply
      .header('Cache-Control', 'public, max-age=86400')
      .type(contentType)
      .send(buf);
  });
});

export default logosRoutes;
