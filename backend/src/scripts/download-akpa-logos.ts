/**
 * Pobiera listę folderów z logotypy.akpa.pl (i nowe-logotypy), dopasowuje do kanałów AKPA z bazy,
 * pobiera logotypy, zapisuje do static/logos/akpa/ i ustawia Channel.logoUrl.
 *
 * Wymaga w .env: DATABASE_URL, AKPA_LOGOS_BASE_URL, AKPA_LOGOS_USER, AKPA_LOGOS_PASSWORD
 * Opcjonalnie: AKPA_LOGOS_NEW_* (drugi serwis), AKPA_API_URL + AKPA_API_TOKEN (gdy brak kanałów w bazie)
 *
 * Gdy w bazie nie ma kanałów AKPA (externalId akpa_*), skrypt pobiera listę kanałów z API AKPA
 * i tworzy rekordy w DB, potem pobiera dla wszystkich logotypy.
 *
 * Uruchomienie: npm run logos:download:akpa
 */
import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetch } from 'undici';

import { config as loadEnv } from 'dotenv';
loadEnv();

import { env } from '../config/env';
import { AKPA_LOGOS_DEFAULTS } from '../config/akpa-logos-defaults';
import { parseFolderNamesFromHtml, findBestFolder } from '../utils/akpa-logo-folders';

const prisma = new PrismaClient();

const EXTERNAL_ID_PREFIX = 'akpa_';

type AkpaChannelRaw = { id?: string | number; name?: string; title?: string; slug?: string; [key: string]: unknown };

function getChannelId(raw: AkpaChannelRaw): string {
  const id = raw.id ?? raw.slug;
  if (id !== undefined && id !== null) return String(id);
  const name = raw.name ?? raw.title ?? '';
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '') || 'unknown';
}

function getChannelName(raw: AkpaChannelRaw): string {
  const name = raw.name ?? raw.title ?? raw.slug;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return String(raw.id ?? 'Kanał');
}

