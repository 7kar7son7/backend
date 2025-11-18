import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const channelCount = await prisma.channel.count();
    const programCount = await prisma.program.count();
    console.log(`Channels: ${channelCount}`);
    console.log(`Programs: ${programCount}`);

    if (channelCount > 0) {
      const sample = await prisma.channel.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      console.log('Sample channels:', sample.map((ch) => ({
        id: ch.id,
        externalId: ch.externalId,
        name: ch.name,
      })));
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
