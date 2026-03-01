import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifySensible from '@fastify/sensible';
import type { ScheduledTask } from 'node-cron';

import prismaPlugin from './plugins/prisma';
import { env } from './config/env';
import { registerRoutes } from './routes';
import { startReminderJob } from './jobs/reminder.job';
import { startEpgImportJob } from './jobs/epg-import.job';
import { startDailyReminderJob } from './jobs/daily-reminder.job';
import { startProgramStartReminderJob } from './jobs/event-notification.job';

export async function buildApp(): Promise<FastifyInstance> {
  const loggerOptions: FastifyServerOptions['logger'] =
    env.NODE_ENV === 'development'
      ? {
          level: env.LOG_LEVEL ?? 'debug',
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            },
          },
        }
      : {
          level: env.LOG_LEVEL ?? 'info',
        };

  const app = Fastify({
    logger: loggerOptions,
    forceCloseConnections: true,
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await app.register(fastifySensible);
  await app.register(prismaPlugin);

  let reminderTask: ScheduledTask | null = null;
  let epgImportTask: ScheduledTask | null = null;
  let dailyReminderTask: { stop: () => void } | null = null;
  let startSoonTask: ScheduledTask | null = null;

  app.addHook('onReady', async () => {
    reminderTask = startReminderJob(app);
    if (reminderTask) {
      app.log.info('Reminder job started');
    }

    epgImportTask = startEpgImportJob(app);
    if (epgImportTask) {
      app.log.info('EPG auto-import job scheduled');
    }

    dailyReminderTask = startDailyReminderJob(app);
    if (dailyReminderTask) {
      app.log.info('Daily reminder job scheduled');
    }

    startSoonTask = startProgramStartReminderJob(app);
    app.log.info('Program start reminder job scheduled');
  });

  app.addHook('onClose', async () => {
    if (reminderTask) {
      reminderTask.stop();
      app.log.info('Reminder job stopped');
    }
    if (epgImportTask) {
      epgImportTask.stop();
      app.log.info('EPG auto-import job stopped');
    }
    if (dailyReminderTask) {
      dailyReminderTask.stop();
      app.log.info('Daily reminder job stopped');
    }
    if (startSoonTask) {
      startSoonTask.stop();
      app.log.info('Program start reminder job stopped');
    }
  });

  await registerRoutes(app);

  return app;
}

