#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const withImages = await prisma.program.count({
    where: { imageUrl: { not: null } },
  });
  
  const total = await prisma.program.count();
  
  console.log(`📊 Programy z obrazami: ${withImages}/${total} (${Math.round((withImages / total) * 100)}%)`);
  
  const sampleWithImages = await prisma.program.findMany({
    where: { imageUrl: { not: null } },
    take: 5,
    select: {
      title: true,
      imageUrl: true,
      channel: { select: { name: true } },
    },
  });
  
  if (sampleWithImages.length > 0) {
    console.log('\n📸 Przykładowe programy z obrazami:');
    sampleWithImages.forEach((p) => {
      console.log(`  • ${p.title} (${p.channel?.name}): ${p.imageUrl}`);
    });
  }
  
  const sampleWithoutImages = await prisma.program.findMany({
    where: { imageUrl: null },
    take: 5,
    select: {
      title: true,
      channel: { select: { name: true, logoUrl: true } },
    },
  });
  
  if (sampleWithoutImages.length > 0) {
    console.log('\n❌ Przykładowe programy bez obrazów:');
    sampleWithoutImages.forEach((p) => {
      console.log(`  • ${p.title} (${p.channel?.name}) - logo kanału: ${p.channel?.logoUrl ?? 'brak'}`);
    });
  }
  
  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});

