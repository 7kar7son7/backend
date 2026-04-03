import type { FastifyInstance } from 'fastify';

import { pruneDisallowedChannels } from '../services/iptv-org-importer';
import { importIptvOrgEpg } from '../services/iptv-org-importer';
import { importAkpaEpg } from '../services/akpa-importer';
import { env } from '../config/env';
import { runEpgImportCycle } from '../jobs/epg-import.job';

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

export default async function epgRoutes(app: FastifyInstance) {
  /**
   * Asynchroniczny import (202) – bez timeoutu reverse proxy. Ustaw EPG_HTTP_TRIGGER_SECRET
   * i wywołuj z cron-job.org / GitHub Actions co kilka godzin, jeśli hosting często restartuje Node.
   */
  app.post('/trigger', async (request, reply) => {
    const secret = env.EPG_HTTP_TRIGGER_SECRET;
    if (!secret) {
      return reply.code(503).send({
        success: false,
        error: 'EPG_HTTP_TRIGGER_SECRET is not configured',
      });
    }
    const raw = request.headers['x-epg-trigger-secret'];
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (!token || token !== secret) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    void Promise.resolve().then(async () => {
      try {
        await runEpgImportCycle(app, 'http');
      } catch {
        /* zalogowane w runEpgImportCycle */
      }
    });

    return reply.code(202).send({
      success: true,
      message: 'EPG import queued (runs in background)',
    });
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
}


