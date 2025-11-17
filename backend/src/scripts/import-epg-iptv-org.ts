#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { Bindings } from 'pino';

import { importIptvOrgEpg } from '../services/iptv-org-importer';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const logger = createCliLogger();

  try {
    const result = await importIptvOrgEpg(prisma, logger, { ...options, verbose: true });
    console.log(
      `🟢 Import zakończony powodzeniem: ${result.channelCount} kanałów / ${result.programCount} programów`,
    );
  } catch (error) {
    console.error('❌ Import IPTV-Org nie powiódł się:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: string[]) {
  const options: { url?: string; file?: string } = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === '--url' || arg === '-u') && argv[i + 1]) {
      options.url = argv[i + 1]!;
      i += 1;
    } else if ((arg === '--file' || arg === '-f') && argv[i + 1]) {
      options.file = argv[i + 1]!;
      i += 1;
    } else if (arg && arg.startsWith('--url=')) {
      const urlValue = arg.split('=')[1];
      if (urlValue) {
        options.url = urlValue;
      }
    } else if (arg && arg.startsWith('--file=')) {
      const fileValue = arg.split('=')[1];
      if (fileValue) {
        options.file = fileValue;
      }
    }
  }

  return options;
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
