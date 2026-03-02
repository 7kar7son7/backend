import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

type EmbeddedEntry = { contentType: string; base64: string };
let embeddedLogosCache: Record<string, EmbeddedEntry> | null = null;

/** Lazy-load dużej mapy embedded (46MB), żeby nie ładować jej przy starcie serwera (OOM na Railway). */
function getEmbeddedLogos(): Record<string, EmbeddedEntry> {
  if (embeddedLogosCache !== null) return embeddedLogosCache;
  let map: Record<string, EmbeddedEntry> = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../data/embedded-akpa-logos');
    map = (mod.EMBEDDED_AKPA_LOGOS ?? {}) as Record<string, EmbeddedEntry>;
  } catch (e) {
    console.warn('[logos] Failed to load embedded-akpa-logos (file missing or OOM):', e instanceof Error ? e.message : e);
  }
  if (Object.keys(map).length === 0) {
    console.warn('[logos] Embedded logos map is empty – upewnij się, że src/data/embedded-akpa-logos.ts jest w repo i w buildzie (npm run logos:embed).');
  }
  embeddedLogosCache = map;
  return embeddedLogosCache;
}

const EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'] as const;

function contentTypeForExt(ext: string): string {
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  return 'image/webp';
}

/**
 * Katalog static/logos/akpa. W Dockerze WORKDIR=/app, więc najpierw cwd (pewniejsze).
 */
export function getStaticLogosDir(): string {
  const byCwd = join(process.cwd(), 'static', 'logos', 'akpa');
  if (existsSync(byCwd)) return byCwd;
  try {
    const fromDist = join(__dirname, '..', '..', 'static', 'logos', 'akpa');
    if (existsSync(fromDist)) return fromDist;
  } catch {
    // ignore
  }
  return join(process.cwd(), 'static', 'logos', 'akpa');
}

/**
 * Odczyt logo: najpierw z wbudowanej mapy (działa na Railway bez static/), potem z plików.
 */
export function readLogoFromStatic(channelId: string): { body: Buffer; contentType: string } | null {
  if (!/^akpa_[a-zA-Z0-9_]+$/.test(channelId) || channelId.length > 128) return null;
  const embedded = getEmbeddedLogos()[channelId];
  if (embedded) {
    return {
      body: Buffer.from(embedded.base64, 'base64'),
      contentType: embedded.contentType,
    };
  }
  const dir = getStaticLogosDir();
  for (const ext of EXTENSIONS) {
    const filePath = join(dir, `${channelId}${ext}`);
    if (existsSync(filePath)) {
      const body = readFileSync(filePath);
      return { body, contentType: contentTypeForExt(ext) };
    }
  }
  return null;
}

/**
 * Dla diagnostyki: ścieżki i czy katalog/plik istnieją.
 */
export function getStaticLogosDebug(): {
  dirCwd: string;
  dirFromDist: string;
  cwdExists: boolean;
  fromDistExists: boolean;
  sampleExists: boolean;
} {
  const dirCwd = join(process.cwd(), 'static', 'logos', 'akpa');
  let dirFromDist = dirCwd;
  try {
    dirFromDist = join(__dirname, '..', '..', 'static', 'logos', 'akpa');
  } catch {
    // ignore
  }
  const cwdExists = existsSync(dirCwd);
  const fromDistExists = existsSync(dirFromDist);
  const dir = cwdExists ? dirCwd : dirFromDist;
  const sampleExists = existsSync(join(dir, 'akpa_85.png')) || existsSync(join(dir, 'akpa_85.jpg'));
  return { dirCwd, dirFromDist, cwdExists, fromDistExists, sampleExists };
}
