#!/usr/bin/env ts-node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { Bindings } from 'pino';
import { fetch } from 'undici';

import { env } from '../config/env';
import {
  EpgImportService,
  type EpgFeed,
} from '../services/epg-import.service';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const prisma = new PrismaClient();
  const importer = new EpgImportService(prisma, createCliLogger());

  try {
    const feed = (await loadFeed(args)) as EpgFeed;
    const result = await importer.importFeed(feed);
    console.log(
      `EPG import completed: ${result.channelCount} channels, ${result.programCount} programs`,
    );
  } catch (error) {
    console.error('EPG import failed', error);
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
    }
  }

  if (!options.url && env.EPG_SOURCE_URL) {
    options.url = env.EPG_SOURCE_URL;
  }

  if (!options.url && !options.file) {
    throw new Error(
      'Provide --url, --file, or set EPG_SOURCE_URL in environment variables.',
    );
  }

  return options;
}

async function loadFeed(options: { url?: string; file?: string }) {
  if (options.file) {
    const filePath = resolve(process.cwd(), options.file);
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  if (!options.url) {
    throw new Error('No feed source specified');
  }

  const response = await fetch(options.url);
  if (!response.ok) {
    throw new Error(
      `Failed to download feed ${options.url} (status ${response.status})`,
    );
  }

  return (await response.json()) as unknown;
}

void main();

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

