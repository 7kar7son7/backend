import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetch } from 'undici';
import { XMLParser } from 'fast-xml-parser';
import { gunzipSync } from 'node:zlib';

import { env } from '../config/env';

const prisma = new PrismaClient();

// Funkcje pomocnicze z iptv-org-importer.ts
function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureSuffix(slug: string, suffix: string): string {
  return slug.endsWith(`-${suffix}`) ? slug : `${slug}-${suffix}`;
}

function pickText(value: any): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '#text' in value) {
    return value['#text'];
  }
  return undefined;
}

function pickIcon(icon: any): string | undefined {
  if (!icon) return undefined;
  if (typeof icon === 'string') return icon;
  if (typeof icon === 'object' && icon.src) {
    return typeof icon.src === 'string' ? icon.src : pickText(icon.src);
  }
  return undefined;
}

type LogoEntry = {
  channel: string;
  url: string;
  tags?: string[];
};

let logoMapCache: Map<string, string> | null = null;
let logoMapPromise: Promise<Map<string, string>> | null = null;

function resolvePathMaybe(path: string | undefined | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const isAbsolutePath = resolve(path) === path || path.startsWith('/');
  return isAbsolutePath ? path : resolve(process.cwd(), path);
}

async function loadLogoMap(): Promise<Map<string, string>> {
  if (logoMapCache) {
    return logoMapCache;
  }
  if (logoMapPromise) {
    return logoMapPromise;
  }

  logoMapPromise = (async () => {
    const configuredPath =
      process.env.EPG_LOGO_DATA_FILE ?? env.EPG_LOGO_DATA_FILE ?? '../epg-source/temp/data/logos.json';
    const resolvedPath = resolvePathMaybe(configuredPath);
    if (!resolvedPath) {
      console.warn('Nie skonfigurowano ścieżki do logotypów (EPG_LOGO_DATA_FILE).');
      return new Map<string, string>();
    }

    try {
      const raw = await readFile(resolvedPath, 'utf-8');
      const entries = JSON.parse(raw) as LogoEntry[];
      const grouped = new Map<string, LogoEntry[]>();
      for (const entry of entries) {
        if (!entry?.channel || typeof entry.url !== 'string' || entry.url.length === 0) {
          continue;
        }
        const key = slugify(entry.channel);
        if (!key) continue;
        const bucket = grouped.get(key) ?? [];
        bucket.push(entry);
        grouped.set(key, bucket);
      }

      const map = new Map<string, string>();
      for (const [key, list] of grouped) {
        const preferred =
          list.find((item) => !(item.tags ?? []).includes('picons')) ?? list[0];
        if (preferred?.url) {
          map.set(key, preferred.url);
        }
      }

      logoMapCache = map;
      return map;
    } catch (error) {
      console.warn('Nie udało się wczytać pliku z logotypami kanałów:', error);
      return new Map<string, string>();
    }
  })();

  const result = await logoMapPromise;
  logoMapCache = result;
  return result;
}

function findLogoForChannel(
  map: Map<string, string>,
  channelId: string,
  channelName: string | undefined,
): string | undefined {
  const candidates = new Set<string>();

  const cleanId = channelId.replace(/\.pl$/, '');
  const idSlug = slugify(cleanId.split('#')[1] ?? cleanId);
  if (idSlug) {
    candidates.add(idSlug);
    candidates.add(ensureSuffix(idSlug, 'pl'));
  }

  const cleanName = (channelName ?? '').replace(/\.pl$/, '');
  const nameSlug = slugify(cleanName);
  if (nameSlug) {
    candidates.add(nameSlug);
    candidates.add(ensureSuffix(nameSlug, 'pl'));
  }

  if (nameSlug) {
    candidates.add(`${nameSlug}pl`);
  }

  for (const slug of candidates) {
    const candidate = map.get(slug);
    if (candidate) {
      return candidate;
    }
  }
  return undefined;
}

async function restoreLogosFromEPG() {
  console.log('🔄 Przywracanie logotypów z EPG...');

  // Pobierz wszystkie kanały z bazy
  const channels = await prisma.channel.findMany({
    select: {
      id: true,
      externalId: true,
      name: true,
      logoUrl: true,
    },
  });

  console.log(`📺 Znaleziono ${channels.length} kanałów w bazie`);

  // Załaduj mapę logotypów z logos.json
  const logoMap = await loadLogoMap();
  console.log(`🖼️  Załadowano ${logoMap.size} logotypów z logos.json`);

  // Pobierz EPG XML
  const EPG_URL = 'https://www.open-epg.com/files/poland1.xml.gz';
  console.log(`📥 Pobieranie EPG z ${EPG_URL}...`);

  let xmlContent: string;
  try {
    const response = await fetch(EPG_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    xmlContent = gunzipSync(Buffer.from(buffer)).toString('utf-8');
  } catch (error) {
    console.error('❌ Błąd pobierania EPG:', error);
    return;
  }

  // Parsuj XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });
  const parsed = parser.parse(xmlContent);
  const tv = parsed.tv || parsed;
  const channelNodes = Array.isArray(tv.channel) ? tv.channel : tv.channel ? [tv.channel] : [];

  console.log(`📡 Znaleziono ${channelNodes.length} kanałów w EPG XML`);

  // Mapuj externalId -> logo URL
  const logoUpdates = new Map<string, string>();

  for (const channelNode of channelNodes) {
    const externalId = channelNode['@_id'];
    if (!externalId) continue;

    const name = pickText(channelNode['display-name']) ?? externalId;
    const directLogo = pickIcon(channelNode.icon);
    const enrichedLogo = directLogo ?? findLogoForChannel(logoMap, externalId, name);

    if (enrichedLogo) {
      logoUpdates.set(externalId, enrichedLogo);
    }
  }

  console.log(`✅ Znaleziono ${logoUpdates.size} logotypów w EPG`);

  // Zaktualizuj logotypy w bazie (tylko jeśli kanał nie ma logotypu lub ma null)
  let updated = 0;
  let skipped = 0;

  for (const channel of channels) {
    const logoUrl = logoUpdates.get(channel.externalId);
    if (!logoUrl) {
      skipped++;
      continue;
    }

    // Aktualizuj tylko jeśli kanał nie ma logotypu
    if (!channel.logoUrl) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { logoUrl },
      });
      updated++;
      console.log(`  ✅ ${channel.name}: ${logoUrl}`);
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Zaktualizowano ${updated} logotypów`);
  console.log(`⏭️  Pominięto ${skipped} kanałów (już mają logotyp lub brak w EPG)`);
}

async function main() {
  try {
    await restoreLogosFromEPG();
  } catch (error) {
    console.error('❌ Błąd:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

