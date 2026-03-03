import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

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

const epgRoutes = fp(async (app: FastifyInstance) => {
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


