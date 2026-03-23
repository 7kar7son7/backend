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

    // Lista kanałów: programy jeszcze nieskończone (endsAt > now) + start przed horyzontem.
    // Poprzednio: startsAt w [now-24h, now+7d] + take 32 od najstarszego startu — na gęstych kanałach
    // (TVP, Polsat, TVN…) pierwsze 32 pozycje to często same już zakończone bloki → karta „Zobacz ramówkę”, a /programs działał.
    const PROGRAMS_PER_CHANNEL_LIMIT = 48;
    const now = new Date();
    const horizonEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
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
                AND: [
                  { endsAt: { gt: now } },
                  { startsAt: { lt: horizonEnd } },
                ],
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
