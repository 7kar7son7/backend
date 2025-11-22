import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { XMLParser } from 'fast-xml-parser';
import { DateTime } from 'luxon';
import { readFile } from 'node:fs/promises';
import { fetch } from 'undici';
import { isAbsolute, resolve } from 'node:path';

import { env } from '../config/env';
import { EpgImportService, type EpgChannel, type EpgFeed, type EpgProgram } from './epg-import.service';

// Lista źródeł EPG z priorytetem - pierwsze działające będzie użyte
const EPG_SOURCES = [
  'https://epg.ovh/pl.xml', // Aktualizowane codziennie, polskie EPG
  'https://epg.best/epg.xml.gz', // Alternatywne źródło
  'https://iptv-org.github.io/epg/guides/pl/pl.xml', // GitHub (może być nieaktualne)
] as const;

const DEFAULT_IPTV_URL = EPG_SOURCES[0];
const DEFAULT_LOGO_DATA_PATH = '../epg-source/temp/data/logos.json';
const DEFAULT_CHANNEL_DATA_PATH = '../epg-source/temp/data/channels.json';

const MAX_CHANNELS =
  Number.parseInt(process.env.IPTV_ORG_MAX_CHANNELS ?? '', 10) ||
  Number.parseInt(env.IPTV_ORG_MAX_CHANNELS ?? '', 10) ||
  10000;

const MAX_PROGRAM_DAYS =
  Number.parseInt(process.env.IPTV_ORG_MAX_DAYS ?? '', 10) ||
  Number.parseInt(env.IPTV_ORG_MAX_DAYS ?? '', 10) ||
  7;

const allowedPrefixesRaw =
  process.env.IPTV_ORG_ALLOWED_PREFIXES ??
  env.IPTV_ORG_ALLOWED_PREFIXES ??
  'pl/';

const allowedPrefixes = allowedPrefixesRaw
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0 && value !== '*');

const allowAllChannels =
  allowedPrefixesRaw.split(',').some((value) => value.trim() === '*') ||
  allowedPrefixes.length === 0;

const envSelectedChannelIds = parseSelectedChannelIds(
  process.env.IPTV_ORG_SELECTED_IDS ?? env.IPTV_ORG_SELECTED_IDS ?? '',
);

type SelectedChannelSet = {
  isEmpty: boolean;
  rawIds: Set<string>;
  slugIds: Set<string>;
};

export function isChannelIdAllowed(channelId: string | null | undefined) {
  if (!channelId) {
    return false;
  }
  if (allowAllChannels) {
    return true;
  }
  return allowedPrefixes.some((prefix) => channelId.startsWith(prefix));
}

export type IptvOrgImportOptions = {
  url?: string;
  file?: string;
  verbose?: boolean;
  channelIds?: string[];
};

interface IptvChannelNode {
  '@_id': string;
  'display-name': Array<string | { '#text': string }> | string | { '#text': string };
  icon?: Array<{ '@_src': string }> | { '@_src': string } | string;
}

interface IptvProgrammeNode {
  '@_start': string;
  '@_stop'?: string;
  '@_channel': string;
  title?: Array<string | { '#text': string }> | string | { '#text': string };
  desc?: Array<string | { '#text': string }> | string | { '#text': string };
  category?: Array<string | { '#text': string }> | string | { '#text': string };
}

