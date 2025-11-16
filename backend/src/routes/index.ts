import healthRoutes from './health';
import channelsRoutes from './channels';
import followsRoutes from './follows';
import eventsRoutes from './events';
import deviceTokensRoutes from './device-tokens';
import pointsRoutes from './points';
import programsRoutes from './programs';

export async function registerRoutes<T extends import('fastify').FastifyInstance>(
  app: T,
) {
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(channelsRoutes, { prefix: '/channels' });
  await app.register(followsRoutes, { prefix: '/follows' });
  await app.register(eventsRoutes, { prefix: '/events' });
  await app.register(deviceTokensRoutes, { prefix: '/device/tokens' });
  await app.register(pointsRoutes, { prefix: '/points' });
  await app.register(programsRoutes, { prefix: '/programs' });
}

