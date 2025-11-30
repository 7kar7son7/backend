import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

import { env } from '../config/env';
import { PushNotificationService } from './push-notification.service';

export class NotificationService {
  constructor(private readonly prisma: PrismaClient, private readonly logger: FastifyBaseLogger) {
    this.pushNotification = new PushNotificationService(prisma, logger);
  }

  private readonly pushNotification: PushNotificationService;

  async sendReminderNotification(deviceIds: string[], payload: ReminderPayload, attempt: number) {
    await this.pushNotification.send(deviceIds, {
      title: attempt === 1 ? 'Wydarzenie właśnie trwa' : 'Czy wydarzenie nadal trwa?',
      body: `${payload.programTitle} na kanale ${payload.channelId}`,
      data: {
        type: 'EVENT_REMINDER',
        eventId: payload.eventId,
        programId: payload.programId,
        channelId: payload.channelId,
        startsAt: payload.startsAt,
        attempt: String(attempt),
      },
    });
  }

  async sendEventStartedNotification(deviceIds: string[], payload: ReminderPayload) {
    await this.pushNotification.send(deviceIds, {
      title: 'Nowe wydarzenie do potwierdzenia',
      body: `${payload.programTitle} właśnie się rozpoczęło`,
      data: {
        type: 'EVENT_STARTED',
        eventId: payload.eventId,
        programId: payload.programId,
        channelId: payload.channelId,
        startsAt: payload.startsAt,
      },
    });
  }

  async sendDailyReminder() {
    const devices = await this.prisma.deviceToken.findMany();
    if (devices.length === 0) {
      return;
    }

    await this.pushNotification.send(
      devices.map((device) => device.deviceId),
      {
        title: 'BackOn.tv przypomina o dzisiejszym programie',
        body: 'Sprawdź, co dziś w TV i dodaj programy do śledzenia.',
        data: {
          type: 'DAILY_REMINDER',
        },
      },
    );
  }

  async sendProgramStartingSoonReminder() {
    const now = new Date();
    
    // 1. Przypomnienie 15 minut przed startem
    // Sprawdź programy startujące za 14-15 minut (okno 1 minuty)
    const fourteenMinutesLater = new Date(now.getTime() + 14 * 60 * 1000);
    const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000);

    const programs15min = await this.prisma.program.findMany({
      where: {
        startsAt: {
          gte: fourteenMinutesLater,
          lte: fifteenMinutesLater,
        },
      },
      include: {
        channel: true,
        programFollows: true,
      },
    });

    for (const program of programs15min) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        continue;
      }

      // Sprawdź czy powiadomienie już zostało wysłane
      const existingLog = await this.prisma.programNotificationLog.findUnique({
        where: {
          programId_reminderType: {
            programId: program.id,
            reminderType: 'FIFTEEN_MIN',
          },
        },
      });

      if (existingLog) {
        continue; // Powiadomienie już wysłane
      }

      await this.pushNotification.send(deviceIds, {
        title: 'Start za 15 minut',
        body: `${program.title} | ${program.channel?.name ?? ''}`,
        data: {
          type: 'PROGRAM_START_SOON',
          programId: program.id,
          channelId: program.channelId,
          startsAt: program.startsAt.toISOString(),
          reminderType: '15_MIN',
        },
      });

      // Zapisz w logu
      await this.prisma.programNotificationLog.create({
        data: {
          programId: program.id,
          reminderType: 'FIFTEEN_MIN',
        },
      });
    }

    // 2. Przypomnienie 5 minut przed startem
    // Sprawdź programy startujące za 4-5 minut (okno 1 minuty)
    const fourMinutesLater = new Date(now.getTime() + 4 * 60 * 1000);
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    const programs5min = await this.prisma.program.findMany({
      where: {
        startsAt: {
          gte: fourMinutesLater,
          lte: fiveMinutesLater,
        },
      },
      include: {
        channel: true,
        programFollows: true,
      },
    });

    for (const program of programs5min) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        continue;
      }

      // Sprawdź czy powiadomienie już zostało wysłane
      const existingLog = await this.prisma.programNotificationLog.findUnique({
        where: {
          programId_reminderType: {
            programId: program.id,
            reminderType: 'FIVE_MIN',
          },
        },
      });

      if (existingLog) {
        continue; // Powiadomienie już wysłane
      }

      await this.pushNotification.send(deviceIds, {
        title: 'Start za 5 minut',
        body: `${program.title} | ${program.channel?.name ?? ''}`,
        data: {
          type: 'PROGRAM_START_SOON',
          programId: program.id,
          channelId: program.channelId,
          startsAt: program.startsAt.toISOString(),
          reminderType: '5_MIN',
        },
      });

      // Zapisz w logu
      await this.prisma.programNotificationLog.create({
        data: {
          programId: program.id,
          reminderType: 'FIVE_MIN',
        },
      });
    }

    // 3. Powiadomienie gdy program się zacznie
    // Sprawdź programy które właśnie się zaczęły (0-1 minuta od startu)
    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);

    const programsStarted = await this.prisma.program.findMany({
      where: {
        startsAt: {
          gte: oneMinuteAgo,
          lte: now,
        },
      },
      include: {
        channel: true,
        programFollows: true,
      },
    });

    for (const program of programsStarted) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        continue;
      }

      // Sprawdź czy powiadomienie już zostało wysłane
      const existingLog = await this.prisma.programNotificationLog.findUnique({
        where: {
          programId_reminderType: {
            programId: program.id,
            reminderType: 'STARTED',
          },
        },
      });

      if (existingLog) {
        continue; // Powiadomienie już wysłane
      }

      await this.pushNotification.send(deviceIds, {
        title: 'Program właśnie się zaczął',
        body: `${program.title} | ${program.channel?.name ?? ''}`,
        data: {
          type: 'PROGRAM_STARTED',
          programId: program.id,
          channelId: program.channelId,
          startsAt: program.startsAt.toISOString(),
        },
      });

      // Zapisz w logu
      await this.prisma.programNotificationLog.create({
        data: {
          programId: program.id,
          reminderType: 'STARTED',
        },
      });
    }
  }
}

type ReminderPayload = {
  eventId: string;
  programId: string;
  channelId: string;
  programTitle: string;
  startsAt: string;
};

