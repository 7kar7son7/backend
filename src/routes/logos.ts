import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';

import { fetchLogoFromAkpaFolder } from '../services/akpa-logo-fetcher';
import { env } from '../config/env';
import {
  loadAkpaLogoFolderMap,
  getCachedAkpaFolderList,
  findBestFolder,
  channelNameToFolderCandidate,
} from '../utils/akpa-logo-folders';

const STATIC_LOGOS_DIR = join(process.cwd(), 'static', 'logos', 'akpa');
const EXTENSIONS = ['png', 'jpg', 'jpeg', 'svg'];

// Domyślne dane do logotypy.akpa.pl (gdy na produkcji nie ustawiono env) – oficjalny dostęp AKPA
const DEFAULT_AKPA_LOGOS_BASE = 'https://logotypy.akpa.pl/logotypy-tv';
const DEFAULT_AKPA_LOGOS_USER = 'logotypy_tv';
const DEFAULT_AKPA_LOGOS_PASSWORD = 'logos_2024@';
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

function safeChannelId(id: string): boolean {
  return /^akpa_[a-zA-Z0-9_]+$/.test(id) && id.length <= 128;
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
      const raw = await app.prisma.$queryRaw<
        Array<{ logoData: Buffer | null; logoContentType: string | null }>
      >(Prisma.sql`SELECT "logoData", "logoContentType" FROM channels WHERE "externalId" = ${channelId} LIMIT 1`);
      const row = raw[0];
      if (row?.logoData != null) rawLogoDataLength = row.logoData.length;
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

  app.get('/akpa/:channelId', async (request, reply) => {
    const channelId = (request.params as { channelId: string }).channelId;
    if (!channelId || !safeChannelId(channelId)) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }

    // 1. Z bazy – raw SQL (BYTEA bywa zwracane jako Buffer, string hex z \x, lub Uint8Array)
    let logoBody: Buffer | null = null;
    let logoContentType: string | null = null;

    function toBuffer(data: unknown): Buffer | null {
      if (data == null) return null;
      if (Buffer.isBuffer(data)) return data;
      if (data instanceof Uint8Array) return Buffer.from(data);
      if (typeof data === 'string') {
        let hex = data;
        if (hex.startsWith('\u005Cx')) hex = hex.slice(2); // PostgreSQL bytea hex prefix \x
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

    const raw = await app.prisma.$queryRaw<
      Array<Record<string, unknown>>
    >(Prisma.sql`SELECT "logoData", "logoContentType" FROM channels WHERE "externalId" = ${channelId} LIMIT 1`);
    const row = raw[0];
    const data = row?.logoData ?? row?.logodata;
    const contentTypeCol = row?.logoContentType ?? row?.logocontenttype;
    const buf = toBuffer(data);
    if (buf && buf.length > 0 && contentTypeCol) {
      logoBody = buf;
      logoContentType = String(contentTypeCol);
      request.log.info({ channelId, bytes: logoBody.length }, 'logos/akpa served from DB (raw SQL)');
      return reply
        .header('Cache-Control', 'public, max-age=86400')
        .type(logoContentType)
        .send(logoBody);
    }


    const channel = await app.prisma.channel.findUnique({
      where: { externalId: channelId },
      select: { id: true, name: true, logoData: true, logoContentType: true },
    });
    if (channel?.logoData != null && channel.logoContentType && !logoBody) {
      const buf = toBuffer(channel.logoData);
      if (buf && buf.length > 0) {
        logoBody = buf;
        logoContentType = channel.logoContentType;
      }
    }
    if (logoBody && logoContentType) {
      request.log.info({ channelId, status: 200, from: 'DB' }, 'logos/akpa served from DB');
      return reply
        .header('Cache-Control', 'public, max-age=86400')
        .type(logoContentType)
        .send(logoBody);
    }
    if (channel && !logoBody) {
      request.log.warn(
        { channelId, reason: 'no_logoData_in_db' },
        'logos/akpa kanał w bazie bez logoData – ustaw AKPA_LOGOS_* na produkcji i zrestartuj (sync wypełni logoData po imporcie EPG)',
      );
    }

    // 2. Pliki statyczne (fallback)
    for (const ext of EXTENSIONS) {
      try {
        const filePath = join(STATIC_LOGOS_DIR, `${channelId}.${ext}`);
        const body = await readFile(filePath);
        const contentType = MIME[ext] ?? 'application/octet-stream';
        request.log.info({ channelId, status: 200 }, 'logos/akpa served from static');
        return reply.header('Cache-Control', 'public, max-age=86400').type(contentType).send(body);
      } catch {
        continue;
      }
    }

    if (!channel) {
      request.log.warn(
        { channelId, status: 404, reason: 'channel_not_in_db' },
        'logos/akpa 404 – kanał nie w bazie (uruchom import EPG)',
      );
      return reply.code(404).send({ error: 'Logo not found' });
    }

    // 3. Fallback: pobierz z AKPA (logotypy.akpa.pl), zwróć i zapisz do bazy w tle
    const baseUrl = (
      env.AKPA_LOGOS_BASE_URL ??
      process.env.AKPA_LOGOS_BASE_URL ??
      DEFAULT_AKPA_LOGOS_BASE
    ).trim().replace(/\/+$/, '');
    const user = (
      env.AKPA_LOGOS_USER ??
      process.env.AKPA_LOGOS_USER ??
      DEFAULT_AKPA_LOGOS_USER
    ).trim();
    const password = (
      env.AKPA_LOGOS_PASSWORD ??
      process.env.AKPA_LOGOS_PASSWORD ??
      DEFAULT_AKPA_LOGOS_PASSWORD
    ).trim();
    if (baseUrl && user && password) {
      const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
      const folderMap = loadAkpaLogoFolderMap();
      const folderList = await getCachedAkpaFolderList(baseUrl, authHeader);
      const mappedFolder = folderMap[channelId];
      const runtimeFolder = folderList.length > 0 ? findBestFolder(channel.name, folderList) : null;
      const nameFolder = channelNameToFolderCandidate(channel.name);
      const folder = mappedFolder ?? runtimeFolder ?? nameFolder ?? null;
      if (folder) {
        let result = await fetchLogoFromAkpaFolder(baseUrl, authHeader, folder, (msg, meta) => {
          request.log.debug(meta ?? {}, msg);
        });
        if (!result) {
          const newBase = (
            env.AKPA_LOGOS_NEW_BASE_URL ??
            process.env.AKPA_LOGOS_NEW_BASE_URL ??
            ''
          ).trim().replace(/\/+$/, '');
          const newUser = (env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER ?? '').trim();
          const newPassword = (env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD ?? '').trim();
          if (newBase && newUser && newPassword) {
            const newAuth = 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64');
            result = await fetchLogoFromAkpaFolder(newBase, newAuth, folder, (msg, meta) => {
              request.log.debug(meta ?? {}, msg);
            });
          }
        }
        if (result) {
          request.log.info({ channelId, from: 'AKPA' }, 'logos/akpa served from AKPA (fallback)');
          setImmediate(() => {
            app.prisma.channel
              .update({
                where: { id: channel.id },
                data: {
                  logoUrl: `/logos/akpa/${channelId}`,
                  logoData: new Uint8Array(result!.body),
                  logoContentType: result!.contentType,
                },
              })
              .then(() => request.log.info({ channelId }, 'logos/akpa saved to DB'))
              .catch((err) => request.log.warn({ err, channelId }, 'logos/akpa save to DB failed'));
          });
          return reply
            .header('Cache-Control', 'public, max-age=86400')
            .type(result.contentType)
            .send(result.body);
        }
      }
    }

    request.log.warn(
      { channelId, status: 404, reason: 'no_logoData_in_db_and_akpa_fallback_failed' },
      'logos/akpa 404 – brak logo w bazie i nie udało się pobrać z AKPA (logotypy.akpa.pl)',
    );
    return reply.code(404).send({ error: 'Logo not found' });
  });
});

export default logosRoutes;
