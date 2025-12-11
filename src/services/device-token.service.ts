import { Prisma, PrismaClient } from '@prisma/client';

export class DeviceTokenService {
  constructor(private readonly prisma: PrismaClient) {}

  async registerToken(deviceId: string, token: string, platform?: string) {
    const createData: Prisma.DeviceTokenCreateInput = {
      deviceId,
      token,
      lastUsedAt: new Date(),
    };

    if (platform !== undefined) {
      createData.platform = platform;
    }

    const updateData: Prisma.DeviceTokenUpdateInput = {
      deviceId: { set: deviceId },
      lastUsedAt: { set: new Date() },
    };

    if (platform !== undefined) {
      updateData.platform = { set: platform };
    }

    return this.prisma.deviceToken.upsert({
      where: { token },
      create: createData,
      update: updateData,
    });
  }

  async unregisterToken(token: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { token },
    });
  }

  async getTokensForDevices(deviceIds: string[]) {
    if (deviceIds.length === 0) {
      return [];
    }

    return this.prisma.deviceToken.findMany({
      where: {
        deviceId: { in: deviceIds },
      },
      select: {
        token: true,
        deviceId: true,
      },
    });
  }

  async removeInvalidTokens(tokens: string[]) {
    if (tokens.length === 0) {
      return;
    }

    await this.prisma.deviceToken.deleteMany({
      where: {
        token: { in: tokens },
      },
    });
  }
}

