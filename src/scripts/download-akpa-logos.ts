/**
 * Pobiera listę folderów z logotypy.akpa.pl (i nowe-logotypy), dopasowuje do kanałów AKPA z bazy,
 * pobiera logotypy, zapisuje do static/logos/akpa/ i ustawia Channel.logoUrl.
 *
 * Wymaga w .env: DATABASE_URL, AKPA_LOGOS_BASE_URL, AKPA_LOGOS_USER, AKPA_LOGOS_PASSWORD
 * Opcjonalnie: AKPA_LOGOS_NEW_BASE_URL, AKPA_LOGOS_NEW_USER, AKPA_LOGOS_NEW_PASSWORD
 *
 * Uruchomienie: npm run logos:download:akpa
 * (Connection string do bazy ustaw w .env jako DATABASE_URL)
 */
import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetch } from 'undici';

import { config as loadEnv } from 'dotenv';
loadEnv();

import { env } from '../config/env';

const prisma = new PrismaClient();

const LOGO_FILES = ['logo.png', 'logo.jpg', 'logo.jpeg', 'image.png', 'image.jpg', 'logo.svg'];
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

function parseFileLinksFromHtml(html: string): string[] {
  const files: string[] = [];
  const re = /<a href="([^"]+)">/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (href == null) continue;
    const s = href.trim();
    if (s.startsWith('/') || s.startsWith('?') || s === '..') continue;
    if (IMAGE_EXT.test(s)) files.push(s);
  }
  return files;
}

function parseFolderNamesFromHtml(html: string): string[] {
  const folders: string[] = [];
  const re = /<a href="([^"]+)\/">/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (href == null) continue;
    const s = href.trim();
    if (s === '..' || s === '/' || s.startsWith('?')) continue;
    try {
      const decoded = decodeURIComponent(s).replace(/\/+$/, '').trim();
      if (decoded && decoded !== 'Parent Directory') folders.push(decoded);
    } catch {
      folders.push(s.replace(/\/+$/, '').trim());
    }
  }
  return [...new Set(folders)];
}

