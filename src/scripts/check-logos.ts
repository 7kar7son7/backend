import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const channels = await prisma.channel.findMany({
    take: 10,
    select: {
      name: true,
      logoUrl: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.log('\n📺 Sprawdzam logotypy kanałów:\n');
  let withLogos = 0;
  let withoutLogos = 0;

  for (const channel of channels) {
    if (channel.logoUrl) {
      console.log(`✅ ${channel.name}: ${channel.logoUrl}`);
      withLogos++;
    } else {
      console.log(`❌ ${channel.name}: BRAK LOGOTYPU`);
      withoutLogos++;
    }
  }

  console.log(`\n📊 Podsumowanie: ${withLogos} z logotypami, ${withoutLogos} bez logotypów\n`);

  const totalChannels = await prisma.channel.count();
  const channelsWithLogos = await prisma.channel.count({
    where: {
      logoUrl: {
        not: null,
      },
    },
  });

  console.log(`📈 Wszystkich kanałów: ${totalChannels}`);
  console.log(`📈 Kanałów z logotypami: ${channelsWithLogos}`);
  console.log(`📈 Kanałów bez logotypów: ${totalChannels - channelsWithLogos}\n`);

  await prisma.$disconnect();
}

main().catch(console.error);

