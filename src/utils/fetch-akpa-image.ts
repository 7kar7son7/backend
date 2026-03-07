import { env } from '../config/env';

const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';

function buildAkpaAuthHeaders(): Record<string, string> {
  const token = (env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN ?? '').trim();
  if (!token) return {};
  const authType = (env.AKPA_AUTH_TYPE ?? process.env.AKPA_AUTH_TYPE ?? 'Bearer').trim();
  if (authType === 'X-Api-Key') return { 'X-API-Key': token };
  if (authType === 'Token') return { Authorization: `Token ${token}` };
  return { Authorization: `Bearer ${token}` };
}

export function isAkpaPhotoUrl(url: string | null | undefined): boolean {
  if (url == null || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname === AKPA_PHOTO_HOST || parsed.hostname.endsWith('.akpa.pl');
  } catch {
    return false;
  }
}

/**
 * Pobiera obraz z AKPA (z tokenem). Zwraca null przy braku tokena, błędzie lub nie-AKPA URL.
 */
export async function fetchAkpaImage(
  imageUrl: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isAkpaPhotoUrl(imageUrl)) return null;
  const token = (env.AKPA_API_TOKEN ?? process.env.AKPA_API_TOKEN ?? '').trim();
  if (!token) return null;

  const headers: Record<string, string> = {
    Accept: 'image/*',
    ...buildAkpaAuthHeaders(),
  };

  try {
    const res = await fetch(imageUrl, { method: 'GET', headers });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.length > 0 ? { buffer, contentType } : null;
  } catch {
    return null;
  }
}
