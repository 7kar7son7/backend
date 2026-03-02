/**
 * Uzupełnia logoData w bazie dla kanałów AKPA, które go nie mają.
 * Wywoływane w tle po imporcie EPG (np. przy starcie), żeby logotypy wyświetlały się z bazy.
 */
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { env } from '../config/env';
import { AKPA_LOGOS_DEFAULTS } from '../config/akpa-logos-defaults';
import { fetchLogoFromAkpaFolder } from './akpa-logo-fetcher';
import {
  loadAkpaLogoFolderMap,
  getCachedAkpaFolderList,
  findBestFolder,
  channelNameToFolderCandidate,
} from '../utils/akpa-logo-folders';

export async function syncAkpaLogosToDb(
  prisma: PrismaClient,
  logger: FastifyBaseLogger,
): Promise<{ synced: number; failed: number }> {
  const baseUrl = (
    env.AKPA_LOGOS_BASE_URL ??
    process.env.AKPA_LOGOS_BASE_URL ??
    AKPA_LOGOS_DEFAULTS.BASE_URL
  )
    .trim()
    .replace(/\/+$/, '');
  const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? AKPA_LOGOS_DEFAULTS.USER).trim();
  const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? AKPA_LOGOS_DEFAULTS.PASSWORD).trim();

  if (!baseUrl || !user || !password) {
    logger.warn(
      { hasBase: !!baseUrl, hasUser: !!user, hasPassword: !!password },
      'sync-akpa-logos: pominięto – brak AKPA_LOGOS_BASE_URL / USER / PASSWORD. Na produkcji ustaw te zmienne, żeby logotypy się wypełniły po imporcie EPG.',
    );
    return { synced: 0, failed: 0 };
  }

  const channels = await prisma.channel.findMany({
    where: {
      externalId: { startsWith: 'akpa_' },
      logoData: null,
    },
    select: { id: true, externalId: true, name: true },
  });

  if (channels.length === 0) {
    const total = await prisma.channel.count({ where: { externalId: { startsWith: 'akpa_' } } });
    logger.info(
      total === 0
        ? 'sync-akpa-logos: brak kanałów AKPA w bazie (sync po imporcie EPG uzupełni logotypy)'
        : 'sync-akpa-logos: wszystkie kanały AKPA mają już logoData w bazie',
    );
    return { synced: 0, failed: 0 };
  }

  logger.info({ count: channels.length }, 'sync-akpa-logos: uzupełniam logoData z AKPA');

  const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
  const folderList = await getCachedAkpaFolderList(baseUrl, authHeader);
  const folderMap = loadAkpaLogoFolderMap();

  const newBase = (
    env.AKPA_LOGOS_NEW_BASE_URL ??
    process.env.AKPA_LOGOS_NEW_BASE_URL ??
    AKPA_LOGOS_DEFAULTS.NEW_BASE_URL
  )
    .trim()
    .replace(/\/+$/, '');
  const newUser = (env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER ?? AKPA_LOGOS_DEFAULTS.NEW_USER).trim();
  const newPassword = (env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD ?? AKPA_LOGOS_DEFAULTS.NEW_PASSWORD).trim();
  const newAuth =
    newBase && newUser && newPassword
      ? 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64')
      : null;

  let synced = 0;
  let failed = 0;

  for (const ch of channels) {
    const mappedFolder = folderMap[ch.externalId];
    const runtimeFolder =
      folderList.length > 0 ? findBestFolder(ch.name, folderList) : null;
    const nameFolder = channelNameToFolderCandidate(ch.name);
    const folder = mappedFolder ?? runtimeFolder ?? nameFolder ?? null;

    if (!folder) {
      failed++;
      continue;
    }

    let result = await fetchLogoFromAkpaFolder(baseUrl, authHeader, folder, (msg, meta) => {
      logger.debug(meta ?? {}, msg);
    });
    if (!result && newAuth) {
      result = await fetchLogoFromAkpaFolder(newBase, newAuth, folder, (msg, meta) => {
        logger.debug(meta ?? {}, msg);
      });
    }

    if (result) {
      try {
        await prisma.channel.update({
          where: { id: ch.id },
          data: {
            logoUrl: `/logos/akpa/${ch.externalId}`,
            logoData: new Uint8Array(result.body),
            logoContentType: result.contentType,
          },
        });
        synced++;
        logger.info({ channelId: ch.externalId, name: ch.name }, 'sync-akpa-logos: zapisano do bazy');
      } catch (err) {
        logger.warn({ err, channelId: ch.externalId }, 'sync-akpa-logos: błąd zapisu');
        failed++;
      }
    } else {
      failed++;
    }
  }

  logger.info(
    { synced, failed, total: channels.length },
    'sync-akpa-logos: zakończono',
  );
  return { synced, failed };
}

