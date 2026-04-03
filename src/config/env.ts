import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Ładuj .env (w produkcji process.env z hosta ma pierwszeństwo; loadEnv nie nadpisuje istniejących)
loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  PORT: z.coerce.number().default(3000),
  // DevStudio / PaaS: nasłuchujemy na wszystkich interfejsach
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z.string().url(),
  EPG_SOURCE_URL: z.string().url().optional(),
  EPG_SOURCE_FILE: z.string().optional(),
  EPG_LOGO_DATA_FILE: z.string().optional(),
  EPG_CHANNEL_DATA_FILE: z.string().optional(),
  EPG_AUTO_IMPORT_ENABLED: z.coerce.boolean().optional(),
  EPG_AUTO_IMPORT_SCHEDULE: z.string().optional(),
  EPG_AUTO_IMPORT_TIMEZONE: z.string().optional(),
  EPG_AUTO_IMPORT_RUN_ON_START: z.coerce.boolean().optional(),
  /** Sekret do POST /epg/trigger (np. cron z zewnątrz gdy hosting restartuje kontener i omija node-cron). */
  EPG_HTTP_TRIGGER_SECRET: z.string().optional().transform((s) => s?.trim() || undefined),
  EPG_GRAB_ENABLED: z.coerce.boolean().optional(),
  EPG_GRAB_COMMAND: z.string().optional(),
  EPG_GRAB_WORKDIR: z.string().optional(),
  IPTV_ORG_MAX_CHANNELS: z.string().optional(),
  IPTV_ORG_MAX_DAYS: z.string().optional(),
  IPTV_ORG_ALLOWED_PREFIXES: z.string().optional(),
  IPTV_ORG_SELECTED_IDS: z.string().optional(),
  EPG_IMPORT_CHUNK_SIZE: z.string().optional(),
  /** Usuwanie programów zakończonych starszych niż N dni (np. 14 zgodnie z licencją AKPA). Dla AKPA domyślnie 14, dla IPTV w importerze używane 1. */
  EPG_PRUNE_MAX_AGE_DAYS: z.string().optional(),
  // AKPA (api-epg.akpa.pl) – gdy AKPA_API_TOKEN ustawiony, import może iść z AKPA
  AKPA_API_URL: z.string().optional().transform((s) => s?.trim()),
  AKPA_API_TOKEN: z.string().optional().transform((s) => s?.trim()),
  AKPA_AUTH_TYPE: z.enum(['Bearer', 'Token', 'X-Api-Key']).optional(),
  /** Gdy ustawione (np. "token"), token jest dodawany do URL: ?token=... (dla API wymagających auth w query) */
  AKPA_AUTH_QUERY_PARAM: z.string().optional().transform((s) => s?.trim() || undefined),
  /** Opcjonalny URL do ramówki (programów). Np. https://api-epg.akpa.pl/api/v1/programs – zapytaj AKPA o endpoint. */
  AKPA_PROGRAMS_URL: z.string().optional().transform((s) => s?.trim() || undefined),
  /** Min. odstęp (ms) między kolejnymi żądaniami do AKPA z tego procesu (domyślnie 550 – poniżej ~2 req/s). */
  AKPA_MIN_REQUEST_INTERVAL_MS: z.string().optional(),
  /** Ile parametrów ch= na jedno GET /epg (mniejsze partie = mniejszy URL, łatwiejsze retry przy błędzie). Domyślnie 25. */
  AKPA_EPG_CHANNELS_PER_REQUEST: z.string().optional(),
  AKPA_LOGOS_BASE_URL: z.string().optional(),
  AKPA_LOGOS_USER: z.string().optional(),
  AKPA_LOGOS_PASSWORD: z.string().optional(),
  AKPA_LOGOS_NEW_BASE_URL: z.string().optional(),
  AKPA_LOGOS_NEW_USER: z.string().optional(),
  AKPA_LOGOS_NEW_PASSWORD: z.string().optional(),
  EPG_SOURCE: z.enum(['akpa', 'iptv']).optional(),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  FCM_SERVER_KEY: z.string().optional(),
  DAILY_REMINDER_SCHEDULE: z.string().optional(),
  DAILY_REMINDER_ENABLED: z.coerce.boolean().optional(),
  ADMIN_EVENT_SECRET: z.string().optional(),
  /** Min. potwierdzeń zanim wyślemy push „Koniec reklam” do innych (domyślnie 2). */
  EVENT_CONFIRMATION_THRESHOLD: z.coerce.number().min(1).max(20).optional(),
  /** Ważność zgłoszenia w minutach (3–5 zgodnie z wymaganiami, domyślnie 5). */
  EVENT_EXPIRY_MINUTES: z.coerce.number().min(1).max(60).optional(),
  /** Max zgłoszeń (POST /events) na device na minutę (ochrona przed spamem). */
  EVENT_RATE_LIMIT_CREATE_PER_MIN: z.coerce.number().min(1).max(60).optional(),
  /** Max zgłoszeń (POST /events) na device na godzinę – zabezpieczenie przed nadużyciami. */
  EVENT_RATE_LIMIT_CREATE_PER_HOUR: z.coerce.number().min(5).max(500).optional(),
  /** Max potwierdzeń (POST /events/:id/confirm) na device na minutę. */
  EVENT_RATE_LIMIT_CONFIRM_PER_MIN: z.coerce.number().min(5).max(120).optional(),
  APP_VERSION: z.string().optional(),
  APP_BUILD_NUMBER: z.coerce.number().optional(),
  APP_MIN_REQUIRED_VERSION: z.string().optional(),
  APP_UPDATE_URL: z.string().url().optional(),
  /** Public URL API – logoUrl w odpowiedziach jako pełne URLe */
  PUBLIC_API_URL: z.string().optional().transform((s) => (s?.trim() || undefined)),
});

export const env = envSchema.parse(process.env);

