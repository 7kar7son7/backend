import { FastifyBaseLogger } from 'fastify';
import { Prisma, PrismaClient } from '@prisma/client';

import { env } from '../config/env';

export type EpgProgram = {
  id: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  season?: number;
  episode?: number;
  image?: string;
  tags?: string[];
};

export type EpgChannel = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  logo?: string;
  countryCode?: string;
  programs?: EpgProgram[];
};

export type EpgFeed = {
  generatedAt?: string;
  channels: EpgChannel[];
};

const DEFAULT_PROGRAM_CHUNK_SIZE = 25;

export class EpgImportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: FastifyBaseLogger,
  ) {}

  async importFeed(feed: EpgFeed) {
    let channelCount = 0;
    let programCount = 0;

    const totalChannels = feed.channels.length;

    const chunkSize =
      Number.parseInt(process.env.EPG_IMPORT_CHUNK_SIZE ?? '', 10) ||
      Number.parseInt(env.EPG_IMPORT_CHUNK_SIZE ?? '', 10) ||
      DEFAULT_PROGRAM_CHUNK_SIZE;

    for (const [index, channel] of feed.channels.entries()) {
      this.logger.info(
        `Import kanału ${index + 1}/${totalChannels}: ${channel.name} (${channel.programs?.length ?? 0} programów)`,
      );

      const channelRecord = await this.prisma.channel.upsert({
        where: { externalId: channel.id },
        update: {
          name: channel.name,
          category: channel.category ?? null,
          description: channel.description ?? null,
          logoUrl: channel.logo ?? null,
          countryCode: channel.countryCode ?? null,
        },
        create: {
          externalId: channel.id,
          name: channel.name,
          category: channel.category ?? null,
          description: channel.description ?? null,
          logoUrl: channel.logo ?? null,
          countryCode: channel.countryCode ?? null,
        },
      });

      channelCount += 1;
      if ((index + 1) % 10 === 0 || index === totalChannels - 1) {
        this.logger.info(
          `Kanały ${index + 1}/${totalChannels} przetworzone (ostatni: ${channel.name})`,
        );
      }

      if (!channel.programs || channel.programs.length === 0) {
        continue;
      }

      const programChunks = chunkArray(channel.programs, chunkSize);

      for (const programChunk of programChunks) {
        const operations: Prisma.PrismaPromise<unknown>[] = [];
        let validProgramsInChunk = 0;

        for (const program of programChunk) {
          const startsAt = new Date(program.start);
          if (Number.isNaN(startsAt.getTime())) {
            this.logger.warn(
              { programId: program.id, start: program.start },
              'Skipping program with invalid start date',
            );
            continue;
          }

          const endsAt = program.end ? new Date(program.end) : null;
          if (program.end && Number.isNaN(endsAt?.getTime() ?? Number.NaN)) {
            this.logger.warn(
              { programId: program.id, end: program.end },
              'Skipping program with invalid end date',
            );
            continue;
          }

          const endsAtFinal = endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);

          const createData: Prisma.ProgramCreateInput = {
            externalId: program.id,
            title: program.title,
            description: program.description ?? null,
            seasonNumber: program.season ?? null,
            episodeNumber: program.episode ?? null,
            startsAt,
            endsAt: endsAtFinal,
            imageUrl: program.image ?? null,
            tags: program.tags ?? [],
            channel: {
              connect: { id: channelRecord.id },
            },
          };

          const updateData: Prisma.ProgramUpdateInput = {
            title: program.title,
            description: program.description ?? null,
            seasonNumber: program.season ?? null,
            episodeNumber: program.episode ?? null,
            startsAt,
            imageUrl: program.image ?? null,
            tags: { set: program.tags ?? [] },
            channel: {
              connect: { id: channelRecord.id },
            },
            endsAt: endsAtFinal,
          };

          operations.push(
            this.prisma.program.upsert({
              where: { externalId: program.id },
              update: updateData,
              create: createData,
            }),
          );
          validProgramsInChunk += 1;
        }

        if (operations.length > 0) {
          try {
            await this.prisma.$transaction(operations);
            programCount += validProgramsInChunk;
          } catch (error) {
            this.logger.error(
              { 
                error, 
                channelName: channel.name, 
                chunkSize: operations.length,
                validProgramsInChunk,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined
              },
              'Failed to save program chunk to database',
            );
            // Kontynuuj z następnym chunkiem zamiast przerywać cały import
            // Nie rzucamy błędu, żeby import mógł kontynuować z innymi kanałami
          }
        }

        if (programCount % 1000 === 0) {
          this.logger.info(`Programy zapisane: ${programCount}`);
        }
      }

      this.logger.info(
        `Zakończono kanał ${index + 1}/${totalChannels}: ${channel.name} (łącznie programów: ${programCount})`,
      );
    }

    return {
      channelCount,
      programCount,
    };
  }
}

function chunkArray<T>(items: readonly T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    return [items.slice()];
  }

  const result: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(items.slice(i, i + chunkSize));
  }
  return result;
}

