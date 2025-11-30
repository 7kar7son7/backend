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

  async createEvent(deviceId: string, programId: string) {
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

    // Ustaw próg walidacji na 5-10 potwierdzeń (losowo między 5 a 10)
    // To sprawia, że wydarzenia są walidowane po osiągnięciu progu
    const followerCountLimit = Math.floor(Math.random() * 6) + 5; // 5-10

    const event = await this.prisma.event.create({
      data: {
        programId,
        initiatorDeviceId: deviceId,
        status: EventStatus.PENDING,
        expiresAt,
        followerCountLimit,
      },
      include: {
        program: true,
      },
    });

    const followerDeviceIds = await this.syncEventFollowers(event.id, programId);

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
        followers: {
          some: {
            deviceId,
          },
        },
      },
      include: {
        program: true,
        confirmations: true,
      },
      orderBy: { initiatedAt: Prisma.SortOrder.desc },
    });
  }

  async syncEventFollowers(eventId: string, programId: string) {
    const followers = await this.prisma.followedItem.findMany({
      where: {
        programId,
        type: FollowType.PROGRAM,
      },
      select: { id: true, deviceId: true },
    });

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
}

