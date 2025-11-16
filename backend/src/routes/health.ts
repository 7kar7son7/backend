import fp from 'fastify-plugin';

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
});

export default healthRoutes;

