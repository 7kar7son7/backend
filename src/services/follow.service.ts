import { FollowType, PrismaClient } from '@prisma/client';

export class FollowService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(deviceId: string) {
    return this.prisma.followedItem.findMany({
      where: { deviceId },
      include: {
        channel: true,
        program: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async followChannel(deviceId: string, channelId: string) {
    await this.prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { id: true },
    });

    return this.prisma.followedItem.upsert({
      where: {
        deviceId_channelId: {
          deviceId,
          channelId,
        },
      },
      update: {
        updatedAt: new Date(),
      },
      create: {
        deviceId,
        type: FollowType.CHANNEL,
        channelId,
      },
    });
  }

  async followProgram(deviceId: string, programId: string) {
    await this.prisma.program.findUniqueOrThrow({
      where: { id: programId },
      select: { id: true, channelId: true },
    });

    return this.prisma.followedItem.upsert({
      where: {
        deviceId_programId: {
          deviceId,
          programId,
        },
      },
      update: {
        updatedAt: new Date(),
      },
      create: {
        deviceId,
        type: FollowType.PROGRAM,
        programId,
      },
    });
  }

  async unfollowChannel(deviceId: string, channelId: string) {
    // Najpierw znajdź FollowedItem, żeby móc usunąć relacje z Event
    const follow = await this.prisma.followedItem.findFirst({
      where: {
        deviceId,
        channelId,
      },
      include: {
        events: {
          select: { id: true },
        },
      },
    });

    if (!follow) {
      return; // Już nie istnieje, nic nie rób
    }

    // Usuń relacje z Event (many-to-many) i FollowedItem w jednej transakcji
    await this.prisma.$transaction(
      async (tx) => {
        // Usuń relacje z Event
        if (follow.events.length > 0) {
          await Promise.all(
            follow.events.map((event) =>
              tx.event.update({
                where: { id: event.id },
                data: {
                  followers: {
                    disconnect: { id: follow.id },
                  },
                },
              }),
            ),
          );
        }

        // Teraz usuń FollowedItem
        await tx.followedItem.delete({
          where: { id: follow.id },
        });
      },
      { timeout: 10000 }, // 10 sekund timeout
    );
  }

  async unfollowProgram(deviceId: string, programId: string) {
    // Najpierw znajdź FollowedItem, żeby móc usunąć relacje z Event
    const follow = await this.prisma.followedItem.findFirst({
      where: {
        deviceId,
        programId,
      },
      include: {
        events: {
          select: { id: true },
        },
      },
    });

    if (!follow) {
      return; // Już nie istnieje, nic nie rób
    }

    // Usuń relacje z Event (many-to-many) i FollowedItem w jednej transakcji
    await this.prisma.$transaction(
      async (tx) => {
        // Usuń relacje z Event
        if (follow.events.length > 0) {
          await Promise.all(
            follow.events.map((event) =>
              tx.event.update({
                where: { id: event.id },
                data: {
                  followers: {
                    disconnect: { id: follow.id },
                  },
                },
              }),
            ),
          );
        }

        // Teraz usuń FollowedItem
        await tx.followedItem.delete({
          where: { id: follow.id },
        });
      },
      { timeout: 10000 }, // 10 sekund timeout
    );
  }
}

