import { Prisma, PrismaClient } from '@prisma/client';

export class ProgramService {
  constructor(private readonly prisma: PrismaClient) {}

  listUpcomingByChannel(channelId: string, params: { from?: Date; to?: Date }) {
    const { from, to } = params;

    const where: Prisma.ProgramWhereInput = {
      channelId,
    };

    // Filtruj programy w zakresie dat
    // Program musi być aktywny w zakresie [from, to]
    // czyli: startsAt < to (program zaczyna się przed końcem zakresu)
    //    i: endsAt > from LUB endsAt jest null (program kończy się po początku zakresu lub nie ma końca)
    if (from && to) {
      where.startsAt = { lt: to };
      where.OR = [
        { endsAt: { gt: from } },
        { endsAt: null },
      ];
    } else if (from) {
      // Jeśli tylko 'from', pokazuj programy które jeszcze się nie zakończyły
      where.OR = [
        { endsAt: { gt: from } },
        { endsAt: null },
      ];
    } else if (to) {
      // Jeśli tylko 'to', pokazuj programy które się zaczynają przed tym czasem
      where.startsAt = { lt: to };
    } else {
      // Domyślnie pokazuj programy które jeszcze się nie zakończyły
      const now = new Date();
      where.OR = [
        { endsAt: { gt: now } },
        { endsAt: null },
      ];
    }

    return this.prisma.program.findMany({
      where,
      orderBy: { startsAt: Prisma.SortOrder.asc },
      include: {
        channel: true, // Dołącz dane kanału
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

