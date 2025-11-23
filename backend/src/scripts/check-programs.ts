#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Sprawdzam programy w bazie danych...\n');

  // Sprawdź liczbę kanałów
  const channelCount = await prisma.channel.count();
  console.log(`📺 Kanały w bazie: ${channelCount}`);

  // Sprawdź liczbę programów
  const programCount = await prisma.program.count();
  console.log(`📺 Programy w bazie: ${programCount}`);

  if (programCount === 0) {
    console.log('\n❌ BRAK PROGRAMÓW W BAZIE!');
    console.log('💡 Uruchom import EPG: npm run epg:import:iptv');
    await prisma.$disconnect();
    return;
  }

  // Sprawdź programy na dzisiaj
  const today = new Date();
  const startOfDay = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const todayPrograms = await prisma.program.count({
    where: {
      OR: [
        {
          startsAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
        {
          startsAt: {
            lt: endOfDay,
          },
          endsAt: {
            gt: startOfDay,
          },
        },
      ],
    },
  });

  console.log(`📅 Programy na dzisiaj (${startOfDay.toISOString()}): ${todayPrograms}`);

  // Sprawdź programy na najbliższe 7 dni
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextWeekPrograms = await prisma.program.count({
    where: {
      startsAt: {
        gte: today,
        lte: nextWeek,
      },
    },
  });

  console.log(`📅 Programy na najbliższe 7 dni: ${nextWeekPrograms}`);

  // Sprawdź najstarszy i najnowszy program
  const oldestProgram = await prisma.program.findFirst({
    orderBy: { startsAt: 'asc' },
    select: { id: true, title: true, startsAt: true, createdAt: true, channel: { select: { name: true } } },
  });

  const newestProgram = await prisma.program.findFirst({
    orderBy: { startsAt: 'desc' },
    select: { id: true, title: true, startsAt: true, createdAt: true, channel: { select: { name: true } } },
  });
  
  // Sprawdź najnowsze zaimportowane programy (po dacie utworzenia)
  const recentlyImported = await prisma.program.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, title: true, startsAt: true, createdAt: true, channel: { select: { name: true } } },
  });

  if (oldestProgram) {
    console.log(`\n📺 Najstarszy program: ${oldestProgram.title} (${oldestProgram.channel?.name}) - ${oldestProgram.startsAt.toISOString()}`);
  }

  if (newestProgram) {
    console.log(`📺 Najnowszy program: ${newestProgram.title} (${newestProgram.channel?.name}) - ${newestProgram.startsAt.toISOString()}`);
  }
  
  if (recentlyImported.length > 0) {
    console.log(`\n🆕 Najnowsze zaimportowane programy (po dacie utworzenia):`);
    recentlyImported.forEach((p) => {
      console.log(`  • ${p.title} (${p.channel?.name}) - start: ${p.startsAt.toISOString()}, utworzono: ${p.createdAt.toISOString()}`);
    });
  }

  // Sprawdź programy z kanałami (wszystkie programy mają channelId, więc wszystkie mają kanały)
  const programsWithChannels = programCount;

  console.log(`\n✅ Programy z przypisanymi kanałami: ${programsWithChannels}`);
  console.log(`❌ Programy bez kanałów: ${programCount - programsWithChannels}`);

  // Przykładowe programy na dzisiaj
  const samplePrograms = await prisma.program.findMany({
    where: {
      OR: [
        {
          startsAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
        {
          startsAt: {
            lt: endOfDay,
          },
          endsAt: {
            gt: startOfDay,
          },
        },
      ],
    },
    take: 5,
    include: {
      channel: true,
    },
    orderBy: {
      startsAt: 'asc',
    },
  });

  if (samplePrograms.length > 0) {
    console.log(`\n📋 Przykładowe programy na dzisiaj:`);
    samplePrograms.forEach((program) => {
      console.log(`  • ${program.channel?.name}: ${program.title} (${program.startsAt.toISOString()})`);
    });
  } else {
    console.log(`\n⚠️  Brak programów na dzisiaj z przypisanymi kanałami!`);
  }

  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});

