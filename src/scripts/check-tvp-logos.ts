import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tvpChannels = await prisma.channel.findMany({
    where: {
      name: {
        contains: 'TVP',
      },
    },
    select: {
      id: true,
      name: true,
      logoUrl: true,
    },
  });

  console.log('\n📺 Kanały TVP w bazie:\n');
  tvpChannels.forEach(ch => {
    if (ch.logoUrl) {
      console.log(`✅ ${ch.name} (${ch.id}): ${ch.logoUrl}`);
    } else {
      console.log(`❌ ${ch.name} (${ch.id}): BRAK LOGOTYPU`);
    }
  });

  const polsatChannels = await prisma.channel.findMany({
    where: {
      name: {
        contains: 'Polsat',
      },
    },
    select: {
      name: true,
      logoUrl: true,
    },
  });

  console.log('\n📺 Kanały Polsat w bazie:\n');
  polsatChannels.forEach(ch => {
    if (ch.logoUrl) {
      console.log(`✅ ${ch.name}: ${ch.logoUrl}`);
    } else {
      console.log(`❌ ${ch.name}: BRAK LOGOTYPU`);
    }
  });

  await prisma.$disconnect();
}

main().catch(console.error);

