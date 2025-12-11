import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { pruneDisallowedChannels } from '../services/iptv-org-importer';
import { importIptvOrgEpg } from '../services/iptv-org-importer';
import { env } from '../config/env';

async function runSelectedImport(app: FastifyInstance) {
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

  throw new Error('Brak konfiguracji źródła EPG (EPG_SOURCE_URL / EPG_SOURCE_FILE)');
}

const epgRoutes = fp(async (app: FastifyInstance) => {
  app.post('/import', async (request, reply) => {
    try {
      app.log.info('Manual EPG import started');
      
      // Prune disallowed channels first
      await pruneDisallowedChannels(app.prisma, app.log);
      
      // Run import
      await runSelectedImport(app);
      
      app.log.info('Manual EPG import finished successfully');
      
      return {
        success: true,
        message: 'EPG import completed successfully',
      };
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


