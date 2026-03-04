import fp from 'fastify-plugin';
import { z } from 'zod';
import { env } from '../config/env';
import { AbuseService } from '../services/abuse.service';

const blockDeviceSchema = z.object({
  deviceId: z.string().min(1),
  reason: z.string().optional(),
});

const appRoutes = fp(async (app) => {
  app.get('/version', async () => {
    return {
      version: env.APP_VERSION ?? '1.0.0',
      buildNumber: env.APP_BUILD_NUMBER ?? 1,
      minRequiredVersion: env.APP_MIN_REQUIRED_VERSION ?? null,
      updateUrl: env.APP_UPDATE_URL ?? 'https://play.google.com/store/apps/details?id=com.backontv.app',
    };
  });

  /** Blokada konta/urządzenia (wymaga ADMIN_EVENT_SECRET). */
  app.post('/block-device', async (request, reply) => {
    if (!env.ADMIN_EVENT_SECRET) {
      return reply.forbidden('Admin block is not configured');
    }
    const rawToken = request.headers['x-admin-secret'];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    if (!token || token !== env.ADMIN_EVENT_SECRET) {
      return reply.unauthorized('Invalid admin token');
    }
    const body = blockDeviceSchema.parse(request.body);
    const abuseService = new AbuseService(app.prisma);
    await abuseService.blockDevice(body.deviceId, body.reason ?? 'blocked_by_admin');
    return reply.code(200).send({ status: 'ok', deviceId: body.deviceId });
  });
});

export default appRoutes;
