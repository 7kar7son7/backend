import cron, { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';

import { env } from '../config/env';
import { NotificationService } from '../services/notification.service';

export function startDailyReminderJob(app: FastifyInstance): ScheduledTask | null {
  // Codzienne przypomnienie powinno działać niezależnie od EPG_AUTO_IMPORT_ENABLED
  // Używamy osobnej zmiennej lub domyślnie włączamy
  const enabled = env.DAILY_REMINDER_ENABLED ?? true; // Domyślnie włączone
  const schedule = env.DAILY_REMINDER_SCHEDULE ?? '0 11 * * *'; // 11:00 - zmienione z 18:00
  const timezone = env.EPG_AUTO_IMPORT_TIMEZONE ?? 'Europe/Warsaw';

  if (!enabled) {
    app.log.info('Daily reminder job disabled.');
    return null;
  }

  const notificationService = new NotificationService(app.prisma, app.log);
  
  // Flaga do zapobiegania nakładającym się wykonaniom
  let isRunning = false;

  const task = cron.schedule(
    schedule,
    async () => {
      // Zapobiegaj nakładającym się wykonaniom
      if (isRunning) {
        app.log.warn(
          { schedule, timezone },
          'Daily reminder job already running, skipping this execution',
        );
        return;
      }

      isRunning = true;
      const triggerTime = new Date();
      const triggerTimeLocal = new Date(triggerTime.toLocaleString('en-US', { timeZone: timezone }));
      
      // Oblicz opóźnienie od idealnego czasu (np. 11:00:00)
      // Parsuj harmonogram cron (minuta godzina dzień miesiąc dzień_tygodnia)
      const scheduleParts = schedule.split(' ');
      const expectedMinute = parseInt(scheduleParts[0] || '0');
      const expectedHour = parseInt(scheduleParts[1] || '11');
      
      // Pobierz aktualny czas w strefie czasowej joba
      const nowInTimezone = new Date(triggerTime.toLocaleString('en-US', { timeZone: timezone }));
      const expectedTime = new Date(triggerTime);
      expectedTime.setHours(expectedHour, expectedMinute, 0, 0);
      
      // Oblicz różnicę czasu w milisekundach
      const delayFromExpected = triggerTime.getTime() - expectedTime.getTime();
      
      app.log.info(
        { 
          schedule, 
          timezone, 
          triggerTimeUTC: triggerTime.toISOString(),
          triggerTimeLocal: triggerTimeLocal.toISOString(),
          triggerTimeLocalString: triggerTime.toLocaleString('pl-PL', { timeZone: timezone }),
          expectedTime: expectedTime.toISOString(),
          delayFromExpectedMs: delayFromExpected,
        },
        'Daily reminder job triggered',
      );
      
      try {
        const beforeSend = new Date();
        await notificationService.sendDailyReminder();
        const afterSend = new Date();
        const sendDuration = afterSend.getTime() - beforeSend.getTime();
        const totalDelay = afterSend.getTime() - triggerTime.getTime();
        
        app.log.info(
          { 
            sentAt: afterSend.toISOString(),
            sentAtLocal: afterSend.toLocaleString('pl-PL', { timeZone: timezone }),
            sendDurationMs: sendDuration,
            triggerToSendDelayMs: totalDelay,
            delayFromExpectedMs: delayFromExpected,
          },
          'Daily reminder sent successfully',
        );
        
        // Ostrzeżenie jeśli opóźnienie jest większe niż 1 minuta
        if (Math.abs(delayFromExpected) > 60000) {
          app.log.warn(
            { 
              delayFromExpectedMs: delayFromExpected,
              delayFromExpectedSeconds: Math.round(delayFromExpected / 1000),
            },
            'Daily reminder job triggered with significant delay from expected time',
          );
        }
      } catch (error) {
        app.log.error(error, 'Daily reminder failed');
      } finally {
        isRunning = false;
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
