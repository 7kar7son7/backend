import { env } from '../config/env';
import { readLogoFromStatic } from './static-logos';

/**
 * Mapowanie logo kanału: każdy kanał AKPA ma URL /logos/akpa/{externalId} (logotypy w bazie w logoData).
 * Dla innych źródeł – logoUrl z bazy lub null.
 */
export function resolveChannelLogoUrl(channel: {
  externalId: string;
  logoUrl?: string | null;
}): string | null {
  const extId = String(channel.externalId ?? '');
  if (extId.startsWith('akpa_')) {
    return `/logos/akpa/${extId}`;
  }
  const fromDb = channel.logoUrl != null ? String(channel.logoUrl).trim() : '';
  return fromDb !== '' ? fromDb : null;
}

/**
 * Normalizuje ścieżkę względną: jeśli nie zaczyna się od http(s) ani od /, dodaje / na początku.
 * Dzięki temu wartości z bazy typu "logos/akpa/xxx" działają jak "/logos/akpa/xxx".
 */
function ensureAbsoluteOrLeadingSlash(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
    return value;
  }
  return `/${value}`;
}

/**
 * Zamienia względny logoUrl na pełny URL gdy ustawiono PUBLIC_API_URL.
 * Używane tylko gdy API i aplikacja są na różnych domenach i trzeba zwrócić pełny URL.
 */
export function toAbsoluteLogoUrl(logoUrl: string | null): string | null {
  if (logoUrl == null || logoUrl.trim() === '') return null;
  const trimmed = logoUrl.trim();
  const path = ensureAbsoluteOrLeadingSlash(trimmed);
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = (env.PUBLIC_API_URL ?? process.env.PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!base) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Logo URL do zwrócenia w API. Zawsze zwracamy pełny URL gdy PUBLIC_API_URL jest ustawione
 * (na produkcji ustaw PUBLIC_API_URL=https://backend.devstudioit.app), żeby aplikacja
 * ładowała obrazki bez polegania na apiBaseUrl. Wymuszamy https.
 */
export function resolveChannelLogoUrlForApi(channel: {
  externalId: string;
  logoUrl: string | null;
}): string | null {
  const path = resolveChannelLogoUrl(channel);
  if (path == null) return null;
  const base = (env.PUBLIC_API_URL ?? process.env.PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  if (base) {
    const full = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    return full.startsWith('http://') ? full.replace(/^http:\/\//, 'https://') : full;
  }
  return path;
}

/**
 * Jak w starym EPG: zwraca logoUrl gotowy do wyświetlenia – data URL gdy mamy bajty (z bazy lub embedded),
 * zero requestów do GET /logos/akpa/. Gdy brak bajtów – fallback na resolveChannelLogoUrlForApi.
 */
export function channelLogoUrlForResponse(channel: {
  externalId: string | null;
  logoUrl: string | null;
  logoData?: unknown;
  logoContentType?: string | null;
}): string | null {
  const logoData = channel.logoData;
  const hasLogoData =
    logoData != null &&
    ((Buffer.isBuffer(logoData) && logoData.length > 0) ||
      (logoData instanceof Uint8Array && logoData.length > 0));
  const logoContentType =
    channel.logoContentType != null && String(channel.logoContentType).trim() !== ''
      ? String(channel.logoContentType).trim()
      : null;
  if (hasLogoData && logoContentType) {
    const b64 =
      Buffer.isBuffer(logoData) ? logoData.toString('base64') : Buffer.from(logoData as Uint8Array).toString('base64');
    return `data:${logoContentType};base64,${b64}`;
  }
  if (String(channel.externalId ?? '').startsWith('akpa_')) {
    const fromStatic = readLogoFromStatic(String(channel.externalId));
    if (fromStatic) {
      return `data:${fromStatic.contentType};base64,${fromStatic.body.toString('base64')}`;
    }
  }
  return resolveChannelLogoUrlForApi(channel);
}
