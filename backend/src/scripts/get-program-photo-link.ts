#!/usr/bin/env tsx
/**
 * Znajdź program po tytule i wypisz link do zdjęcia (proxy AKPA).
 * Uruchom: npx tsx src/scripts/get-program-photo-link.ts "Damy i wieśniaczki"
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const search = process.argv[2] ?? 'Damy i wieśniaczki';
  const program = await prisma.program.findFirst({
    where: {
      title: { contains: search, mode: 'insensitive' },
      imageUrl: { not: null },
    },
    select: { id: true, title: true, imageUrl: true, channel: { select: { name: true } } },
    orderBy: { startsAt: 'desc' },
  });

  if (!program) {
    console.error('Nie znaleziono programu z tytułem zawierającym:', search);
    process.exit(1);
  }

  const base = 'http://localhost:3000';
  const proxyPath = '/photos/proxy?url=' + encodeURIComponent(program.imageUrl!);
  const linkByPhoto = base + proxyPath;
  const linkById = `${base}/programs/photo/${program.id}`;

  console.log('Program:', program.title);
  console.log('Kanał:', program.channel?.name ?? '-');
  console.log('');
  console.log('Link do obrazka (wklej w przeglądarkę):');
  console.log(linkByPhoto);
  console.log('');
  console.log('Alternatywnie (przekierowanie):');
  console.log(linkById);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
