/**
 * Uzupełnia logoData w bazie dla kanałów AKPA, które go nie mają.
 * Wywoływane w tle po imporcie EPG (np. przy starcie), żeby logotypy wyświetlały się z bazy.
 */
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { env } from '../config/env';
import { fetchLogoFromAkpaFolder } from './akpa-logo-fetcher';
import {
  loadAkpaLogoFolderMap,
  getCachedAkpaFolderList,
  findBestFolder,
} from '../utils/akpa-logo-folders';

export async function syncAkpaLogosToDb(
  prisma: PrismaClient,
  logger: FastifyBaseLogger,
): Promise<{ synced: number; failed: number }> {
  const baseUrl = (
    env.AKPA_LOGOS_BASE_URL ??
    process.env.AKPA_LOGOS_BASE_URL ??
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? '').trim();
  const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? '').trim();

  if (!baseUrl || !user || !password) {
    logger.info(
      { hasBase: !!baseUrl, hasUser: !!user, hasPassword: !!password },
      'sync-akpa-logos: pominięto (brak AKPA_LOGOS_* w env)',
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
    logger.info('sync-akpa-logos: wszystkie kanały AKPA mają już logoData w bazie');
    return { synced: 0, failed: 0 };
  }

  logger.info({ count: channels.length }, 'sync-akpa-logos: uzupełniam logoData z AKPA');

  const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
  const folderList = await getCachedAkpaFolderList(baseUrl, authHeader);
  const folderMap = loadAkpaLogoFolderMap();

  const newBase = (
    env.AKPA_LOGOS_NEW_BASE_URL ??
    process.env.AKPA_LOGOS_NEW_BASE_URL ??
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  const newUser = (env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER ?? '').trim();
  const newPassword = (env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD ?? '').trim();
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
    const folder = mappedFolder ?? runtimeFolder ?? null;

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
