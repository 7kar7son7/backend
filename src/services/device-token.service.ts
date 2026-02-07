import { Prisma, PrismaClient, NotificationSensitivity } from '@prisma/client';

export class DeviceTokenService {
  constructor(private readonly prisma: PrismaClient) {}

  async registerToken(
    deviceId: string,
    token: string,
    platform?: string,
    notificationSensitivity?: NotificationSensitivity,
  ) {
    const createData: Prisma.DeviceTokenCreateInput = {
      deviceId,
      token,
      lastUsedAt: new Date(),
    };

    if (platform !== undefined) {
      createData.platform = platform;
    }

    if (notificationSensitivity !== undefined) {
      createData.notificationSensitivity = notificationSensitivity;
    }

    const updateData: Prisma.DeviceTokenUpdateInput = {
      deviceId: { set: deviceId },
      lastUsedAt: { set: new Date() },
    };

    if (platform !== undefined) {
      updateData.platform = { set: platform };
    }

    if (notificationSensitivity !== undefined) {
      updateData.notificationSensitivity = { set: notificationSensitivity };
    }

    return this.prisma.deviceToken.upsert({
      where: { token },
      create: createData,
      update: updateData,
    });
  }

  async updateNotificationSensitivity(
    deviceId: string,
    notificationSensitivity: NotificationSensitivity,
  ) {
    return this.prisma.deviceToken.updateMany({
      where: { deviceId },
      data: { notificationSensitivity },
    });
  }

  async getNotificationSensitivity(deviceId: string): Promise<NotificationSensitivity | null> {
    const deviceToken = await this.prisma.deviceToken.findFirst({
      where: { deviceId },
      select: { notificationSensitivity: true },
    });

    return deviceToken?.notificationSensitivity ?? null;
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

