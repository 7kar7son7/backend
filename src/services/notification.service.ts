import { PrismaClient, NotificationSensitivity } from '@prisma/client';
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

    // Atomowo „rezerwuj” prawo do wysłania: ustaw initialPushSentAt tylko gdy jest null.
    // Dzięki temu retry / drugi request (create + threshold) nie wyślą duplikatu.
    const updated = await this.prisma.event.updateMany({
      where: {
        id: payload.eventId,
        initialPushSentAt: null,
        validatedAt: null,
      },
      data: { initialPushSentAt: new Date() },
    });

    if (updated.count === 0) {
      this.logger.debug(
        { eventId: payload.eventId },
        'Event notification already sent or event validated (duplicate prevented by initialPushSentAt)',
      );
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
      'pushNotification.send completed (initialPushSentAt already set)',
    );
  }

  async sendEventConfirmationNotification(
    deviceIds: string[],
    payload: ReminderPayload,
    confirmedByDeviceId: string,
  ) {
    this.logger.info(
      {
        eventId: payload.eventId,
        programId: payload.programId,
        deviceIdsCount: deviceIds.length,
        confirmedByDeviceId,
      },
      'sendEventConfirmationNotification called',
    );

    // Upewnij się, że mamy czytelną treść powiadomienia
    const programTitle = payload.programTitle || 'Program';
    const notificationBody = programTitle.length > 50 
      ? `${programTitle.substring(0, 47)}... - ktoś potwierdził koniec reklam!`
      : `${programTitle} - ktoś potwierdził koniec reklam!`;
    
    const message: PushMessage = {
      title: 'Potwierdzenie reklam',
      body: notificationBody,
      data: {
        type: 'EVENT_CONFIRMED',
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
      'Calling pushNotification.send for event confirmation',
    );
    
    await this.pushNotification.send(deviceIds, message);
    
    this.logger.info(
      {
        eventId: payload.eventId,
        deviceIdsCount: deviceIds.length,
      },
      'pushNotification.send completed for event confirmation',
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
        title: 'Programy na dziś',
        body: 'Sprawdź, co dziś w TV i dodaj programy do śledzenia.',
        data: {
          type: 'DAILY_REMINDER',
        },
      },
    );
  }

  /**
   * Filtruje deviceIds zgodnie z ustawieniami notificationSensitivity
   * @param deviceIds Lista wszystkich deviceIds
   * @param reminderMinutes Typ powiadomienia (15, 10, lub 5 minut)
   * @returns Lista deviceIds, które powinny otrzymać powiadomienie
   */
  private async filterDevicesBySensitivity(
    deviceIds: string[],
    reminderMinutes: 15 | 10 | 5,
  ): Promise<string[]> {
    if (deviceIds.length === 0) {
      return [];
    }

    // Pobierz ustawienia dla wszystkich urządzeń
    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: {
        deviceId: { in: deviceIds },
      },
      select: {
        deviceId: true,
        notificationSensitivity: true,
      },
    });

    // Mapuj deviceId -> sensitivity
    const sensitivityMap = new Map<string, NotificationSensitivity | null>();
    for (const token of deviceTokens) {
      sensitivityMap.set(token.deviceId, token.notificationSensitivity);
    }

    // Filtruj zgodnie z ustawieniami:
    // HIGH (3 powiadomienia): 15, 10, 5 min
    // MEDIUM (2 powiadomienia): 10, 5 min (domyślnie)
    // LOW (1 powiadomienie): 5 min
    return deviceIds.filter((deviceId) => {
      const sensitivity = sensitivityMap.get(deviceId) ?? NotificationSensitivity.MEDIUM;

      switch (reminderMinutes) {
        case 15:
          return sensitivity === NotificationSensitivity.HIGH;
        case 10:
          return (
            sensitivity === NotificationSensitivity.HIGH || sensitivity === NotificationSensitivity.MEDIUM
          );
        case 5:
          return true; // Wszyscy otrzymują powiadomienie 5 min przed
        default:
          return false;
      }
    });
  }

  async sendProgramStartingSoonReminder() {
    const now = new Date();

    // 1. Przypomnienie 15 minut przed startem (tylko dla HIGH sensitivity)
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
      const allDeviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (allDeviceIds.length === 0) {
        this.logger.info({ programId: program.id, title: program.title }, 'Program has no followers, skipping');
        continue;
      }

      // Filtruj deviceIds - tylko HIGH sensitivity otrzyma powiadomienie 15 min
      const deviceIds = await this.filterDevicesBySensitivity(allDeviceIds, 15);
      if (deviceIds.length === 0) {
        this.logger.debug(
          { programId: program.id, title: program.title, allDeviceIdsCount: allDeviceIds.length },
          'No devices with HIGH sensitivity for 15min reminder, skipping',
        );
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
    }

    // 2. Przypomnienie 10 minut przed startem (dla HIGH i MEDIUM sensitivity)
    // Sprawdź programy startujące za 9-11 minut (szersze okno żeby nie przegapić)
    const nineMinutesLater = new Date(now.getTime() + 9 * 60 * 1000);
    const elevenMinutesLater = new Date(now.getTime() + 11 * 60 * 1000);

    const programs10min = await this.prisma.program.findMany({
      where: {
        startsAt: {
          gte: nineMinutesLater,
          lte: elevenMinutesLater,
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
      { count: programs10min.length, timeWindow: '9-11 min', now: now.toISOString() },
      'Checking programs for 10min reminder',
    );

    for (const program of programs10min) {
      const allDeviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (allDeviceIds.length === 0) {
        this.logger.info({ programId: program.id, title: program.title }, 'Program has no followers, skipping');
        continue;
      }

      // Filtruj deviceIds - HIGH i MEDIUM sensitivity otrzyma powiadomienie 10 min
      const deviceIds = await this.filterDevicesBySensitivity(allDeviceIds, 10);
      if (deviceIds.length === 0) {
        this.logger.debug(
          { programId: program.id, title: program.title, allDeviceIdsCount: allDeviceIds.length },
          'No devices with HIGH or MEDIUM sensitivity for 10min reminder, skipping',
        );
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
        'Checking program for 10min reminder',
      );
      
      // Wysyłaj powiadomienie gdy jest między 9 a 11 minutami przed (540-660 sekund)
      // To pozwoli złapać programy które są dokładnie 10 minut przed, nawet jeśli job uruchomi się o 9:59 lub 10:59
      if (totalSecondsUntilStart < 540 || totalSecondsUntilStart > 660) {
        this.logger.info(
          { programId: program.id, title: program.title, minutesUntilStart, secondsUntilStart, totalSecondsUntilStart },
          'Program outside 10min window (9:00-11:00), skipping',
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
            reminderType: 'TEN_MIN',
          },
        });
        
        // Rekord utworzony - teraz wyślij powiadomienie
        this.logger.info(
          { programId: program.id, title: program.title, deviceIdsCount: deviceIds.length, minutesUntilStart },
          'Sending 10min reminder notification',
        );
        await this.pushNotification.send(deviceIds, {
          title: 'Start za 10 minut',
          body: `${program.title} | ${program.channel?.name ?? ''}`,
          data: {
            type: 'PROGRAM_START_SOON',
            programId: program.id,
            channelId: program.channelId,
            startsAt: program.startsAt.toISOString(),
            reminderType: '10_MIN',
          },
        });
        this.logger.info(
          { programId: program.id, title: program.title },
          '10min reminder notification sent successfully',
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
            title: 'Start za 10 minut',
            body: `${program.title} | ${program.channel?.name ?? ''}`,
            data: {
              type: 'PROGRAM_START_SOON',
              programId: program.id,
              channelId: program.channelId,
              startsAt: program.startsAt.toISOString(),
              reminderType: '10_MIN',
            },
          });
        }
      }
    }
    }

    // 3. Przypomnienie 5 minut przed startem (wszyscy użytkownicy)
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
      const allDeviceIds = program.programFollows.map((follow) => follow.deviceId);
      if (allDeviceIds.length === 0) {
        this.logger.info({ programId: program.id, title: program.title }, 'Program has no followers, skipping');
        continue;
      }

      // Filtruj deviceIds - wszyscy otrzymują powiadomienie 5 min (ale sprawdzamy ustawienia dla spójności)
      const deviceIds = await this.filterDevicesBySensitivity(allDeviceIds, 5);
      if (deviceIds.length === 0) {
        // To nie powinno się zdarzyć, ale na wszelki wypadek
        this.logger.warn(
          { programId: program.id, title: program.title, allDeviceIdsCount: allDeviceIds.length },
          'No devices for 5min reminder (unexpected)',
        );
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

    // 4. Powiadomienie gdy program się zacznie
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

