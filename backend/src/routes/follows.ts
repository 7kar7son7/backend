import { FastifyInstance } from 'fastify';
import { FollowType } from '@prisma/client';
import { z } from 'zod';

import { FollowService } from '../services/follow.service';
import { getDeviceId } from '../utils/device';

const followBodySchema = z.object({
  type: z.enum([FollowType.CHANNEL, FollowType.PROGRAM]),
  targetId: z.string().uuid(),
});

export default async function followsRoutes(app: FastifyInstance) {
  const followService = new FollowService(app.prisma);

  app.get('/', async (request, reply) => {
    let deviceId: string;
    try {
      deviceId = getDeviceId(request);
    } catch (error) {
      request.log.warn(error);
      return reply.badRequest('Missing X-Device-Id header');
    }

    const follows = await followService.list(deviceId);
    return { data: follows };
  });

  app.post('/', async (request, reply) => {
    let deviceId: string;
    try {
      deviceId = getDeviceId(request);
    } catch (error) {
      request.log.warn(error);
      return reply.badRequest('Missing X-Device-Id header');
    }

    const body = followBodySchema.parse(request.body);

    try {
      if (body.type === FollowType.CHANNEL) {
        await followService.followChannel(deviceId, body.targetId);
      } else {
        await followService.followProgram(deviceId, body.targetId);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('No Channel found') ||
        error instanceof Error &&
        error.message.includes('No Program found')
      ) {
        return reply.notFound(error.message);
      }
      request.log.error(error, 'Failed to follow target');
      return reply.internalServerError();
    }

    const follows = await followService.list(deviceId);
    return reply.code(201).send({ data: follows });
  });

  app.delete('/', async (request, reply) => {
    let deviceId: string;
    try {
      deviceId = getDeviceId(request);
    } catch (error) {
      request.log.warn(error);
      return reply.badRequest('Missing X-Device-Id header');
    }

    const body = followBodySchema.parse(request.body);

    if (body.type === FollowType.CHANNEL) {
      await followService.unfollowChannel(deviceId, body.targetId);
    } else {
      await followService.unfollowProgram(deviceId, body.targetId);
    }

    const follows = await followService.list(deviceId);
    return { data: follows };
  });
}

