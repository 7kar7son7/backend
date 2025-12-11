#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { Bindings } from 'pino';

import { importIptvOrgEpg } from '../services/iptv-org-importer';

import { env } from '../config/env';

const DEFAULT_SELECTED_CHANNEL_IDS = [
  'pl/tvp1',
  'pl/tvp2',
  'pl/tvpinfo',
  'pl/tvpsport',
  'pl/tvpseriale',
  'pl/tvn',
  'pl/tvn24',
  'pl/tvn7',
  'pl/tvnstyl',
  'pl/polsat',
  'pl/polsatnews',
  'pl/polsatsport',
  'pl/tv4',
  'pl/tvpuls',
  'pl/tvphistoria',
  'pl/ttv',
  'pl/canalplus',
  'pl/canalplusfilm',
  'pl/canalplussport',
  'pl/eleven1',
  'pl/eleven2',
  'pl/discoverychannel',
  'pl/discoverylife',
  'pl/nationalgeographic',
  'pl/animalplanet',
  'pl/bbcbrit',
  'pl/bbcearth',
  'pl/hbo',
  'pl/hbo2',
  'pl/hbo3',
  'pl/cinemax',
  'pl/axn',
  'pl/minimini',
  'pl/disneychannel',
  'pl/nickelodeon',
  'pl/cartoonnetwork',
  'pl/eskatv',
  'pl/4fundance',
  'pl/fokustv',
];

const prisma = new PrismaClient();

async function main() {
  const selected =
    parseSelectedChannelIds(env.IPTV_ORG_SELECTED_IDS ?? '') ??
    DEFAULT_SELECTED_CHANNEL_IDS;

  const logger = createCliLogger();
  try {
    logger.info(
      `🛠️ Przygotowuję bazę – zostawiam tylko ${selected.length} wybrane kanały.`,
    );
    const normalizedSet = new Set(selected.map(normalizeChannelId));
    const existing = await prisma.channel.findMany({
      select: { id: true, externalId: true },
    });

    const removable = existing.filter(
      (channel) => !normalizedSet.has(normalizeChannelId(channel.externalId)),
    );

    if (removable.length > 0) {
      const idsToRemove = removable.map((channel) => channel.id);
      logger.info(`🧹 Usuwam ${idsToRemove.length} kanałów spoza listy.`);
      await prisma.program.deleteMany({ where: { channelId: { in: idsToRemove } } });
      await prisma.channel.deleteMany({ where: { id: { in: idsToRemove } } });
    }

    logger.info('📡 Importuję dane EPG z IPTV-Org dla wybranych kanałów...');
    await importIptvOrgEpg(prisma, logger, {
      channelIds: selected,
      verbose: true,
    });
    logger.info('✅ Import zakończony powodzeniem.');
  } catch (error) {
    logger.error(error, '❌ Import nie powiódł się.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

function normalizeChannelId(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function parseSelectedChannelIds(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
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


