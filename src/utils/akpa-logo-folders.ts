/**
 * Wspólna logika dopasowania nazwy kanału do folderu na logotypy.akpa.pl.
 * Używane przez route GET /logos/akpa/:id oraz skrypt download-akpa-logos.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fetch } from 'undici';

/** Parsuje listowanie katalogu Apache – zwraca nazwy folderów (linki kończące się na /). */
export function parseFolderNamesFromHtml(html: string): string[] {
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

export function normalize(s: string): string {
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

/** Kandydat na nazwę folderu AKPA z nazwy kanału (do fallback gdy brak w mapie i lista folderów pusta). */
export function channelNameToFolderCandidate(channelName: string): string | null {
  const n = normalize(channelName);
  return n || null;
}

/**
 * Znajduje folder z listy AKPA pasujący do nazwy kanału.
 * Sprawdza: dokładna norma, + " hd", bez " hd", bez spacji, zawieranie.
 */
export function findBestFolder(channelName: string, folderList: string[]): string | null {
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

export type AkpaLogoFolderMap = Record<string, string>;

let cachedMap: AkpaLogoFolderMap | null = null;

const MAP_FILENAME = 'akpa-logo-folder-map.json';

/** Ładuje mapowanie externalId → nazwa folderu AKPA (z pliku wygenerowanego przez logos:download:akpa). */
export function loadAkpaLogoFolderMap(): AkpaLogoFolderMap {
  if (cachedMap) return cachedMap;
  const cwd = process.cwd();
  for (const subPath of [join(cwd, 'src', 'data', MAP_FILENAME), join(cwd, 'data', MAP_FILENAME)]) {
    try {
      if (existsSync(subPath)) {
        const raw = readFileSync(subPath, 'utf8');
        cachedMap = JSON.parse(raw) as AkpaLogoFolderMap;
        return cachedMap;
      }
    } catch {
      // ignore
    }
  }
  cachedMap = {};
  return cachedMap;
}

const FOLDER_LIST_CACHE_MS = 60 * 60 * 1000; // 1h
let folderListCache: { list: string[]; at: number } | null = null;

/** Pobiera listę folderów z logotypy.akpa.pl (z cache). Gdy błąd/brak auth zwraca []. */
export async function getCachedAkpaFolderList(
  baseUrl: string,
  authHeader: string,
): Promise<string[]> {
  const now = Date.now();
  if (folderListCache && now - folderListCache.at < FOLDER_LIST_CACHE_MS) {
    return folderListCache.list;
  }
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/`;
    const res = await fetch(url, { method: 'GET', headers: { Authorization: authHeader } });
    if (!res.ok) return [];
    const html = await res.text();
    const list = parseFolderNamesFromHtml(html);
    folderListCache = { list, at: now };
    return list;
  } catch {
    return folderListCache?.list ?? [];
  }
}
