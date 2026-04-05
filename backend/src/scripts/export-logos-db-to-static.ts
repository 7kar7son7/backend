/**
 * Eksportuje logotypy z bazy (logoData) do folderu static/logos/akpa/.
 * Jeden plik na kanał: akpa_1.png, akpa_112.jpg itd. (rozszerzenie z logoContentType).
 * Uruchom: DATABASE_URL="postgresql://..." npx tsx src/scripts/export-logos-db-to-static.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';

const OUT_DIR = join(process.cwd(), 'static', 'logos', 'akpa');

function extensionFromContentType(ct: string | null): string {
  if (!ct || typeof ct !== 'string') return '.png';
  const t = ct.trim().toLowerCase();
  if (t.includes('jpeg') || t.includes('jpg')) return '.jpg';
  if (t.includes('png')) return '.png';
  if (t.includes('gif')) return '.gif';
  if (t.includes('webp')) return '.webp';
  if (t.includes('svg')) return '.svg';
  return '.png';
}

async function main() {
  const prisma = new PrismaClient();

  const channels = await prisma.channel.findMany({
    where: { externalId: { startsWith: 'akpa_' } },
    select: { externalId: true, name: true, logoData: true, logoContentType: true },
  });

  let written = 0;
  let skipped = 0;

  mkdirSync(OUT_DIR, { recursive: true });

  for (const ch of channels) {
    let data: Buffer | null = null;
    let contentType: string | null = ch.logoContentType ?? null;

    if (ch.logoData != null) {
      if (Buffer.isBuffer(ch.logoData)) data = ch.logoData;
      else if (ch.logoData instanceof Uint8Array) data = Buffer.from(ch.logoData);
      else data = Buffer.from(ch.logoData as ArrayBuffer);
    }

    if (!data || data.length === 0) {
      const raw = await prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`SELECT "logoData", "logoContentType" FROM channels WHERE "externalId" = ${ch.externalId} LIMIT 1`,
      );
      const row = raw[0];
      if (row) {
        const rawData = row.logoData ?? row.logodata;
        const rawCt = (row.logoContentType ?? row.logocontenttype) as string | undefined;
        if (rawData != null && typeof (rawData as Buffer).length === 'number' && (rawData as Buffer).length > 0) {
          data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData as ArrayBuffer);
          if (rawCt) contentType = String(rawCt).trim();
        }
      }
    }

    if (!data || data.length === 0) {
      console.log(`Pominięto ${ch.externalId} (${ch.name}) – brak logoData`);
      skipped++;
      continue;
    }

    const ext = extensionFromContentType(contentType);
    const filename = `${ch.externalId}${ext}`;
    const path = join(OUT_DIR, filename);
    writeFileSync(path, data);
    console.log(`Zapisano ${filename} (${ch.name})`);
    written++;
  }

  console.log(`\nGotowe: ${written} plików w ${OUT_DIR}, ${skipped} pominiętych (brak logoData).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
