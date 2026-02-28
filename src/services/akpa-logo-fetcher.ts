/**
 * Pobieranie pojedynczego logotypu z logotypy.akpa.pl (po nazwie folderu).
 * Używane przez route GET /logos/akpa/:channelId jako fallback gdy brak pliku na dysku.
 */
import { fetch } from 'undici';

const LOGO_FILES = ['logo.png', 'logo.jpg', 'logo.jpeg', 'image.png', 'image.jpg', 'logo.svg'];
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

function parseImageLinksFromHtml(html: string): string[] {
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
  return files.sort((a, b) => {
    const aSimple = !/_black|_white|_green|_red/i.test(a) ? 0 : 1;
    const bSimple = !/_black|_white|_green|_red/i.test(b) ? 0 : 1;
    if (aSimple !== bSimple) return aSimple - bSimple;
    return a.length - b.length;
  });
}

const FETCH_TIMEOUT_MS = 15000;

async function fetchFolderListing(
  baseUrl: string,
  authHeader: string,
  folderName: string,
): Promise<string[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(folderName)}/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: authHeader },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const html = await res.text();
    return parseImageLinksFromHtml(html);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

/**
 * Pobiera logo z podanego folderu na logotypy.akpa.pl.
 * Próbuje najpierw standardowe nazwy (logo.png itd.), potem listuje folder i bierze pierwszy obraz.
 */
export async function fetchLogoFromAkpaFolder(
  baseUrl: string,
  authHeader: string,
  folderName: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  const base = baseUrl.replace(/\/+$/, '');
  const opts = { method: 'GET' as const, headers: { Authorization: authHeader } };
  for (const fileName of LOGO_FILES) {
    const url = `${base}/${encodeURIComponent(folderName)}/${fileName}`;
    try {
      const res = await fetch(url, opts);
      if (res.ok && res.body) {
        const buf = Buffer.from(await res.arrayBuffer());
        const contentType =
          res.headers.get('content-type') ?? (fileName.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
        return { body: buf, contentType };
      }
    } catch {
      continue;
    }
  }
  const fileNames = await fetchFolderListing(baseUrl, authHeader, folderName);
  for (const fileName of fileNames) {
    const url = `${base}/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`;
    try {
      const res = await fetch(url, opts);
      if (res.ok && res.body) {
        const buf = Buffer.from(await res.arrayBuffer());
        const contentType =
          res.headers.get('content-type') ?? (fileName.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
        return { body: buf, contentType };
      }
    } catch {
      continue;
    }
  }
  return null;
}
