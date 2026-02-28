import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';

import { env } from '../config/env';

const DEFAULT_AKPA_LOGOS_BASE = 'https://logotypy.akpa.pl/logotypy-tv';
const DEFAULT_AKPA_LOGOS_USER = 'logotypy_tv';
const DEFAULT_AKPA_LOGOS_PASSWORD = 'logos_2024@';

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
    if (ch) {
      const raw = await app.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`SELECT "logoData", "logoContentType" FROM channels WHERE "externalId" = ${channelId} LIMIT 1`,
      );
      const row = raw[0];
      const rawData = row?.logoData ?? row?.logodata;
      if (rawData != null && typeof (rawData as Buffer).length === 'number') rawLogoDataLength = (rawData as Buffer).length;
    }
    const baseUrl = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? DEFAULT_AKPA_LOGOS_BASE).trim();
    const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? DEFAULT_AKPA_LOGOS_USER).trim();
    const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? DEFAULT_AKPA_LOGOS_PASSWORD).trim();
    return reply.send({
      channelId,
      channelFound: !!ch,
      hasLogoData: hasData,
      hasContentType: !!(ch?.logoContentType),
      logoDataLength: len,
      rawLogoDataLength,
      name: ch?.name ?? null,
      akpaLogosConfigured: !!(baseUrl && user && password),
    });
  });

  /** GET /logos/akpa/:channelId – mapowanie: externalId → logo z bazy. Tylko odczyt z channels. */
  app.get('/akpa/:channelId', async (request, reply) => {
    const channelId = (request.params as { channelId: string }).channelId;
    if (!channelId || !safeChannelId(channelId)) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }

    const rows = await app.prisma.$queryRaw<
      Array<Record<string, unknown>>
    >(Prisma.sql`SELECT "logoData", "logoContentType" FROM channels WHERE "externalId" = ${channelId} LIMIT 1`);
    const row = rows[0];
    const data = row?.logoData ?? row?.logodata;
    const contentTypeCol = row?.logoContentType ?? row?.logocontenttype;
    const buf = toBuffer(data);
    if (buf && buf.length > 0 && contentTypeCol) {
      request.log.info({ channelId, bytes: buf.length }, 'logos/akpa from DB');
      return reply
        .header('Cache-Control', 'public, max-age=86400')
        .type(String(contentTypeCol))
        .send(buf);
    }
    return reply.code(404).send({ error: 'Logo not found' });
  });
});

export default logosRoutes;
