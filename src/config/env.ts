import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// W produkcji nie ładuj .env - zmienne są w process.env
if (process.env.NODE_ENV !== 'production') {
  loadEnv();
}

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
  EPG_GRAB_ENABLED: z.coerce.boolean().optional(),
  EPG_GRAB_COMMAND: z.string().optional(),
  EPG_GRAB_WORKDIR: z.string().optional(),
  IPTV_ORG_MAX_CHANNELS: z.string().optional(),
  IPTV_ORG_MAX_DAYS: z.string().optional(),
  IPTV_ORG_ALLOWED_PREFIXES: z.string().optional(),
  IPTV_ORG_SELECTED_IDS: z.string().optional(),
  EPG_IMPORT_CHUNK_SIZE: z.string().optional(),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  FCM_SERVER_KEY: z.string().optional(),
  DAILY_REMINDER_SCHEDULE: z.string().optional(),
});

export const env = envSchema.parse(process.env);

