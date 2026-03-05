/**
 * Generuje tylko mapę externalId → folder AKPA (bez pobierania plików).
 * Przydatne po dodaniu nowych kanałów – odświeża src/data/akpa-logo-folder-map.json.
 *
 * Wymaga: DATABASE_URL, AKPA_LOGOS_BASE_URL, AKPA_LOGOS_USER, AKPA_LOGOS_PASSWORD
 * Opcjonalnie: AKPA_LOGOS_NEW_BASE_URL, AKPA_LOGOS_NEW_USER, AKPA_LOGOS_NEW_PASSWORD
 *
 * Uruchomienie: npm run logos:build-map
 */
import { PrismaClient } from '@prisma/client';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetch } from 'undici';

import { config as loadEnv } from 'dotenv';
loadEnv();

import { env } from '../config/env';
import { parseFolderNamesFromHtml, findBestFolder } from '../utils/akpa-logo-folders';

const prisma = new PrismaClient();

async function fetchListing(url: string, authHeader: string): Promise<string> {
  const res = await fetch(url, { method: 'GET', headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Listing ${url}: ${res.status}`);
  return res.text();
}

async function main() {
  const baseUrl = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? '').replace(/\/+$/, '');
  const user = env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER;
  const password = env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD;

  if (!baseUrl || !user || !password) {
    console.error('Ustaw AKPA_LOGOS_BASE_URL, AKPA_LOGOS_USER, AKPA_LOGOS_PASSWORD w .env');
    process.exit(1);
  }

  const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
  console.log('Pobieranie listy katalogów z logotypy.akpa.pl ...');
  const mainHtml = await fetchListing(baseUrl + '/', authHeader);
  let folderList = parseFolderNamesFromHtml(mainHtml);
  console.log(`  logotypy-tv: ${folderList.length} folderów`);

  const newBase = (env.AKPA_LOGOS_NEW_BASE_URL ?? process.env.AKPA_LOGOS_NEW_BASE_URL ?? '').replace(/\/+$/, '');
  const newUser = env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER;
  const newPassword = env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD;
  if (newBase && newUser && newPassword) {
    const newAuth = 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64');
    try {
      const newHtml = await fetchListing(newBase + '/', newAuth);
      const newFolders = parseFolderNamesFromHtml(newHtml);
      folderList = [...new Set([...folderList, ...newFolders])];
      console.log(`  nowe-logotypy: +${newFolders.length} folderów, łącznie ${folderList.length}`);
    } catch (e) {
      console.warn('  nowe-logotypy:', (e as Error).message);
    }
  }

  const channels = await prisma.channel.findMany({
    where: { externalId: { startsWith: 'akpa_' } },
    select: { externalId: true, name: true },
  });
  console.log(`Kanały AKPA w bazie: ${channels.length}\n`);

  const folderMap: Record<string, string> = {};
  for (const ch of channels) {
    const folder = findBestFolder(ch.name, folderList);
    if (folder) {
      folderMap[ch.externalId] = folder;
      console.log(`  ${ch.externalId}  ${ch.name}  →  ${folder}`);
    } else {
      console.log(`  ${ch.externalId}  ${ch.name}  →  (brak dopasowania)`);
    }
  }

  const mapPath = join(process.cwd(), 'src', 'data', 'akpa-logo-folder-map.json');
  await writeFile(mapPath, JSON.stringify(folderMap, null, 2), 'utf8');
  console.log(`\nMapa zapisana: ${mapPath} (${Object.keys(folderMap).length} kanałów)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
