import { env } from '../config/env';

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
 * Logo URL do zwrócenia w API. Zwracamy ścieżkę względną (/logos/akpa/xxx),
 * żeby aplikacja dopinała apiBaseUrl i ładowała obrazki z tego samego backendu co API.
 * (Gdy PUBLIC_API_URL jest ustawione, zwracamy pełny URL.)
 */
export function resolveChannelLogoUrlForApi(channel: {
  externalId: string;
  logoUrl: string | null;
}): string | null {
  const path = resolveChannelLogoUrl(channel);
  if (path == null) return null;
  const base = (env.PUBLIC_API_URL ?? process.env.PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  if (base) return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return path;
}
