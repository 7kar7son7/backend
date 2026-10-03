import { FastifyInstance } from 'fastify';

import { listLiveAdBreaks } from '../services/live-ad-breaks.service';
import { getAdBreakStatsService } from '../services/ad-break-stats.service';

export default async function adBreakStatsRoutes(app: FastifyInstance) {
  app.get('/stats', async () => {
    const service = getAdBreakStatsService(app.prisma);
    await service.ensureFresh();
    return { data: service.snapshot() };
  });

  app.get('/live', async () => {
    const data = await listLiveAdBreaks(app.prisma);
    return { data };
  });
}
