import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { fetchLogoFromAkpaFolder } from '../services/akpa-logo-fetcher';
import { env } from '../config/env';

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

function logoSlugCandidates(name: string): string[] {
  const t = name.trim();
  if (!t) return [];
  const lower = t.toLowerCase();
  const noSpace = t.replace(/\s+/g, '');
  const lowerNoSpace = lower.replace(/\s+/g, '');
  const list = [lower, lowerNoSpace, t, noSpace, lowerNoSpace];
  if (lower === 'dizi') list.push('novelas+');
  return list.filter((s, i, arr) => s && arr.indexOf(s) === i);
}

const logosRoutes = fp(async (app: FastifyInstance) => {
  app.get('/akpa/:channelId', async (request, reply) => {
    const channelId = (request.params as { channelId: string }).channelId;
    if (!channelId || !safeChannelId(channelId)) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }
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

    const channel = await app.prisma.channel.findUnique({
      where: { externalId: channelId },
      select: { name: true, logoData: true, logoContentType: true },
    });
    if (!channel) {
      request.log.info({ channelId, status: 404 }, 'logos/akpa channel not in DB');
      return reply.code(404).send({ error: 'Logo not found' });
    }

    if (channel.logoData && channel.logoData.length > 0) {
      const contentType = channel.logoContentType ?? 'image/png';
      request.log.info({ channelId, status: 200 }, 'logos/akpa served from DB');
      return reply
        .header('Cache-Control', 'public, max-age=86400')
        .type(contentType)
        .send(Buffer.from(channel.logoData));
    }

    if (!channel.name) {
      request.log.info({ channelId, status: 404 }, 'logos/akpa no name for AKPA fallback');
      return reply.code(404).send({ error: 'Logo not found' });
    }

    const baseUrl = (
      env.AKPA_LOGOS_BASE_URL ??
      process.env.AKPA_LOGOS_BASE_URL ??
      ''
    ).trim().replace(/\/+$/, '');
    const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? '').trim();
    const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? '').trim();
    if (baseUrl && user && password) {
      const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
      for (const slug of logoSlugCandidates(channel.name)) {
        const result = await fetchLogoFromAkpaFolder(baseUrl, authHeader, slug);
        if (result) {
          request.log.info({ channelId, status: 200 }, 'logos/akpa served from AKPA (primary)');
          return reply
            .header('Cache-Control', 'public, max-age=86400')
            .type(result.contentType)
            .send(result.body);
        }
      }
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
      for (const slug of logoSlugCandidates(channel.name)) {
        const result = await fetchLogoFromAkpaFolder(newBase, authHeader, slug);
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
