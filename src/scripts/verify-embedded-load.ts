/**
 * Weryfikacja ładowania embedded logos (tak jak w static-logos.ts).
 * Uruchom: npx tsx src/scripts/verify-embedded-load.ts
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const dir = join(cwd, 'src', 'utils');
const candidates = [
  join(dir, '..', 'data', 'embedded-akpa-logos.ts'),
  join(dir, '..', 'data', 'embedded-akpa-logos.js'),
  join(cwd, 'src', 'data', 'embedded-akpa-logos.ts'),
  join(cwd, 'src', 'data', 'embedded-akpa-logos.js'),
];
const pathToLoad = candidates.find((p) => existsSync(p)) ?? null;
console.log('pathToLoad', pathToLoad);
if (pathToLoad) {
  try {
    const mod = require(pathToLoad);
    const raw = mod?.EMBEDDED_AKPA_LOGOS ?? mod?.default?.EMBEDDED_AKPA_LOGOS ?? mod;
    const keys = raw && typeof raw === 'object' ? Object.keys(raw) : [];
    console.log('count', keys.length, '| akpa_367', keys.includes('akpa_367'));
  } catch (e) {
    console.error('require failed', e);
  }
} else {
  console.log('no file found');
}
