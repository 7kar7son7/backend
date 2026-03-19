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
import photosRoutes from './photos';

export async function registerRoutes<T extends import('fastify').FastifyInstance>(
  app: T,
) {
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(appRoutes, { prefix: '/app' });
  await app.register(photosRoutes, { prefix: '/photos' });
  await app.register(channelsRoutes, { prefix: '/channels' });
  await app.register(followsRoutes, { prefix: '/follows' });
  await app.register(eventsRoutes, { prefix: '/events' });
  await app.register(deviceTokensRoutes, { prefix: '/device/tokens' });
  await app.register(pointsRoutes, { prefix: '/points' });
  await app.register(programsRoutes, { prefix: '/programs' });
  await app.register(epgRoutes, { prefix: '/epg' });

  await app.register(logosRoutes, { prefix: '/logos' });

  app.get('/logos-ping', async (_req, reply) => reply.send({ ok: true, msg: 'main app' }));

  // app-ads.txt (IAB Tech Lab) – weryfikacja sprzedawców reklam dla aplikacji (AdMob/Google Play)
  const APP_ADS_TXT = 'google.com, pub-6373424298734336, DIRECT, f08c47fec0942fa0\n';
  app.get('/app-ads.txt', async (_req, reply) => {
    return reply
      .header('Content-Type', 'text/plain; charset=utf-8')
      .send(APP_ADS_TXT);
  });
}