export async function importIptvOrgEpg(
  prisma: PrismaClient,
  logger: FastifyBaseLogger,
  options: IptvOrgImportOptions = {},
) {
  const resolvedFile = resolvePathMaybe(options.file ?? env.EPG_SOURCE_FILE ?? process.env.EPG_SOURCE_FILE ?? null);
  const finalUrl =
    options.file != null
      ? undefined
      : options.url ?? env.EPG_SOURCE_URL ?? DEFAULT_IPTV_URL;

  if (!resolvedFile && !finalUrl) {
    throw new Error('Brak źródła feedu IPTV-Org (ustaw --url/--file lub zmienne EPG_SOURCE_URL / EPG_SOURCE_FILE).');
  }

  const sourceLabel = resolvedFile ?? finalUrl ?? DEFAULT_IPTV_URL;
  logger.info(`📡 Rozpoczynam import EPG z ${sourceLabel}`);

  let xml: string;
  try {
    if (resolvedFile) {
      logger.info(`📥 Próbuję pobrać XML z pliku: ${resolvedFile}`);
      xml = await loadFromFile(resolvedFile);
      logger.info(`✅ Pobrano XML z pliku (${xml.length} znaków)`);
    } else if (finalUrl) {
      // Jeśli użyto domyślnego URL, spróbuj wszystkich źródeł jako fallback
      const urlsToTry = finalUrl === DEFAULT_IPTV_URL ? EPG_SOURCES : [finalUrl];
      xml = await loadFromUrlWithFallback(urlsToTry, logger);
      logger.info(`✅ Pobrano XML (${xml.length} znaków)`);
    } else {
      throw new Error('Brak źródła feedu - ani plik, ani URL');
    }
  } catch (error) {
    logger.error(
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : undefined,
        source: sourceLabel,
        url: finalUrl,
        file: resolvedFile,
      },
      'Failed to load EPG XML from source',
    );
    throw error;
  }

  let parsed: any;
  try {
    logger.info('🔄 Parsuję XML (może to chwilę potrwać dla dużych plików)...');
    // Użyj opcji optymalizujących dla dużych plików
    const parser = new XMLParser({ 
      ignoreAttributes: false, 
      attributeNamePrefix: '@_',
      parseAttributeValue: false, // Nie parsuj wartości atrybutów - oszczędza pamięć
      trimValues: true,
    });
    parsed = parser.parse(xml);
    logger.info('✅ XML został sparsowany');
  } catch (error) {
    logger.error(
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        xmlLength: xml.length,
        xmlPreview: xml.substring(0, 500),
      },
      'Failed to parse EPG XML',
    );
    throw error;
  }

  if (!parsed?.tv) {
    logger.error(
      {
        parsedKeys: Object.keys(parsed || {}),
        parsedPreview: JSON.stringify(parsed).substring(0, 500),
      },
      'Invalid EPG feed format - missing tv element',
    );
    throw new Error('Niepoprawny format feedu IPTV-Org');
  }

  const channelNodes: IptvChannelNode[] = ensureArray(parsed.tv.channel ?? []);
  const programmeNodes: IptvProgrammeNode[] = ensureArray(parsed.tv.programme ?? []);
  logger.info(
    `ℹ️  Wczytano ${channelNodes.length} kanałów i ${programmeNodes.length} programów z pliku XML.`,
  );

  const selectedChannels = buildSelectedChannelSet(
    options.channelIds ?? envSelectedChannelIds,
  );
  
  // Loguj informacje o filtrach
  logger.info(`🔍 Filtry kanałów:`);
  logger.info(`  • Prefiksy dozwolone: ${allowedPrefixes.length > 0 ? allowedPrefixes.join(', ') : 'wszystkie'}`);
  logger.info(`  • Wybrane kanały: ${selectedChannels.isEmpty ? 'wszystkie z prefiksem' : envSelectedChannelIds.length + ' określonych'}`);
  if (!selectedChannels.isEmpty && envSelectedChannelIds.length > 0) {
    logger.info(`  • Lista wybranych: ${envSelectedChannelIds.slice(0, 5).join(', ')}${envSelectedChannelIds.length > 5 ? '...' : ''}`);
  }

  const programmesByChannel = new Map<string, EpgProgram[]>();
  let processedPrograms = 0;
  let skippedPrograms = 0;
  let skippedByDate = 0;
  let skippedByChannel = 0;
  let skippedBySelection = 0;
  let todayPrograms = 0;
  
  const now = DateTime.utc();
  const today = now.startOf('day');
  const maxTime = now.plus({ days: MAX_PROGRAM_DAYS });

  logger.info(`🔄 Przetwarzam ${programmeNodes.length} programów z XML...`);
  const minTime = now.minus({ days: 7 }); // Akceptuj programy z ostatnich 7 dni
  logger.info(`📅 Zakres dat: od ${minTime.toISO()} (7 dni wstecz) do ${maxTime.toISO()} (${MAX_PROGRAM_DAYS} dni w przód)`);
  logger.info(`📅 Dzisiaj: ${today.toISO()}, Teraz: ${now.toISO()}`);

  for (const programme of programmeNodes) {
    const channelId = programme['@_channel'];
    if (!channelId) {
      skippedPrograms += 1;
      continue;
    }
    if (!isChannelIdAllowed(channelId)) {
      skippedByChannel += 1;
      continue;
    }
    // Dla epg.ovh ignorujemy IPTV_ORG_SELECTED_IDS - importujemy wszystkie polskie kanały (z prefiksem pl/)
    // Filtr prefiksów (pl/) już zapewnia, że tylko polskie kanały są importowane
    // if (!selectedChannels.isEmpty && !isChannelSelectedById(selectedChannels, channelId)) {
    //   skippedBySelection += 1;
    //   continue;
    // }

    const startTs = parseTimestamp(programme['@_start']);
    if (!startTs) {
      skippedPrograms += 1;
      continue;
    }

    const start = DateTime.fromJSDate(startTs).toUTC();
    const programDay = start.startOf('day');
    
    // minTime jest już zdefiniowane wyżej (7 dni wstecz)
    // Sprawdź czy program mieści się w zakresie dat
    if (start < minTime) {
      // Program zbyt stary - pomiń
      skippedByDate += 1;
      continue;
    }
    
    if (start > maxTime) {
      // Program zbyt daleko w przyszłości - pomiń
      skippedByDate += 1;
      continue;
    }
    
    // Loguj programy z dzisiaj i przyszłości
    if (programDay.equals(today)) {
      todayPrograms += 1;
      if (todayPrograms <= 20) {
        logger.info(`📺 Program z dzisiaj: ${channelId} - ${pickText(programme.title)} - ${start.toFormat('yyyy-MM-dd HH:mm')} UTC`);
      }
    } else if (start > now && start <= maxTime) {
      // Loguj też programy z najbliższych dni dla debugowania
      if (todayPrograms < 5) {
        logger.debug(`📅 Program z przyszłości: ${channelId} - ${pickText(programme.title)} - ${start.toFormat('yyyy-MM-dd HH:mm')} UTC`);
      }
    }

    const endTs = programme['@_stop'] ? parseTimestamp(programme['@_stop']) : null;

    const startIso =
      start.toISO({ suppressMilliseconds: true }) ??
      start.toUTC().toISO() ??
      new Date().toISOString();
    const endIso = endTs
      ? DateTime.fromJSDate(endTs).toUTC().toISO({ suppressMilliseconds: true }) ?? undefined
      : undefined;
    const description = pickText(programme.desc);
    const categories = ensureArray(programme.category)
      .map(pickText)
      .filter((tag): tag is string => Boolean(tag));

    const program: EpgProgram = {
      id: `${channelId}-${startIso}`,
      title: pickText(programme.title) ?? 'Program',
      start: startIso,
      ...(description != null ? { description } : {}),
      ...(endIso != null ? { end: endIso } : {}),
      ...(categories.length > 0 ? { tags: categories } : {}),
    };

    const list = programmesByChannel.get(channelId) ?? [];
    list.push(program);
    programmesByChannel.set(channelId, list);
    processedPrograms += 1;
    if (processedPrograms % 10000 === 0) {
      logger.info(
        `  • Przetworzono ${processedPrograms} wpisów programów (ostatni kanał: ${channelId}).`,
      );
    }
  }
  
  logger.info(
    `✅ Przetworzono ${processedPrograms} programów (w tym ${todayPrograms} z dzisiaj), pominięto:` +
    ` ${skippedPrograms} (brak danych), ${skippedByChannel} (prefiks), ${skippedBySelection} (wybór), ${skippedByDate} (data) - łącznie ${programmeNodes.length} w XML.`,
  );

  const channels: EpgChannel[] = [];
  let processedChannels = 0;
  const verbose = options.verbose ?? false;
  
  logger.info(`🔄 Przetwarzam ${channelNodes.length} kanałów z XML...`);
  const logoMap = await loadLogoMap(logger);
  const allowedSlugs = await loadAllowedChannelSlugs(logger);

  for (const channel of channelNodes) {
    if (!isChannelIdAllowed(channel['@_id'])) {
      continue;
    }
    const programs = programmesByChannel.get(channel['@_id']);
    if (!programs || programs.length === 0) {
      continue;
    }

    programs.sort((a, b) => DateTime.fromISO(a.start).toMillis() - DateTime.fromISO(b.start).toMillis());

    const name = pickText(channel['display-name']) ?? channel['@_id'];
    const directLogo = pickIcon(channel.icon);
    const enrichedLogo =
      directLogo ??
      findLogoForChannel(logoMap, channel['@_id'], name);

    // Sprawdź czy kanał jest na liście polskich stacji (jeśli lista istnieje)
    // Jeśli lista jest pusta, akceptuj wszystkie kanały z dozwolonym prefiksem (pl/)
    if (allowedSlugs.size > 0 && !isChannelWhitelisted(allowedSlugs, channel['@_id'], name)) {
      if (verbose) {
        logger.info(`  • Pomijam kanał ${name} (${channel['@_id']}) – poza listą polskich stacji.`);
      }
      continue;
    }

    const channelPayload: EpgChannel = {
      id: channel['@_id'],
      name,
      programs,
      ...(enrichedLogo ? { logo: enrichedLogo } : {}),
    };

    // Jeśli nie ma wybranych kanałów, importuj wszystkie z dozwolonym prefiksem
    if (!selectedChannels.isEmpty && !isChannelSelected(selectedChannels, channel['@_id'], name)) {
      continue;
    }

    channels.push(channelPayload);
    processedChannels += 1;

    if (verbose || processedChannels <= 10 || processedChannels % 20 === 0) {
      logger.info(
        `  • Kanał ${processedChannels}: ${channelPayload.name} (${programs.length} programów)`,
      );
    }
  }

  const limitedChannels = channels
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, Math.max(0, MAX_CHANNELS));

  logger.info(`📊 Do importu wybrano ${limitedChannels.length} kanałów.`);

  const feed: EpgFeed = {
    generatedAt: new Date().toISOString(),
    channels: limitedChannels,
  };

  const service = new EpgImportService(prisma, logger);
  try {
    const totalPrograms = feed.channels.reduce((sum, ch) => sum + (ch.programs?.length ?? 0), 0);
    logger.info(
      `📦 Przygotowano ${feed.channels.length} kanałów z łącznie ${totalPrograms} programami do importu.`,
    );
    
    logger.info('🔄 Rozpoczynam zapis do bazy danych...');
    const result = await service.importFeed(feed);
    logger.info(`✅ Zaimportowano ${result.channelCount} kanałów i ${result.programCount} audycji.`);
    return result;
  } catch (error) {
    const totalPrograms = feed.channels.reduce((sum, ch) => sum + (ch.programs?.length ?? 0), 0);
    logger.error(
      { 
        error, 
        channelCount: feed.channels.length,
        totalPrograms,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : undefined,
        firstChannelName: feed.channels[0]?.name,
        firstChannelPrograms: feed.channels[0]?.programs?.length ?? 0,
      },
      'Failed to import EPG feed to database',
    );
    throw error;
  }
}

