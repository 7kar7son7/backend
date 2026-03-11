import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { resolveChannelLogoUrlForApi } from '../utils/channel-logo';
import { programImageUrlForApi } from '../utils/program-photo-url';
import { env } from '../config/env';

const dayQuerySchema = z.object({
  date: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      try {
        return new Date(value);
      } catch {
        return undefined;
      }
    }),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
  offset: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
});

export default async function programsRoutes(app: FastifyInstance) {
  /** Zdjęcie programu – ZAWSZE z AKPA przez proxy (token), NIGDY z bazy. */
  app.get('/photo/:programId', async (request, reply) => {
    try {
      const { programId } = request.params as { programId: string };
      const program = await app.prisma.program.findUnique({
        where: { id: programId },
        select: { imageUrl: true },
      });
      const akpaUrl = program?.imageUrl?.trim();
      if (!akpaUrl) {
        return reply.code(404).send({ error: 'Photo not found', message: 'Program has no photo URL' });
      }
      try {
        const parsed = new URL(akpaUrl);
        const isAkpa =
          parsed.hostname === 'api-epg.akpa.pl' || parsed.hostname.endsWith('.akpa.pl');
        if (!isAkpa) {
          return reply.code(404).send({ error: 'Photo not found', message: 'Program photo is not from AKPA' });
        }
      } catch {
        return reply.code(404).send({ error: 'Photo not found', message: 'Invalid photo URL' });
      }
      const proxyPath = '/photos/proxy?url=' + encodeURIComponent(akpaUrl);
      return reply.redirect(proxyPath, 302);
    } catch (error) {
      request.log.error(error, 'Failed to serve program photo');
      return reply.code(500).send({
        error: 'Failed to serve program photo',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /** Wyszukiwanie programów po tytule – używane w aplikacji jako /programs/search. */
  app.get('/search', async (request, reply) => {
    try {
      const querySchema = z.object({
        search: z.string().min(1),
        limit: z
          .string()
          .optional()
          .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
      });

      const query = querySchema.parse(request.query);
      const now = new Date();

      const programs = await app.prisma.program.findMany({
        where: {
          AND: [
            {
              title: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
            {
              // Nie pokazuj programów, które już się skończyły
              endsAt: {
                gt: now,
              },
            },
          ],
        },
        include: {
          channel: true,
        },
        orderBy: {
          startsAt: 'asc',
        },
        take: query.limit ?? 50,
      });

      return reply.send({
        data: programs.map((program) => ({
          id: program.id,
          title: program.title,
          channelId: program.channelId,
          channelName: program.channel?.name ?? program.channelId ?? 'Nieznany kanał',
          channelLogoUrl: program.channel ? resolveChannelLogoUrlForApi(program.channel) : null,
          description: program.description,
          seasonNumber: program.seasonNumber,
          episodeNumber: program.episodeNumber,
          startsAt: program.startsAt instanceof Date ? program.startsAt.toISOString() : program.startsAt,
          endsAt: program.endsAt instanceof Date ? program.endsAt.toISOString() : program.endsAt,
          imageUrl:
            programImageUrlForApi(program.imageUrl, env.PUBLIC_API_URL, {
              programId: program.id,
              hasImageData: program.imageHasData,
            }) ??
            (program.channel ? resolveChannelLogoUrlForApi(program.channel) : null) ??
            null,
          tags: program.tags ?? [],
        })),
      });
    } catch (error) {
      request.log.error(error, 'Failed to search programs');
      return reply.code(500).send({
        error: 'Failed to search programs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/:programId', async (request, reply) => {
    try {
      const { programId } = request.params as { programId: string };

      const program = await app.prisma.program.findUnique({
        where: { id: programId },
        include: {
          channel: true,
        },
      });

      if (!program) {
        return reply.code(404).send({
          error: 'Program not found',
          message: `Program with id ${programId} not found`,
        });
      }

      return reply
        .header('Cache-Control', 'private, max-age=60')
        .send({
          data: {
            id: program.id,
            title: program.title,
            channelId: program.channelId,
            channelName: program.channel?.name ?? program.channelId ?? 'Nieznany kanał',
            channelLogoUrl: program.channel ? resolveChannelLogoUrlForApi(program.channel) : null,
            description: program.description,
            seasonNumber: program.seasonNumber,
            episodeNumber: program.episodeNumber,
            startsAt: program.startsAt instanceof Date ? program.startsAt.toISOString() : program.startsAt,
            endsAt: program.endsAt instanceof Date ? program.endsAt.toISOString() : program.endsAt,
            imageUrl: programImageUrlForApi(program.imageUrl, env.PUBLIC_API_URL, { programId: program.id, hasImageData: program.imageHasData }) ?? (program.channel ? resolveChannelLogoUrlForApi(program.channel) : null) ?? null,
            tags: program.tags ?? [],
          },
        });
    } catch (error) {
      request.log.error(error, 'Failed to fetch program');
      return reply.code(500).send({
        error: 'Failed to fetch program',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/day', async (request, reply) => {
    try {
      const query = dayQuerySchema.parse(request.query);

      const selectedDate = query.date ?? new Date();
      const startOfDay = new Date(
        Date.UTC(
          selectedDate.getUTCFullYear(),
          selectedDate.getUTCMonth(),
          selectedDate.getUTCDate(),
        ),
      );
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      const now = new Date();

      app.log.info({
        selectedDate: selectedDate.toISOString(),
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString(),
        now: now.toISOString(),
        queryDate: query.date?.toISOString(),
      }, 'Fetching programs for day');

      // Dla dzisiejszego dnia: pokazuj tylko programy aktualnie emitowane lub przyszłe
      // Dla innych dni: pokazuj wszystkie programy z tego dnia
      const isToday = selectedDate.toDateString() === new Date().toDateString();
      const minTime = isToday ? now : startOfDay;

      // Filtruj programy z kanałami bezpośrednio w zapytaniu - szybsze!
      const programs = await app.prisma.program.findMany({
        where: {
          AND: [
            {
              OR: [
                {
                  startsAt: {
                    gte: startOfDay,
                    lt: endOfDay,
                  },
                },
                {
                  startsAt: {
                    lt: endOfDay,
                  },
                  endsAt: {
                    gt: startOfDay,
                  },
                },
              ],
            },
            // Filtruj: pokazuj tylko programy, które jeszcze się nie zakończyły
            {
              endsAt: {
                gt: minTime,
              },
            },
          ],
        },
        include: {
          channel: true,
        },
        orderBy: {
          startsAt: 'asc',
        },
        take: query.limit ?? 500, // Domyślnie 500, ale można ograniczyć przez query
        skip: query.offset ?? 0, // Paginacja
      });

      app.log.info({
        totalPrograms: programs.length,
        dateRange: { start: startOfDay.toISOString(), end: endOfDay.toISOString() },
      }, 'Found programs for day');

      // Uproszczone sortowanie - tylko dla dzisiejszego dnia
      // Dla innych dni po prostu zwracamy posortowane po startsAt (już z bazy)
      let sortedPrograms = programs;
      if (isToday) {
        // Tylko dla dzisiejszego dnia: sortuj tak, aby aktualne programy były na górze
        sortedPrograms = programs.sort((a, b) => {
          const aStartsAt = a.startsAt.getTime();
          const bStartsAt = b.startsAt.getTime();
          const nowTime = now.getTime();
          
          const aIsPast = aStartsAt < nowTime;
          const bIsPast = bStartsAt < nowTime;
          
          if (aIsPast && bIsPast) {
            // Oba są w przeszłości - sortuj malejąco (najpóźniejsze wcześniejsze na górze)
            return bStartsAt - aStartsAt;
          } else if (!aIsPast && !bIsPast) {
            // Oba są w przyszłości - sortuj rosnąco (najwcześniejsze późniejsze na dole)
            return aStartsAt - bStartsAt;
          } else {
            // Jeden w przeszłości, jeden w przyszłości - przeszłość przed przyszłością
            return aIsPast ? -1 : 1;
          }
        });
      }
      
      return {
        data: sortedPrograms.map((program) => ({
            id: program.id,
            title: program.title,
            channelId: program.channelId,
            channelName: program.channel?.name ?? program.channelId ?? 'Nieznany kanał',
            channelLogoUrl: program.channel ? resolveChannelLogoUrlForApi(program.channel) : null,
            description: program.description,
            seasonNumber: program.seasonNumber,
            episodeNumber: program.episodeNumber,
            startsAt: program.startsAt instanceof Date ? program.startsAt.toISOString() : program.startsAt,
            endsAt: program.endsAt instanceof Date ? program.endsAt.toISOString() : program.endsAt,
            imageUrl: programImageUrlForApi(program.imageUrl, env.PUBLIC_API_URL, { programId: program.id, hasImageData: program.imageHasData }) ?? (program.channel ? resolveChannelLogoUrlForApi(program.channel) : null) ?? null,
            tags: program.tags ?? [],
          })),
      };
    } catch (error) {
      request.log.error(error, 'Failed to fetch programs for day');
      return reply.code(500).send({
        error: 'Failed to fetch programs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
