#!/usr/bin/env npx tsx
/**
 * Jednorazowo: ile programów TTV w bazie w oknie dnia (jak aplikacja: UTC północ–północ).
 * Uruchom z katalogu backend: npx tsx src/scripts/check-ttv-today.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const TTV_CHANNEL_ID = 'ccc5fc42-c45d-417f-b47d-1d6005bcdbdc';

async function main() {
  const prisma = new PrismaClient();
  const channelId = TTV_CHANNEL_ID;

  async function check(label: string, from: Date, to: Date) {
    const where = { channelId, startsAt: { lt: to }, endsAt: { gt: from } };
    const count = await prisma.program.count({ where });
    const first = await prisma.program.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      take: 5,
      select: { title: true, startsAt: true, endsAt: true },
    });
    console.log(label, 'count=', count);
    for (const p of first) {
      console.log(' ', p.startsAt.toISOString(), '–', p.endsAt.toISOString(), p.title);
    }
  }

  const ch = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { name: true, externalId: true },
  });
  console.log('Kanał:', ch);

  await check(
    '2026-04-02 UTC (from/to jak w aplikacji)',
    new Date('2026-04-02T00:00:00.000Z'),
    new Date('2026-04-03T00:00:00.000Z'),
  );
  await check(
    '2026-04-01 UTC',
    new Date('2026-04-01T00:00:00.000Z'),
    new Date('2026-04-02T00:00:00.000Z'),
  );

  const afterMorning = await prisma.program.count({
    where: {
      channelId,
      startsAt: { gte: new Date('2026-04-02T03:00:00.000Z'), lt: new Date('2026-04-03T00:00:00.000Z') },
    },
  });
  console.log('Programy TTV 2026-04-02 od 03:00 UTC w górę (reszta „dnia” UTC):', afterMorning);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
