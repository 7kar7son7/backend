/**
 * Sprawdza jak zapisane są kolumny i dane w tabeli channels (logo).
 * Uruchom: DATABASE_URL="postgresql://..." npx tsx src/scripts/check-db-columns.ts
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Brak DATABASE_URL');
    process.exit(1);
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const columns: Array<{ column_name: string; data_type: string }> =
      await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'channels'
      ORDER BY ordinal_position
    `;
    console.log('Kolumny tabeli channels:\n');
    columns.forEach((c) => console.log(' ', c.column_name, '|', c.data_type));

    const sample = await prisma.$queryRaw<
      Array<Record<string, unknown>>
    >`SELECT id, "externalId", name, "logoUrl",
       CASE WHEN "logoData" IS NULL THEN NULL ELSE length("logoData") END as logo_data_len,
       "logoContentType"
       FROM channels LIMIT 5`;
    console.log('\nPrzykładowe wiersze (bez binarki logoData, tylko długość):\n');
    console.log(JSON.stringify(sample, null, 2));

    const withLogo = await prisma.$queryRaw<
      Array<{ count: string }>
    >`SELECT COUNT(*)::text as count FROM channels WHERE "logoData" IS NOT NULL AND length("logoData") > 0`;
    console.log('\nLiczba kanałów z niepustym logoData:', withLogo[0]?.count ?? 0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
