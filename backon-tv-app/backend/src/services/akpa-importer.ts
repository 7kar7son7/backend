import type { FastifyBaseLogger } from 'fastify';
import { PrismaClient } from '@prisma/client';

import { env } from '../config/env';
import { EpgImportService, type EpgChannel, type EpgFeed, type EpgProgram } from './epg-import.service';

const DEFAULT_AKPA_API_URL = 'https://api-epg.akpa.pl/api/v1';
const EXTERNAL_ID_PREFIX = 'akpa_';
const LOGO_FILES = ['logo.png', 'logo.jpg', 'logo.jpeg', 'image.png', 'image.jpg', 'logo.svg'];
const LOGO_CONCURRENCY = 6;

type AkpaChannelRaw = {
  id?: string | number;
  name?: string;
  title?: string;
  slug?: string;
  description?: string;
  programs?: unknown[];
  schedule?: unknown[];
  broadcasts?: unknown[];
  events?: unknown[];
  [key: string]: unknown;
};

type AkpaProgramRaw = {
  id?: string | number;
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  channel_id?: string | number;
  channelId?: string | number;
  channel_slug?: string;
  season?: number;
  episode?: number;
  image?: string;
  tags?: unknown[];
  [key: string]: unknown;
};

function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getChannelId(raw: AkpaChannelRaw): string {
  const id = raw.id ?? raw.slug;
  if (id !== undefined && id !== null) return String(id);
  const name = raw.name ?? raw.title ?? '';
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '') || 'unknown';
}

function getChannelName(raw: AkpaChannelRaw): string {
  const name = raw.name ?? raw.title ?? raw.slug;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return String(raw.id ?? 'Kanał');
}

const AUTH_TYPES = ['Bearer', 'Token', 'X-Api-Key'] as const;

function buildAuthHeaders(token: string, type: (typeof AUTH_TYPES)[number]): Record<string, string> {
  const t = token.trim();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (type === 'X-Api-Key') {
    headers['X-API-Key'] = t;
  } else if (type === 'Token') {
    headers['Authorization'] = `Token ${t}`;
  } else {
    headers['Authorization'] = `Bearer ${t}`;
  }
  return headers;
}

/** Nazwa parametru w URL (nie wartość tokenu). Gdy użytkownik wklei token zamiast nazwy, używamy "token". */
function getAuthQueryParamName(): string | undefined {
  const raw = env.AKPA_AUTH_QUERY_PARAM ?? process.env.AKPA_AUTH_QUERY_PARAM;
  if (!raw || !raw.trim()) return undefined;
  const s = raw.trim();
  if (s.length > 40 || (s.length > 15 && !/^[a-z_]+$/i.test(s))) {
    return 'token';
  }
  return s;
}

const QUERY_PARAM_NAMES_TO_TRY = ['token', 'api_key', 'access_token', 'apikey'] as const;

function buildChannelsUrlWithParam(baseUrl: string, token: string, paramName: string): string {
  const path = `${baseUrl}/channels`;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${encodeURIComponent(paramName)}=${encodeURIComponent(token.trim())}`;
}

function buildChannelsUrl(baseUrl: string, token: string): string {
  const paramName = getAuthQueryParamName();
  if (paramName && token) {
    return buildChannelsUrlWithParam(baseUrl, token, paramName);
  }
  return `${baseUrl}/channels`;
}

async function fetchChannels(
  baseUrl: string,
  token: string,
  logger: FastifyBaseLogger,
  authType: (typeof AUTH_TYPES)[number] = 'Bearer',
  queryParamName?: string | null,
): Promise<AkpaChannelRaw[]> {
  const url =
    queryParamName === null
      ? `${baseUrl}/channels`
      : queryParamName
        ? buildChannelsUrlWithParam(baseUrl, token, queryParamName)
        : buildChannelsUrl(baseUrl, token);
  const useQueryAuth = queryParamName !== null && (!!queryParamName || !!getAuthQueryParamName());
  const headers =
    useQueryAuth && token.trim()
      ? { Accept: 'application/json' }
      : buildAuthHeaders(token, authType);
  const res = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, url, authType, body: text.slice(0, 500) }, 'AKPA API channels error');
    throw new Error(`AKPA API channels failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as unknown;
  if (Array.isArray(json)) return json as AkpaChannelRaw[];
  if (json && typeof json === 'object') {
    const data = (json as Record<string, unknown>).data;
    if (Array.isArray(data)) return data as AkpaChannelRaw[];
    const channels = (json as Record<string, unknown>).channels;
    if (Array.isArray(channels)) return channels as AkpaChannelRaw[];
  }
  logger.warn({ json: JSON.stringify(json).slice(0, 300) }, 'AKPA: nieznany format odpowiedzi channels');
  return [];
}

