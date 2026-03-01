import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { AKPA_LOGOS_DEFAULTS } from '../config/akpa-logos-defaults';
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

  // Diagnostyka logotypów – na głównej instancji, żeby zawsze działała (nie zależała od pluginu)
  app.get('/logos/debug/db', async (_request, reply) => {
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

  app.get<{ Params: { channelId: string } }>('/logos/debug/akpa/:channelId', async (request, reply) => {
    const channelId = request.params.channelId;
    if (!channelId || !/^akpa_[a-zA-Z0-9_]+$/.test(channelId) || channelId.length > 128) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }
    const ch = await app.prisma.channel.findUnique({
      where: { externalId: channelId },
      select: { name: true, logoData: true, logoContentType: true },
    });
    const hasData = ch?.logoData != null;
    const len =
      hasData && Buffer.isBuffer(ch!.logoData)
        ? ch!.logoData.length
        : hasData && ch!.logoData instanceof Uint8Array
          ? ch!.logoData.length
          : null;
    let rawLogoDataLength: number | null = null;
    let hexLength: number | null = null;
    if (ch) {
      const raw = await app.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`SELECT "logoData", "logoContentType" FROM channels WHERE "externalId" = ${channelId} LIMIT 1`,
      );
      const row = raw[0];
      const rawData = row?.['logoData'] ?? row?.['logodata'];
      if (rawData != null && typeof (rawData as Buffer).length === 'number')
        rawLogoDataLength = (rawData as Buffer).length;
      const hexRow = await app.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`SELECT encode("logoData", 'hex') as hex_data FROM channels WHERE "externalId" = ${channelId} LIMIT 1`,
      );
      const h = hexRow[0];
      const hexVal = h ? (h['hex_data'] ?? h['hex_data']) : null;
      if (hexVal && typeof hexVal === 'string') hexLength = hexVal.length;
    }
    const baseUrl = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? AKPA_LOGOS_DEFAULTS.BASE_URL).trim();
    const user = (env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? AKPA_LOGOS_DEFAULTS.USER).trim();
    const password = (env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? AKPA_LOGOS_DEFAULTS.PASSWORD).trim();
    return reply.send({
      channelId,
      channelFound: !!ch,
      hasLogoData: hasData,
      hasContentType: !!(ch?.logoContentType),
      logoDataLength: len,
      rawLogoDataLength,
      hexLength,
      name: ch?.name ?? null,
      akpaLogosConfigured: !!(baseUrl && user && password),
    });
  });

  // Serwowanie logotypu z bazy – ta sama ścieżka co w debug (encode hex), żeby w aplikacji się wyświetlały
  app.get<{ Params: { channelId: string } }>('/logos/akpa/:channelId', async (request, reply) => {
    const channelId = request.params.channelId;
    if (!channelId || !/^akpa_[a-zA-Z0-9_]+$/.test(channelId) || channelId.length > 128) {
      return reply.code(400).send({ error: 'Invalid channel id' });
    }
    const channel = await app.prisma.channel.findUnique({
      where: { externalId: channelId },
      select: { logoContentType: true },
    });
    if (!channel) {
      return reply.code(404).send({ error: 'Logo not found' });
    }
    const hexRow = await app.prisma.$queryRaw<Array<Record<string, unknown>>>(
      Prisma.sql`SELECT encode("logoData", 'hex') as hex_data, "logoContentType" as logo_content_type FROM channels WHERE "externalId" = ${channelId} LIMIT 1`,
    );
    const row = hexRow[0];
    if (!row) {
      return reply.code(404).send({ error: 'Logo not found' });
    }
    const hexVal = row['hex_data'];
    const ctVal = row['logo_content_type'];
    const hexStr = hexVal == null ? '' : Buffer.isBuffer(hexVal) ? hexVal.toString('utf8') : String(hexVal).trim();
    if (hexStr.length === 0) {
      return reply.code(404).send({ error: 'Logo not found' });
    }
    const buf = Buffer.from(hexStr, 'hex');
    if (buf.length === 0) {
      return reply.code(404).send({ error: 'Logo not found' });
    }
    const contentType = (ctVal != null && String(ctVal).trim()) ? String(ctVal).trim() : 'image/png';
    return reply
      .header('Cache-Control', 'public, max-age=86400')
      .type(contentType)
      .send(buf);
  });

  await app.register(logosRoutes, { prefix: '/logos' });
}

