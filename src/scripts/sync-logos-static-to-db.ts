/**
 * Czyta pliki z static/logos/akpa/* i zapisuje je do kolumn logoData, logoContentType w channels.
 * Uruchom lokalnie (gdzie masz static/ po logos:download:akpa), potem deploy – produkcja będzie serwować z bazy.
 * Uruchomienie: DATABASE_URL=... npx tsx src/scripts/sync-logos-static-to-db.ts
 */
import { PrismaClient } from '@prisma/client';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const prisma = new PrismaClient();
const STATIC_DIR = join(process.cwd(), 'static', 'logos', 'akpa');
const EXT = ['png', 'jpg', 'jpeg', 'svg'] as const;
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

async function main() {
  let entries: string[];
  try {
    entries = await readdir(STATIC_DIR);
  } catch (e) {
    console.error('Brak folderu static/logos/akpa. Uruchom najpierw: npm run logos:download:akpa');
    process.exit(1);
  }
  const byExternalId = new Map<string, { ext: string }>();
  for (const e of entries) {
    const match = e.match(/^(akpa_[a-zA-Z0-9_]+)\.(png|jpg|jpeg|svg)$/i);
    if (match) byExternalId.set(match[1], { ext: match[2].toLowerCase() });
  }
  if (byExternalId.size === 0) {
    console.error('Brak plików akpa_*.png/jpg/svg w', STATIC_DIR);
    process.exit(1);
  }
  console.log('Znaleziono', byExternalId.size, 'plików logo. Zapis do bazy...\n');
  let ok = 0;
  for (const [externalId, { ext }] of byExternalId) {
    const filePath = join(STATIC_DIR, `${externalId}.${ext}`);
    try {
      const body = await readFile(filePath);
      const logoContentType = MIME[ext] ?? 'image/png';
      await prisma.channel.updateMany({
        where: { externalId },
        data: { logoUrl: `/logos/akpa/${externalId}`, logoData: body, logoContentType },
      });
      const count = await prisma.channel.count({ where: { externalId } });
      if (count > 0) {
        ok++;
        console.log('  OK', externalId);
      }
    } catch (e) {
      console.warn('  SKIP', externalId, (e as Error).message);
    }
  }
  console.log('\nGotowe:', ok, 'kanałów z logo w bazie.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
