/**
 * Sprawdza w bazie: jak zapisane są logotypy (logoData, logoContentType, logoUrl) i mapowanie per kanał.
 * Uruchom: DATABASE_URL="postgresql://..." npx tsx src/scripts/check-channel-logos-db.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.channel.count();
  const akpaChannels = await prisma.channel.count({
    where: { externalId: { startsWith: 'akpa_' } },
  });

  // Surowe SQL – liczba kanałów AKPA z niepustym logoData (BYTEA)
  const rawCount = await prisma.$queryRaw<[{ count: bigint }]>(
    Prisma.sql`SELECT COUNT(*) as count FROM channels WHERE "externalId" LIKE 'akpa_%' AND "logoData" IS NOT NULL AND length("logoData") > 0`,
  );
  const withLogoDataRaw = Number(rawCount[0]?.count ?? 0);

  // Surowe SQL – lista AKPA z długością logoData i logoContentType
  const rawRows = await prisma.$queryRaw<
    Array<{ externalId: string; name: string; logoDataLen: number | null; logoContentType: string | null; logoUrl: string | null }>
  >(Prisma.sql`
    SELECT "externalId", "name",
           length("logoData") as "logoDataLen",
           "logoContentType",
           "logoUrl"
    FROM channels
    WHERE "externalId" LIKE 'akpa_%'
    ORDER BY "externalId"
    LIMIT 65
  `);

  console.log('\n=== LOGOTYPY W BAZIE (channels) ===\n');
  console.log('Wszystkich kanałów:           ', total);
  console.log('Kanałów AKPA (externalId akpa_*):', akpaChannels);
  console.log('AKPA z logoData (raw SQL):    ', withLogoDataRaw);
  console.log('');
  console.log('Mapowanie: GET /logos/akpa/:channelId → szuka rekordu WHERE "externalId" = :channelId, serwuje "logoData" + "logoContentType".');
  console.log('W API każdy kanał AKPA dostaje logoUrl = /logos/akpa/{externalId} (channel-logo.ts).');
  console.log('');
  console.log('--- Wszystkie kanały AKPA (externalId | name | length(logoData) | logoContentType | logoUrl) ---\n');

  for (const r of rawRows) {
    const len = r.logoDataLen != null ? String(r.logoDataLen) : 'NULL';
    const ct = r.logoContentType ?? 'NULL';
    const url = r.logoUrl ?? 'NULL';
    console.log(
      `${String(r.externalId).padEnd(16)} | ${String(r.name).substring(0, 28).padEnd(28)} | ${len.padStart(6)} | ${String(ct).padEnd(12)} | ${url}`,
    );
  }

  const expectedUrlMismatch = rawRows.filter(
    (r) => r.logoUrl !== `/logos/akpa/${r.externalId}` && r.logoUrl !== null && r.logoUrl !== '',
  );
  if (expectedUrlMismatch.length > 0) {
    console.log('\n--- Kanały z logoUrl innym niż /logos/akpa/{externalId} ---');
    for (const r of expectedUrlMismatch) {
      console.log('  ', r.externalId, '| logoUrl=', r.logoUrl);
    }
  }

  console.log('\n');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
