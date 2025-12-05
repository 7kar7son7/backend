import {
  EventChoice,
  EventStatus,
  FollowType,
  Prisma,
  PrismaClient,
  ReminderKind,
} from '@prisma/client';

type CreateEventOptions = {
  skipInitiatorFollow?: boolean;
};

export class EventService {
  constructor(private readonly prisma: PrismaClient) {}

  async createEvent(deviceId: string, programId: string, options?: CreateEventOptions) {
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

    // Ustaw próg walidacji na 1 dla testów (docelowo 5-10)
    // To sprawia, że wydarzenia są walidowane po osiągnięciu progu
    const followerCountLimit = 1; // Na początek 1 dla testów, później 5-10

    const event = await this.prisma.event.create({
      data: {
        programId,
        initiatorDeviceId: deviceId,
        status: EventStatus.PENDING,
        expiresAt,
        followerCountLimit,
      },
      include: {
        program: {
          include: {
            channel: true,
          },
        },
      },
    });

    const followerDeviceIds = await this.syncEventFollowers(event.id, programId);
    
    if (!options?.skipInitiatorFollow) {
      // Dodaj inicjatora do followers, jeśli jeszcze nie jest na liście
      const initiatorIsFollower = followerDeviceIds.includes(deviceId);
      if (!initiatorIsFollower) {
        // Sprawdź czy inicjator śledzi program
        const initiatorFollow = await this.prisma.followedItem.findFirst({
          where: {
            programId,
            deviceId,
            type: FollowType.PROGRAM,
          },
        });
        
        if (initiatorFollow) {
          // Jeśli śledzi program, dodaj do followers
          await this.prisma.event.update({
            where: { id: event.id },
            data: {
              followers: {
                connect: { id: initiatorFollow.id },
              },
            },
          });
          followerDeviceIds.push(deviceId);
        } else {
          // Jeśli nie śledzi, utwórz tymczasowy follow tylko dla tego wydarzenia
          const tempFollow = await this.prisma.followedItem.create({
            data: {
              deviceId,
              type: FollowType.PROGRAM,
              programId,
            },
          });
          
          await this.prisma.event.update({
            where: { id: event.id },
            data: {
              followers: {
                connect: { id: tempFollow.id },
              },
            },
          });
          followerDeviceIds.push(deviceId);
        }
      }
    }

    return { event, followerDeviceIds };
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

  async confirmEvent(
    eventId: string,
    deviceId: string,
    choice: EventChoice,
    reminderUsed: boolean,
  ) {
    const event = await this.prisma.event.findUnique({
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

  /**
   * Pobiera wszystkich followers programu (do wysłania powiadomień)
   * Wyklucza deviceId które już zgłosiły event (są w confirmations)
   */
  async getProgramFollowersForNotification(eventId: string, programId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        confirmations: {
          select: { deviceId: true },
        },
        initiatorDeviceId: true,
      },
    });

    if (!event) {
      return [];
    }

    // Pobierz wszystkich followers programu
    const followers = await this.prisma.followedItem.findMany({
      where: {
        programId,
        type: FollowType.PROGRAM,
      },
      select: { deviceId: true },
    });

    // Wyklucz tych którzy już zgłosili (są w confirmations) oraz inicjatora
    const confirmedDeviceIds = new Set([
      ...event.confirmations.map((c) => c.deviceId),
      event.initiatorDeviceId,
    ]);

    return followers
      .map((f) => f.deviceId)
      .filter((deviceId) => !confirmedDeviceIds.has(deviceId));
  }
}

