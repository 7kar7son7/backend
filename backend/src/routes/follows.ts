import { FastifyInstance } from 'fastify';
import { FollowType } from '@prisma/client';
import { z } from 'zod';

import { FollowService } from '../services/follow.service';
import { getDeviceId } from '../utils/device';

const FOLLOWS_CACHE_TTL_MS = 60_000; // 60 s – lista ulubionych bez logoData w SQL; dłuższy cache = mniej powtórzeń przy nawigacji
const followsCache = new Map<string, { payload: unknown; expiresAt: number }>();

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

    const cached = followsCache.get(deviceId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const follows = await followService.list(deviceId);
    const payload = { data: follows };
    followsCache.set(deviceId, {
      payload,
      expiresAt: Date.now() + FOLLOWS_CACHE_TTL_MS,
    });
    return payload;
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
      followsCache.delete(deviceId);
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
    followsCache.delete(deviceId);

    // Zwracamy od razu bez list() – unikamy wolnego zapytania i timeoutu 408.
    // Aplikacja po unfollow i tak odświeża listę (np. _loadFollowedPrograms).
    return { data: [] };
  });
}

