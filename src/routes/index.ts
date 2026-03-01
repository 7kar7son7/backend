import { Prisma } from '@prisma/client';
import healthRoutes from './health';
import appRoutes from './app';
import channelsRoutes from './channels';
import followsRoutes from './follows';
import eventsRoutes from './events';
import deviceTokensRoutes from './device-tokens';
import pointsRoutes from './points';
import programsRoutes from './programs';
import epgRoutes from './epg';
import logosRoutes from './logos';

export async function registerRoutes<T extends import('fastify').FastifyInstance>(
  app: T,
) {
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(appRoutes, { prefix: '/app' });
  await app.register(channelsRoutes, { prefix: '/channels' });
  await app.register(followsRoutes, { prefix: '/follows' });
  await app.register(eventsRoutes, { prefix: '/events' });
  await app.register(deviceTokensRoutes, { prefix: '/device/tokens' });
  await app.register(pointsRoutes, { prefix: '/points' });
  await app.register(programsRoutes, { prefix: '/programs' });
  await app.register(epgRoutes, { prefix: '/epg' });

  // Diagnostyka logotypów – rejestracja na głównej instancji (bez prefixu), żeby działała zawsze
  app.get('/logos/debug/db', async (_request, reply) => {
    try {
      const countResult = await app.prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(*) as count FROM channels WHERE "externalId" LIKE 'akpa_%' AND "logoData" IS NOT NULL AND length("logoData") > 0`,
      );
      const count = Number(countResult[0]?.count ?? 0);
      const dbHost = process.env.DATABASE_URL?.replace(/^[^@]+@/, '***@').split('/')[0] ?? 'unknown';
      return reply.send({
        ok: true,
        channelsWithLogo: count,
        databaseHost: dbHost,
        message: count >= 60 ? 'Baza OK – backend widzi logotypy.' : `Tylko ${count} kanałów z logoData – sprawdź DATABASE_URL.`,
      });
    } catch (err) {
      return reply.code(500).send({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        message: 'Błąd połączenia z bazą lub zapytania.',
      });
    }
  });

  await app.register(logosRoutes, { prefix: '/logos' });
}

