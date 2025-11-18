import { Prisma, PrismaClient } from '@prisma/client';

export class ChannelService {
  constructor(private readonly prisma: PrismaClient) {}

  listChannels(params: { search?: string; includePrograms?: boolean }) {
    const { search, includePrograms } = params;

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
              // Pokazujemy wszystkie programy na najbliższe 7 dni
            },
          }
        : undefined;

    const where: Prisma.ChannelWhereInput | undefined =
      search !== undefined
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined;

    return this.prisma.channel.findMany({
      orderBy: { name: Prisma.SortOrder.asc },
      ...(where ? { where } : {}),
      ...(include ? { include } : {}),
    });
  }

  getChannel(channelId: string) {
    return this.prisma.channel.findUnique({
      where: { id: channelId },
    });
  }
}

