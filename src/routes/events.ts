import { FastifyInstance } from 'fastify';
import { EventChoice, EventStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

import { EventService } from '../services/event.service';
import { NotificationService } from '../services/notification.service';
import { PointsService } from '../services/points.service';
import { getDeviceId } from '../utils/device';
import { env } from '../config/env';

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
    // NIE wysyłaj powiadomień od razu - będą wysłane dopiero gdy event osiągnie próg
    // (w confirmEvent, gdy confirmationsCount >= followerCountLimit)

    return {
      ...event,
      program: {
        ...event.program,
        channelName: event.program.channel?.name ?? event.program.channelId,
        channelLogoUrl: event.program.channel?.logoUrl ?? null,
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
        channelLogoUrl: event.program.channel?.logoUrl ?? null,
      },
    }));
    
    return { data: formattedEvents };
  });

  app.post('/', async (request, reply) => {
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

      const formattedEvent = await finalizeEventResponse(event, followerDeviceIds, deviceId);
      return reply.code(201).send({ data: formattedEvent });
    } catch (error) {
      if (error instanceof Error && error.message === 'Program not found') {
        return reply.notFound(error.message);
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

  app.post('/:eventId/confirm', async (request, reply) => {
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

      // Sprawdź czy event osiągnął próg TERAZ (po dodaniu tego potwierdzenia)
      // i czy wcześniej NIE był zwalidowany (żeby nie wysyłać powiadomień wielokrotnie)
      const confirmationsCount = await eventService.getEventConfirmationsCount(params.eventId);
      const eventAfter = await eventService.getEvent(params.eventId);
      const shouldSendNotifications =
        !wasAlreadyValidated &&
        eventBefore.followerCountLimit &&
        confirmationsCount >= eventBefore.followerCountLimit &&
        eventAfter?.status === EventStatus.VALIDATED;

      if (shouldSendNotifications) {
        // Pobierz wszystkich followers programu (oprócz tych którzy już zgłosili)
        const recipients = await eventService.getProgramFollowersForNotification(
          params.eventId,
          eventBefore.programId,
        );

        if (recipients.length > 0) {
          // Upewnij się, że mamy czytelny tytuł programu
          const programTitle = eventBefore.program.title || 'Program';
          const channelName = eventBefore.program.channel?.name || '';
          
          const payload = {
            eventId: params.eventId,
            programId: eventBefore.programId,
            channelId: eventBefore.program.channelId,
            programTitle: channelName ? `${channelName}: ${programTitle}` : programTitle,
            startsAt: eventBefore.program.startsAt.toISOString(),
          };

          await notificationService.sendEventStartedNotification(recipients, payload);
          request.log.info(
            { eventId: params.eventId, recipientsCount: recipients.length },
            'Sent event notifications after threshold reached',
          );
        }
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

