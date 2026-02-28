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
  await app.register(logosRoutes, { prefix: '/logos' });
}

