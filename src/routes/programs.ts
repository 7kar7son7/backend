import { FastifyInstance } from 'fastify';
import { z } from 'zod';

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

const searchQuerySchema = z.object({
  search: z.string().min(2),
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
  const programService = new (await import('../services/program.service')).ProgramService(app.prisma);

  app.get('/search', async (request, reply) => {
    try {
      const query = searchQuerySchema.parse(request.query);
      const programs = await programService.searchPrograms({
        search: query.search,
        ...(query.limit !== undefined && { limit: query.limit }),
        ...(query.offset !== undefined && { offset: query.offset }),
      });

      return {
        data: programs.map((program) => ({
          id: program.id,
          title: program.title,
          channelId: program.channelId,
          channelName: program.channel?.name ?? program.channelId,
          channelLogoUrl: program.channel?.logoUrl ?? null,
          description: program.description,
          seasonNumber: program.seasonNumber,
          episodeNumber: program.episodeNumber,
          startsAt: program.startsAt,
          endsAt: program.endsAt,
          imageUrl: program.imageUrl ?? program.channel?.logoUrl ?? null,
          tags: program.tags ?? [],
        })),
      };
    } catch (error) {
      request.log.error(error, 'Failed to search programs');
      return reply.code(500).send({
        error: 'Failed to search programs',
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
            channelName: program.channel?.name ?? program.channelId,
            channelLogoUrl: program.channel?.logoUrl ?? null,
            description: program.description,
            seasonNumber: program.seasonNumber,
            episodeNumber: program.episodeNumber,
            startsAt: program.startsAt,
            endsAt: program.endsAt,
            imageUrl: program.imageUrl ?? program.channel?.logoUrl ?? null,
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

  app.get('/:programId', async (request, reply) => {
    try {
      const params = z.object({ programId: z.string().uuid() }).parse(request.params);
      
      const program = await app.prisma.program.findUnique({
        where: { id: params.programId },
        include: {
          channel: true,
        },
      });

      if (!program) {
        return reply.notFound('Program not found');
      }

      return {
        data: {
          id: program.id,
          title: program.title,
          channelId: program.channelId,
          channelName: program.channel?.name ?? program.channelId,
          channelLogoUrl: program.channel?.logoUrl ?? null,
          description: program.description,
          seasonNumber: program.seasonNumber,
          episodeNumber: program.episodeNumber,
          startsAt: program.startsAt,
          endsAt: program.endsAt,
          imageUrl: program.imageUrl ?? program.channel?.logoUrl ?? null,
          tags: program.tags ?? [],
        },
      };
    } catch (error) {
      request.log.error(error, 'Failed to fetch program');
      return reply.code(500).send({
        error: 'Failed to fetch program',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
