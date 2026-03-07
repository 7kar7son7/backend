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

    // Ograniczenie: max 16 programów na kanał w liście – szybsze zapytanie i mniejszy JSON (szczegóły kanału ładują pełną listę osobno)
    const PROGRAMS_PER_CHANNEL_LIMIT = 16;
    const include: Prisma.ChannelInclude | undefined =
      includePrograms === true
        ? {
            programs: {
              where: {
                startsAt: {
                  gte: new Date(),
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
