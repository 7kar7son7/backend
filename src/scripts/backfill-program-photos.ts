#!/usr/bin/env tsx
/**
 * Pobiera zdjęcia programów z AKPA do bazy (imageData).
 * Dla programów, które mają imageUrl (URL AKPA) ale jeszcze nie mają imageData.
 *
 * Wymaga: AKPA_API_TOKEN w .env
 * Uruchom: npm run scripts:backfill-program-photos
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { fetchAkpaImage, isAkpaPhotoUrl } from '../utils/fetch-akpa-image';

const prisma = new PrismaClient();

const CONCURRENCY = 5;
const BATCH_SIZE = 50;

async function main() {
  const token = (env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN ?? '').trim();
  if (!token) {
    console.error('❌ Ustaw AKPA_API_TOKEN w .env');
    process.exit(1);
  }

  const toFetch = await prisma.program.findMany({
    where: {
      imageUrl: { not: null },
      imageHasData: false,
    },
    select: { id: true, title: true, imageUrl: true, channel: { select: { name: true } } },
  });

  const withAkpaUrl = toFetch.filter((p) => p.imageUrl && isAkpaPhotoUrl(p.imageUrl));
  console.log(`📸 Programy z URL AKPA bez zdjęcia w bazie: ${withAkpaUrl.length}`);

  if (withAkpaUrl.length === 0) {
    console.log('Nic do pobrania.');
    await prisma.$disconnect();
    return;
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < withAkpaUrl.length; i += CONCURRENCY) {
    const batch = withAkpaUrl.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (prog) => {
        const url = prog.imageUrl!;
        const result = await fetchAkpaImage(url);
        if (!result) {
          fail++;
          return;
        }
        try {
          await prisma.program.update({
            where: { id: prog.id },
            data: {
              imageData: result.buffer,
              imageContentType: result.contentType.slice(0, 64),
              imageHasData: true,
            },
          });
          ok++;
          if (ok <= 10 || ok % 100 === 0) {
            console.log(`  ✓ ${prog.title} (${prog.channel?.name})`);
          }
        } catch {
          fail++;
        }
      }),
    );
    if ((i + batch.length) % (BATCH_SIZE) < CONCURRENCY) {
      console.log(`  ... ${ok + fail}/${withAkpaUrl.length}`);
    }
  }

  console.log(`\n✅ Zapisano zdjęć: ${ok}, nie udało się: ${fail}`);
  await prisma.$disconnect();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
