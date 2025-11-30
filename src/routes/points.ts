import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { PointsService } from '../services/points.service';
import { getDeviceId } from '../utils/device';

const manualPointsSchema = z.object({
  deviceId: z.string(),
  amount: z.number().int(),
  description: z.string().min(3),
});

export default async function pointsRoutes(app: FastifyInstance) {
  const pointsService = new PointsService(app.prisma);

  app.get('/me', async (request, reply) => {
    let deviceId: string;
    try {
      deviceId = getDeviceId(request);
    } catch (error) {
      request.log.warn(error);
      return reply.badRequest('Missing X-Device-Id header');
    }

    const summary = await pointsService.getSummary(deviceId);
    return { data: summary };
  });

  app.post('/manual', async (request, reply) => {
    const body = manualPointsSchema.parse(request.body);

    await pointsService.addManualPoints(body.deviceId, body.amount, body.description);
    return reply.code(201).send({ status: 'ok' });
  });

  app.get('/leaderboard', async (request, reply) => {
    const query = z
      .object({
        limit: z.string().optional().transform((val) => (val ? Number.parseInt(val, 10) : 50)),
      })
      .parse(request.query);

    const leaderboard = await pointsService.getLeaderboard(query.limit);
    return { data: leaderboard };
  });
}

