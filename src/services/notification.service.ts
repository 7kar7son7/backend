import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

import { env } from '../config/env';
import { PushNotificationService, type PushMessage } from './push-notification.service';

export class NotificationService {
  constructor(private readonly prisma: PrismaClient, private readonly logger: FastifyBaseLogger) {
    this.pushNotification = new PushNotificationService(prisma, logger);
  }

  private readonly pushNotification: PushNotificationService;

  async sendReminderNotification(deviceIds: string[], payload: ReminderPayload, attempt: number) {
    const channelName = payload.channelName || 'kanale';
    await this.pushNotification.send(deviceIds, {
      title: attempt === 1 ? 'Wydarzenie właśnie trwa' : 'Czy wydarzenie nadal trwa?',
      body: `${payload.programTitle} na kanale ${channelName}`,
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
    // Sprawdź czy powiadomienie dla tego eventu już zostało wysłane
    // Używamy flagi validatedAt w Event jako wskaźnika że powiadomienia zostały wysłane
    const event = await this.prisma.event.findUnique({
      where: { id: payload.eventId },
      select: { validatedAt: true, status: true },
    });

    if (!event) {
      this.logger.warn({ eventId: payload.eventId }, 'Event not found when sending notification');
      return;
    }

    // Jeśli event ma validatedAt, to powiadomienia już zostały wysłane
    // (validatedAt jest ustawiane tylko raz, gdy event osiąga próg)
    if (event.validatedAt) {
      this.logger.debug({ eventId: payload.eventId }, 'Event notification already sent (duplicate prevented by validatedAt)');
      return;
    }

    // Upewnij się, że mamy czytelną treść powiadomienia
    const programTitle = payload.programTitle || 'Program';
    const notificationBody = programTitle.length > 50 
      ? `${programTitle.substring(0, 47)}... - reklamy zakończone? Potwierdź!`
      : `${programTitle} - reklamy zakończone? Potwierdź!`;
    
    const message: PushMessage = {
      title: 'KONIEC REKLAM',
      body: notificationBody,
      data: {
        type: 'EVENT_STARTED',
        eventId: payload.eventId,
        programId: payload.programId,
        channelId: payload.channelId,
        startsAt: payload.startsAt,
      },
    };
    
    // Dodaj image tylko jeśli jest dostępne (nie przekazuj undefined)
    if (payload.channelLogoUrl) {
      message.image = payload.channelLogoUrl;
    }
    
    await this.pushNotification.send(deviceIds, message);
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
    // Sprawdź programy startujące za 14-15 minut (żeby powiadomienie przyszło dokładnie 15 min przed lub wcześniej, nie później)
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

    this.logger.info(
      { count: programs15min.length, timeWindow: '14-15 min', now: now.toISOString() },
      'Checking programs for 15min reminder',
    );

    for (const program of programs15min) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        this.logger.info({ programId: program.id, title: program.title }, 'Program has no followers, skipping');
        continue;
      }

      // Sprawdź ile minut zostało do startu (używamy floor żeby zawsze zaokrąglać w dół)
      const millisecondsUntilStart = program.startsAt.getTime() - now.getTime();
      const minutesUntilStart = Math.floor(millisecondsUntilStart / (60 * 1000));
      const secondsUntilStart = Math.floor((millisecondsUntilStart % (60 * 1000)) / 1000);
      
      this.logger.info(
        { 
          programId: program.id, 
          title: program.title, 
          startsAt: program.startsAt.toISOString(),
          minutesUntilStart,
          secondsUntilStart,
          deviceIdsCount: deviceIds.length 
        },
        'Checking program for 15min reminder',
      );
      
      // Akceptuj programy w oknie 15-16 minut (job działa co minutę, więc musimy mieć okno)
      // To zapewni, że powiadomienie przyjdzie dokładnie 15 minut przed lub wcześniej (nie później)
      if (minutesUntilStart < 15 || minutesUntilStart > 16) {
        this.logger.debug(
          { programId: program.id, title: program.title, minutesUntilStart },
          'Program outside 15min window (15-16), skipping',
        );
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
        this.logger.info(
          { programId: program.id, title: program.title, deviceIdsCount: deviceIds.length, minutesUntilStart },
          'Sending 15min reminder notification',
        );
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
        this.logger.info(
          { programId: program.id, title: program.title },
          '15min reminder notification sent successfully',
        );
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
    // Sprawdź programy startujące za 4-5 minut (żeby powiadomienie przyszło dokładnie 5 min przed lub wcześniej, nie później)
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

    this.logger.info(
      { count: programs5min.length, timeWindow: '4-5 min', now: now.toISOString() },
      'Checking programs for 5min reminder',
    );

    for (const program of programs5min) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        this.logger.info({ programId: program.id, title: program.title }, 'Program has no followers, skipping');
        continue;
      }

      const millisecondsUntilStart = program.startsAt.getTime() - now.getTime();
      const minutesUntilStart = Math.floor(millisecondsUntilStart / (60 * 1000));
      const secondsUntilStart = Math.floor((millisecondsUntilStart % (60 * 1000)) / 1000);
      
      this.logger.info(
        { 
          programId: program.id, 
          title: program.title, 
          startsAt: program.startsAt.toISOString(),
          minutesUntilStart,
          secondsUntilStart,
          deviceIdsCount: deviceIds.length 
        },
        'Checking program for 5min reminder',
      );
      
      if (minutesUntilStart >= 4 && minutesUntilStart <= 5) {
        // OK - program jest w oknie, wyślij powiadomienie
      } else {
        this.logger.info(
          { programId: program.id, title: program.title, minutesUntilStart },
          'Program outside 5min window (4-5), skipping',
        );
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
        this.logger.info(
          { programId: program.id, title: program.title, deviceIdsCount: deviceIds.length },
          'Sending 5min reminder notification',
        );
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
        this.logger.info(
          { programId: program.id, title: program.title },
          '5min reminder notification sent',
        );
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

    this.logger.info(
      { count: programsStarted.length, timeWindow: '0-30s ago' },
      'Checking programs for started notification',
    );

    for (const program of programsStarted) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        this.logger.info({ programId: program.id, title: program.title }, 'Program has no followers, skipping');
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
        this.logger.info(
          { programId: program.id, title: program.title, deviceIdsCount: deviceIds.length },
          'Sending program started notification',
        );
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
        this.logger.info(
          { programId: program.id, title: program.title },
          'Program started notification sent',
        );
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
  channelName?: string | null;
};

