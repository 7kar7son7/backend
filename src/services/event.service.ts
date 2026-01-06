import {
  EventChoice,
  EventStatus,
  FollowType,
  Prisma,
  PrismaClient,
  ReminderKind,
} from '@prisma/client';

export class EventService {
  constructor(private readonly prisma: PrismaClient) {}

  async createEvent(deviceId: string, programId: string, options?: { skipInitiatorFollow?: boolean }) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        channelId: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (!program) {
      throw new Error('Program not found');
    }

    const expiresAt = program.endsAt ?? new Date(program.startsAt.getTime() + 60 * 60 * 1000);

    const event = await this.prisma.event.create({
      data: {
        programId,
        initiatorDeviceId: deviceId,
        status: EventStatus.PENDING,
        expiresAt,
      },
      include: {
        program: {
          include: {
            channel: true,
          },
        },
      },
    });

    const followerDeviceIds = await this.syncEventFollowers(event.id, programId, deviceId, options?.skipInitiatorFollow);

    return { event, followerDeviceIds };
  }

  async confirmEvent(
    eventId: string,
    deviceId: string,
    choice: EventChoice,
    reminderUsed: boolean,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        program: true,
        confirmations: true,
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    if (event.status === EventStatus.CANCELLED || event.status === EventStatus.EXPIRED) {
      throw new Error('Event is no longer active');
    }

    if (event.expiresAt && event.expiresAt < new Date()) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: { status: EventStatus.EXPIRED },
      });
      throw new Error('Event has expired');
    }

    const existingConfirmation = event.confirmations.find(
      (confirmation) => confirmation.deviceId === deviceId,
    );

    if (existingConfirmation) {
      return existingConfirmation;
    }

    const delaySeconds = Math.floor(
      (Date.now() - event.initiatedAt.getTime()) / 1000,
    );

    const confirmation = await this.prisma.eventConfirmation.create({
      data: {
        eventId,
        deviceId,
        choice,
        delaySeconds,
        reminderUsed,
      },
    });

    const confirmationsCount = await this.prisma.eventConfirmation.count({
      where: { eventId },
    });

    if (event.followerCountLimit && confirmationsCount >= event.followerCountLimit) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: {
          status: EventStatus.VALIDATED,
          validatedAt: new Date(),
        },
      });
    }

    return confirmation;
  }

  async registerReminder(eventId: string, deviceId: string, attempt: number, mutedNight: boolean) {
    return this.prisma.reminderLog.create({
      data: {
        eventId,
        deviceId,
        attempt,
        kind: ReminderKind.PUSH,
        mutedNight,
      },
    });
  }

  async listActiveEvents(deviceId: string) {
    return this.prisma.event.findMany({
      where: {
        status: {
          in: [EventStatus.PENDING, EventStatus.VALIDATED],
        },
        expiresAt: {
          gte: new Date(),
        },
        OR: [
          {
            followers: {
              some: {
                deviceId,
              },
            },
          },
          {
            initiatorDeviceId: deviceId,
          },
        ],
      },
      include: {
        program: {
          include: {
            channel: true,
          },
        },
        confirmations: true,
      },
      orderBy: { initiatedAt: Prisma.SortOrder.desc },
    });
  }

  async syncEventFollowers(eventId: string, programId: string, initiatorDeviceId?: string, skipInitiatorFollow?: boolean) {
    const followers = await this.prisma.followedItem.findMany({
      where: {
        programId,
        type: FollowType.PROGRAM,
      },
      select: { id: true, deviceId: true },
    });

    // Jeśli initiatorDeviceId jest podany i nie skipujemy, upewnij się że jest w followers
    if (initiatorDeviceId && !skipInitiatorFollow) {
      const initiatorFollow = followers.find((f) => f.deviceId === initiatorDeviceId);
      if (!initiatorFollow) {
        // Utwórz follow dla initiatora jeśli nie istnieje
        const newFollow = await this.prisma.followedItem.create({
          data: {
            deviceId: initiatorDeviceId,
            programId,
            type: FollowType.PROGRAM,
          },
          select: { id: true, deviceId: true },
        });
        followers.push(newFollow);
      }
    }

    if (followers.length === 0) {
      return [];
    }

    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        followers: {
          connect: followers.map((follow) => ({ id: follow.id })),
        },
      },
    });

    return followers.map((follow) => follow.deviceId);
  }

  async getEvent(eventId: string) {
    return this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        program: {
          include: {
            channel: true,
          },
        },
        confirmations: true,
      },
    });
  }

  async getEventConfirmationsCount(eventId: string) {
    return this.prisma.eventConfirmation.count({
      where: { eventId },
    });
  }

  async getProgramFollowersForNotification(eventId: string, programId: string) {
    // Pobierz wszystkich followers programu, którzy jeszcze nie potwierdzili tego eventu
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        confirmations: {
          select: { deviceId: true },
        },
      },
    });

    if (!event) {
      return [];
    }

    const confirmedDeviceIds = new Set(event.confirmations.map((c) => c.deviceId));

    // Pobierz wszystkich followers programu
    const followers = await this.prisma.followedItem.findMany({
      where: {
        programId,
        type: FollowType.PROGRAM,
      },
      select: {
        deviceId: true,
      },
    });

    const followerDeviceIds = followers.map((f) => f.deviceId);

    if (followerDeviceIds.length === 0) {
      return [];
    }

    // Pobierz tokeny dla tych deviceId
    const tokens = await this.prisma.deviceToken.findMany({
      where: {
        deviceId: { in: followerDeviceIds },
        token: { not: null },
      },
      select: {
        deviceId: true,
      },
      distinct: ['deviceId'],
    });

    const deviceIdsWithTokens = new Set(tokens.map((t) => t.deviceId));

    // Filtruj followers - tylko ci którzy mają tokeny i jeszcze nie potwierdzili
    return followerDeviceIds.filter((deviceId) => {
      const hasToken = deviceIdsWithTokens.has(deviceId);
      const notConfirmed = !confirmedDeviceIds.has(deviceId);
      return hasToken && notConfirmed;
    });
  }
}

