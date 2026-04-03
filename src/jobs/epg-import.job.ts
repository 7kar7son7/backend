import cron, { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';

import { env } from '../config/env';
import { AKPA_LOGOS_DEFAULTS } from '../config/akpa-logos-defaults';
import { runConfiguredGrab } from '../services/epg-grab.service';
import {
  importIptvOrgEpg,
  pruneDisallowedChannels,
} from '../services/iptv-org-importer';
import { importAkpaEpg } from '../services/akpa-importer';
import { EpgImportService } from '../services/epg-import.service';
import { syncAkpaLogosToDb } from '../services/sync-akpa-logos-to-db.service';

type LogoSyncReason = 'startup' | 'cron' | 'http';

/** Po imporcie AKPA: w tle uzupełnia logoData (nowe kanały / brak w bazie). */
function scheduleAkpaLogoSyncAfterImport(app: FastifyInstance, reason: LogoSyncReason): void {
  const logosBase = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? AKPA_LOGOS_DEFAULTS.BASE_URL).trim();
  const logosUser = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? AKPA_LOGOS_DEFAULTS.USER).trim();
  const logosPassword = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? AKPA_LOGOS_DEFAULTS.PASSWORD).trim();
  if (!logosBase || !logosUser || !logosPassword) {
    app.log.warn(
      { reason },
      'AKPA_LOGOS_BASE_URL / USER / PASSWORD nie ustawione – sync logotypów do bazy pominięty. Ustaw na produkcji, żeby API zwracało więcej logo z bazy.',
    );
    return;
  }
  setImmediate(async () => {
    try {
      await syncAkpaLogosToDb(app.prisma, app.log);
    } catch (err) {
      app.log.warn({ err, reason }, 'Sync logotypów AKPA do bazy zakończony błędem');
    }
  });
}

/** Jeden import naraz (cron + start + HTTP) – zapobiega nakładaniu się i crashom przy równoległym imporcie. */
let epgImportCycleInProgress = false;

/**
 * Pełny cykl: (opcjonalnie grab) → import → prune (AKPA) → sync logo.
 * Używany przez cron, import po starcie oraz (w tle) POST /epg/trigger.
 */
export async function runEpgImportCycle(app: FastifyInstance, trigger: 'cron' | 'startup' | 'http'): Promise<void> {
  if (epgImportCycleInProgress) {
    app.log.warn({ trigger }, 'EPG import: pominięto – poprzedni cykl w toku');
    return;
  }

  const forceIptv = env.EPG_SOURCE === 'iptv' || process.env.EPG_SOURCE === 'iptv';
  const hasAkpaToken = !!(env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN);
  const useAkpa = hasAkpaToken && !forceIptv;

  epgImportCycleInProgress = true;
  const t0 = Date.now();
  try {
    app.log.info(
      { trigger, startedAt: new Date().toISOString(), source: useAkpa ? 'AKPA' : 'IPTV-Org' },
      'EPG import cycle started',
    );

    if (!useAkpa) {
      try {
        await runConfiguredGrab(app.log);
      } catch (error) {
        app.log.error(error, 'Aktualizacja feedu (grab) nie powiodła się, kontynuuję import z istniejących danych.');
      }
      await pruneDisallowedChannels(app.prisma, app.log);
    }

    await runSelectedImport(app);

    if (useAkpa) {
      const maxAgeDays = Math.max(
        1,
        Number.parseInt(env.EPG_PRUNE_MAX_AGE_DAYS ?? process.env.EPG_PRUNE_MAX_AGE_DAYS ?? '14', 10) || 14,
      );
      const epgService = new EpgImportService(app.prisma, app.log);
      await epgService.pruneOldPrograms(maxAgeDays);
      const logoReason: LogoSyncReason = trigger === 'startup' ? 'startup' : trigger === 'http' ? 'http' : 'cron';
      scheduleAkpaLogoSyncAfterImport(app, logoReason);
    }

    app.log.info(
      { trigger, finishedAt: new Date().toISOString(), durationMs: Date.now() - t0 },
      'EPG import cycle finished successfully',
    );
  } catch (error) {
    app.log.error({ err: error, trigger, durationMs: Date.now() - t0 }, 'EPG import cycle failed');
    throw error;
  } finally {
    epgImportCycleInProgress = false;
  }
}

export function startEpgImportJob(app: FastifyInstance): ScheduledTask | null {
  const forceIptv = env.EPG_SOURCE === 'iptv' || process.env.EPG_SOURCE === 'iptv';
  const hasAkpaToken = !!(env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN);
  const useAkpa = hasAkpaToken && !forceIptv;

  const enabled = env.EPG_AUTO_IMPORT_ENABLED ?? (useAkpa ? true : false);
  if (!enabled) {
    app.log.info('EPG auto-import job disabled (EPG_AUTO_IMPORT_ENABLED=false).');
    return null;
  }

  /** Co 4 h w Warszawie (wcześniej 6 h – częstsze odświeżanie gdy hosting restartuje kontenery i omija tick crona). */
  const schedule = env.EPG_AUTO_IMPORT_SCHEDULE ?? (useAkpa ? '0 */4 * * *' : '0 3 * * *');
  const timezone = env.EPG_AUTO_IMPORT_TIMEZONE ?? 'Europe/Warsaw';
  const runOnStart = env.EPG_AUTO_IMPORT_RUN_ON_START ?? (useAkpa ? true : false);

  app.log.info(
    {
      msg: `Scheduling EPG auto-import (${useAkpa ? 'AKPA' : 'IPTV-Org'})`,
      cron: schedule,
      timezone,
      note: 'Jeśli kontener często się restartuje, tick crona może nie wpaść w okno działania – ustaw EPG_HTTP_TRIGGER_SECRET i zewnętrzny cron na POST /epg/trigger.',
    },
    'EPG auto-import schedule',
  );

  const task = cron.schedule(
    schedule,
    async () => {
      try {
        app.log.info(
          { trigger: 'cron', schedule, timezone, firedAt: new Date().toISOString() },
          'EPG auto-import cron tick',
        );
        await runEpgImportCycle(app, 'cron');
      } catch {
        /* błąd już w runEpgImportCycle */
      }
    },
    {
      timezone,
    },
  );

  if (runOnStart) {
    const startDelayMs = 45 * 1000; // 45 s – pierwsze żądania API bez rywalizacji z importem
    setTimeout(async () => {
      try {
        app.log.info('Running initial EPG import on startup (after delay).');
        await runEpgImportCycle(app, 'startup');
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
    }, startDelayMs);
  }

  return task;
}

async function runSelectedImport(app: FastifyInstance) {
  const forceIptv = env.EPG_SOURCE === 'iptv' || process.env.EPG_SOURCE === 'iptv';
  const hasAkpaToken = !!(env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN);
  const useAkpa = hasAkpaToken && !forceIptv;

  if (useAkpa) {
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

  if (hasAkpaToken) {
    throw new Error('Brak konfiguracji AKPA (sprawdź AKPA_API_TOKEN i AKPA_AUTH_TYPE).');
  }
  throw new Error('Brak konfiguracji źródła EPG (AKPA_API_TOKEN lub EPG_SOURCE_URL / EPG_SOURCE_FILE).');
}
