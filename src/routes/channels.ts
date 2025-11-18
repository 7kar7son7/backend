import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ChannelService } from '../services/channel.service';
import { ProgramService } from '../services/program.service';

const listQuerySchema = z.object({
  search: z.string().min(2).optional(),
  includePrograms: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => (value ? value === 'true' : undefined)),
});

const programsQuerySchema = z.object({
  from: z
    .string()
    .datetime()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
  to: z
    .string()
    .datetime()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
});

export default async function channelsRoutes(app: FastifyInstance) {
  const channelService = new ChannelService(app.prisma);
  const programService = new ProgramService(app.prisma);

  app.get('/', async (request) => {
    const query = listQuerySchema.parse(request.query);
    const includePrograms = query.includePrograms === true ? true : undefined;
    const filters: { search?: string; includePrograms?: boolean } = {};
    if (query.search) {
      filters.search = query.search;
    }
    if (includePrograms) {
      filters.includePrograms = true;
    }

    const channels = await channelService.listChannels(filters);

    const formattedChannels = channels.map((channel) => {
      const base = {
        id: channel.id,
        externalId: channel.externalId,
        name: channel.name,
        description: channel.description,
        logoUrl: channel.logoUrl,
        category: channel.category,
        countryCode: channel.countryCode,
      };

      if (!includePrograms) {
        return base;
      }

      return {
        ...base,
        programs: (('programs' in channel && Array.isArray(channel.programs)) ? channel.programs : []).map((program: any) => ({
          id: program.id,
          title: program.title,
          channelId: program.channelId,
          channelName: channel.name,
          description: program.description,
          seasonNumber: program.seasonNumber,
          episodeNumber: program.episodeNumber,
          startsAt: program.startsAt,
          endsAt: program.endsAt,
          imageUrl: program.imageUrl,
          tags: program.tags ?? [],
        })),
      };
    });

    return { data: formattedChannels };
  });

  app.get('/:channelId', async (request, reply) => {
    const params = z.object({ channelId: z.string().uuid() }).parse(request.params);
    const channel = await channelService.getChannel(params.channelId);

    if (!channel) {
      return reply.notFound('Channel not found');
    }

    return { data: channel };
  });

  app.get('/:channelId/programs', async (request, reply) => {
    const params = z.object({ channelId: z.string().uuid() }).parse(request.params);
    const query = programsQuerySchema.parse(request.query);

    const channel = await channelService.getChannel(params.channelId);
    if (!channel) {
      return reply.notFound('Channel not found');
    }

    const filter: { from?: Date; to?: Date } = {};
    if (query.from) {
      filter.from = query.from;
    }
    if (query.to) {
      filter.to = query.to;
    }

    const programs = await programService.listUpcomingByChannel(
      params.channelId,
      filter,
    );

    return {
      data: {
        channel,
        programs,
      },
    };
  });
}

