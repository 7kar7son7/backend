#!/usr/bin/env tsx
/**
 * Raport pokrycia ramówki: kanały vs programy (w tym z endsAt > NOW()).
 * Uruchom: DATABASE_URL=... npx tsx src/scripts/check-epg-coverage.ts
 */
import { PrismaClient } from '@prisma/client';

import { env } from '../config/env';

const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
});

async function main() {
  const [ch, pr, withAny, withFuture, empty, stats] = await Promise.all([
    prisma.channel.count(),
    prisma.program.count(),
    prisma.$queryRaw<[{ n: bigint }]>`
      SELECT COUNT(DISTINCT "channelId")::bigint AS n FROM programs`,
    prisma.$queryRaw<[{ n: bigint }]>`
      SELECT COUNT(DISTINCT "channelId")::bigint AS n FROM programs WHERE "endsAt" > NOW()`,
    prisma.$queryRaw<{ externalId: string; name: string; future_programs: bigint }[]>`
      SELECT c."externalId", c.name, COUNT(p.id) AS future_programs
      FROM channels c
      LEFT JOIN programs p ON p."channelId" = c.id AND p."endsAt" > NOW()
      GROUP BY c.id, c."externalId", c.name
      HAVING COUNT(p.id) = 0
      ORDER BY c.name`,
    prisma.$queryRaw<{ name: string; cnt: bigint }[]>`
      SELECT c.name, COUNT(p.id) AS cnt
      FROM channels c
      LEFT JOIN programs p ON p."channelId" = c.id AND p."endsAt" > NOW()
      GROUP BY c.id, c.name
      ORDER BY cnt ASC
      LIMIT 15`,
  ]);

  const photos = await prisma.program.count({
    where: { imageUrl: { not: null }, imageHasData: true },
  });
  const photosAkpaUrlOnly = await prisma.program.count({
    where: { imageUrl: { not: null }, imageHasData: false },
  });

  console.log(
    JSON.stringify(
      {
        channels: ch,
        programs_total: pr,
        channels_with_any_program: Number(withAny[0].n),
        channels_with_future_programs: Number(withFuture[0].n),
        channels_with_zero_future_epg: empty.length,
        channels_missing_future_epg: empty.map((r) => ({
          externalId: r.externalId,
          name: r.name,
        })),
        sample_lowest_future_counts: stats.map((r) => ({
          name: r.name,
          future_programs: Number(r.cnt),
        })),
        programs_with_image_in_db: photos,
        programs_with_akpa_url_only_no_blob: photosAkpaUrlOnly,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
