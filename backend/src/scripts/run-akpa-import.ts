#!/usr/bin/env tsx
/**
 * Jednorazowy import EPG z AKPA do bazy.
 * Wymaga: DATABASE_URL, AKPA_API_TOKEN w env (lub .env).
 *
 * Przykład (PowerShell):
 *   $env:DATABASE_URL="postgresql://..."; $env:AKPA_API_TOKEN="..."; npm run epg:import:akpa
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { Bindings } from 'pino';

import { importAkpaEpg } from '../services/akpa-importer';
import { EpgImportService } from '../services/epg-import.service';
import { env } from '../config/env';

const logger: FastifyBaseLogger = {
  level: 'info',
  info: (...args: unknown[]) => console.log('[epg]', ...args),
  warn: (...args: unknown[]) => console.warn('[epg]', ...args),
  error: (...args: unknown[]) => console.error('[epg]', ...args),
  debug: (...args: unknown[]) => console.debug('[epg]', ...args),
  fatal: (...args: unknown[]) => console.error('[epg]', ...args),
  trace: (...args: unknown[]) => console.debug('[epg]', ...args),
  child: (_: Bindings) => logger,
  silent: () => {},
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Brak DATABASE_URL. Ustaw w env lub .env');
    process.exit(1);
  }
  if (!env.AKPA_API_TOKEN?.trim() && !process.env.AKPA_API_TOKEN?.trim()) {
    console.error('Brak AKPA_API_TOKEN. Ustaw w env lub .env');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    logger.info('Start importu EPG z AKPA...');
    const result = await importAkpaEpg(prisma, logger);
    logger.info(`Import zakończony: ${result.channelCount} kanałów, ${result.programCount} programów`);

    const maxAgeDays = Math.max(
      1,
      Number.parseInt(env.EPG_PRUNE_MAX_AGE_DAYS ?? process.env.EPG_PRUNE_MAX_AGE_DAYS ?? '14', 10) || 14,
    );
    const epgService = new EpgImportService(prisma, logger);
    await epgService.pruneOldPrograms(maxAgeDays);
    logger.info('Usunięto stare programy (starsze niż %d dni)', maxAgeDays);
  } catch (err) {
    logger.error(err, 'Import EPG nie powiódł się');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
