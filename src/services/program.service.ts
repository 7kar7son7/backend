import { Prisma, PrismaClient } from '@prisma/client';

export class ProgramService {
  constructor(private readonly prisma: PrismaClient) {}

  listUpcomingByChannel(channelId: string, params: { from?: Date; to?: Date }) {
    const { from, to } = params;

    const where: Prisma.ProgramWhereInput = {
      channelId,
    };

    // Filtruj programy w zakresie dat
    if (from && to) {
      // Jeśli podano oba, pokazuj programy które zaczynają się w tym zakresie
      where.startsAt = {
        gte: from,
        lt: to,
      };
    } else if (from) {
      // Jeśli tylko 'from', pokazuj programy które się zaczynają od tego czasu
      where.startsAt = { gte: from };
    } else if (to) {
      // Jeśli tylko 'to', pokazuj programy które się zaczynają przed tym czasem
      where.startsAt = { lt: to };
    } else {
      // Domyślnie pokazuj programy które jeszcze się nie zakończyły
      where.endsAt = { gt: new Date() };
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

