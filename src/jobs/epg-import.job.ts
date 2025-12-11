import cron, { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';

import { env } from '../config/env';
import { runConfiguredGrab } from '../services/epg-grab.service';
import {
  importIptvOrgEpg,
  pruneDisallowedChannels,
} from '../services/iptv-org-importer';

export function startEpgImportJob(app: FastifyInstance): ScheduledTask | null {
  const enabled = env.EPG_AUTO_IMPORT_ENABLED ?? false;
  if (!enabled) {
    app.log.info('EPG auto-import job disabled (EPG_AUTO_IMPORT_ENABLED=false).');
    return null;
  }

  const schedule = env.EPG_AUTO_IMPORT_SCHEDULE ?? '0 3 * * *';
  const timezone = env.EPG_AUTO_IMPORT_TIMEZONE ?? 'Europe/Warsaw';
  const runOnStart = env.EPG_AUTO_IMPORT_RUN_ON_START ?? false;

  app.log.info(
    `Scheduling IPTV-Org auto-import with cron "${schedule}" (timezone ${timezone}).`,
  );

  let isRunning = false;

  const task = cron.schedule(
    schedule,
    async () => {
      if (isRunning) {
        app.log.warn('EPG auto-import skipped: previous run still in progress.');
        return;
      }

      isRunning = true;
      try {
        app.log.info('EPG auto-import started.');
        try {
          await runConfiguredGrab(app.log);
        } catch (error) {
          app.log.error(error, 'Aktualizacja feedu (grab) nie powiodła się, kontynuuję import z istniejących danych.');
        }
        await pruneDisallowedChannels(app.prisma, app.log);
        await runSelectedImport(app);
        app.log.info('EPG auto-import finished successfully.');
      } catch (error) {
        app.log.error(error, 'EPG auto-import failed');
      } finally {
        isRunning = false;
      }
    },
    {
      timezone,
    },
  );

  if (runOnStart) {
    setImmediate(async () => {
      try {
        app.log.info('Running initial EPG import on startup.');
        try {
          await runConfiguredGrab(app.log);
        } catch (error) {
          app.log.error(error, 'Aktualizacja feedu (grab) na starcie nie powiodła się, używam bieżącego pliku.');
        }
        await pruneDisallowedChannels(app.prisma, app.log);
        await runSelectedImport(app);
        app.log.info('Initial EPG import finished successfully.');
      } catch (error) {
        app.log.error(
          {
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            errorName: error instanceof Error ? error.name : undefined,
          },
          'Initial EPG import failed',
        );
      }
    });
  }

  return task;
}

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
      verbose: false,
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
      verbose: false,
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

  throw new Error('Brak konfiguracji źródła EPG (EPG_SOURCE_URL / EPG_SOURCE_FILE).');
}
