import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { DeviceTokenService } from '../services/device-token.service';
import { getDeviceId } from '../utils/device';

const registerSchema = z.object({
  token: z.string().min(10),
  platform: z.string().optional(),
});

const deleteSchema = z.object({
  token: z.string().min(10),
});

export default async function deviceTokensRoutes(app: FastifyInstance) {
  const deviceTokenService = new DeviceTokenService(app.prisma);

  app.post('/', async (request, reply) => {
    let deviceId: string;
    try {
      deviceId = getDeviceId(request);
    } catch (error) {
      request.log.warn(error);
      return reply.badRequest('Missing X-Device-Id header');
    }

    const body = registerSchema.parse(request.body);
    await deviceTokenService.registerToken(deviceId, body.token, body.platform);

    return reply.code(201).send({ status: 'ok' });
  });

  app.delete('/', async (request, reply) => {
    const body = deleteSchema.parse(request.body);
    await deviceTokenService.unregisterToken(body.token);

    return { status: 'ok' };
  });
}