export async function pruneDisallowedChannels(
  prisma: PrismaClient,
  logger: FastifyBaseLogger,
) {
  if (allowAllChannels) {
    logger.info('Prune skipped — wszystkie prefiksy są dozwolone.');
    return { removed: 0 };
  }

  logger.info(
    `🔍 Sprawdzam kanały w bazie. Do zachowania prefiksy: ${allowedPrefixes.join(', ')}`,
  );

  const channels = await prisma.channel.findMany({
    select: { id: true, externalId: true, name: true },
  });
  const allowedSlugs = await loadAllowedChannelSlugs(logger);

  const removable = channels.filter((channel) => {
    const idAllowed = isChannelIdAllowed(channel.externalId);
    const whitelistAllowed = isChannelWhitelisted(
      allowedSlugs,
      channel.externalId ?? undefined,
      channel.name ?? undefined,
    );
    return !idAllowed || !whitelistAllowed;
  });

  if (removable.length === 0) {
    logger.info('✅ Wszystkie kanały w bazie spełniają kryteria.');
    return { removed: 0 };
  }

  logger.warn(
    `🧹 Usuwam ${removable.length} kanałów spoza dozwolonych prefiksów. Przykłady: ${removable
      .slice(0, 5)
      .map((channel) => channel.externalId ?? channel.name)
      .join(', ')}`,
  );

  const idsToRemove = removable.map((channel) => channel.id);
  const deleteResult = await prisma.channel.deleteMany({ where: { id: { in: idsToRemove } } });

  logger.info(
    `🗑️  Usunięto ${deleteResult.count} kanałów (powiązane programy usunięto kaskadowo).`,
  );

  return { removed: deleteResult.count };
}

