import { FastifyInstance } from 'fastify';
import { FollowType } from '@prisma/client';
import { z } from 'zod';

import { FollowService } from '../services/follow.service';
import { getDeviceId } from '../utils/device';

const followBodySchema = z.object({
  type: z.enum([FollowType.CHANNEL, FollowType.PROGRAM]),
  targetId: z.string().uuid(),
});

function formatFollow(follow: any) {
  return {
    id: String(follow.id),
    deviceId: String(follow.deviceId),
    type: String(follow.type),
    channel: follow.channel ? {
      id: String(follow.channel.id),
      externalId: String(follow.channel.externalId),
      name: String(follow.channel.name),
      description: follow.channel.description ?? null,
      category: follow.channel.category ?? null,
      logoUrl: follow.channel.logoUrl ?? null,
      countryCode: follow.channel.countryCode ?? null,
    } : null,
    program: follow.program ? {
      id: String(follow.program.id),
      title: String(follow.program.title),
      channelId: String(follow.program.channelId),
      channelName: String(follow.program.channel?.name ?? ''),
      channelLogoUrl: follow.program.channel?.logoUrl ?? null,
      description: follow.program.description ?? null,
      seasonNumber: follow.program.seasonNumber ?? null,
      episodeNumber: follow.program.episodeNumber ?? null,
      startsAt: follow.program.startsAt.toISOString(),
      endsAt: follow.program.endsAt?.toISOString() ?? null,
      imageUrl: follow.program.imageUrl ?? null,
      tags: follow.program.tags ?? [],
    } : null,
    createdAt: follow.createdAt.toISOString(),
    updatedAt: follow.updatedAt?.toISOString() ?? null,
  };
}

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
    const formattedFollows = follows.map(formatFollow);
    return { data: formattedFollows };
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
    const formattedFollows = follows.map(formatFollow);
    return reply.code(201).send({ data: formattedFollows });
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
    const formattedFollows = follows.map(formatFollow);
    return { data: formattedFollows };
  });
}
