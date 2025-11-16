import cron, { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';

import { env } from '../config/env';
import { NotificationService } from '../services/notification.service';

export function startDailyReminderJob(app: FastifyInstance): ScheduledTask | null {
  const enabled = env.EPG_AUTO_IMPORT_ENABLED ?? false;
  const schedule = env.DAILY_REMINDER_SCHEDULE ?? '0 11 * * *';
  const timezone = env.EPG_AUTO_IMPORT_TIMEZONE ?? 'Europe/Warsaw';

  if (!enabled) {
    app.log.info('Daily reminder job disabled.');
    return null;
  }

  const notificationService = new NotificationService(app.prisma, app.log);

  const task = cron.schedule(
    schedule,
    async () => {
      try {
        await notificationService.sendDailyReminder();
        app.log.info('Daily reminder sent.');
      } catch (error) {
        app.log.error(error, 'Daily reminder failed');
      }
    },
    {
      timezone,
    },
  );

  return task;
}
