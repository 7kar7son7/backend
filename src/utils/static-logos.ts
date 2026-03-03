import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

type EmbeddedEntry = { contentType: string; base64: string };
let embeddedLogosCache: Record<string, EmbeddedEntry> | null = null;

/** Lazy-load mapy embedded z JSON (readFileSync – działa zawsze), potem opcjonalnie z .ts. */
function getEmbeddedLogos(): Record<string, EmbeddedEntry> {
  if (embeddedLogosCache !== null) return embeddedLogosCache;
  let map: Record<string, EmbeddedEntry> = {};
  const cwd = process.cwd();
  const dir = typeof __dirname !== 'undefined' ? __dirname : join(cwd, 'src', 'utils');
  const jsonCandidates = [
    join(cwd, 'src', 'data', 'embedded-akpa-logos.json'),
    join(cwd, 'data', 'embedded-akpa-logos.json'),
    join(dir, '..', 'data', 'embedded-akpa-logos.json'),
  ];
  for (const p of jsonCandidates) {
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, EmbeddedEntry>;
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        map = parsed;
        break;
      }
    } catch {
      // next path
    }
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
