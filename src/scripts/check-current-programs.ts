#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  console.log(`Aktualny czas UTC: ${now.toISOString()}`);
  console.log(`Aktualny czas PL: ${now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}\n`);

  const currentPrograms = await prisma.program.findMany({
    take: 10,
    where: {
      endsAt: { gt: now },
    },
    select: {
      title: true,
      startsAt: true,
      endsAt: true,
      channel: { select: { name: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  console.log(`Programy aktualne/przyszłe (endsAt > now): ${currentPrograms.length}\n`);
  currentPrograms.forEach((pr) => {
    const plStart = pr.startsAt.toLocaleString('pl-PL', {
      timeZone: 'Europe/Warsaw',
      timeStyle: 'short',
    });
    const plEnd = pr.endsAt?.toLocaleString('pl-PL', {
      timeZone: 'Europe/Warsaw',
      timeStyle: 'short',
    });
    console.log(`  ${pr.title} (${pr.channel?.name}): ${plStart} - ${plEnd}`);
  });

  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});

