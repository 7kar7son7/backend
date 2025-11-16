#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { Bindings } from 'pino';

import { pruneDisallowedChannels } from '../services/iptv-org-importer';

async function main() {
  const prisma = new PrismaClient();
  const logger = createCliLogger();

  try {
    const { removed } = await pruneDisallowedChannels(prisma, logger);
    logger.info(`🔚 Czyszczenie zakończone. Usunięto ${removed} kanałów.`);
  } catch (error) {
    logger.error(error, '❌ Nie udało się oczyścić kanałów.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

function createCliLogger(): FastifyBaseLogger {
  const logger: FastifyBaseLogger = {
    level: 'info',
    info: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
    fatal: console.error.bind(console),
    trace: console.debug.bind(console),
    child: (_bindings: Bindings) => logger,
    silent: () => {},
  };

  return logger;
}

void main();