async function fetchChannelsWithAuthRetry(
  baseUrl: string,
  token: string,
  logger: FastifyBaseLogger,
): Promise<{ channels: AkpaChannelRaw[]; authType: (typeof AUTH_TYPES)[number] }> {
  const configured = (env.AKPA_AUTH_TYPE ?? process.env.AKPA_AUTH_TYPE ?? 'Bearer').trim() as (typeof AUTH_TYPES)[number];
  const toTry: (typeof AUTH_TYPES)[number][] =
    configured && AUTH_TYPES.includes(configured)
      ? [configured, ...AUTH_TYPES.filter((t) => t !== configured)]
      : [...AUTH_TYPES];

  // Zawsze najpierw nagłówek (AKPA przyjmuje Bearer) – niezależnie od AKPA_AUTH_QUERY_PARAM
  for (const authType of toTry) {
    try {
      const channels = await fetchChannels(baseUrl, token, logger, authType, null);
      if (channels.length >= 0) {
        if (authType !== configured) {
          logger.info(`AKPA: działa z auth type=${authType}. Możesz ustawić AKPA_AUTH_TYPE=${authType}`);
        }
        return { channels, authType };
      }
    } catch (e) {
      if ((e as Error).message?.includes('403')) {
        logger.warn({ authType }, 'AKPA 403, próbuję innego auth');
        continue;
      }
      throw e;
    }
  }

  const paramName = getAuthQueryParamName();
  const queryParamsToTry = paramName
    ? [paramName, ...QUERY_PARAM_NAMES_TO_TRY.filter((p) => p !== paramName)]
    : [...QUERY_PARAM_NAMES_TO_TRY];

  for (const queryParam of queryParamsToTry) {
    try {
      const channels = await fetchChannels(baseUrl, token, logger, toTry[0], queryParam);
      if (channels.length >= 0) {
        if (queryParam !== queryParamsToTry[0]) {
          logger.info(`AKPA: działa z query param=${queryParam}. Ustaw AKPA_AUTH_QUERY_PARAM=${queryParam}`);
        }
        return { channels, authType: toTry[0] ?? configured };
      }
    } catch (e) {
      if ((e as Error).message?.includes('403')) {
        logger.warn({ queryParam }, 'AKPA 403, próbuję innego query param');
        continue;
      }
      throw e;
    }
  }

  throw new Error(
    'AKPA API 403 Not authenticated. Ustaw AKPA_API_TOKEN w .env (lokalnie) lub w zmiennych środowiskowych na serwerze. Token musi być ważny u AKPA.',
  );
}

function toEpgProgram(raw: AkpaProgramRaw): EpgProgram | null {
  const id = raw.id != null ? String(raw.id) : undefined;
  const title = raw.title != null ? String(raw.title) : undefined;
  const start =
    raw.start != null
      ? String(raw.start)
      : (raw as Record<string, unknown>).start_time != null
        ? String((raw as Record<string, unknown>).start_time)
        : (raw as Record<string, unknown>).startDate != null
          ? String((raw as Record<string, unknown>).startDate)
          : (raw as Record<string, unknown>).starts_at != null
            ? String((raw as Record<string, unknown>).starts_at)
            : undefined;
  if (!id || !title || !start) return null;
  const startsAt = new Date(start);
  if (Number.isNaN(startsAt.getTime())) return null;
  const endRaw =
    raw.end ??
    (raw as Record<string, unknown>).end_time ??
    (raw as Record<string, unknown>).endDate ??
    (raw as Record<string, unknown>).ends_at;
  const end = endRaw != null ? String(endRaw) : undefined;
  let endDate: Date | undefined;
  if (end) {
    endDate = new Date(end);
    if (Number.isNaN(endDate.getTime())) endDate = undefined;
  }
  const prog: EpgProgram = { id, title, start };
  const desc =
    raw.description ??
    (raw as Record<string, unknown>).desc ??
    (raw as Record<string, unknown>).synopsis ??
    (raw as Record<string, unknown>).summary ??
    (raw as Record<string, unknown>).longDescription;
  if (desc != null && String(desc).trim()) {
    prog.description = String(desc).trim();
  } else {
    const r = raw as Record<string, unknown>;
    const genre = r.genre != null ? String(r.genre).trim() : '';
    const subgenre = r.subgenre != null ? String(r.subgenre).trim() : '';
    const year = r.productionYear != null ? String(r.productionYear).trim() : '';
    const countries = Array.isArray(r.productionCountries)
      ? (r.productionCountries as string[]).map((c) => String(c).trim()).filter(Boolean)
      : [];
    const parts: string[] = [];
    if (genre) parts.push(genre);
    if (subgenre) parts.push(subgenre);
    if (year) parts.push(`(${year})`);
    if (countries.length) parts.push(countries.join(', '));
    if (parts.length) prog.description = parts.join(' ');
  }
  if (endDate != null) prog.end = endDate.toISOString();
  if (typeof raw.season === 'number') prog.season = raw.season;
  if (typeof raw.episode === 'number') prog.episode = raw.episode;
  if (raw.image != null) prog.image = String(raw.image);
  const tagList = Array.isArray(raw.tags) ? raw.tags.map((t) => String(t)) : [];
  const r = raw as Record<string, unknown>;
  if (r.genre != null && String(r.genre).trim()) tagList.push(String(r.genre).trim());
  if (r.formalCategory != null && String(r.formalCategory).trim()) tagList.push(String(r.formalCategory).trim());
  if (Array.isArray(r.keywords)) {
    for (const kw of r.keywords as Array<{ keyword?: string; humanReadable?: string }>) {
      if (kw?.keyword && String(kw.keyword).trim() && kw.humanReadable === 'yes') tagList.push(String(kw.keyword).trim());
    }
  }
  if (tagList.length) prog.tags = [...new Set(tagList)];
  return prog;
}

