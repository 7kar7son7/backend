const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';

/**
 * Zdjęcia programów: zawsze przez proxy – backend pobiera z AKPA z tokenem.
 * API zwraca /photos/proxy?url=... (nie z bazy). Aplikacja ładuje ten URL, backend fetche z AKPA.
 */
export function programImageUrlForApi(
  rawImageUrl: string | null | undefined,
  baseUrl?: string | null,
  _options?: { programId?: string; hasImageData?: boolean },
): string | null {
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
