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

/** Jeden kandydat na nazwę folderu AKPA (do fallback). */
export function channelNameToFolderCandidate(channelName: string): string | null {
  const n = normalize(channelName);
  return n || null;
}

/** Wszystkie warianty nazwy folderu do próby (np. "13 ulica" → ["13 ulica", "13-ulica", "13ulica"]). */
export function channelNameToFolderCandidates(channelName: string): string[] {
  const n = normalize(channelName);
  if (!n) return [];
  const out = new Set<string>();
  out.add(n);
  out.add(n.replace(/\s+/g, '-'));
  out.add(n.replace(/\s+/g, ''));
  return [...out];
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

/** Wbudowana mapa (fallback gdy plik nie istnieje, np. na Railway). */
const BUILTIN_FOLDER_MAP: AkpaLogoFolderMap = {
  akpa_498: 'romance tv', akpa_112: 'amc', akpa_513: 'paramount network', akpa_387: 'warner tv',
  akpa_466: 'id', akpa_725: 'super polsat', akpa_841: 'polsat rodzina', akpa_358: 'cinemax2',
  akpa_435: 'tvp hd', akpa_359: 'polsat comedy central extra', akpa_240: 'tvn fabuła', akpa_85: 'ale kino+',
  akpa_508: 'itvn', akpa_366: 'axn white', akpa_367: 'axn black', akpa_936: 'novelas+', akpa_633: 'stopklatka',
  akpa_1111: 'polsat film 2', akpa_268: 'tv 6', akpa_147: 'axn', akpa_1112: 'polsat reality',
  akpa_343: 'tvp kultura', akpa_477: 'polsat film', akpa_75: '13 ulica', akpa_528: 'axn spin',
  akpa_333: 'tvn style', akpa_382: 'fx comedy', akpa_1: 'tvp 1', akpa_800: 'ttv', akpa_753: 'metro',
  akpa_597: 'polsat seriale', akpa_3: 'tvp polonia', akpa_2: 'tvp 2', akpa_495: 'fx', akpa_5: 'polsat',
  akpa_497: 'tvp seriale', akpa_6: 'polsat 2', akpa_756: 'wp', akpa_7: 'tvn 7', akpa_403: 'kino tv',
  akpa_273: 'novelas+', akpa_174: 'ci polsat', akpa_17: 'tvn', akpa_18: 'tv 4', akpa_720: 'zoom tv',
  akpa_11: 'tv puls', akpa_721: 'nowa tv', akpa_310: 'novela tv', akpa_941: 'sundance tv', akpa_4: 'kino polska',
  akpa_405: 'filmbox premium hd', akpa_406: 'filmbox extra hd', akpa_807: 'epic drama', akpa_631: 'filmbox arthouse',
  akpa_438: 'filmbox family', akpa_280: 'puls 2', akpa_412: 'sci fi', akpa_417: 'tvs', akpa_640: 'fokus tv',
  akpa_36: 'cinemax',
};

let cachedMap: AkpaLogoFolderMap | null = null;

const MAP_FILENAME = 'akpa-logo-folder-map.json';

/** Ładuje mapowanie externalId → nazwa folderu AKPA (z pliku lub wbudowanej mapy). */
export function loadAkpaLogoFolderMap(): AkpaLogoFolderMap {
  if (cachedMap) return cachedMap;
  const cwd = process.cwd();
  const paths = [
    join(cwd, 'src', 'data', MAP_FILENAME),
    join(cwd, 'data', MAP_FILENAME),
    join(cwd, 'dist', 'data', MAP_FILENAME),
  ];
  try {
    const fromDir = typeof __dirname !== 'undefined' ? join(__dirname, '..', 'data', MAP_FILENAME) : null;
    if (fromDir) paths.push(fromDir);
  } catch {
    // ignore
  }
  for (const subPath of paths) {
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
  cachedMap = BUILTIN_FOLDER_MAP;
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
    if (!res.ok) {
      if (typeof process !== 'undefined' && process.env?.LOG_AKPA_FOLDER_LIST) {
        console.warn(`[AKPA] listowanie folderów: ${res.status} ${res.statusText} (${url})`);
      }
      return [];
    }
    const html = await res.text();
    const list = parseFolderNamesFromHtml(html);
    folderListCache = { list, at: now };
    return list;
  } catch (err) {
    if (typeof process !== 'undefined' && process.env?.LOG_AKPA_FOLDER_LIST) {
      console.warn('[AKPA] listowanie folderów błąd:', err);
    }
    return [];
  }
}
