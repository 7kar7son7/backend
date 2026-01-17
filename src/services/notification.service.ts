import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

import { env } from '../config/env';
import { PushNotificationService, type PushMessage } from './push-notification.service';

export class NotificationService {
  constructor(private readonly prisma: PrismaClient, private readonly logger: FastifyBaseLogger) {
    // Użyj singleton zamiast tworzyć nową instancję
    this.pushNotification = PushNotificationService.getInstance(prisma, logger);
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
    this.logger.info(
      {
        eventId: payload.eventId,
        programId: payload.programId,
        deviceIdsCount: deviceIds.length,
        deviceIds: deviceIds,
      },
      'sendEventStartedNotification called',
    );

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
    
    this.logger.info(
      {
        eventId: payload.eventId,
        deviceIdsCount: deviceIds.length,
        messageTitle: message.title,
        messageBody: message.body,
      },
      'Calling pushNotification.send',
    );
    
    await this.pushNotification.send(deviceIds, message);
    
    this.logger.info(
      {
        eventId: payload.eventId,
        deviceIdsCount: deviceIds.length,
      },
      'pushNotification.send completed',
    );
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
    // Sprawdź programy startujące za 14-16 minut (szersze okno żeby nie przegapić)
    const fourteenMinutesLater = new Date(now.getTime() + 14 * 60 * 1000);
    const sixteenMinutesLater = new Date(now.getTime() + 16 * 60 * 1000);

    const programs15min = await this.prisma.program.findMany({
      where: {
        startsAt: {
          gte: fourteenMinutesLater,
          lte: sixteenMinutesLater,
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
      { count: programs15min.length, timeWindow: '14-16 min', now: now.toISOString() },
      'Checking programs for 15min reminder',
    );

    for (const program of programs15min) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        this.logger.info({ programId: program.id, title: program.title }, 'Program has no followers, skipping');
        continue;
      }

      // Sprawdź ile minut i sekund zostało do startu
      const millisecondsUntilStart = program.startsAt.getTime() - now.getTime();
      const totalSecondsUntilStart = Math.floor(millisecondsUntilStart / 1000);
      const minutesUntilStart = Math.floor(totalSecondsUntilStart / 60);
      const secondsUntilStart = totalSecondsUntilStart % 60;
      
      this.logger.info(
        { 
          programId: program.id, 
          title: program.title, 
          startsAt: program.startsAt.toISOString(),
          minutesUntilStart,
          secondsUntilStart,
          totalSecondsUntilStart,
          deviceIdsCount: deviceIds.length 
        },
        'Checking program for 15min reminder',
      );
      
      // Wysyłaj powiadomienie gdy jest między 14 a 16 minutami przed (840-960 sekund)
      // To pozwoli złapać programy które są dokładnie 15 minut przed, nawet jeśli job uruchomi się o 14:59 lub 15:59
      if (totalSecondsUntilStart < 840 || totalSecondsUntilStart > 960) {
        this.logger.info(
          { programId: program.id, title: program.title, minutesUntilStart, secondsUntilStart, totalSecondsUntilStart },
          'Program outside 15min window (14:00-16:00), skipping',
        );
        continue;
      }
      
      // Jeśli jest dokładnie 15 minut (900 sekund) lub najbliżej (w oknie 14:30-15:30), wyślij
      // Preferuj dokładnie 15 minut, ale akceptuj też 14:30-15:30 żeby nie przegapić

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
    // Sprawdź programy startujące za 4-6 minut (szersze okno żeby nie przegapić)
    const fourMinutesLater = new Date(now.getTime() + 4 * 60 * 1000);
    const sixMinutesLater = new Date(now.getTime() + 6 * 60 * 1000);

    const programs5min = await this.prisma.program.findMany({
      where: {
        startsAt: {
          gte: fourMinutesLater,
          lte: sixMinutesLater,
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
      { count: programs5min.length, timeWindow: '4-6 min', now: now.toISOString() },
      'Checking programs for 5min reminder',
    );

    for (const program of programs5min) {
      const deviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (deviceIds.length === 0) {
        this.logger.info({ programId: program.id, title: program.title }, 'Program has no followers, skipping');
        continue;
      }

      const millisecondsUntilStart = program.startsAt.getTime() - now.getTime();
      const totalSecondsUntilStart = Math.floor(millisecondsUntilStart / 1000);
      const minutesUntilStart = Math.floor(totalSecondsUntilStart / 60);
      const secondsUntilStart = totalSecondsUntilStart % 60;
      
      this.logger.info(
        { 
          programId: program.id, 
          title: program.title, 
          startsAt: program.startsAt.toISOString(),
          minutesUntilStart,
          secondsUntilStart,
          totalSecondsUntilStart,
          deviceIdsCount: deviceIds.length 
        },
        'Checking program for 5min reminder',
      );
      
      // Wysyłaj powiadomienie gdy jest między 4 a 6 minutami przed (240-360 sekund)
      // To pozwoli złapać programy które są dokładnie 5 minut przed, nawet jeśli job uruchomi się o 4:59 lub 5:59
      if (totalSecondsUntilStart < 240 || totalSecondsUntilStart > 360) {
        this.logger.info(
          { programId: program.id, title: program.title, minutesUntilStart, secondsUntilStart, totalSecondsUntilStart },
          'Program outside 5min window (4:00-6:00), skipping',
        );
        continue;
      }
      
      // Jeśli jest dokładnie 5 minut (300 sekund) lub najbliżej (w oknie 4:30-5:30), wyślij

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
    // Sprawdź programy które właśnie się zaczęły (0-60 sekund od startu) - okno aby job co minutę nie przegapił
    const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000);

    const programsStarted = await this.prisma.program.findMany({
      where: {
        startsAt: {
          gte: sixtySecondsAgo,
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
      { count: programsStarted.length, timeWindow: '0-60s ago', now: now.toISOString() },
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

