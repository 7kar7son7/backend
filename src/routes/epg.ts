import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { fetch } from 'undici';

import { pruneDisallowedChannels } from '../services/iptv-org-importer';
import { importIptvOrgEpg } from '../services/iptv-org-importer';
import { importAkpaEpg } from '../services/akpa-importer';
import { env } from '../config/env';

async function runSelectedImport(app: FastifyInstance) {
  const forceIptv = env.EPG_SOURCE === 'iptv' || process.env.EPG_SOURCE === 'iptv';
  const hasAkpaToken = !!(env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN);
  const useAkpa = hasAkpaToken && !forceIptv;

  if (useAkpa) {
    app.log.info('Import EPG ze źródła AKPA.');
    await importAkpaEpg(app.prisma, app.log);
    return;
  }

  const rawSelected = env.IPTV_ORG_SELECTED_IDS ?? '';
  const selected = rawSelected
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (selected.length > 0) {
    app.log.info(
      { count: selected.length },
      'Importuję tylko kanały z listy IPTV_ORG_SELECTED_IDS.',
    );
    const options: Parameters<typeof importIptvOrgEpg>[2] = {
      verbose: true,
      channelIds: selected,
    };
    if (env.EPG_SOURCE_URL) {
      options.url = env.EPG_SOURCE_URL;
    }
    if (env.EPG_SOURCE_FILE ?? process.env.EPG_SOURCE_FILE) {
      options.file = env.EPG_SOURCE_FILE ?? process.env.EPG_SOURCE_FILE!;
    }
    await importIptvOrgEpg(app.prisma, app.log, options);
    return;
  }

  if (env.EPG_SOURCE_URL || env.EPG_SOURCE_FILE || process.env.EPG_SOURCE_FILE) {
    const options: Parameters<typeof importIptvOrgEpg>[2] = {
      verbose: true,
    };
    if (env.EPG_SOURCE_URL) {
      options.url = env.EPG_SOURCE_URL;
    }
    if (env.EPG_SOURCE_FILE ?? process.env.EPG_SOURCE_FILE) {
      options.file = env.EPG_SOURCE_FILE ?? process.env.EPG_SOURCE_FILE!;
    }
    await importIptvOrgEpg(app.prisma, app.log, options);
    return;
  }

  if (hasAkpaToken) {
    throw new Error('Brak konfiguracji AKPA (sprawdź AKPA_API_TOKEN i AKPA_AUTH_TYPE).');
  }
  throw new Error('Brak konfiguracji źródła EPG (AKPA_API_TOKEN lub EPG_SOURCE_URL / EPG_SOURCE_FILE).');
}

const AKPA_LOGO_FILES = ['logo.png', 'logo.jpg', 'logo.jpeg', 'image.png', 'image.jpg', 'logo.svg'];

async function fetchLogoFromBase(
  baseUrl: string,
  authHeader: string,
  pathSegment: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  for (const fileName of AKPA_LOGO_FILES) {
    const url = `${baseUrl}/${pathSegment}/${fileName}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: { Authorization: authHeader } });
      if (res.ok && res.body) {
        const buf = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') ?? (fileName.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
        return { body: buf, contentType };
      }
    } catch {
      continue;
    }
  }
  return null;
}

const epgRoutes = fp(async (app: FastifyInstance) => {
  app.get('/logos/akpa/:slug', async (request, reply) => {
    const slug = (request.params as { slug: string }).slug;
    if (!slug) return reply.code(400).send({ error: 'Missing slug' });

    const baseUrl = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? '').replace(/\/+$/, '');
    const user = env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER;
    const password = env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD;
    const pathSegment = decodeURIComponent(slug);

    if (baseUrl && user && password) {
      const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
      const result = await fetchLogoFromBase(baseUrl, authHeader, pathSegment);
      if (result) {
        return reply.header('Cache-Control', 'public, max-age=86400').type(result.contentType).send(result.body);
      }
    }

    const newBase = (env.AKPA_LOGOS_NEW_BASE_URL ?? process.env.AKPA_LOGOS_NEW_BASE_URL ?? '').replace(/\/+$/, '');
    const newUser = env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER;
    const newPassword = env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD;
    if (newBase && newUser && newPassword) {
      const authHeader = 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64');
      const result = await fetchLogoFromBase(newBase, authHeader, pathSegment);
      if (result) {
        return reply.header('Cache-Control', 'public, max-age=86400').type(result.contentType).send(result.body);
      }
    }

    return reply.code(404).send({ error: 'Logo not found' });
  });

  app.post('/import', async (request, reply) => {
    try {
      app.log.info('Manual EPG import started');
      const forceIptv = env.EPG_SOURCE === 'iptv' || process.env.EPG_SOURCE === 'iptv';
      const hasAkpaToken = !!(env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN);
      const useAkpa = hasAkpaToken && !forceIptv;
      if (!useAkpa) {
        await pruneDisallowedChannels(app.prisma, app.log);
      }
      await runSelectedImport(app);
      app.log.info('Manual EPG import finished successfully');
      return { success: true, message: 'EPG import completed successfully' };
    } catch (error) {
      app.log.error(error, 'Manual EPG import failed');
      return reply.code(500).send({
        success: false,
        error: 'EPG import failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
});

export default epgRoutes;


