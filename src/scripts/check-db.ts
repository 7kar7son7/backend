/**
 * One-off script: sprawdza połączenie i zawartość bazy (kanały, programy).
 * Użycie: DATABASE_URL="postgresql://..." npx tsx src/scripts/check-db.ts
 */
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Ustaw DATABASE_URL (np. w .env lub: $env:DATABASE_URL="postgresql://...")');
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  try {
    await prisma.$connect();
    console.log('Połączenie z bazą: OK\n');

    const channelCount = await prisma.channel.count();
    console.log('Tabela channels:', channelCount, 'rekordów');

    const programCount = await prisma.program.count();
    console.log('Tabela programs:', programCount, 'rekordów');

    if (channelCount > 0) {
      const sample = await prisma.channel.findMany({
        take: 10,
        orderBy: { name: 'asc' },
        select: { id: true, externalId: true, name: true, logoUrl: true },
      });
      console.log('\nPrzykładowe kanały (max 10):');
      sample.forEach((c) =>
        console.log(`  - ${c.name} (externalId: ${c.externalId})`),
      );
    } else {
      console.log('\nBrak kanałów w bazie – uruchom import EPG (AKPA lub IPTV).');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Błąd:', e.message || e);
  process.exit(1);
});