/** Programy zagnieżdżone w obiekcie kanału (np. channel.programs, channel.schedule). */
function parseProgramsFromChannel(raw: AkpaChannelRaw): EpgProgram[] {
  const list =
    Array.isArray(raw.programs)
      ? raw.programs
      : Array.isArray(raw.schedule)
        ? raw.schedule
        : Array.isArray(raw.broadcasts)
          ? raw.broadcasts
          : Array.isArray(raw.events)
            ? raw.events
            : [];
  const out: EpgProgram[] = [];
  for (const item of list) {
    if (item && typeof item === 'object') {
      const prog = toEpgProgram(item as AkpaProgramRaw);
      if (prog) out.push(prog);
    }
  }
  return out;
}

function getChannelKeyFromProgram(raw: AkpaProgramRaw): string | null {
  const v = raw.channel_id ?? raw.channelId ?? raw.channel_slug;
  if (v != null) return String(v);
  return null;
}

async function logoExists(baseUrl: string, authHeader: string, pathSegment: string): Promise<boolean> {
  const segment = pathSegment.trim();
  if (!segment) return false;
  for (const fileName of LOGO_FILES) {
    const url = `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(segment)}/${fileName}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: { Authorization: authHeader } });
      if (res.ok && res.body) return true;
    } catch {
      continue;
    }
  }
  return false;
}

function logoSlugCandidates(raw: AkpaChannelRaw): string[] {
  const name = getChannelName(raw);
  const short = (raw as Record<string, unknown>).short_name;
  const candidates: string[] = [];
  if (typeof short === 'string' && short.trim()) candidates.push(short.trim());
  if (name.trim()) {
    candidates.push(name.trim());
    candidates.push(name.replace(/\s+/g, '').trim());
    candidates.push(name.toLowerCase().trim());
    candidates.push(name.replace(/\s+/g, '').toLowerCase().trim());
  }
  return [...new Set(candidates)].filter(Boolean);
}

async function resolveLogoSlug(
  raw: AkpaChannelRaw,
  baseUrl: string,
  authHeader: string,
  logger: FastifyBaseLogger,
): Promise<string> {
  const fallback = getChannelName(raw).toLowerCase().trim() || 'unknown';
  for (const slug of logoSlugCandidates(raw)) {
    if (await logoExists(baseUrl, authHeader, slug)) return slug;
  }
  return fallback;
}

async function resolveLogoSlugsForChannels(
  rawChannels: AkpaChannelRaw[],
  logger: FastifyBaseLogger,
): Promise<Map<string, string>> {
  const baseUrl = (env.AKPA_LOGOS_BASE_URL ?? process.env.AKPA_LOGOS_BASE_URL ?? '').replace(/\/+$/, '');
  const user = env.AKPA_LOGOS_USER ?? process.env.AKPA_LOGOS_USER;
  const password = env.AKPA_LOGOS_PASSWORD ?? process.env.AKPA_LOGOS_PASSWORD;
  if (!baseUrl || !user || !password) {
    logger.info('AKPA: brak AKPA_LOGOS_BASE_URL/USER/PASSWORD – pomijam rozwiązywanie logotypów');
    return new Map();
  }
  const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
  const byId = new Map<string, string>();
  for (let i = 0; i < rawChannels.length; i += LOGO_CONCURRENCY) {
    const batch = rawChannels.slice(i, i + LOGO_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (raw) => {
        const apiId = getChannelId(raw);
        const slug = await resolveLogoSlug(raw, baseUrl, authHeader, logger);
        return { apiId, slug } as const;
      }),
    );
    for (const { apiId, slug } of results) byId.set(apiId, slug);
  }
  const newBase = (env.AKPA_LOGOS_NEW_BASE_URL ?? process.env.AKPA_LOGOS_NEW_BASE_URL ?? '').replace(/\/+$/, '');
  const newUser = env.AKPA_LOGOS_NEW_USER ?? process.env.AKPA_LOGOS_NEW_USER;
  const newPassword = env.AKPA_LOGOS_NEW_PASSWORD ?? process.env.AKPA_LOGOS_NEW_PASSWORD;
  if (newBase && newUser && newPassword) {
    const newAuth = 'Basic ' + Buffer.from(`${newUser}:${newPassword}`).toString('base64');
    for (const [apiId, slug] of byId) {
      const raw = rawChannels.find((r) => getChannelId(r) === apiId);
      if (!raw) continue;
      if (await logoExists(newBase, newAuth, slug)) continue;
      const alt = await resolveLogoSlug(raw, newBase, newAuth, logger);
      if (alt !== slug && (await logoExists(newBase, newAuth, alt))) byId.set(apiId, alt);
    }
  }
  logger.info({ resolved: byId.size, total: rawChannels.length }, 'AKPA: rozwiązano logotypy kanałów');
  return byId;
}

/** Odpowiedź GET /epg?ch=1&ch=2&... – channels[].days[].schedule[]. */
type AkpaEpgChannel = {
  channelId?: number;
  channelName?: string;
  days?: Array<{ date?: string; schedule?: AkpaProgramRaw[] }>;
};

/**
 * Pobiera ramówkę z endpointu AKPA GET /epg?ch=id1&ch=id2&... (wymaga nagłówka Accept: application/json).
 * Zwraca mapę: channelId (string) -> EpgProgram[].
 */
async function fetchEpgByChannelIds(
  baseUrl: string,
  channelIds: string[],
  token: string,
  authType: (typeof AUTH_TYPES)[number],
  logger: FastifyBaseLogger,
): Promise<Map<string, EpgProgram[]>> {
  if (channelIds.length === 0) return new Map();
  const epgUrl = `${baseUrl.replace(/\/+$/, '')}/epg?${channelIds.map((id) => `ch=${encodeURIComponent(id)}`).join('&')}`;
  const headers = { ...buildAuthHeaders(token.trim(), authType), Accept: 'application/json' };
  const res = await fetch(epgUrl, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    logger.warn({ status: res.status, url: epgUrl.slice(0, 80), body: text.slice(0, 200) }, 'AKPA EPG error');
    return new Map();
  }
  const json = (await res.json()) as unknown;
  const channelsList =
    json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).channels)
      ? ((json as Record<string, unknown>).channels as AkpaEpgChannel[])
      : [];
  const byChannel = new Map<string, EpgProgram[]>();
  for (const ch of channelsList) {
    const cid = ch.channelId != null ? String(ch.channelId) : null;
    if (!cid) continue;
    const programs: EpgProgram[] = [];
    for (const day of ch.days ?? []) {
      for (const item of day.schedule ?? []) {
        if (item && typeof item === 'object') {
          const prog = toEpgProgram(item as AkpaProgramRaw);
          if (prog) programs.push(prog);
        }
      }
    }
    if (programs.length) byChannel.set(cid, programs);
  }
  const total = [...byChannel.values()].reduce((s, p) => s + p.length, 0);
  logger.info({ channelsWithSchedule: byChannel.size, totalPrograms: total }, 'AKPA: pobrano ramówkę z /epg');
  return byChannel;
}

/**
 * Pobiera programy z opcjonalnego endpointu AKPA (AKPA_PROGRAMS_URL).
 * Zwraca mapę: klucz kanału (api id) -> lista EpgProgram.
 */
async function fetchProgramsByChannel(
  programsUrl: string,
  token: string,
  authType: (typeof AUTH_TYPES)[number],
  logger: FastifyBaseLogger,
): Promise<Map<string, EpgProgram[]>> {
  const headers = buildAuthHeaders(token.trim(), authType);
  const res = await fetch(programsUrl, { method: 'GET', headers });
  if (!res.ok) {
    if (res.status === 404) {
      logger.info('AKPA: endpoint programów nie istnieje (404) – ramówka niedostępna z tego API.');
      return new Map();
    }
    const text = await res.text();
    logger.warn({ status: res.status, url: programsUrl, body: text.slice(0, 300) }, 'AKPA programs endpoint error');
    return new Map();
  }
  const json = (await res.json()) as unknown;
  let list: AkpaProgramRaw[] = [];
  if (Array.isArray(json)) list = json as AkpaProgramRaw[];
  else if (json && typeof json === 'object') {
    const data = (json as Record<string, unknown>).data;
    const programs = (json as Record<string, unknown>).programs;
    if (Array.isArray(data)) list = data as AkpaProgramRaw[];
    else if (Array.isArray(programs)) list = programs as AkpaProgramRaw[];
  }
  const byChannel = new Map<string, EpgProgram[]>();
  for (const raw of list) {
    const key = getChannelKeyFromProgram(raw);
    const prog = toEpgProgram(raw);
    if (!key || !prog) continue;
    const existing = byChannel.get(key) ?? [];
    existing.push(prog);
    byChannel.set(key, existing);
  }
  logger.info({ channelsWithPrograms: byChannel.size, totalPrograms: list.length }, 'AKPA: pobrano programy');
  return byChannel;
}

/**
 * Import kanałów z API AKPA (api-epg.akpa.pl).
 * Tylko dodaje/aktualizuje kanały z AKPA – nie usuwa istniejących kanałów z innych źródeł.
 * Programy (ramówka) – jeśli AKPA udostępnia endpoint, ustaw AKPA_PROGRAMS_URL (zapytaj AKPA o URL).
 */
export async function importAkpaEpg(
  prisma: PrismaClient,
  logger: FastifyBaseLogger,
): Promise<{ channelCount: number; programCount: number }> {
  const baseUrl = normalizeApiUrl(
    env.AKPA_API_URL ?? process.env.AKPA_API_URL ?? DEFAULT_AKPA_API_URL,
  );
  const rawToken = env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN ?? '';
  const token = rawToken.trim();

  if (!token) {
    throw new Error('Brak tokenu AKPA. Ustaw AKPA_API_TOKEN w zmiennych środowiskowych.');
  }

  logger.info(`Import EPG z AKPA (${baseUrl})`);

  const { channels: rawChannels, authType } = await fetchChannelsWithAuthRetry(baseUrl, token, logger);
  logger.info(`Pobrano ${rawChannels.length} kanałów z API AKPA`);

  const channelIds = rawChannels.map((r) => getChannelId(r));
  const epgByChannel = await fetchEpgByChannelIds(baseUrl, channelIds, token, authType, logger);

  const programsUrl = env.AKPA_PROGRAMS_URL ?? process.env.AKPA_PROGRAMS_URL;
  const programsByChannel = programsUrl
    ? await fetchProgramsByChannel(programsUrl, token, authType, logger)
    : new Map<string, EpgProgram[]>();

  const channels: EpgChannel[] = rawChannels.map((raw) => {
    const apiId = getChannelId(raw);
    const externalId = EXTERNAL_ID_PREFIX + apiId;
    const name = getChannelName(raw);
    const logo = `/logos/akpa/${externalId}`;
    const description =
      typeof raw.description === 'string' ? raw.description.trim() : undefined;
    const fromChannel = parseProgramsFromChannel(raw);
    const fromEpg = epgByChannel.get(apiId) ?? epgByChannel.get(String(raw.id)) ?? [];
    const fromUrl = programsByChannel.get(apiId) ?? programsByChannel.get(String(raw.id)) ?? programsByChannel.get(name) ?? [];
    const programs = fromChannel.length > 0 ? fromChannel : fromEpg.length > 0 ? fromEpg : fromUrl;

    return {
      id: externalId,
      name,
      ...(description ? { description } : {}),
      logo,
      countryCode: 'PL',
      programs,
    };
  });

  const feed: EpgFeed = {
    generatedAt: new Date().toISOString(),
    channels,
  };

  const service = new EpgImportService(prisma, logger);
  const result = await service.importFeed(feed);

  logger.info(`AKPA: zaimportowano ${result.channelCount} kanałów, ${result.programCount} programów`);
  return result;
}
