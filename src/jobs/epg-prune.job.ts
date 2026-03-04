import cron, { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';

import { env } from '../config/env';
import { EpgImportService } from '../services/epg-import.service';

/** Codzienny cron: usuwa programy EPG zakończone starsze niż EPG_PRUNE_MAX_AGE_DAYS (domyślnie 14). Zgodność z umową/licencją. */
export function startEpgPruneJob(app: FastifyInstance): ScheduledTask | null {
  const schedule = '0 4 * * *';
  const timezone = env.EPG_AUTO_IMPORT_TIMEZONE ?? 'Europe/Warsaw';
  const maxAgeDays = Math.max(
    1,
    Number.parseInt(env.EPG_PRUNE_MAX_AGE_DAYS ?? '14', 10) || 14,
  );

  app.log.info(
    { schedule, timezone, maxAgeDays },
    'EPG prune job scheduled (daily cleanup of programs older than maxAgeDays)',
  );

  const task = cron.schedule(
    schedule,
    async () => {
      try {
        const epgService = new EpgImportService(app.prisma, app.log);
        await epgService.pruneOldPrograms(maxAgeDays);
      } catch (error) {
        app.log.error(error, 'EPG daily prune failed');
      }
    },
    { timezone },
  );

  return task;
}
