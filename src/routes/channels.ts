import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { resolveChannelLogoUrlForApi } from '../utils/channel-logo';
import { ChannelService } from '../services/channel.service';
import { ProgramService } from '../services/program.service';

const listQuerySchema = z.object({
  search: z.string().min(2).optional(),
  includePrograms: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => (value ? value === 'true' : undefined)),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
  offset: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
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

  app.get('/', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const includePrograms = query.includePrograms === true ? true : undefined;
    const filters: { search?: string; includePrograms?: boolean; limit?: number; offset?: number } = {};
    if (query.search) {
      filters.search = query.search;
    }
    if (includePrograms) {
      filters.includePrograms = true;
    }
    if (query.limit !== undefined) {
      filters.limit = query.limit;
    }
    if (query.offset !== undefined) {
      filters.offset = query.offset;
    }

    const channels = await channelService.listChannels(filters);
    request.log.info(
      { count: channels.length, limit: filters.limit, offset: filters.offset },
      'GET /channels – lista kanałów',
    );

    const formattedChannels = channels.map((channel) => {
      const resolvedLogoUrl = resolveChannelLogoUrlForApi(channel);
      const base = {
        id: String(channel.id),
        externalId: String(channel.externalId),
        name: String(channel.name),
        description: channel.description != null ? String(channel.description) : null,
        logoUrl: resolvedLogoUrl ?? null,
        category: channel.category != null ? String(channel.category) : null,
        countryCode: channel.countryCode != null ? String(channel.countryCode) : null,
      };

      if (!includePrograms) {
        return base;
      }

      const programs = ('programs' in channel && Array.isArray(channel.programs)) ? channel.programs : [];
      const programsList = programs.map((program: any) => ({
        id: String(program.id),
        title: String(program.title),
        channelId: String(program.channelId),
        channelName: String(channel.name),
        channelLogoUrl: resolvedLogoUrl ?? null,
        description: program.description != null ? String(program.description) : null,
        seasonNumber: program.seasonNumber ?? null,
        episodeNumber: program.episodeNumber ?? null,
        startsAt: program.startsAt instanceof Date ? program.startsAt.toISOString() : program.startsAt,
        endsAt: program.endsAt instanceof Date ? program.endsAt.toISOString() : program.endsAt,
        imageUrl: program.imageUrl != null ? String(program.imageUrl) : (resolvedLogoUrl ?? null),
        tags: Array.isArray(program.tags) ? program.tags.map((t: unknown) => String(t)) : [],
      }));
      // Gdy 0 programów – nie dodawaj klucza "programs", żeby format był jak GET bez includePrograms (działa w Ustawieniach).
      if (programsList.length === 0) {
        return base;
      }
      return { ...base, programs: programsList };
    });

    return reply.type('application/json').send({ data: formattedChannels });
  });

  app.get('/:channelId', async (request, reply) => {
    const params = z.object({ channelId: z.string().uuid() }).parse(request.params);
    const channel = await channelService.getChannel(params.channelId);

    if (!channel) {
      return reply.notFound('Channel not found');
    }

    const logoUrl = resolveChannelLogoUrlForApi(channel);
    return { data: { ...channel, logoUrl } };
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

    const logoUrl = resolveChannelLogoUrlForApi(channel);
    return {
      data: {
        channel: { ...channel, logoUrl },
        programs: programs.map((program) => ({
          id: program.id,
          title: program.title,
          channelId: program.channelId,
          channelName: channel.name,
          channelLogoUrl: logoUrl,
          description: program.description ?? null,
          seasonNumber: program.seasonNumber ?? null,
          episodeNumber: program.episodeNumber ?? null,
          startsAt: program.startsAt instanceof Date ? program.startsAt.toISOString() : program.startsAt,
          endsAt: program.endsAt instanceof Date ? program.endsAt.toISOString() : program.endsAt,
          imageUrl: program.imageUrl ?? logoUrl ?? null,
          tags: program.tags ?? [],
        })),
      },
    };
  });
}

