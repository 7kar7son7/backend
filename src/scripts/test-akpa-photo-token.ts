#!/usr/bin/env tsx
/**
 * Test tokenu AKPA – sprawdza, czy backend może pobrać zdjęcie programu z api-epg.akpa.pl.
 * Uruchom z katalogu backend (env z .env): npx tsx src/scripts/test-akpa-photo-token.ts
 *
 * Jeśli na produkcji zdjęcia się nie ładują, uruchom ten skrypt z env produkcyjnym
 * (np. na Railway: Variables → wyślij AKPA_* do pliku i załaduj), żeby zobaczyć status/403/terminated.
 */
import 'dotenv/config';

const AKPA_PHOTO_HOST = 'api-epg.akpa.pl';
const SAMPLE_PHOTO_URL = 'https://api-epg.akpa.pl/api/v1/photo/akpa_p3x4_5028097.jpg';

function buildAuthHeaders(): Record<string, string> {
  const token = (process.env.AKPA_API_TOKEN ?? '').trim();
  if (!token) return {};
  const authType = (process.env.AKPA_AUTH_TYPE ?? 'Bearer').trim();
  if (authType === 'X-Api-Key') return { 'X-API-Key': token };
  if (authType === 'Token') return { Authorization: `Token ${token}` };
  return { Authorization: `Bearer ${token}` };
}

function maskToken(s: string): string {
  if (s.length <= 8) return '***';
  return s.slice(0, 4) + '…' + s.slice(-4);
}

async function main() {
  console.log('=== Test tokenu AKPA (zdjęcia programów) ===\n');

  const token = (process.env.AKPA_API_TOKEN ?? '').trim();
  const authHeaders = buildAuthHeaders();

  console.log('AKPA_API_TOKEN ustawiony:', token ? `tak (${maskToken(token)})` : 'NIE');
  console.log('AKPA_AUTH_TYPE:', process.env.AKPA_AUTH_TYPE ?? 'Bearer');
  console.log('URL testowy:', SAMPLE_PHOTO_URL);
  console.log('');

  if (!token || Object.keys(authHeaders).length === 0) {
    console.error('Błąd: Ustaw AKPA_API_TOKEN w .env (lub zmiennych środowiskowych).');
    process.exit(1);
  }

  try {
    const res = await fetch(SAMPLE_PHOTO_URL, {
      method: 'GET',
      headers: {
        Accept: 'image/*',
        'User-Agent': 'BackOnTV-test-akpa-photo/1.0',
        ...authHeaders,
      },
      signal: AbortSignal.timeout(15_000),
    });

    const contentType = res.headers.get('content-type') ?? '';
    const contentLength = res.headers.get('content-length') ?? '';

    console.log('Odpowiedź AKPA:');
    console.log('  Status:', res.status, res.statusText);
    console.log('  Content-Type:', contentType);
    console.log('  Content-Length:', contentLength || '(stream)');

    if (!res.ok) {
      const text = await res.text();
      console.log('  Body (skrót):', text.slice(0, 300));
      if (res.status === 403) {
        console.error('\n403 = token nieprawidłowy lub wygasły. Sprawdź AKPA_API_TOKEN i AKPA_AUTH_TYPE.');
      }
      process.exit(1);
    }

    const buf = await res.arrayBuffer();
    console.log('  Pobrano bajtów:', buf.byteLength);
    if (buf.byteLength > 0 && contentType.startsWith('image/')) {
      console.log('\nOK – AKPA zwraca obrazek, token działa. Zdjęcia w aplikacji powinny się ładować.');
      console.log('Jeśli na produkcji nadal brak zdjęć, sprawdź:');
      console.log('  1. Czy na serwerze (Railway/Docker) ustawione są AKPA_API_TOKEN i AKPA_AUTH_TYPE.');
      console.log('  2. Czy PUBLIC_API_URL wskazuje na ten sam backend (np. https://backend.devstudioit.app).');
      console.log('  3. Logi backendu przy żądaniu GET /photos/proxy – błąd "terminated" oznacza, że AKPA zamyka połączenie (np. z chmury).');
    } else {
      console.warn('\nUwaga: odpowiedź nie wygląda na obrazek (Content-Type lub rozmiar).');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.error('\nBłąd pobierania z AKPA:', msg);
    if (msg.includes('terminated') || msg.includes('ECONNRESET') || msg.includes('socket hang up') || isAbort) {
      console.error('Połączenie zostało zamknięte (timeout lub AKPA zrywa połączenie). Na produkcji (Railway itd.) AKPA może blokować/zamykać połączenia z chmury – skontaktuj się z AKPA.');
    }
    process.exit(1);
  }
}

main();