/** Pobiera listę kanałów z API AKPA i zwraca { externalId, name }. Wymaga AKPA_API_URL + AKPA_API_TOKEN. */
async function fetchChannelsFromAkpaApi(): Promise<{ externalId: string; name: string }[]> {
  const baseUrl = (env.AKPA_API_URL ?? process.env.AKPA_API_URL ?? 'https://api-epg.akpa.pl/api/v1').replace(/\/+$/, '');
  const token = (env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN ?? '').trim();
  if (!token) throw new Error('Brak AKPA_API_TOKEN – ustaw w .env, żeby pobrać listę kanałów z API AKPA.');
  const url = `${baseUrl}/channels`;
  const authType = (env.AKPA_AUTH_TYPE ?? process.env.AKPA_AUTH_TYPE ?? 'Bearer').trim();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authType === 'X-Api-Key') {
    headers['X-API-Key'] = token;
  } else {
    headers['Authorization'] = authType === 'Token' ? `Token ${token}` : `Bearer ${token}`;
  }
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) throw new Error(`AKPA API channels: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  const json = (await res.json()) as unknown;
  let rawList: AkpaChannelRaw[] = [];
  if (Array.isArray(json)) rawList = json as AkpaChannelRaw[];
  else if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.data)) rawList = o.data as AkpaChannelRaw[];
    else if (Array.isArray(o.channels)) rawList = o.channels as AkpaChannelRaw[];
  }
  return rawList.map((raw) => ({
    externalId: EXTERNAL_ID_PREFIX + getChannelId(raw),
    name: getChannelName(raw),
  }));
}

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

async function fetchListing(url: string, authHeader: string): Promise<string> {
  const res = await fetch(url, { method: 'GET', headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Listing ${url}: ${res.status}`);
  return res.text();
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
  const baseUrl = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? AKPA_LOGOS_DEFAULTS.BASE_URL).replace(/\/+$/, '');
  const user = env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER ?? AKPA_LOGOS_DEFAULTS.USER;
  const password = env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD ?? AKPA_LOGOS_DEFAULTS.PASSWORD;

  const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
  await mkdir(STATIC_LOGOS_DIR, { recursive: true });

  console.log('Pobieranie listy katalogów z logotypy.akpa.pl ...');
  const mainHtml = await fetchListing(baseUrl + '/', authHeader);
  let folderList = parseFolderNamesFromHtml(mainHtml);
  console.log(`  logotypy-tv: ${folderList.length} folderów`);

  const newBase = (env.AKPA_LOGOS_NEW_BASE_URL ?? process.env.AKPA_LOGOS_NEW_BASE_URL ?? AKPA_LOGOS_DEFAULTS.NEW_BASE_URL).replace(/\/+$/, '');
  const newUser = env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER ?? AKPA_LOGOS_DEFAULTS.NEW_USER;
  const newPassword = env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD ?? AKPA_LOGOS_DEFAULTS.NEW_PASSWORD;
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

  let channels = await prisma.channel.findMany({
    where: { externalId: { startsWith: 'akpa_' } },
    select: { id: true, externalId: true, name: true },
  });

  if (channels.length === 0) {
    const apiUrl = env.AKPA_API_URL ?? process.env.AKPA_API_URL;
    const token = env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN;
    if (apiUrl && token) {
      console.log('Brak kanałów AKPA w bazie – pobieram listę z API AKPA ...');
      const list = await fetchChannelsFromAkpaApi();
      console.log(`  API zwróciło ${list.length} kanałów. Zapisuję do bazy ...`);
      for (const { externalId, name } of list) {
        await prisma.channel.upsert({
          where: { externalId },
          create: { externalId, name },
          update: { name },
        });
      }
      channels = await prisma.channel.findMany({
        where: { externalId: { startsWith: 'akpa_' } },
        select: { id: true, externalId: true, name: true },
      });
      console.log(`  W bazie jest teraz ${channels.length} kanałów AKPA.\n`);
    } else {
      console.error(
        '\nBrak kanałów AKPA w bazie. Ustaw w .env: AKPA_API_URL i AKPA_API_TOKEN, potem uruchom ten skrypt ponownie,\n' +
          'albo najpierw uruchom import EPG: npm run epg:import\n',
      );
      process.exit(1);
    }
  }

  console.log(`\nKanały AKPA w bazie: ${channels.length}. Dopasowanie i pobieranie logotypów ...\n`);

  let ok = 0;
  let fail = 0;
  const folderMap: Record<string, string> = {};
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

    if (result && folder) {
      folderMap[ch.externalId] = folder;
      const ext = result.ext;
      const filePath = join(STATIC_LOGOS_DIR, `${ch.externalId}.${ext}`);
      await writeFile(filePath, result.body);
      const logoUrl = `/logos/akpa/${ch.externalId}`;
      const logoContentType =
        ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : 'image/png';
      await prisma.channel.update({
        where: { id: ch.id },
        data: {
          logoUrl,
          logoData: new Uint8Array(result.body),
          logoContentType,
        },
      });
      ok++;
      console.log(`  OK ${ch.name} -> folder "${folder}" -> DB + ${ch.externalId}.${ext}`);
    } else {
      fail++;
      console.log(`  BRAK ${ch.name} (${ch.externalId})${folder ? ` [folder: ${folder}]` : ' [brak dopasowania]'}`);
    }
  }

  const mapPath = join(process.cwd(), 'src', 'data', 'akpa-logo-folder-map.json');
  await writeFile(mapPath, JSON.stringify(folderMap, null, 2), 'utf8');
  console.log(`\nMapa zapisana: ${mapPath} (${Object.keys(folderMap).length} kanałów)`);
  console.log(`Gotowe: ${ok} pobranych, ${fail} bez logotypu. Pliki: ${STATIC_LOGOS_DIR}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
