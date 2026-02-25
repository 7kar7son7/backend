import type { FastifyInstance } from 'fastify';
import { DateTime } from 'luxon';

import { env } from '../config/env';
import { NotificationService } from '../services/notification.service';

/** Timer handle so we can clear on app close */
let dailyReminderTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Oblicza następny moment 18:00:00.000 w Europe/Warsaw (lub godzina z harmonogramu).
 * Zwraca [DateTime, delayMs]. Jeśli już po 18:00 dziś, zwraca jutro 18:00.
 */
function getNextRun(zone: string, hour: number, minute: number): { at: DateTime; delayMs: number } {
  const now = DateTime.now().setZone(zone);
  let next = now.set({ hour, minute, second: 0, millisecond: 0 });
  if (next <= now) {
    next = next.plus({ days: 1 });
  }
  const delayMs = Math.max(0, next.toMillis() - now.toMillis());
  return { at: next, delayMs };
}

export function startDailyReminderJob(app: FastifyInstance): { stop: () => void } | null {
  const enabled = env.DAILY_REMINDER_ENABLED ?? true;
  const schedule = env.DAILY_REMINDER_SCHEDULE ?? '0 18 * * *';
  const timezone = env.EPG_AUTO_IMPORT_TIMEZONE ?? 'Europe/Warsaw';

  const scheduleParts = schedule.split(' ');
  const expectedMinute = parseInt(scheduleParts[0] || '0', 10);
  const expectedHour = parseInt(scheduleParts[1] || '18', 10);

  if (!enabled) {
    app.log.info('Daily reminder job disabled.');
    return null;
  }

  const notificationService = new NotificationService(app.prisma, app.log);
  let isRunning = false;

  function runAndScheduleNext() {
    if (isRunning) {
      app.log.warn({ schedule, timezone }, 'Daily reminder already running, skipping');
      scheduleNext();
      return;
    }
    isRunning = true;
    const triggeredAt = DateTime.now().setZone(timezone);
    app.log.info(
      {
        schedule,
        timezone,
        triggeredAt: triggeredAt.toISO(),
        triggeredAtLocal: triggeredAt.toFormat('yyyy-MM-dd HH:mm:ss', { locale: 'pl' }),
      },
      'Daily reminder job triggered (exact-time scheduler)',
    );
    notificationService
      .sendDailyReminder()
      .then(() => {
        const afterSend = DateTime.now().setZone(timezone);
        app.log.info(
          {
            sentAt: afterSend.toISO(),
            sentAtLocal: afterSend.toFormat('yyyy-MM-dd HH:mm:ss', { locale: 'pl' }),
          },
          'Daily reminder sent successfully',
        );
      })
      .catch((err) => {
        app.log.error(err, 'Daily reminder failed');
      })
      .finally(() => {
        isRunning = false;
        scheduleNext();
      });
  }

  function scheduleNext() {
    const { at: nextRun, delayMs } = getNextRun(timezone, expectedHour, expectedMinute);
    dailyReminderTimeoutId = setTimeout(runAndScheduleNext, delayMs);
    app.log.info(
      {
        nextRunAt: nextRun.toISO(),
        nextRunLocal: nextRun.toFormat('yyyy-MM-dd HH:mm:ss', { locale: 'pl' }),
        delayMs,
        delayMinutes: Math.round(delayMs / 60000),
      },
      'Daily reminder next run scheduled',
    );
  }

  // Start: jeśli teraz jest przed 18:00 dziś, czekamy do 18:00; jeśli po 18:00, do jutro 18:00
  const { at: firstRun, delayMs } = getNextRun(timezone, expectedHour, expectedMinute);
  dailyReminderTimeoutId = setTimeout(runAndScheduleNext, delayMs);

  app.log.info(
    {
      schedule,
      timezone,
      enabled,
      firstRunAt: firstRun.toISO(),
      firstRunLocal: firstRun.toFormat('yyyy-MM-dd HH:mm:ss', { locale: 'pl' }),
      delayMs,
    },
    'Daily reminder job scheduled (exact time, no cron delay)',
  );

  return {
    stop() {
      if (dailyReminderTimeoutId !== null) {
        clearTimeout(dailyReminderTimeoutId);
        dailyReminderTimeoutId = null;
        app.log.info('Daily reminder job stopped');
      }
    },
  };
}
