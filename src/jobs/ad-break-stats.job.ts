import cron, { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';

import { getAdBreakStatsService } from '../services/ad-break-stats.service';

export function startAdBreakStatsJob(app: FastifyInstance): ScheduledTask {
  const service = getAdBreakStatsService(app.prisma);

  void service.refresh().catch((error) => {
    app.log.error(error, 'Ad-break stats initial refresh failed');
  });

  return cron.schedule(
    '*/30 * * * *',
    () => {
      void service.refresh().catch((error) => {
        app.log.error(error, 'Ad-break stats refresh failed');
      });
    },
    { timezone: 'Europe/Warsaw' },
  );
}
