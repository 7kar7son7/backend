import { FollowType, PrismaClient } from '@prisma/client';

import { env } from '../config/env';
import { akpaLogoThumbDataUrl } from '../utils/akpa-logo-thumbs';
import { resolveChannelLogoUrlForApi } from '../utils/channel-logo';
import { programImageUrlForApi } from '../utils/program-photo-url';

import { channelPublicSelect } from './prisma-selects';

export class FollowService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(deviceId: string) {
    const items = await this.prisma.followedItem.findMany({
      where: { deviceId },
      select: {
        id: true,
        deviceId: true,
        type: true,
        createdAt: true,
        updatedAt: true,
        channel: { select: channelPublicSelect },
        program: {
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
            channel: { select: channelPublicSelect },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const channelJson = (ch: NonNullable<(typeof items)[0]['channel']>) => {
      const logoUrl = resolveChannelLogoUrlForApi(ch);
      const logoThumbDataUrl = akpaLogoThumbDataUrl(String(ch.externalId));
      return {
        id: ch.id,
        externalId: ch.externalId,
        name: ch.name,
        description: ch.description,
        logoUrl,
        logoThumbDataUrl: logoThumbDataUrl ?? null,
        category: ch.category,
        countryCode: ch.countryCode,
      };
    };

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
          channel: channelJson(item.channel),
          program: null,
        };
      }

      if (item.type === 'PROGRAM' && item.program) {
        const pch = item.program.channel;
        const chThumb = pch ? akpaLogoThumbDataUrl(String(pch.externalId)) : null;
        return {
          ...base,
          channel: pch ? channelJson(pch) : null,
          program: {
            id: item.program.id,
            title: item.program.title,
            channelId: item.program.channelId,
            channelName: pch?.name ?? item.program.channelId ?? 'Nieznany kanał',
            channelLogoUrl: pch ? resolveChannelLogoUrlForApi(pch) : null,
            channelLogoThumbDataUrl: chThumb ?? null,
            description: item.program.description,
            seasonNumber: item.program.seasonNumber,
            episodeNumber: item.program.episodeNumber,
            startsAt: item.program.startsAt instanceof Date ? item.program.startsAt.toISOString() : item.program.startsAt,
            endsAt: item.program.endsAt instanceof Date ? item.program.endsAt.toISOString() : item.program.endsAt,
            imageUrl:
              programImageUrlForApi(item.program.imageUrl, env.PUBLIC_API_URL, {
                programId: item.program.id,
                hasImageData: item.program.imageHasData,
              }) ??
              item.program.imageUrl ??
              (pch ? resolveChannelLogoUrlForApi(pch) : null),
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

