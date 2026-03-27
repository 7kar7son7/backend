import { Prisma, PrismaClient } from '@prisma/client';

export class ProgramService {
  constructor(private readonly prisma: PrismaClient) {}

  listUpcomingByChannel(channelId: string, params: { from?: Date; to?: Date }) {
    const { from, to } = params;

    const where: Prisma.ProgramWhereInput = {
      channelId,
    };

    // Jeśli podano zakres dat, zwróć programy które się przecinają z tym zakresem
    // Program przecina się z zakresem jeśli: startsAt < to AND endsAt > from
    if (from && to) {
      where.startsAt = { lt: to };
      where.endsAt = { gt: from };
    } else if (from) {
      // Jeśli tylko from, zwróć programy które jeszcze się nie skończyły
      where.endsAt = { gt: from };
    } else if (to) {
      // Jeśli tylko to, zwróć programy które zaczynają się przed to
      where.startsAt = { lt: to };
    } else {
      // Jeśli brak parametrów, zwróć tylko przyszłe programy
      where.startsAt = { gte: new Date() };
    }

    // Bez JOIN na channel – kanał jest jeden; osobno getChannel() albo Promise.all w route (mniej danych z DB).
    return this.prisma.program.findMany({
      where,
      orderBy: { startsAt: Prisma.SortOrder.asc },
      select: {
        id: true,
        title: true,
        channelId: true,
        description: true,
        seasonNumber: true,
        episodeNumber: true,
        startsAt: true,
        endsAt: true,
        imageUrl: true,
        imageHasData: true,
        tags: true,
      },
    });
  }

  getProgram(programId: string) {
    return this.prisma.program.findUnique({
      where: { id: programId },
      include: {
        programFollows: {
          select: {
            deviceId: true,
            createdAt: true,
          },
        },
      },
    });
  }
}

