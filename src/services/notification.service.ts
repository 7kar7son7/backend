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
    // Upewnij się, że mamy czytelną treść powiadomienia
    const programTitle = payload.programTitle || 'Program';
    const notificationBody = programTitle.length > 50 
      ? `${programTitle.substring(0, 47)}... - reklamy zakończone? Potwierdź!`
      : `${programTitle} - reklamy zakończone? Potwierdź!`;
    
    await this.pushNotification.send(deviceIds, {
      title: 'KONIEC REKLAM',
      body: notificationBody,
      image: payload.channelLogoUrl ?? undefined,
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
        programFollows: {
          where: {
            type: 'PROGRAM',
          },
        },
      },
    });

    for (const program of programs15min) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        continue;
      }

      // Próbuj utworzyć rekord PRZED wysłaniem - jeśli już istnieje (P2002), nie wysyłaj
      try {
        // Próbuj utworzyć rekord - unique constraint zapobiegnie duplikatom
        // Jeśli rekord już istnieje, dostaniemy P2002 i nie wyślemy powiadomienia
        await this.prisma.programNotificationLog.create({
          data: {
            programId: program.id,
            reminderType: 'FIFTEEN_MIN',
          },
        });
        
        // Rekord utworzony - teraz wyślij powiadomienie
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
      } catch (error: any) {
        // Jeśli unique constraint error (P2002), to znaczy że rekord już istnieje - nie wysyłaj
        if (error?.code === 'P2002') {
          this.logger.debug({ programId: program.id }, 'Notification already sent (duplicate prevented)');
          continue; // Już wysłane przez inny proces, pomiń
        } else {
          // Inny błąd (np. tabela nie istnieje) - kontynuuj wysyłanie
          this.logger.warn({ error, programId: program.id }, 'Failed to create notification log, sending anyway');
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
        }
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
        programFollows: {
          where: {
            type: 'PROGRAM',
          },
        },
      },
    });

    for (const program of programs5min) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        continue;
      }

      // Próbuj utworzyć rekord PRZED wysłaniem - jeśli już istnieje (P2002), nie wysyłaj
      try {
        // Próbuj utworzyć rekord - unique constraint zapobiegnie duplikatom
        // Jeśli rekord już istnieje, dostaniemy P2002 i nie wyślemy powiadomienia
        await this.prisma.programNotificationLog.create({
          data: {
            programId: program.id,
            reminderType: 'FIVE_MIN',
          },
        });
        
        // Rekord utworzony - teraz wyślij powiadomienie
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
      } catch (error: any) {
        // Jeśli unique constraint error (P2002), to znaczy że rekord już istnieje - nie wysyłaj
        if (error?.code === 'P2002') {
          continue; // Już wysłane przez inny proces, pomiń
        } else {
          // Inny błąd (np. tabela nie istnieje) - kontynuuj wysyłanie
          this.logger.warn({ error, programId: program.id }, 'Failed to create notification log, sending anyway');
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
        }
      }
    }

    // 3. Powiadomienie gdy program się zacznie
    // Sprawdź programy które właśnie się zaczęły (0-30 sekund od startu) - wąskie okno aby uniknąć duplikatów
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);

    const programsStarted = await this.prisma.program.findMany({
      where: {
        startsAt: {
          gte: thirtySecondsAgo,
          lte: now,
        },
      },
      include: {
        channel: true,
        programFollows: {
          where: {
            type: 'PROGRAM',
          },
        },
      },
    });

    for (const program of programsStarted) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        continue;
      }

      // Próbuj utworzyć rekord PRZED wysłaniem - jeśli już istnieje (P2002), nie wysyłaj
      try {
        // Próbuj utworzyć rekord - unique constraint zapobiegnie duplikatom
        // Jeśli rekord już istnieje, dostaniemy P2002 i nie wyślemy powiadomienia
        await this.prisma.programNotificationLog.create({
          data: {
            programId: program.id,
            reminderType: 'STARTED',
          },
        });
        
        // Rekord utworzony - teraz wyślij powiadomienie
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
      } catch (error: any) {
        // Jeśli unique constraint error (P2002), to znaczy że rekord już istnieje - nie wysyłaj
        if (error?.code === 'P2002') {
          continue; // Już wysłane przez inny proces, pomiń
        } else {
          // Inny błąd (np. tabela nie istnieje) - kontynuuj wysyłanie
          this.logger.warn({ error, programId: program.id }, 'Failed to create notification log, sending anyway');
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
  }
}

type ReminderPayload = {
  eventId: string;
  programId: string;
  channelId: string;
  programTitle: string;
  startsAt: string;
  channelLogoUrl?: string | null;
};

