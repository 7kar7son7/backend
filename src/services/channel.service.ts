import { Prisma, PrismaClient } from '@prisma/client';

export class ChannelService {
  constructor(private readonly prisma: PrismaClient) {}

  listChannels(params: {
    search?: string;
    includePrograms?: boolean;
    limit?: number;
    offset?: number;
    /** Zwróć tylko kanały o podanych ID (np. ulubione) – jeden request zamiast N. */
    channelIds?: string[];
  }) {
    const { search, includePrograms, limit, offset, channelIds } = params;

    // Ograniczenie: max 32 programy na kanał (ok. 1–2 dni). Lista: bez description (szybsze zapytanie i mniejszy JSON).
    const PROGRAMS_PER_CHANNEL_LIMIT = 32;
    const include: Prisma.ChannelInclude | undefined =
      includePrograms === true
        ? {
            programs: {
              select: {
                id: true,
                title: true,
                channelId: true,
                startsAt: true,
                endsAt: true,
                imageUrl: true,
                imageHasData: true,
                seasonNumber: true,
                episodeNumber: true,
                tags: true,
              },
              where: {
                startsAt: {
                  // Uwzględnij programy od 24 h wstecz, żeby bieżący program (już trwający) był w liście – potrzebne do paska postępu w ulubionych i na kanałach
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                  lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dni do przodu
                },
              },
              orderBy: { startsAt: Prisma.SortOrder.asc },
              take: PROGRAMS_PER_CHANNEL_LIMIT,
            },
          }
        : undefined;

    const where: Prisma.ChannelWhereInput = {};

    if (search !== undefined) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (channelIds !== undefined && channelIds.length > 0) {
      where.id = { in: channelIds };
    }

    const hasWhere = Object.keys(where).length > 0;

    return this.prisma.channel.findMany({
      ...(hasWhere ? { where } : {}),
      orderBy: { name: Prisma.SortOrder.asc },
      ...(include ? { include } : {}),
      ...(limit !== undefined ? { take: limit } : {}),
      ...(offset !== undefined ? { skip: offset } : {}),
    });
  }

  getChannel(channelId: string) {
    return this.prisma.channel.findUnique({
      where: { id: channelId },
    });
  }
}
