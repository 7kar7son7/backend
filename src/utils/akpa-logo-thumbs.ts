import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Miniatury WebP (48px) dla akpa_* – generowane: npm run logos:thumbs.
 * W JSON listy kanałów jako logoThumbDataUrl → zero dodatkowych requestów na kafelek przy starcie.
 */
const THUMB_FILENAME = 'akpa-logo-thumbs.json';

let thumbBase64ById: Record<string, string> | null = null;

function loadThumbs(): Record<string, string> {
  if (thumbBase64ById) return thumbBase64ById;
  const cwd = process.cwd();
  const paths = [
    join(cwd, 'src', 'data', THUMB_FILENAME),
    join(cwd, 'data', THUMB_FILENAME),
    join(cwd, 'dist', 'data', THUMB_FILENAME),
    join(__dirname, '..', 'data', THUMB_FILENAME),
  ];
  for (const subPath of paths) {
    try {
      if (existsSync(subPath)) {
        const raw = readFileSync(subPath, 'utf8');
        thumbBase64ById = JSON.parse(raw) as Record<string, string>;
        const n = Object.keys(thumbBase64ById).length;
        if (n > 0) {
          console.log('[logos] miniaturki kanałów:', n, 'wpisów (logoThumbDataUrl w API), plik:', subPath);
        }
        return thumbBase64ById;
      }
    } catch {
      // next
    }
  }
  thumbBase64ById = {};
  return thumbBase64ById;
}

export function akpaLogoThumbDataUrl(externalId: string): string | null {
  const id = String(externalId ?? '').trim();
  if (!id.startsWith('akpa_')) return null;
  const map = loadThumbs();
  const b64 = map[id];
  if (!b64) return null;
  return `data:image/webp;base64,${b64}`;
}
