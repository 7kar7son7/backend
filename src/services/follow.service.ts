import { FollowType, PrismaClient } from '@prisma/client';

import { resolveChannelLogoUrlForApi } from '../utils/channel-logo';

export class FollowService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(deviceId: string) {
    const items = await this.prisma.followedItem.findMany({
      where: { deviceId },
      include: {
        channel: true,
        program: {
          include: {
            channel: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Formatuj odpowiedź tak, aby program miał channelName i channelLogoUrl
    return items.map((item) => {
      const base = {
        id: item.id,
        deviceId: item.deviceId,
        type: item.type,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };

      if (item.type === 'CHANNEL' && item.channel) {
        return {
          ...base,
          channel: {
            id: item.channel.id,
            externalId: item.channel.externalId,
            name: item.channel.name,
            description: item.channel.description,
            logoUrl: resolveChannelLogoUrlForApi(item.channel),
            category: item.channel.category,
            countryCode: item.channel.countryCode,
          },
          program: null,
        };
      }

      if (item.type === 'PROGRAM' && item.program) {
        return {
          ...base,
          channel: item.program.channel ? {
            id: item.program.channel.id,
            externalId: item.program.channel.externalId,
            name: item.program.channel.name,
            description: item.program.channel.description,
            logoUrl: resolveChannelLogoUrlForApi(item.program.channel),
            category: item.program.channel.category,
            countryCode: item.program.channel.countryCode,
          } : null,
          program: {
            id: item.program.id,
            title: item.program.title,
            channelId: item.program.channelId,
            channelName: item.program.channel?.name ?? item.program.channelId ?? 'Nieznany kanał',
            channelLogoUrl: item.program.channel ? resolveChannelLogoUrlForApi(item.program.channel) : null,
            description: item.program.description,
            seasonNumber: item.program.seasonNumber,
            episodeNumber: item.program.episodeNumber,
            startsAt: item.program.startsAt instanceof Date ? item.program.startsAt.toISOString() : item.program.startsAt,
            endsAt: item.program.endsAt instanceof Date ? item.program.endsAt.toISOString() : item.program.endsAt,
            imageUrl: item.program.imageUrl,
            tags: item.program.tags ?? [],
          },
        };
      }

      return {
        ...base,
        channel: null,
        program: null,
      };
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

