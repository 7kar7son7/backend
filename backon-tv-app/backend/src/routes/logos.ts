import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { fetchLogoFromAkpaFolder } from '../services/akpa-logo-fetcher';
import { env } from '../config/env';
import {
  loadAkpaLogoFolderMap,
  getCachedAkpaFolderList,
  findBestFolder,
} from '../utils/akpa-logo-folders';

const STATIC_LOGOS_DIR = join(process.cwd(), 'static', 'logos', 'akpa');
const EXTENSIONS = ['png', 'jpg', 'jpeg', 'svg'];
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

function safeChannelId(id: string): boolean {
  return /^akpa_[a-zA-Z0-9_]+$/.test(id) && id.length <= 128;
}

/** Warianty nazwy folderu na logotypy.akpa.pl – foldery to np. "13 ulica", "4fun dance". */
function logoSlugCandidates(name: string): string[] {
  const t = name.trim();
  if (!t) return [];
  const lower = t.toLowerCase();
  const noSpace = t.replace(/\s+/g, '');
  const lowerNoSpace = lower.replace(/\s+/g, '');
  const withHyphen = lower.replace(/\s+/g, '-');
  const withUnderscore = lower.replace(/\s+/g, '_');
  const list = [lower, t, lowerNoSpace, withHyphen, withUnderscore, noSpace];
  if (lower === 'dizi') list.push('novelas+');
  return list.filter((s, i, arr) => s && arr.indexOf(s) === i);
}

const logosRoutes = fp(async (app: FastifyInstance) => {
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
    return reply.send({
      channelId,
      channelFound: !!ch,
      hasLogoData: hasData,
      hasContentType: !!(ch?.logoContentType),
      logoDataLength: len,
      name: ch?.name ?? null,
    });
  });

  app.get('/akpa/:channelId', async (request, reply) => {
    const channelId = (request.params as { channelId: string }).channelId;
    if (!channelId || !safeChannelId(channelId)) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }

    // 1. Najpierw baza – logotypy mają się wyświetlać z bazy (logoData)
    const channel = await app.prisma.channel.findUnique({
      where: { externalId: channelId },
      select: { name: true, logoData: true, logoContentType: true },
    });
    if (channel?.logoData != null && channel.logoContentType) {
      const body =
        Buffer.isBuffer(channel.logoData)
          ? channel.logoData
          : Buffer.from(channel.logoData as ArrayBuffer | Uint8Array);
      request.log.info({ channelId, status: 200, from: 'DB' }, 'logos/akpa served from DB');
      return reply
        .header('Cache-Control', 'public, max-age=86400')
        .type(channel.logoContentType)
        .send(body);
    }
    if (channel && (channel.logoData == null || !channel.logoContentType)) {
      request.log.info(
        { channelId, hasLogoData: false, hasContentType: !!channel.logoContentType },
        'logos/akpa channel in DB but no logoData – sprawdź migrację i redeploy',
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
      request.log.info({ channelId, status: 404 }, 'logos/akpa channel not in DB');
      return reply.code(404).send({ error: 'Logo not found' });
    }
    request.log.debug(
      { channelId },
      'logos/akpa channel in DB but no logoData – ustaw AKPA_LOGOS_* i zrestartuj (sync w tle) lub uruchom npm run logos:download:akpa',
    );
    if (!channel.name) {
      request.log.info({ channelId, status: 404 }, 'logos/akpa channel has no name');
      return reply.code(404).send({ error: 'Logo not found' });
    }

    const baseUrl = (
      env.AKPA_LOGOS_BASE_URL ??
      process.env.AKPA_LOGOS_BASE_URL ??
      ''
    ).trim().replace(/\/+$/, '');
    const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? '').trim();
    const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? '').trim();
    const folderMap = loadAkpaLogoFolderMap();
    const mappedFolder = folderMap[channelId];
    let slugs = logoSlugCandidates(channel.name);
    if (baseUrl && user && password) {
      const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
      const folderList = await getCachedAkpaFolderList(baseUrl, authHeader);
      const runtimeFolder = folderList.length > 0 ? findBestFolder(channel.name, folderList) : null;
      const firstFolders = [mappedFolder, runtimeFolder].filter(Boolean) as string[];
      slugs = [...new Set([...firstFolders, ...slugs])];
      request.log.info(
        {
          channelId,
          channelName: channel.name,
          mappedFolder: mappedFolder ?? null,
          runtimeFolder: runtimeFolder ?? null,
          slugsCount: slugs.length,
        },
        'logos/akpa trying AKPA (primary)',
      );
      for (const slug of slugs) {
        const result = await fetchLogoFromAkpaFolder(baseUrl, authHeader, slug, (msg, meta) => {
          request.log.info(meta ?? {}, msg);
        });
        if (result) {
          request.log.info({ channelId, status: 200 }, 'logos/akpa served from AKPA (primary)');
          return reply
            .header('Cache-Control', 'public, max-age=86400')
            .type(result.contentType)
            .send(result.body);
        }
      }
      request.log.info(
        { channelId, channelName: channel.name, triedSlugs: slugs },
        'logos/akpa AKPA (primary) all slugs failed',
      );
    } else {
      request.log.info(
        { channelId, hasBase: !!baseUrl, hasUser: !!user, hasPassword: !!password },
        'logos/akpa AKPA (primary) not configured',
      );
    }

    const newBase = (
      env.AKPA_LOGOS_NEW_BASE_URL ??
      process.env.AKPA_LOGOS_NEW_BASE_URL ??
      ''
    ).trim().replace(/\/+$/, '');
    const newUser = (env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER ?? '').trim();
    const newPassword = (env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD ?? '').trim();
    if (newBase && newUser && newPassword) {
      const authHeader = 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64');
      for (const slug of slugs) {
        const result = await fetchLogoFromAkpaFolder(newBase, authHeader, slug, (msg, meta) => {
          request.log.info(meta ?? {}, msg);
        });
        if (result) {
          request.log.info({ channelId, status: 200 }, 'logos/akpa served from AKPA (new base)');
          return reply
            .header('Cache-Control', 'public, max-age=86400')
            .type(result.contentType)
            .send(result.body);
        }
      }
    }

    request.log.info({ channelId, status: 404 }, 'logos/akpa not found');
    return reply.code(404).send({ error: 'Logo not found' });
  });
});

export default logosRoutes;
