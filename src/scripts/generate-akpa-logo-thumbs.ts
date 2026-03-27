/**
 * Z embedded-akpa-logos.json robi akpa-logo-thumbs.json: WebP 48px, niska jakość – mały JSON do inline w /channels.
 * Uruchom: npm run logos:thumbs (wymaga sharp).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const IN_JSON = join(process.cwd(), 'src', 'data', 'embedded-akpa-logos.json');
const OUT_JSON = join(process.cwd(), 'src', 'data', 'akpa-logo-thumbs.json');

async function main() {
  if (!existsSync(IN_JSON)) {
    console.error('Brak', IN_JSON, '— najpierw npm run logos:embed');
    process.exit(1);
  }
  const embedded = JSON.parse(readFileSync(IN_JSON, 'utf8')) as Record<
    string,
    { contentType?: string; base64?: string }
  >;
  const out: Record<string, string> = {};
  const ids = Object.keys(embedded).filter((k) => k.startsWith('akpa_')).sort();
  for (const id of ids) {
    const e = embedded[id];
    if (!e?.base64) continue;
    const buf = Buffer.from(e.base64, 'base64');
    const webp = await sharp(buf)
      .resize(48, 48, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
    out[id] = webp.toString('base64');
  }
  writeFileSync(OUT_JSON, JSON.stringify(out));
  const raw = readFileSync(OUT_JSON);
  console.log('Zapisano', Object.keys(out).length, 'miniatur do', OUT_JSON, '| rozmiar pliku', raw.length, 'B');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
