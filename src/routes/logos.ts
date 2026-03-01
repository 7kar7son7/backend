import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';

import { env } from '../config/env';
import { AKPA_LOGOS_DEFAULTS } from '../config/akpa-logos-defaults';
import { fetchLogoFromAkpaFolder } from '../services/akpa-logo-fetcher';
import {
  loadAkpaLogoFolderMap,
  getCachedAkpaFolderList,
  findBestFolder,
  channelNameToFolderCandidate,
} from '../utils/akpa-logo-folders';

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
      name: ch?.name ?? null,
      akpaLogosConfigured: !!(baseUrl && user && password),
    });
  });

  /** GET /logos/akpa/:channelId – wyłącznie z bazy (Prisma: channels.logoData, channels.logoContentType po externalId). */
  app.get('/akpa/:channelId', async (request, reply) => {
    const channelId = (request.params as { channelId: string }).channelId;
    if (!channelId || !safeChannelId(channelId)) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }

    const channel = await app.prisma.channel.findUnique({
      where: { externalId: channelId },
      select: { logoData: true, logoContentType: true, name: true },
    });
    if (!channel) {
      request.log.debug({ channelId }, 'logos/akpa: channel not found');
      return reply.code(404).send({ error: 'Logo not found' });
    }
    let buf = toBuffer(channel.logoData);
    let contentType = channel.logoContentType != null ? String(channel.logoContentType).trim() : '';
    let source: 'prisma' | 'raw' = 'prisma';

    // Fallback: Prisma czasem nie zwraca Bytes (bytea) poprawnie na produkcji – odczyt przez raw SQL
    if (!buf || buf.length === 0 || !contentType) {
      const raw = await app.prisma.$queryRaw<Array<{ logoData: unknown; logoContentType: unknown }>>(
        Prisma.sql`SELECT "logoData", "logoContentType" FROM channels WHERE "externalId" = ${channelId} LIMIT 1`,
      );
      const row = raw[0];
      if (row) {
        const rawBuf = toBuffer(row.logoData);
        const rawCt = row.logoContentType != null ? String(row.logoContentType).trim() : '';
        if (rawBuf && rawBuf.length > 0 && rawCt) {
          buf = rawBuf;
          contentType = rawCt;
          source = 'raw';
        }
      }
    }

    if (buf && buf.length > 0 && contentType) {
      request.log.info({ channelId, bytes: buf.length, source }, 'logos/akpa from DB');
      return reply
        .header('Cache-Control', 'public, max-age=86400')
        .type(contentType)
        .send(buf);
    }

    // Fallback: zaloguj się na logotypy.akpa.pl (a) logotypy-tv, (b) nowe-logotypy – zwróć obraz, zapisz do bazy w tle
    const baseUrl = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? AKPA_LOGOS_DEFAULTS.BASE_URL).trim();
    const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? AKPA_LOGOS_DEFAULTS.USER).trim();
    const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? AKPA_LOGOS_DEFAULTS.PASSWORD).trim();
    const newBase = (env.AKPA_LOGOS_NEW_BASE_URL ?? process.env.AKPA_LOGOS_NEW_BASE_URL ?? AKPA_LOGOS_DEFAULTS.NEW_BASE_URL).trim().replace(/\/+$/, '');
    const newUser = (env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER ?? AKPA_LOGOS_DEFAULTS.NEW_USER).trim();
    const newPassword = (env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD ?? AKPA_LOGOS_DEFAULTS.NEW_PASSWORD).trim();
    const newAuth = newBase && newUser && newPassword ? 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64') : null;

    if ((baseUrl && user && password) && channel.name) {
      const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
      const folderMap = loadAkpaLogoFolderMap();
      const folderList = await getCachedAkpaFolderList(baseUrl, authHeader);
      const mappedFolder = folderMap[channelId];
      const runtimeFolder = folderList.length > 0 ? findBestFolder(channel.name, folderList) : null;
      const nameFolder = channelNameToFolderCandidate(channel.name);
      const folder = mappedFolder ?? runtimeFolder ?? nameFolder ?? null;
      if (folder) {
        let akpaResult = await fetchLogoFromAkpaFolder(baseUrl, authHeader, folder, (msg, meta) => {
          request.log.debug(meta ?? {}, msg);
        });
        if (!akpaResult && newAuth) {
          akpaResult = await fetchLogoFromAkpaFolder(newBase, newAuth, folder, (msg, meta) => {
            request.log.debug(meta ?? {}, msg);
          });
        }
        if (akpaResult?.body && akpaResult.body.length > 0) {
          request.log.info({ channelId, bytes: akpaResult.body.length }, 'logos/akpa from AKPA');
          app.prisma.channel
            .update({
              where: { externalId: channelId },
              data: { logoData: akpaResult.body, logoContentType: akpaResult.contentType },
            })
            .then(() => request.log.debug({ channelId }, 'logos/akpa: saved to DB'))
            .catch((err) => request.log.warn({ err, channelId }, 'logos/akpa: save to DB failed'));
          return reply
            .header('Cache-Control', 'public, max-age=86400')
            .type(akpaResult.contentType)
            .send(akpaResult.body);
        }
      }
    }

    request.log.debug({ channelId, hasLogoData: !!channel.logoData }, 'logos/akpa: no logo in DB');
    return reply.code(404).send({ error: 'Logo not found' });
  });
});

export default logosRoutes;
