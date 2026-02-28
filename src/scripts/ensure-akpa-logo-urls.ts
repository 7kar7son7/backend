/**
 * Ustawia logoUrl = /logos/akpa/{externalId} dla WSZYSTKICH kanałów AKPA w bazie.
 * Mapowanie: każdy kanał ma URL do logotypu (serwowany z bazy przez GET /logos/akpa/:id).
 * Uruchom: DATABASE_URL="postgresql://..." npx tsx src/scripts/ensure-akpa-logo-urls.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const channels = await prisma.channel.findMany({
    where: { externalId: { startsWith: 'akpa_' } },
    select: { externalId: true, logoUrl: true },
  });
  console.log(`Kanały AKPA w bazie: ${channels.length}\n`);
  let updated = 0;
  for (const ch of channels) {
    const expected = `/logos/akpa/${ch.externalId}`;
    if (ch.logoUrl !== expected) {
      await prisma.channel.update({
        where: { externalId: ch.externalId },
        data: { logoUrl: expected },
      });
      console.log(`  ${ch.externalId} -> ${expected}`);
      updated++;
    }
  }
  console.log(`\nGotowe. Zaktualizowano: ${updated} kanałów. Wszystkie AKPA mają logoUrl = /logos/akpa/{externalId}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
