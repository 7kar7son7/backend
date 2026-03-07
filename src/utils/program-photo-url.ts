/**
 * Zdjęcia programów z AKPA (api-epg.akpa.pl) wymagają tokenu – klient bez tokenu dostaje 403.
 * API zwraca imageUrl jako ścieżkę przez proxy backendu, który dołącza token.
 */
const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';

export function programImageUrlForApi(rawImageUrl: string | null | undefined): string | null {
  if (rawImageUrl == null || typeof rawImageUrl !== 'string') return null;
  const url = rawImageUrl.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === AKPA_PHOTO_HOST || parsed.hostname.endsWith('.akpa.pl')) {
      return '/photos/proxy?url=' + encodeURIComponent(url);
    }
  } catch {
    // niepoprawny URL – zwróć oryginał
  }
  return url;
}
