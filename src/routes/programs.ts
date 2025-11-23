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
});

export default async function programsRoutes(app: FastifyInstance) {
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

      app.log.info({
        selectedDate: selectedDate.toISOString(),
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString(),
        queryDate: query.date?.toISOString(),
      }, 'Fetching programs for day');

      const programs = await app.prisma.program.findMany({
        where: {
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
        include: {
          channel: true,
        },
        orderBy: {
          startsAt: 'asc',
        },
      });

      app.log.info({
        totalPrograms: programs.length,
        programsWithChannels: programs.filter((p) => p.channel != null).length,
        dateRange: { start: startOfDay.toISOString(), end: endOfDay.toISOString() },
      }, 'Found programs for day');

      const filteredPrograms = programs.filter((program) => program.channel != null);
      
      return {
        data: filteredPrograms.map((program) => ({
            id: program.id,
            title: program.title,
            channelId: program.channelId,
            channelName: program.channel?.name ?? program.channelId,
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
}
