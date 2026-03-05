import fp from 'fastify-plugin';
import { env } from '../config/env';

const appRoutes = fp(async (app) => {
  app.get('/version', async () => {
    return {
      version: env.APP_VERSION ?? '1.0.0',
      buildNumber: env.APP_BUILD_NUMBER ?? 1,
      minRequiredVersion: env.APP_MIN_REQUIRED_VERSION ?? null,
      updateUrl: env.APP_UPDATE_URL ?? 'https://play.google.com/store/apps/details?id=com.backontv.app',
    };
  });
});

export default appRoutes;
