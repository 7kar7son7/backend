/**
 * Zapisuje embedded-akpa-logos.json z istniejącego .ts (żeby serwer mógł ładować przez readFileSync).
 * Uruchom raz: npx tsx src/scripts/write-embedded-json.ts
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const tsPath = join(process.cwd(), 'src', 'data', 'embedded-akpa-logos.ts');
const jsonPath = join(process.cwd(), 'src', 'data', 'embedded-akpa-logos.json');
if (!existsSync(tsPath)) {
  console.error('Brak pliku embedded-akpa-logos.ts. Uruchom najpierw: npm run logos:embed');
  process.exit(1);
}
const mod = require(tsPath);
const obj = mod?.EMBEDDED_AKPA_LOGOS ?? mod?.default?.EMBEDDED_AKPA_LOGOS ?? {};
if (typeof obj !== 'object' || Object.keys(obj).length === 0) {
  console.error('Brak danych w pliku .ts');
  process.exit(1);
}
writeFileSync(jsonPath, JSON.stringify(obj), 'utf8');
console.log('Zapisano', Object.keys(obj).length, 'logotypów do', jsonPath);
