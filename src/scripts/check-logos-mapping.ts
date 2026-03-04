/**
 * Sprawdza, czy każdy kanał AKPA ma odpowiadający plik w static/logos/akpa/.
 * Uruchom: DATABASE_URL="postgresql://..." npx tsx src/scripts/check-logos-mapping.ts
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const STATIC_DIR = join(process.cwd(), 'static', 'logos', 'akpa');
const EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function nameToSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
}

function hasFileForChannel(externalId: string, name: string): { ok: boolean; file?: string } {
  const baseNames = [externalId, nameToSlug(name)].filter(Boolean);
  for (const base of baseNames) {
    for (const ext of EXTS) {
      const path = join(STATIC_DIR, `${base}${ext}`);
      if (existsSync(path)) return { ok: true, file: `${base}${ext}` };
    }
  }
  return { ok: false };
}

async function main() {
  const prisma = new PrismaClient();
  const channels = await prisma.channel.findMany({
    where: { externalId: { startsWith: 'akpa_' } },
    select: { externalId: true, name: true },
    orderBy: { name: 'asc' },
  });

  console.log('\n=== Mapowanie kanał → logo (static/logos/akpa/) ===\n');
  let ok = 0;
  let missing = 0;
  for (const ch of channels) {
    const { ok: found, file } = hasFileForChannel(ch.externalId, ch.name);
    if (found) {
      console.log(`  OK  ${ch.externalId.padEnd(14)} ${ch.name.padEnd(32)} → ${file}`);
      ok++;
    } else {
      console.log(`  BRAK ${ch.externalId.padEnd(14)} ${ch.name}`);
      missing++;
    }
  }
  console.log(`\nPodsumowanie: ${ok} z mapowaniem, ${missing} bez pliku.\n`);
  await prisma.$disconnect();
  if (missing > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
