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
    await this.prisma.followedItem.deleteMany({
      where: {
        deviceId,
        channelId,
      },
    });
  }

  async unfollowProgram(deviceId: string, programId: string) {
    await this.prisma.followedItem.deleteMany({
      where: {
        deviceId,
        programId,
      },
    });
  }
}

