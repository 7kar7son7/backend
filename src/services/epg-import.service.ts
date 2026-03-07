import { FastifyBaseLogger } from 'fastify';
import { Prisma, PrismaClient } from '@prisma/client';

import { env } from '../config/env';
import { fetchAkpaImage, isAkpaPhotoUrl } from '../utils/fetch-akpa-image';

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
    this.logger.info(`🚀 Rozpoczynam import feedu EPG (${feed.channels.length} kanałów)`);
    
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

      // Przygotuj dane do update - nie nadpisuj logoUrl jeśli nie ma nowego logotypu
      // WAŻNE: Nie dodajemy logoUrl do updateData jeśli nie ma nowego logotypu w feedzie
      // Dzięki temu istniejące logotypy w bazie nie zostaną nadpisane na null
      const updateData: {
        name: string;
        category: string | null;
        description: string | null;
        logoUrl?: string;
        countryCode: string | null;
      } = {
        name: channel.name,
        category: channel.category ?? null,
        description: channel.description ?? null,
        countryCode: channel.countryCode ?? null,
      };

      // Aktualizuj logoUrl TYLKO jeśli jest nowy logotyp w feedzie
      // Jeśli channel.logo jest undefined/null, NIE dodajemy logoUrl do updateData
      // Dzięki temu Prisma nie nadpisze istniejącego logoUrl na null
      if (channel.logo !== undefined && channel.logo !== null && channel.logo.trim() !== '') {
        updateData.logoUrl = channel.logo;
      }
      // Jeśli nie ma logotypu w feedzie, updateData.logoUrl pozostaje undefined
      // i Prisma nie zaktualizuje tego pola (zachowa istniejącą wartość)

      const channelRecord = await this.prisma.channel.upsert({
        where: { externalId: channel.id },
        update: updateData,
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
        this.logger.debug(`Kanał ${channel.name} nie ma programów, pomijam`);
        continue;
      }
      
      this.logger.debug(`Przetwarzam ${channel.programs.length} programów dla kanału ${channel.name}`);

      const programChunks = chunkArray(channel.programs, chunkSize);

      for (const programChunk of programChunks) {
        const operations: Prisma.PrismaPromise<unknown>[] = [];
        let validProgramsInChunk = 0;

        for (const program of programChunk) {
          // Walidacja podstawowych danych
          if (!program.id || !program.title || !program.start) {
            this.logger.warn(
              { programId: program.id, hasTitle: !!program.title, hasStart: !!program.start },
              'Skipping program with missing required fields',
            );
            continue;
          }

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

          // Walidacja, że end jest po start
          const endsAtFinal = endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);
          if (endsAtFinal.getTime() <= startsAt.getTime()) {
            this.logger.warn(
              { programId: program.id, start: program.start, end: program.end },
              'Skipping program with end date before or equal to start date',
            );
            continue;
          }

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

            // Pobierz zdjęcia z AKPA i zapisz do bazy (imageData) – bez proxy przy odczycie
            const withImage = programChunk.filter((p) => p.image && isAkpaPhotoUrl(p.image));
            if (withImage.length > 0) {
              const externalIds = withImage.map((p) => p.id);
              const dbPrograms = await this.prisma.program.findMany({
                where: { externalId: { in: externalIds }, channelId: channelRecord.id },
                select: { id: true, externalId: true },
              });
              const byExternalId = new Map(dbPrograms.map((p) => [p.externalId, p.id]));
              const IMAGE_CONCURRENCY = 3;
              for (let i = 0; i < withImage.length; i += IMAGE_CONCURRENCY) {
                const batch = withImage.slice(i, i + IMAGE_CONCURRENCY);
                await Promise.all(
                  batch.map(async (prog) => {
                    const dbId = byExternalId.get(prog.id);
                    if (!dbId || !prog.image) return;
                    const result = await fetchAkpaImage(prog.image);
                    if (!result) return;
                    await this.prisma.program.update({
                      where: { id: dbId },
                      data: {
                        imageData: new Uint8Array(result.buffer),
                        imageContentType: result.contentType.slice(0, 64),
                        imageHasData: true,
                      },
                    });
                  }),
                );
              }
            }
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

    this.logger.info(`✅ Import feedu EPG zakończony: ${channelCount} kanałów, ${programCount} programów`);
    
    return {
      channelCount,
      programCount,
    };
  }

  async pruneOldPrograms(maxAgeDays: number = 1): Promise<number> {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
    
    this.logger.info(`🧹 Usuwam programy starsze niż ${maxAgeDays} dzień/dni (przed ${cutoffDate.toISOString()})...`);
    
    // Usuń programy, które już się zakończyły i są starsze niż maxAgeDays
    const deleteResult = await this.prisma.program.deleteMany({
      where: {
        endsAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.info(`🗑️  Usunięto ${deleteResult.count} starych programów (zakończonych przed ${cutoffDate.toISOString()})`);
    
    return deleteResult.count;
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