/** Pobiera i zapisuje logo jednego kanału AKPA (fallback przy GET /logos/akpa/:id gdy brak logoData). */
export async function fetchAndSaveAkpaLogoForChannel(
  prisma: PrismaClient,
  logger: FastifyBaseLogger,
  externalId: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  const baseUrl = (
    env.AKPA_LOGOS_BASE_URL ??
    process.env.AKPA_LOGOS_BASE_URL ??
    AKPA_LOGOS_DEFAULTS.BASE_URL
  )
    .trim()
    .replace(/\/+$/, '');
  const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? AKPA_LOGOS_DEFAULTS.USER).trim();
  const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? AKPA_LOGOS_DEFAULTS.PASSWORD).trim();

  const baseHost = baseUrl ? new URL(baseUrl).host : '';
  logger.info(
    { externalId, baseHost, hasUser: !!user, hasPassword: !!password },
    '[fetchAndSaveAkpaLogo] start',
  );

  if (!baseUrl || !user || !password) {
    logger.warn(
      { hasBase: !!baseUrl, hasUser: !!user, hasPassword: !!password },
      '[fetchAndSaveAkpaLogo] brak AKPA_LOGOS_BASE_URL/USER/PASSWORD – ustaw na Railway',
    );
    return null;
  }

  const ch = await prisma.channel.findUnique({
    where: { externalId },
    select: { id: true, name: true },
  });
  if (!ch) {
    logger.warn({ externalId }, '[fetchAndSaveAkpaLogo] channel not found in DB');
    return null;
  }

  const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
  logger.info({ externalId }, '[fetchAndSaveAkpaLogo] getting folder list from AKPA...');
  const folderList = await getCachedAkpaFolderList(baseUrl, authHeader);
  logger.info(
    { externalId, folderListLength: folderList.length },
    folderList.length === 0
      ? '[fetchAndSaveAkpaLogo] folder list PUSTA (listowanie logotypy.akpa.pl zwróciło [] – 401? 404?)'
      : '[fetchAndSaveAkpaLogo] folder list OK',
  );

  const folderMap = loadAkpaLogoFolderMap();
  const mapSize = Object.keys(folderMap).length;
  const mappedFolder = folderMap[externalId];
  const runtimeFolder = folderList.length > 0 ? findBestFolder(ch.name, folderList) : null;
  const nameFolder = channelNameToFolderCandidate(ch.name);
  const folder = mappedFolder ?? runtimeFolder ?? nameFolder ?? null;
  const folderSource = mappedFolder ? 'map' : runtimeFolder ? 'runtime' : nameFolder ? 'name' : 'none';
  logger.info(
    { externalId, folderMapSize: mapSize, mappedFolder: !!mappedFolder, folder, folderSource },
    '[fetchAndSaveAkpaLogo] folder resolved',
  );

  if (!folder) {
    logger.warn(
      { externalId, channelName: ch.name, hasMappedFolder: !!mappedFolder, folderListLength: folderList.length },
      '[fetchAndSaveAkpaLogo] no folder – brak w mapie i listowanie puste',
    );
    return null;
  }

  const logAkpaStatus = (msg: string, meta?: Record<string, unknown>) => {
    const status = meta?.status as number | undefined;
    const err = meta?.error;
    if (typeof status === 'number' && (status >= 400 || status < 200)) {
      logger.warn({ ...meta, externalId, folder }, `[fetchAndSaveAkpaLogo] ${msg} status=${status}`);
    } else if (err) {
      logger.warn({ ...meta, externalId, folder }, `[fetchAndSaveAkpaLogo] ${msg} error=${String(err)}`);
    } else {
      logger.info(meta ?? {}, `[fetchAndSaveAkpaLogo] ${msg}`);
    }
  };
  logger.info({ externalId, folder, baseHost }, '[fetchAndSaveAkpaLogo] fetch logo from main URL...');
  let result = await fetchLogoFromAkpaFolder(baseUrl, authHeader, folder, logAkpaStatus);
  if (!result) {
    logger.info({ externalId, folder }, '[fetchAndSaveAkpaLogo] main URL null, trying NEW_BASE');
    const newBase = (
      env.AKPA_LOGOS_NEW_BASE_URL ??
      process.env.AKPA_LOGOS_NEW_BASE_URL ??
      AKPA_LOGOS_DEFAULTS.NEW_BASE_URL
    )
      .trim()
      .replace(/\/+$/, '');
    const newUser = (env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER ?? AKPA_LOGOS_DEFAULTS.NEW_USER).trim();
    const newPassword = (env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD ?? AKPA_LOGOS_DEFAULTS.NEW_PASSWORD).trim();
    if (newBase && newUser && newPassword) {
      const newAuth = 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64');
      result = await fetchLogoFromAkpaFolder(newBase, newAuth, folder, logAkpaStatus);
    }
  }
  if (!result) {
    logger.warn(
      { externalId, folder, baseHost },
      '[fetchAndSaveAkpaLogo] NULL – nie udało się pobrać (sprawdź wyżej: status 401/404? timeout?)',
    );
    return null;
  }

  logger.info({ externalId, folder, bodyLength: result.body?.length }, '[fetchAndSaveAkpaLogo] OK – zwracam logo');
  const body = Buffer.isBuffer(result.body) ? result.body : Buffer.from(result.body);
  setImmediate(() => {
    prisma.channel
      .update({
        where: { id: ch.id },
        data: {
          logoUrl: `/logos/akpa/${externalId}`,
          logoData: new Uint8Array(body),
          logoContentType: result.contentType,
        },
      })
      .then(() => logger.info({ externalId }, '[fetchAndSaveAkpaLogo] zapisano do bazy'))
      .catch((err) => logger.warn({ err, externalId }, '[fetchAndSaveAkpaLogo] błąd zapisu do bazy'));
  });
  return { body, contentType: result.contentType };
}
