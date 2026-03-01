import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';

const healthRoutes = fp(async (app) => {
  app.get('/', async () => {
    let database: 'ok' | 'error' = 'ok';

    try {
      await app.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      database = 'error';
      app.log.error(error, 'Database health check failed');
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database,
    };
  });

  /** Diagnostyka logotypów – zawsze pod /health, żeby działało niezależnie od prefixu /logos. */
  app.get('/logos-db', async (_request, reply) => {
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
});

export default healthRoutes;

