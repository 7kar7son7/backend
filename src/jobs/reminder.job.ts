import cron, { ScheduledTask } from 'node-cron';
import { EventStatus } from '@prisma/client';
import { FastifyInstance } from 'fastify';

import { NotificationService } from '../services/notification.service';
import { EventService } from '../services/event.service';

const REMINDER_SCHEDULE = '*/2 * * * *';
const MAX_REMINDERS_PER_EVENT = 2;
const MAX_REMINDERS_PER_DAY = 8;
const NIGHT_START = 22;
const NIGHT_END = 7;

export function startReminderJob(app: FastifyInstance): ScheduledTask {
  const notificationService = new NotificationService(app.prisma, app.log);
  const eventService = new EventService(app.prisma);

  const task = cron.schedule(
    REMINDER_SCHEDULE,
    async () => {
      const now = new Date();
      const currentHour = now.getHours();

      // Usunięto sendProgramStartingSoonReminder() - jest wywoływane przez event-notification.job.ts
      // aby uniknąć duplikatów powiadomień

      const activeEvents = await app.prisma.event.findMany({
        where: {
          status: EventStatus.PENDING,
          expiresAt: {
            gte: now,
          },
        },
        include: {
          program: {
            include: {
              channel: true,
            },
          },
          followers: {
            select: {
              id: true,
              deviceId: true,
            },
          },
          confirmations: true,
          reminders: true,
        },
      });

      for (const event of activeEvents) {
        const confirmedDeviceIds = new Set(
          event.confirmations.map((confirmation) => confirmation.deviceId),
        );

        for (const follower of event.followers) {
          if (confirmedDeviceIds.has(follower.deviceId)) {
            continue;
          }

          const remindersForEvent = event.reminders.filter(
            (reminder) => reminder.deviceId === follower.deviceId,
          );

          if (remindersForEvent.length >= MAX_REMINDERS_PER_EVENT) {
            continue;
          }

          const startOfDay = new Date(now);
          startOfDay.setHours(0, 0, 0, 0);

          const remindersToday = await app.prisma.reminderLog.count({
            where: {
              deviceId: follower.deviceId,
              sentAt: { gte: startOfDay },
            },
          });

          if (remindersToday >= MAX_REMINDERS_PER_DAY) {
            continue;
          }

          if (currentHour >= NIGHT_START || currentHour < NIGHT_END) {
            await eventService.registerReminder(
              event.id,
              follower.deviceId,
              remindersForEvent.length + 1,
              true,
            );
            continue;
          }

          try {
            await notificationService.sendReminderNotification(
              [follower.deviceId],
              {
                eventId: event.id,
                programId: event.programId,
                channelId: event.program.channelId,
                programTitle: event.program.title,
                startsAt: event.program.startsAt.toISOString(),
                channelName: event.program.channel?.name || null,
              },
              remindersForEvent.length + 1,
            );

            await eventService.registerReminder(
              event.id,
              follower.deviceId,
              remindersForEvent.length + 1,
              false,
            );
          } catch (error) {
            app.log.error(error, 'Failed to send reminder notification');
          }
        }
      }
    },
  );

  return task;
}

