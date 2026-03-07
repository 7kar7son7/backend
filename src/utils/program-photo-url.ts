const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';

/**
 * Zdjęcia programów:
 * 1. Gdy jest imageData w bazie → /programs/photo/:id (szybko z bazy).
 * 2. Gdy brak imageData ale jest URL AKPA → /photos/proxy?url=... (backend pobiera z AKPA z tokenem, ładowanie „na żywo”).
 */
export function programImageUrlForApi(
  rawImageUrl: string | null | undefined,
  baseUrl?: string | null,
  options?: { programId?: string; hasImageData?: boolean },
): string | null {
  const { programId, hasImageData } = options ?? {};
  if (hasImageData && programId) {
    const path = `/programs/photo/${programId}`;
    if (baseUrl != null && baseUrl.trim() !== '') {
      const base = baseUrl.trim().replace(/\/+$/, '');
      return base + path;
    }
    return path;
  }
  if (rawImageUrl == null || typeof rawImageUrl !== 'string') return null;
  const url = rawImageUrl.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === AKPA_PHOTO_HOST || parsed.hostname.endsWith('.akpa.pl')) {
      const path = '/photos/proxy?url=' + encodeURIComponent(url);
      if (baseUrl != null && baseUrl.trim() !== '') {
        const base = baseUrl.trim().replace(/\/+$/, '');
        return base + path;
      }
      return path;
    }
  } catch {
    // niepoprawny URL
  }
  return url;
}
