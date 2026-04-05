#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const programs = await prisma.program.findMany({
    take: 5,
    select: {
      title: true,
      startsAt: true,
      endsAt: true,
      channel: { select: { name: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  console.log('Przykładowe programy:\n');
  programs.forEach((pr) => {
    console.log(`${pr.title} (${pr.channel?.name}):`);
    console.log(`  UTC: ${pr.startsAt.toISOString()} - ${pr.endsAt?.toISOString()}`);
    
    // Konwersja na czas polski (CET/CEST)
    const plStart = pr.startsAt.toLocaleString('pl-PL', { 
      timeZone: 'Europe/Warsaw',
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const plEnd = pr.endsAt?.toLocaleString('pl-PL', { 
      timeZone: 'Europe/Warsaw',
      dateStyle: 'short',
      timeStyle: 'short',
    });
    
    console.log(`  PL:  ${plStart} - ${plEnd}`);
    console.log('');
  });

  // Sprawdź aktualny czas
  const now = new Date();
  console.log(`\nAktualny czas UTC: ${now.toISOString()}`);
  console.log(`Aktualny czas PL: ${now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}`);
  
  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});

