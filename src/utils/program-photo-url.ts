const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';

/**
 * Zdjęcia programów: zawsze przez proxy – backend pobiera z AKPA z tokenem.
 * Gdy program ma imageData w bazie – /programs/:id/image. Inaczej AKPA: /photos/proxy?url=...
 */
export function programImageUrlForApi(
  rawImageUrl: string | null | undefined,
  baseUrl?: string | null,
  options?: { programId?: string; hasImageData?: boolean },
): string | null {
  const pid = options?.programId?.trim();
  if (pid && options?.hasImageData) {
    const path = `/programs/${pid}/image`;
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
