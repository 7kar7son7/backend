import { FastifyInstance } from 'fastify';
import { EventChoice, EventStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

import { EventService } from '../services/event.service';
import { NotificationService } from '../services/notification.service';
import { PointsService } from '../services/points.service';
import { akpaLogoThumbDataUrl } from '../utils/akpa-logo-thumbs';
import { resolveChannelLogoUrlForApi } from '../utils/channel-logo';
import { getDeviceId } from '../utils/device';
import { checkRateLimit, checkRateLimitHourly } from '../utils/rate-limit';
import { env } from '../config/env';
import { AbuseService } from '../services/abuse.service';

const RATE_LIMIT_CREATE = env.EVENT_RATE_LIMIT_CREATE_PER_MIN ?? 10;
const RATE_LIMIT_CREATE_PER_HOUR = env.EVENT_RATE_LIMIT_CREATE_PER_HOUR ?? 30;
const RATE_LIMIT_CONFIRM = env.EVENT_RATE_LIMIT_CONFIRM_PER_MIN ?? 30;

const createEventSchema = z.object({
  programId: z.string().uuid(),
});

const adminEventSchema = z.object({
  programId: z.string().uuid(),
});

const confirmEventSchema = z.object({
  choice: z.nativeEnum(EventChoice),
  reminderUsed: z.boolean().default(false),
});

export default async function eventsRoutes(app: FastifyInstance) {
  const eventService = new EventService(app.prisma);
  const notificationService = new NotificationService(app.prisma, app.log);
  const pointsService = new PointsService(app.prisma);
  const abuseService = new AbuseService(app.prisma);

  type EventWithProgramAndChannel = Prisma.EventGetPayload<{
    include: {
      program: {
        include: {
          channel: true;
        };
      };
    };
  }>;

  async function finalizeEventResponse(
    event: EventWithProgramAndChannel,
    followerDeviceIds: string[],
    initiatorDeviceId: string,
  ) {
    return {
      ...event,
      program: {
        ...event.program,
        channelName: event.program.channel?.name ?? event.program.channelId,
        channelLogoUrl: event.program.channel ? resolveChannelLogoUrlForApi(event.program.channel) : null,
        channelLogoThumbDataUrl: event.program.channel
          ? akpaLogoThumbDataUrl(event.program.channel.externalId)
          : null,
      },
    };
  }

  app.get('/', async (request, reply) => {
    let deviceId: string;
    try {
      deviceId = getDeviceId(request);
    } catch (error) {
      request.log.warn(error);
      return reply.badRequest('Missing X-Device-Id header');
    }

    const events = await eventService.listActiveEvents(deviceId);
    
    // Formatuj eventy - dodaj channelName i channelLogoUrl do program
    const formattedEvents = events.map((event) => ({
      ...event,
      program: {
        ...event.program,
        channelName: event.program.channel?.name ?? event.program.channelId,
        channelLogoUrl: event.program.channel ? resolveChannelLogoUrlForApi(event.program.channel) : null,
        channelLogoThumbDataUrl: event.program.channel
          ? akpaLogoThumbDataUrl(event.program.channel.externalId)
          : null,
      },
    }));
    
    return { data: formattedEvents };
  });

  app.post('/', {
    preHandler: async (request, reply) => {
      let deviceId: string;
      try {
        deviceId = getDeviceId(request);
      } catch {
        return;
      }
      if (await abuseService.isDeviceBlocked(deviceId)) {
        return reply.code(403).send({ error: 'Account is blocked' });
      }
      const key = `event:create:${deviceId}`;
      if (!checkRateLimitHourly(key, RATE_LIMIT_CREATE_PER_HOUR)) {
        await abuseService.flagOrBlockDevice(deviceId, 'hourly_limit_exceeded', 'FLAGGED');
        await abuseService.decreaseReputation(deviceId);
        request.log.warn({ deviceId }, 'Event create: hourly limit exceeded, device flagged');
        return reply.code(429).send({
          error: 'Too many event reports this hour; try again later',
        });
      }
      if (!checkRateLimit(key, RATE_LIMIT_CREATE)) {
        return reply.code(429).send({
          error: 'Too many event reports; try again in a minute',
        });
      }
    },
  }, async (request, reply) => {
    let deviceId: string;
    try {
      deviceId = getDeviceId(request);
    } catch (error) {
      request.log.warn(error);
      return reply.badRequest('Missing X-Device-Id header');
    }

    const body = createEventSchema.parse(request.body);

    try {
      const { event, followerDeviceIds } = await eventService.createEvent(
        deviceId,
        body.programId,
      );

      // Natychmiast wyślij push „KONIEC REKLAM” do wszystkich obserwujących (oprócz inicjatora),
      // żeby na ich telefonach pojawił się popup do potwierdzenia.
      try {
        const recipientDeviceIds = followerDeviceIds.filter((id) => id !== deviceId);

        if (recipientDeviceIds.length > 0) {
          const programTitle = event.program.title || 'Program';
          const channelName = event.program.channel?.name || '';

          const payload = {
            eventId: event.id,
            programId: event.programId,
            channelId: event.program.channelId,
            programTitle: channelName ? `${channelName}: ${programTitle}` : programTitle,
            startsAt: event.program.startsAt.toISOString(),
            channelLogoUrl: event.program.channel
              ? resolveChannelLogoUrlForApi(event.program.channel)
              : null,
            channelLogoThumbDataUrl: event.program.channel
              ? akpaLogoThumbDataUrl(event.program.channel.externalId)
              : null,
          };

          await notificationService.sendEventStartedNotification(
            recipientDeviceIds,
            payload,
          );

          request.log.info(
            {
              eventId: event.id,
              programId: body.programId,
              followerCountLimit: event.followerCountLimit,
              recipientsCount: recipientDeviceIds.length,
            },
            'Event created; initial KONIEC REKLAM notification sent to followers',
          );
        } else {
          request.log.info(
            { eventId: event.id, programId: body.programId },
            'Event created; no followers to notify about KONIEC REKLAM',
          );
        }
      } catch (notifyError) {
        // Nie blokuj utworzenia eventu jeśli wysyłka powiadomień się nie uda
        request.log.warn(
          notifyError,
          'Failed to send initial KONIEC REKLAM notification after event creation',
        );
      }

      const formattedEvent = await finalizeEventResponse(event, followerDeviceIds, deviceId);
      return reply.code(201).send({
        data: { ...formattedEvent, recipientsCount: followerDeviceIds.length },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Program not found') {
          return reply.notFound(error.message);
        }
        if (error.message === 'Already reported for this program (one report per ad block)') {
          return reply.code(409).send({ error: error.message });
        }
      }
      request.log.error(error, 'Failed to create event');
      return reply.internalServerError();
    }
  });

  app.post('/admin', async (request, reply) => {
    if (!env.ADMIN_EVENT_SECRET) {
      request.log.warn('Admin event secret is not configured');
      return reply.forbidden('Admin events are disabled');
    }

    const rawToken = request.headers['x-admin-secret'];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!token || token !== env.ADMIN_EVENT_SECRET) {
      request.log.warn('Invalid admin secret provided for event creation');
      return reply.unauthorized('Invalid admin token');
    }

    const body = adminEventSchema.parse(request.body);

    try {
      const { event, followerDeviceIds } = await eventService.createEvent(
        'admin',
        body.programId,
        { skipInitiatorFollow: true },
      );

      const formattedEvent = await finalizeEventResponse(event, followerDeviceIds, 'admin');
      return reply.code(201).send({ data: formattedEvent });
    } catch (error) {
      if (error instanceof Error && error.message === 'Program not found') {
        return reply.notFound(error.message);
      }
      request.log.error(error, 'Failed to create admin event');
      return reply.internalServerError();
    }
  });

  app.post('/:eventId/confirm', {
    preHandler: async (request, reply) => {
      let deviceId: string;
      try {
        deviceId = getDeviceId(request);
      } catch {
        return;
      }
      if (await abuseService.isDeviceBlocked(deviceId)) {
        return reply.code(403).send({ error: 'Account is blocked' });
      }
      const key = `event:confirm:${deviceId}`;
      if (!checkRateLimit(key, RATE_LIMIT_CONFIRM)) {
        return reply.code(429).send({
          error: 'Too many confirmations; try again in a minute',
        });
      }
    },
  }, async (request, reply) => {
    let deviceId: string;
    try {
      deviceId = getDeviceId(request);
    } catch (error) {
      request.log.warn(error);
      return reply.badRequest('Missing X-Device-Id header');
    }

    const params = z.object({ eventId: z.string().uuid() }).parse(request.params);
    const body = confirmEventSchema.parse(request.body);

    try {
      // Pobierz event przed potwierdzeniem, żeby sprawdzić próg
      const eventBefore = await eventService.getEvent(params.eventId);
      if (!eventBefore) {
        return reply.notFound('Event not found');
      }

      // Sprawdź czy event już został zwalidowany (powiadomienia już wysłane)
      const wasAlreadyValidated = eventBefore.status === EventStatus.VALIDATED && eventBefore.validatedAt !== null;

      const confirmation = await eventService.confirmEvent(
        params.eventId,
        deviceId,
        body.choice,
        body.reminderUsed,
      );

      // Wyślij powiadomienia "Potwierdzenie reklam" TYLKO do osób które JUŻ potwierdziły event
      // (żeby wiedziały że ktoś inny też potwierdził)
      // Osoby które jeszcze nie potwierdziły powinny dostać tylko "KONIEC REKLAM" (EVENT_STARTED)
      try {
        // Pobierz tylko osoby które JUŻ potwierdziły ten event (oprócz tego który właśnie potwierdził i initiatora)
        const confirmedDeviceIds = eventBefore.confirmations
          .map(conf => conf.deviceId)
          .filter(id => id !== deviceId && id !== eventBefore.initiatorDeviceId);
        
        if (confirmedDeviceIds.length === 0) {
          request.log.debug(
            { eventId: params.eventId },
            'No other confirmed users to notify about confirmation',
          );
        } else {
          // Sprawdź które z tych deviceIds mają tokeny push
          const tokens = await app.prisma.deviceToken.findMany({
            where: {
              deviceId: { in: confirmedDeviceIds },
            },
            select: {
              deviceId: true,
            },
            distinct: ['deviceId'],
          });
          
          const recipientsWithTokens = tokens.map(t => t.deviceId);
        
        if (recipientsWithTokens.length > 0) {
          const programTitle = eventBefore.program.title || 'Program';
          const channelName = eventBefore.program.channel?.name || '';
          
          const payload = {
            eventId: params.eventId,
            programId: eventBefore.programId,
            channelId: eventBefore.program.channelId,
            programTitle: channelName ? `${channelName}: ${programTitle}` : programTitle,
            startsAt: eventBefore.program.startsAt.toISOString(),
            channelLogoUrl: eventBefore.program.channel ? resolveChannelLogoUrlForApi(eventBefore.program.channel) : null,
            channelLogoThumbDataUrl: eventBefore.program.channel
              ? akpaLogoThumbDataUrl(eventBefore.program.channel.externalId)
              : null,
          };

          await notificationService.sendEventConfirmationNotification(
            recipientsWithTokens,
            payload,
            deviceId,
          );
          request.log.info(
            { eventId: params.eventId, recipientsCount: recipientsWithTokens.length },
            'Sent event confirmation notifications to already confirmed users',
          );
        }
        }
      } catch (error) {
        // Nie przerywaj procesu jeśli powiadomienia się nie udały
        request.log.warn(error, 'Failed to send event confirmation notifications');
      }

      await pointsService.handleEventConfirmation({
        deviceId,
        eventId: params.eventId,
        choice: body.choice,
        delaySeconds: confirmation.delaySeconds ?? null,
        reminderUsed: body.reminderUsed,
      });

      return { data: confirmation };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Event not found') {
          return reply.notFound(error.message);
        }
        if (error.message === 'Event is no longer active') {
          return reply.conflict(error.message);
        }
        if (error.message === 'Event has expired') {
          return reply.conflict(error.message);
        }
      }

      request.log.error(error, 'Failed to confirm event');
      return reply.internalServerError();
    }
  });
}