async function loadFromUrl(url: string, logger: FastifyBaseLogger) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minut timeout
  
  try {
    logger.info(`🌐 Wysyłam żądanie HTTP GET do: ${url}`);
    
    // Sprawdź czy fetch jest dostępny (undici lub natywny)
    let fetchFn: typeof fetch;
    if (typeof fetch !== 'undefined') {
      fetchFn = fetch;
      logger.debug('Używam dostępnego fetch (undici lub natywny)');
    } else {
      throw new Error('fetch is not available in this environment');
    }
    
    // undici ma swoje własne typy RequestInit, więc nie typujemy explicite
    const fetchOptions = {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EPG-Importer/1.0)',
        'Accept': 'application/xml, text/xml, application/gzip, */*',
      },
    };
    
    logger.debug({ url, hasSignal: !!controller.signal, headers: fetchOptions.headers }, 'Fetch options');
    
    const startTime = Date.now();
    const response = await fetchFn(url, fetchOptions);
    const duration = Date.now() - startTime;
    clearTimeout(timeoutId);
    
    logger.info(`📡 Otrzymano odpowiedź po ${duration}ms: status ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Nie udało się odczytać treści odpowiedzi');
      logger.error(
        {
          status: response.status,
          statusText: response.statusText,
          url,
          errorBody: errorText.substring(0, 500),
          headers: Object.fromEntries(response.headers.entries()),
        },
        'HTTP request failed',
      );
      throw new Error(`Nie udało się pobrać feedu (status ${response.status} ${response.statusText}): ${errorText.substring(0, 200)}`);
    }

    logger.info('📥 Pobieram treść odpowiedzi...');
    const text = await response.text();
    logger.info(`✅ Pobrano treść (${text.length} znaków)`);
    
    if (text.length === 0) {
      throw new Error('Otrzymano pustą odpowiedź z serwera');
    }
    
    // Sprawdź czy to wygląda na XML
    if (!text.trim().startsWith('<?xml') && !text.trim().startsWith('<tv')) {
      logger.warn({ textPreview: text.substring(0, 200) }, 'Otrzymana treść nie wygląda na XML');
    }
    
    return text;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({ url, timeout: '5 minutes' }, 'Timeout podczas pobierania feedu EPG');
      throw new Error(`Timeout podczas pobierania feedu EPG z ${url} (przekroczono 5 minut)`);
    }
    
    // Sprawdź czy to błąd sieciowy
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        logger.error(
          {
            error: error.message,
            url,
            hint: 'Sprawdź czy Railway ma dostęp do internetu i czy URL jest poprawny',
          },
          'Network error during EPG feed download',
        );
      } else if (error.message.includes('certificate') || error.message.includes('SSL') || error.message.includes('TLS')) {
        logger.error(
          {
            error: error.message,
            url,
            hint: 'Problem z certyfikatem SSL',
          },
          'SSL error during EPG feed download',
        );
      }
    }
    
    logger.error(
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : undefined,
        url,
      },
      'Error during EPG feed download',
    );
    throw error;
  }
}

async function loadFromFile(filePath: string) {
  return readFile(filePath, 'utf-8');
}

async function loadFromUrlWithFallback(urls: readonly string[], logger: FastifyBaseLogger): Promise<string> {
  const errors: Array<{ url: string; error: Error }> = [];
  
  for (const url of urls) {
    try {
      logger.info(`🔄 Próbuję pobrać EPG z: ${url}`);
      const xml = await loadFromUrl(url, logger);
      logger.info(`✅ Udało się pobrać EPG z: ${url}`);
      return xml;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push({ url, error: err });
      logger.warn({ url, error: err.message }, `❌ Nie udało się pobrać EPG z ${url}, próbuję następne źródło...`);
    }
  }
  
  // Wszystkie źródła zawiodły
  logger.error(
    {
      errors: errors.map((e) => ({ url: e.url, message: e.error.message })),
      totalSources: urls.length,
    },
    'Wszystkie źródła EPG zawiodły',
  );
  throw new Error(
    `Nie udało się pobrać EPG z żadnego źródła. Próbowano: ${urls.join(', ')}. Ostatni błąd: ${errors[errors.length - 1]?.error.message}`,
  );
}

function resolvePathMaybe(pathValue: string | null | undefined) {
  if (!pathValue) return null;
  return isAbsolute(pathValue) ? pathValue : resolve(process.cwd(), pathValue);
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseSelectedChannelIds(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function buildSelectedChannelSet(ids: readonly string[]): SelectedChannelSet {
  if (!ids || ids.length === 0) {
    return { isEmpty: true, rawIds: new Set(), slugIds: new Set() };
  }

  const rawIds = new Set<string>();
  const slugIds = new Set<string>();

  for (const id of ids) {
    const normalized = normalizeChannelIdentifier(id);
    if (normalized) {
      rawIds.add(normalized);
      addSlugVariants(slugIds, normalized.split('#').pop() ?? normalized);
    }
    addSlugVariants(slugIds, id);
  }

  return { isEmpty: false, rawIds, slugIds };
}

function normalizeChannelIdentifier(value: string | null | undefined) {
  return value ? value.trim().toLowerCase() : '';
}

function addSlugVariants(target: Set<string>, value: string | null | undefined) {
  if (!value) {
    return;
  }
  const raw = value.trim();
  if (!raw) {
    return;
  }

  const candidates = new Set<string>();
  candidates.add(slugify(raw));

  const afterSlash = raw.split('/').pop();
  if (afterSlash) {
    candidates.add(slugify(afterSlash));
  }

  const afterHash = raw.split('#').pop();
  if (afterHash) {
    candidates.add(slugify(afterHash));
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    target.add(candidate);
    target.add(ensureSuffix(candidate, 'pl'));
  }
}

function isChannelSelectedById(set: SelectedChannelSet, channelId: string | null | undefined) {
  if (set.isEmpty) {
    return true;
  }
  const normalized = normalizeChannelIdentifier(channelId);
  if (!normalized) {
    return false;
  }

  if (set.rawIds.has(normalized)) {
    return true;
  }

  const slug = slugify(normalized.split('#').pop() ?? normalized);
  if (!slug) {
    return false;
  }

  if (set.slugIds.has(slug) || set.slugIds.has(ensureSuffix(slug, 'pl'))) {
    return true;
  }

  return false;
}

function isChannelSelected(
  set: SelectedChannelSet,
  channelId: string | undefined,
  channelName: string | undefined,
) {
  if (set.isEmpty) {
    return true;
  }

  if (isChannelSelectedById(set, channelId)) {
    return true;
  }

  if (channelName) {
    const slug = slugify(channelName);
    if (slug && (set.slugIds.has(slug) || set.slugIds.has(ensureSuffix(slug, 'pl')))) {
      return true;
    }
  }

  return false;
}

function pickText(node: unknown): string | undefined {
  if (node == null) return undefined;
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) {
    for (const item of node) {
      const value = pickText(item);
      if (value) return value;
    }
    return undefined;
  }
  if (typeof node === 'object' && '#text' in (node as Record<string, unknown>)) {
    const text = (node as Record<string, unknown>)['#text'];
    return typeof text === 'string' ? text : undefined;
  }
  return undefined;
}

function pickIcon(icon: unknown): string | undefined {
  const candidates = ensureArray(icon as Array<{ '@_src': string }> | undefined);
  for (const item of candidates) {
    if (item && typeof item === 'object' && '@_src' in item) {
      const src = (item as { '@_src': string })['@_src'];
      if (src) return src;
    }
  }
  return undefined;
}

function parseTimestamp(raw: string | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  let dt = DateTime.fromFormat(trimmed, 'yyyyLLddHHmmss ZZZ', {
    setZone: true,
  });
  if (!dt.isValid) {
    const withoutOffset = trimmed.split(' ')[0] ?? trimmed;
    dt = DateTime.fromFormat(withoutOffset, 'yyyyLLddHHmmss', { zone: 'UTC' });
  }
  return dt.isValid ? dt.toUTC().toJSDate() : null;
}

type LogoEntry = {
  channel?: string;
  url?: string;
  tags?: string[];
};

let logoMapPromise: Promise<Map<string, string>> | null = null;
let logoMapCache: Map<string, string> | null = null;

type ChannelEntry = {
  id?: string;
  name?: string;
  alt_names?: string[];
  country?: string;
};

let allowedChannelSlugsPromise: Promise<Set<string>> | null = null;
let allowedChannelSlugsCache: Set<string> | null = null;

async function loadLogoMap(logger: FastifyBaseLogger) {
  if (logoMapCache) {
    return logoMapCache;
  }
  if (logoMapPromise) {
    return logoMapPromise;
  }

  logoMapPromise = (async () => {
    const configuredPath =
      process.env.EPG_LOGO_DATA_FILE ?? env.EPG_LOGO_DATA_FILE ?? DEFAULT_LOGO_DATA_PATH;
    const resolvedPath = resolvePathMaybe(configuredPath);
    if (!resolvedPath) {
      logger.warn('Nie skonfigurowano ścieżki do logotypów (EPG_LOGO_DATA_FILE).');
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
      logger.warn(
        { err: error, path: resolvedPath },
        'Nie udało się wczytać pliku z logotypami kanałów.',
      );
      return new Map<string, string>();
    }
  })();

  const result = await logoMapPromise;
  logoMapCache = result;
  return result;
}

async function loadAllowedChannelSlugs(logger: FastifyBaseLogger) {
  if (allowedChannelSlugsCache) {
    return allowedChannelSlugsCache;
  }
  if (allowedChannelSlugsPromise) {
    return allowedChannelSlugsPromise;
  }

  allowedChannelSlugsPromise = (async () => {
    const configuredPath =
      process.env.EPG_CHANNEL_DATA_FILE ?? env.EPG_CHANNEL_DATA_FILE ?? DEFAULT_CHANNEL_DATA_PATH;
    const resolvedPath = resolvePathMaybe(configuredPath);
    if (!resolvedPath) {
      logger.warn('Nie skonfigurowano pliku kanałów (EPG_CHANNEL_DATA_FILE).');
      return new Set<string>();
    }

    try {
      const raw = await readFile(resolvedPath, 'utf-8');
      const entries = JSON.parse(raw) as ChannelEntry[];
      const slugs = new Set<string>();
      for (const entry of entries) {
        if (!entry || entry.country !== 'PL') {
          continue;
        }
        const names = new Set<string>();
        if (entry.name) names.add(entry.name);
        if (entry.id) names.add(entry.id);
        for (const alt of entry.alt_names ?? []) {
          if (alt) names.add(alt);
        }
        for (const value of names) {
          const slug = slugify(value);
          if (!slug) continue;
          slugs.add(slug);
          slugs.add(ensureSuffix(slug, 'pl'));
        }
      }
      allowedChannelSlugsCache = slugs;
      return slugs;
    } catch (error) {
      logger.warn(
        { err: error, path: resolvedPath },
        'Nie udało się wczytać pliku kanałów (channels.json).',
      );
      return new Set<string>();
    }
  })();

  const result = await allowedChannelSlugsPromise;
  allowedChannelSlugsCache = result;
  return result;
}

function findLogoForChannel(
  map: Map<string, string>,
  channelId: string,
  channelName: string | undefined,
) {
  const candidates = new Set<string>();

  const idSlug = slugify(channelId.split('#')[1] ?? channelId);
  if (idSlug) {
    candidates.add(idSlug);
    candidates.add(ensureSuffix(idSlug, 'pl'));
  }

  const nameSlug = slugify(channelName ?? '');
  if (nameSlug) {
    candidates.add(nameSlug);
    candidates.add(ensureSuffix(nameSlug, 'pl'));
  }

  for (const slug of candidates) {
    const candidate = map.get(slug);
    if (candidate) {
      return candidate;
    }
  }
  return undefined;
}

function isChannelWhitelisted(
  allowedSlugs: Set<string>,
  channelId: string | undefined,
  channelName: string | undefined,
) {
  // Jeśli lista jest pusta, akceptuj wszystkie kanały z dozwolonym prefiksem (pl/)
  // Prefiks już zapewnia, że tylko polskie kanały są importowane
  if (allowedSlugs.size === 0) {
    return true;
  }

  const candidates = new Set<string>();
  if (channelId) {
    const idPart = channelId.split('#').pop() ?? channelId;
    const slug = slugify(idPart);
    if (slug) {
      candidates.add(slug);
      candidates.add(ensureSuffix(slug, 'pl'));
    }
  }

  if (channelName) {
    const slug = slugify(channelName);
    if (slug) {
      candidates.add(slug);
      candidates.add(ensureSuffix(slug, 'pl'));
    }
  }

  for (const slug of candidates) {
    if (slug && allowedSlugs.has(slug)) {
      return true;
    }
  }

  for (const slug of candidates) {
    if (FALLBACK_ALLOWED_KEYWORDS.some((keyword) => slug.includes(keyword))) {
      return true;
    }
  }

  return false;
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function ensureSuffix(slug: string, suffix: string) {
  if (!slug) return slug;
  return slug.endsWith(suffix) ? slug : `${slug}${suffix}`;
}

const FALLBACK_ALLOWED_KEYWORDS = [
  'tvp',
  'tvn',
  'polsat',
  'canal',
  'puls',
  'fokus',
  'player',
  'eleven',
  'hbo',
  'canalplus',
  '4fun',
  'trwam',
  'eska',
  'discovery',
  'animalplanet',
  'nationalgeographic',
  'bbc',
  'history',
  'cinemax',
  'fox',
  'cartoonnetwork',
  'mini',
  'nickelodeon',
  'nickjr',
];
