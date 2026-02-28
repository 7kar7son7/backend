import type { FastifyBaseLogger } from 'fastify';
import { PrismaClient } from '@prisma/client';

import { env } from '../config/env';
import { EpgImportService, type EpgChannel, type EpgFeed } from './epg-import.service';

const DEFAULT_AKPA_API_URL = 'https://api-epg.akpa.pl/api/v1';
const EXTERNAL_ID_PREFIX = 'akpa_';

type AkpaChannelRaw = {
  id?: string | number;
  name?: string;
  title?: string;
  slug?: string;
  description?: string;
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

/**
 * Import kanałów z API AKPA (api-epg.akpa.pl).
 * Tylko dodaje/aktualizuje kanały z AKPA – nie usuwa istniejących kanałów z innych źródeł.
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

  const { channels: rawChannels } = await fetchChannelsWithAuthRetry(baseUrl, token, logger);
  logger.info(`Pobrano ${rawChannels.length} kanałów z API AKPA`);

  const channels: EpgChannel[] = rawChannels.map((raw) => {
    const apiId = getChannelId(raw);
    const externalId = EXTERNAL_ID_PREFIX + apiId;
    const name = getChannelName(raw);
    const logoSlug = name.toLowerCase().trim();
    const logo = `/epg/logos/akpa/${encodeURIComponent(logoSlug)}`;
    const description =
      typeof raw.description === 'string' ? raw.description.trim() : undefined;

    return {
      id: externalId,
      name,
      ...(description ? { description } : {}),
      logo,
      countryCode: 'PL',
      programs: [],
    };
  });

  const feed: EpgFeed = {
    generatedAt: new Date().toISOString(),
    channels,
  };

  const service = new EpgImportService(prisma, logger);
  const result = await service.importFeed(feed);

  logger.info(`AKPA: zaimportowano ${result.channelCount} kanałów`);
  return result;
}
