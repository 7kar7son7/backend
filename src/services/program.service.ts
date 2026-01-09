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

    return this.prisma.program.findMany({
      where,
      orderBy: { startsAt: Prisma.SortOrder.asc },
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

