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

      // Sprawdź czy powiadomienie już zostało wysłane (z obsługą błędów jeśli tabela nie istnieje)
      let existingLog = null;
      try {
        existingLog = await this.prisma.programNotificationLog.findUnique({
          where: {
            programId_reminderType: {
              programId: program.id,
              reminderType: 'FIFTEEN_MIN',
            },
          },
        });
      } catch (error) {
        // Jeśli tabela nie istnieje (migracja nie zastosowana), kontynuuj wysyłanie
        this.logger.warn({ error, programId: program.id }, 'Failed to check notification log, sending anyway');
      }

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

      // Zapisz w logu (z obsługą błędów)
      try {
        await this.prisma.programNotificationLog.create({
          data: {
            programId: program.id,
            reminderType: 'FIFTEEN_MIN',
          },
        });
      } catch (error) {
        // Jeśli tabela nie istnieje, zignoruj błąd
        this.logger.warn({ error, programId: program.id }, 'Failed to log notification, continuing');
      }
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

      // Sprawdź czy powiadomienie już zostało wysłane (z obsługą błędów jeśli tabela nie istnieje)
      let existingLog = null;
      try {
        existingLog = await this.prisma.programNotificationLog.findUnique({
          where: {
            programId_reminderType: {
              programId: program.id,
              reminderType: 'FIVE_MIN',
            },
          },
        });
      } catch (error) {
        // Jeśli tabela nie istnieje (migracja nie zastosowana), kontynuuj wysyłanie
        this.logger.warn({ error, programId: program.id }, 'Failed to check notification log, sending anyway');
      }

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

      // Zapisz w logu (z obsługą błędów)
      try {
        await this.prisma.programNotificationLog.create({
          data: {
            programId: program.id,
            reminderType: 'FIVE_MIN',
          },
        });
      } catch (error) {
        // Jeśli tabela nie istnieje, zignoruj błąd
        this.logger.warn({ error, programId: program.id }, 'Failed to log notification, continuing');
      }
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

      // Użyj transakcji z create - jeśli unique constraint error, to znaczy że już wysłane
      let shouldSend = false;
      try {
        // Próbuj utworzyć rekord w transakcji - jeśli już istnieje, unique constraint zapobiegnie duplikatom
        shouldSend = await this.prisma.$transaction(async (tx) => {
          // Sprawdź czy już istnieje
          const existing = await tx.programNotificationLog.findUnique({
            where: {
              programId_reminderType: {
                programId: program.id,
                reminderType: 'STARTED',
              },
            },
          });
          
          if (existing) {
            return false; // Już wysłane
          }
          
          // Utwórz rekord - jeśli dwa procesy próbują jednocześnie, unique constraint zapobiegnie duplikatom
          await tx.programNotificationLog.create({
            data: {
              programId: program.id,
              reminderType: 'STARTED',
            },
          });
          
          return true; // Nowy rekord, można wysłać
        });
      } catch (error: any) {
        // Jeśli unique constraint error (P2002), to znaczy że rekord już istnieje (race condition)
        if (error?.code === 'P2002') {
          shouldSend = false; // Już wysłane przez inny proces
        } else {
          // Inny błąd (np. tabela nie istnieje) - kontynuuj wysyłanie
          this.logger.warn({ error, programId: program.id }, 'Failed to check notification log, sending anyway');
          shouldSend = true;
        }
      }

      if (!shouldSend) {
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

