/**
 * Jednorazowy test: fetchAndSaveAkpaLogoForChannel(akpa_367) z pełnym logowaniem do pliku.
 * Uruchom: npx tsx src/scripts/test-logo-flow.ts
 * Wymaga: .env z DATABASE_URL (opcjonalnie AKPA_LOGOS_*).
 */
import { config as loadEnv } from 'dotenv';
loadEnv();

import { createWriteStream } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import { fetchAndSaveAkpaLogoForChannel } from '../services/sync-akpa-logos-to-db.service';

const LOG_FILE = 'logo-test.log';
const CHANNEL_ID = 'akpa_367';

function createFileLogger(): FastifyBaseLogger {
  const stream = createWriteStream(LOG_FILE, { flags: 'w' });
  const log = (level: string, msg: string, obj?: object) => {
    const line = `${new Date().toISOString()} [${level}] ${msg} ${obj ? JSON.stringify(obj) : ''}\n`;
    stream.write(line);
    console.log(line.trim());
  };
  return {
    child: () => createFileLogger(),
    trace: (o: object, msg: string) => log('trace', msg, o),
    debug: (o: object, msg: string) => log('debug', msg, o),
    info: (o: object, msg: string) => log('info', msg, o),
    warn: (o: object, msg: string) => log('warn', msg, o),
    error: (o: object, msg: string) => log('error', msg, o),
    fatal: (o: object, msg: string) => log('fatal', msg, o),
    silent: () => {},
  } as FastifyBaseLogger;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Brak DATABASE_URL w .env');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const logger = createFileLogger();

  logger.info({ channelId: CHANNEL_ID }, '[test] start fetchAndSaveAkpaLogoForChannel');

  const result = await fetchAndSaveAkpaLogoForChannel(prisma, logger, CHANNEL_ID);

  if (result) {
    logger.info({ bodyLength: result.body.length, contentType: result.contentType }, '[test] OK – logo pobrane');
  } else {
    logger.warn({}, '[test] NULL – nie udało się pobrać (sprawdź logi wyżej)');
  }

  await prisma.$disconnect();
  console.log('\nLogi zapisane w', LOG_FILE);
  process.exit(result ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
