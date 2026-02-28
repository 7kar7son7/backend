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
 * Zamienia względny logoUrl na pełny URL gdy ustawiono PUBLIC_API_URL (dla aplikacji mobilnej).
 * Bez PUBLIC_API_URL zwraca ścieżkę z leading slash, żeby aplikacja mogła dopiąć apiBaseUrl.
 * WAŻNE: W produkcji ustaw PUBLIC_API_URL na publiczny URL API (np. https://backend.example.com),
 * inaczej aplikacja mobilna może nie móc załadować obrazków (np. gdy apiBaseUrl się różni).
 */
export function toAbsoluteLogoUrl(logoUrl: string | null): string | null {
  if (logoUrl == null || logoUrl.trim() === '') return null;
  const trimmed = logoUrl.trim();
  const path = ensureAbsoluteOrLeadingSlash(trimmed);
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = (env.PUBLIC_API_URL ?? process.env.PUBLIC_API_URL ?? 'https://backend.devstudioit.app').trim().replace(/\/+$/, '');
  if (!base) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Logo URL do zwrócenia w API: z bazy / fallback AKPA + opcjonalnie jako pełny URL. */
export function resolveChannelLogoUrlForApi(channel: {
  externalId: string;
  logoUrl: string | null;
}): string | null {
  return toAbsoluteLogoUrl(resolveChannelLogoUrl(channel));
}
