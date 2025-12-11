import cron, { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';

import { NotificationService } from '../services/notification.service';

const START_SOON_SCHEDULE = '*/1 * * * *';

export function startProgramStartReminderJob(app: FastifyInstance): ScheduledTask {
  const notificationService = new NotificationService(app.prisma, app.log);

  const task = cron.schedule(START_SOON_SCHEDULE, async () => {
    try {
      await notificationService.sendProgramStartingSoonReminder();
    } catch (error) {
      app.log.error(error, 'Failed to send program start reminder');
    }
  });

  return task;
}
