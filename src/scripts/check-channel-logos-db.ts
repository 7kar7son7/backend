/**
 * Jednorazowy skrypt: sprawdza w bazie jak wyglądają kanały i mapowanie logoUrl.
 * Uruchom: DATABASE_URL="postgresql://..." npx tsx src/scripts/check-channel-logos-db.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.channel.count();
  const withLogoNotNull = await prisma.channel.count({
    where: { logoUrl: { not: null } },
  });
  const withLogoNonEmpty = await prisma.channel.count({
    where: {
      logoUrl: { not: null, not: '' },
    },
  });
  const akpaChannels = await prisma.channel.count({
    where: { externalId: { startsWith: 'akpa_' } },
  });

  console.log('\n=== KANAŁY W BAZIE ===\n');
  console.log('Wszystkich kanałów:        ', total);
  console.log('Z logoUrl NOT NULL:        ', withLogoNotNull);
  console.log('Z logoUrl niepustym:       ', withLogoNonEmpty);
  console.log('externalId zaczyna się akpa_:', akpaChannels);
  console.log('');

  const sample = await prisma.channel.findMany({
    take: 20,
    select: { externalId: true, name: true, logoUrl: true },
    orderBy: { name: 'asc' },
  });
  console.log('--- Przykładowe 20 kanałów (externalId | name | logoUrl) ---\n');
  for (const c of sample) {
    const logo =
      c.logoUrl === null
        ? 'NULL'
        : c.logoUrl === ''
          ? '(pusty string)'
          : c.logoUrl.length > 70
            ? c.logoUrl.substring(0, 67) + '...'
            : c.logoUrl;
    console.log(
      `${c.externalId.padEnd(24)} | ${c.name.substring(0, 32).padEnd(32)} | ${logo}`,
    );
  }

  const withoutLogo = await prisma.channel.findMany({
    where: { OR: [{ logoUrl: null }, { logoUrl: '' }] },
    take: 8,
    select: { externalId: true, name: true },
  });
  console.log('\n--- Kanały BEZ logotypu (przykład 8) ---');
  for (const c of withoutLogo) {
    console.log('  ', c.externalId, '|', c.name);
  }

  const withLogo = await prisma.channel.findMany({
    where: { logoUrl: { not: null, not: '' } },
    take: 8,
    select: { externalId: true, name: true, logoUrl: true },
  });
  console.log('\n--- Kanały Z logotypem (przykład 8) ---');
  for (const c of withLogo) {
    console.log('  ', c.externalId, '|', c.name, '|', c.logoUrl);
  }

  console.log('\n');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