async function fetchListing(url: string, authHeader: string): Promise<string> {
  const res = await fetch(url, { method: 'GET', headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Listing ${url}: ${res.status}`);
  return res.text();
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeNoSpaces(s: string): string {
  return normalize(s).replace(/\s/g, '');
}

/** Znajdź folder z listy pasujący do nazwy kanału (bez HD, z HD, bez spacji itd.). */
function findBestFolder(channelName: string, folderList: string[]): string | null {
  const n = normalize(channelName);
  const nNoSpace = normalizeNoSpaces(channelName);
  if (!n) return null;

  const byNorm = new Map<string, string>();
  for (const f of folderList) {
    const fn = normalize(f);
    if (!byNorm.has(fn)) byNorm.set(fn, f);
  }

  if (byNorm.has(n)) return byNorm.get(n)!;
  if (byNorm.has(n + ' hd')) return byNorm.get(n + ' hd')!;
  if (n.endsWith(' hd') && byNorm.has(n.slice(0, -3))) return byNorm.get(n.slice(0, -3))!;
  if (byNorm.has(nNoSpace)) return byNorm.get(nNoSpace)!;
  for (const [fn, orig] of byNorm) {
    if (fn === n || fn.startsWith(n + ' ') || n.startsWith(fn) || fn.replace(/\s/g, '') === nNoSpace) return orig;
  }
  for (const [fn, orig] of byNorm) {
    if (fn.includes(n) || n.includes(fn)) return orig;
  }
  if (n === 'dizi' && byNorm.has('novelas+')) return byNorm.get('novelas+')!;
  return null;
}

async function fetchFolderListing(baseUrl: string, authHeader: string, folderName: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(folderName)}/`;
  const html = await fetch(url, { method: 'GET', headers: { Authorization: authHeader } }).then((r) =>
    r.ok ? r.text() : Promise.reject(new Error(`${r.status}`)),
  );
  const files = parseFileLinksFromHtml(html);
  return files.sort((a, b) => {
    const aSimple = !/_black|_white|_green|_red/i.test(a) ? 0 : 1;
    const bSimple = !/_black|_white|_green|_red/i.test(b) ? 0 : 1;
    if (aSimple !== bSimple) return aSimple - bSimple;
    return a.length - b.length;
  });
}

async function fetchLogo(
  baseUrl: string,
  authHeader: string,
  folderName: string,
): Promise<{ body: Buffer; ext: string } | null> {
  const base = baseUrl.replace(/\/+$/, '');
  for (const fileName of LOGO_FILES) {
    const url = `${base}/${encodeURIComponent(folderName)}/${fileName}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: { Authorization: authHeader } });
      if (res.ok && res.body) {
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = fileName.endsWith('.svg') ? 'svg' : fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ? 'jpg' : 'png';
        return { body: buf, ext };
      }
    } catch {
      continue;
    }
  }
  try {
    const fileNames = await fetchFolderListing(baseUrl, authHeader, folderName);
    for (const fileName of fileNames) {
      const url = `${base}/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`;
      try {
        const res = await fetch(url, { method: 'GET', headers: { Authorization: authHeader } });
        if (res.ok && res.body) {
          const buf = Buffer.from(await res.arrayBuffer());
          const ext = fileName.endsWith('.svg') ? 'svg' : fileName.match(/\.jpe?g$/i) ? 'jpg' : 'png';
          return { body: buf, ext };
        }
      } catch {
        continue;
      }
    }
  } catch {
    // ignore listing errors
  }
  return null;
}

const STATIC_LOGOS_DIR = join(process.cwd(), 'static', 'logos', 'akpa');

async function main() {
  const baseUrl = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? '').replace(/\/+$/, '');
  const user = env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER;
  const password = env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD;

  if (!baseUrl || !user || !password) {
    console.error('Ustaw AKPA_LOGOS_BASE_URL, AKPA_LOGOS_USER, AKPA_LOGOS_PASSWORD w .env');
    process.exit(1);
  }

  const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
  await mkdir(STATIC_LOGOS_DIR, { recursive: true });

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
    select: { id: true, externalId: true, name: true },
  });

  console.log(`\nKanały AKPA w bazie: ${channels.length}. Dopasowanie i pobieranie logotypów ...\n`);

  let ok = 0;
  let fail = 0;
  const newAuth =
    newBase && newUser && newPassword
      ? 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64')
      : null;

  for (const ch of channels) {
    const folder = findBestFolder(ch.name, folderList);
    let result: { body: Buffer; ext: string } | null = null;
    let usedBase = baseUrl;
    let usedAuth = authHeader;

    if (folder) {
      result = await fetchLogo(baseUrl, authHeader, folder);
      if (!result && newAuth) {
        result = await fetchLogo(newBase, newAuth, folder);
        if (result) usedBase = newBase;
        usedAuth = newAuth;
      }
    }

    if (result) {
      const ext = result.ext;
      const filePath = join(STATIC_LOGOS_DIR, `${ch.externalId}.${ext}`);
      await writeFile(filePath, result.body);
      const logoUrl = `/logos/akpa/${ch.externalId}`;
      const logoContentType =
        ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      await prisma.channel.update({
        where: { id: ch.id },
        data: { logoUrl, logoData: result.body, logoContentType },
      });
      ok++;
      console.log(`  OK ${ch.name} -> folder "${folder}" -> ${ch.externalId}.${ext} (zapis do bazy)`);
    } else {
      fail++;
      console.log(`  BRAK ${ch.name} (${ch.externalId})${folder ? ` [folder: ${folder}]` : ' [brak dopasowania]'}`);
    }
  }

  console.log(`\nGotowe: ${ok} pobranych, ${fail} bez logotypu. Pliki: ${STATIC_LOGOS_DIR}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
