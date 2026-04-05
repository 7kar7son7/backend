/**
 * Synchronizuje logo do bazy dla JEDNEGO kanału (po nazwie).
 * Mapowanie: kanał z bazy → logoUrl = /logos/akpa/{externalId}, logoData z AKPA.
 *
 * Uruchom (bez hasła w repo – używaj zmiennej):
 *   DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=disable" npx tsx src/scripts/sync-one-channel-logo.ts "13 Ulica"
 *
 * Albo bez argumentu – zapyta o nazwę lub zsyncuje pierwszy kanał AKPA bez logo.
 */
import { PrismaClient } from '@prisma/client';
import { fetchLogoFromAkpaFolder } from '../services/akpa-logo-fetcher';
import {
  loadAkpaLogoFolderMap,
  getCachedAkpaFolderList,
  findBestFolder,
  channelNameToFolderCandidate,
} from '../utils/akpa-logo-folders';

const DEFAULT_AKPA_LOGOS_BASE = 'https://logotypy.akpa.pl/logotypy-tv';
const DEFAULT_AKPA_LOGOS_USER = 'logotypy_tv';
const DEFAULT_AKPA_LOGOS_PASSWORD = 'logos_2024@';

async function main() {
  const channelNameArg = process.argv[2]?.trim();
  if (!channelNameArg) {
    console.error('Użycie: DATABASE_URL="postgresql://..." npx tsx src/scripts/sync-one-channel-logo.ts "13 Ulica"');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Brak DATABASE_URL. Ustaw: DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=disable"');
    process.exit(1);
  }

  const baseUrl = (process.env.AKPA_LOGOS_BASE_URL ?? DEFAULT_AKPA_LOGOS_BASE).trim().replace(/\/+$/, '');
  const user = (process.env.AKPA_LOGOS_USER ?? DEFAULT_AKPA_LOGOS_USER).trim();
  const password = (process.env.AKPA_LOGOS_PASSWORD ?? DEFAULT_AKPA_LOGOS_PASSWORD).trim();
  if (!baseUrl || !user || !password) {
    console.error('Brak AKPA_LOGOS_BASE_URL / USER / PASSWORD (lub domyślne).');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const channel = await prisma.channel.findFirst({
      where: {
        name: { equals: channelNameArg, mode: 'insensitive' },
        externalId: { startsWith: 'akpa_' },
      },
      select: { id: true, externalId: true, name: true, logoUrl: true },
    });

    if (!channel) {
      console.error('Nie znaleziono kanału AKPA o nazwie:', channelNameArg);
      const list = await prisma.channel.findMany({
        where: { externalId: { startsWith: 'akpa_' } },
        select: { name: true, externalId: true },
        take: 20,
      });
      console.log('Przykładowe kanały AKPA:', list.map((c) => `"${c.name}" (${c.externalId})`).join(', '));
      process.exit(1);
    }

    console.log('Kanał:', channel.name, '| externalId:', channel.externalId);

    const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
    const folderMap = loadAkpaLogoFolderMap();
    const folderList = await getCachedAkpaFolderList(baseUrl, authHeader);
    const mappedFolder = folderMap[channel.externalId];
    const runtimeFolder = folderList.length > 0 ? findBestFolder(channel.name, folderList) : null;
    const nameFolder = channelNameToFolderCandidate(channel.name);
    const folder = mappedFolder ?? runtimeFolder ?? nameFolder ?? null;

    if (!folder) {
      console.error('Nie znaleziono folderu AKPA dla kanału. Mapowanie:', Object.keys(folderMap).length, 'wpisów; lista folderów:', folderList.length);
      process.exit(1);
    }

    console.log('Folder AKPA:', folder);
    const result = await fetchLogoFromAkpaFolder(baseUrl, authHeader, folder, (msg, meta) => {
      console.log(msg, meta ?? '');
    });

    if (!result || !result.body.length) {
      console.error('Nie udało się pobrać logo z AKPA.');
      process.exit(1);
    }

    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        logoUrl: `/logos/akpa/${channel.externalId}`,
        logoData: new Uint8Array(result.body),
        logoContentType: result.contentType,
      },
    });

    console.log('OK. Zapisano logo do bazy dla', channel.name, '| logoUrl =', `/logos/akpa/${channel.externalId}`, '| bytes:', result.body.length);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
