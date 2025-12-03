import { FastifyInstance } from 'fastify';
import { EventChoice } from '@prisma/client';
import { z } from 'zod';

import { EventService } from '../services/event.service';
import { NotificationService } from '../services/notification.service';
import { PointsService } from '../services/points.service';
import { getDeviceId } from '../utils/device';

const createEventSchema = z.object({
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

      const payload = {
        eventId: event.id,
        programId: event.programId,
        channelId: event.program.channelId,
        programTitle: event.program.title,
        startsAt: event.program.startsAt.toISOString(),
      };

      const recipients = followerDeviceIds.filter((id) => id !== deviceId);
      await notificationService.sendEventStartedNotification(recipients, payload);

      // Formatuj event.program tak jak w innych endpointach (dodaj channelName)
      const formattedEvent = {
        ...event,
        program: {
          ...event.program,
          channelName: event.program.channel?.name ?? event.program.channelId,
          channelLogoUrl: event.program.channel?.logoUrl ?? null,
        },
      };

      return reply.code(201).send({ data: formattedEvent });
    } catch (error) {
      if (error instanceof Error && error.message === 'Program not found') {
        return reply.notFound(error.message);
      }
      request.log.error(error, 'Failed to create event');
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
      const confirmation = await eventService.confirmEvent(
        params.eventId,
        deviceId,
        body.choice,
        body.reminderUsed,
      );

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

