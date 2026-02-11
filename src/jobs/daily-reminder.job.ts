import cron, { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';

import { env } from '../config/env';
import { NotificationService } from '../services/notification.service';

export function startDailyReminderJob(app: FastifyInstance): ScheduledTask | null {
  // Codzienne przypomnienie powinno działać niezależnie od EPG_AUTO_IMPORT_ENABLED
  // Używamy osobnej zmiennej lub domyślnie włączamy
  const enabled = env.DAILY_REMINDER_ENABLED ?? true; // Domyślnie włączone
  const schedule = env.DAILY_REMINDER_SCHEDULE ?? '0 18 * * *'; // 18:00 przed prime time
  const timezone = env.EPG_AUTO_IMPORT_TIMEZONE ?? 'Europe/Warsaw';

  if (!enabled) {
    app.log.info('Daily reminder job disabled.');
    return null;
  }

  const notificationService = new NotificationService(app.prisma, app.log);

  const task = cron.schedule(
    schedule,
    async () => {
      const triggerTime = new Date();
      const triggerTimeLocal = new Date(triggerTime.toLocaleString('en-US', { timeZone: timezone }));
      app.log.info(
        { 
          schedule, 
          timezone, 
          triggerTimeUTC: triggerTime.toISOString(),
          triggerTimeLocal: triggerTimeLocal.toISOString(),
          triggerTimeLocalString: triggerTime.toLocaleString('pl-PL', { timeZone: timezone }),
        },
        'Daily reminder job triggered',
      );
      try {
        const beforeSend = new Date();
        await notificationService.sendDailyReminder();
        const afterSend = new Date();
        const sendDuration = afterSend.getTime() - beforeSend.getTime();
        app.log.info(
          { 
            sentAt: afterSend.toISOString(),
            sentAtLocal: afterSend.toLocaleString('pl-PL', { timeZone: timezone }),
            sendDurationMs: sendDuration,
            triggerToSendDelayMs: afterSend.getTime() - triggerTime.getTime(),
          },
          'Daily reminder sent successfully',
        );
      } catch (error) {
        app.log.error(error, 'Daily reminder failed');
      }
    },
    {
      timezone,
    },
  );
  
  app.log.info(
    { schedule, timezone, enabled },
    'Daily reminder job scheduled',
  );

  return task;
}
