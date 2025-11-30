import {
  EventChoice,
  PointReason,
  Prisma,
  PrismaClient,
} from '@prisma/client';

const FAST_CONFIRM_WINDOW_SECONDS = 60;

const POINT_VALUES: Record<PointReason, number> = {
  [PointReason.FAST_CONFIRM]: 5,
  [PointReason.REMINDER_CONFIRM]: 3,
  [PointReason.DOUBLE_CONFIRM]: 2,
  [PointReason.DAILY_STREAK]: 2,
  [PointReason.STREAK_BONUS]: 0, // dynamic
  [PointReason.MANUAL_ADJUSTMENT]: 0,
};

const STREAK_BONUSES: Array<{ length: number; bonus: number }> = [
  { length: 3, bonus: 10 },
  { length: 7, bonus: 20 },
  { length: 14, bonus: 35 },
  { length: 30, bonus: 60 },
];

export class PointsService {
  constructor(private readonly prisma: PrismaClient) {}

  async handleEventConfirmation(params: {
    deviceId: string;
    eventId: string;
    choice: EventChoice;
    delaySeconds: number | null;
    reminderUsed: boolean;
  }) {
    const { deviceId, delaySeconds, reminderUsed } = params;

    const reasons: PointReason[] = [];

    if (!reminderUsed && (delaySeconds ?? Number.MAX_SAFE_INTEGER) <= FAST_CONFIRM_WINDOW_SECONDS) {
      reasons.push(PointReason.FAST_CONFIRM);
    } else if (reminderUsed) {
      reasons.push(PointReason.REMINDER_CONFIRM);
    } else {
      reasons.push(PointReason.DOUBLE_CONFIRM);
    }

    const streakResult = await this.updateStreak(deviceId);
    if (streakResult.streakIncreased) {
      reasons.push(PointReason.DAILY_STREAK);

      const bonus = this.calculateStreakBonus(streakResult.newLength);
      if (bonus) {
        await this.addPoints(deviceId, bonus, PointReason.STREAK_BONUS, params.eventId);
      }
    }

    let totalAwarded = 0;
    for (const reason of reasons) {
      const amount = POINT_VALUES[reason];
      if (amount > 0) {
        await this.addPoints(deviceId, amount, reason, params.eventId);
        totalAwarded += amount;
      }
    }

    return {
      awarded: totalAwarded,
      newStreakLength: streakResult.newLength,
    };
  }

  async addManualPoints(
    deviceId: string,
    amount: number,
    description: string,
  ) {
    await this.addPoints(deviceId, amount, PointReason.MANUAL_ADJUSTMENT, undefined, description);
  }

  private async addPoints(
    deviceId: string,
    amount: number,
    reason: PointReason,
    eventId?: string,
    description?: string,
  ) {
    const [balance] = await this.prisma.$transaction([
      this.prisma.pointBalance.upsert({
        where: { deviceId },
        update: { totalPoints: { increment: amount } },
        create: {
          deviceId,
          totalPoints: amount,
        },
      }),
      this.prisma.pointEntry.create({
        data: {
          deviceId,
          points: amount,
          reason,
          eventId: eventId ?? null,
          description: description ?? null,
        },
      }),
    ]);

    return balance;
  }

  private async updateStreak(deviceId: string) {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.pointBalance.findUnique({
        where: { deviceId },
        select: {
          deviceId: true,
          streakLength: true,
          lastActive: true,
        },
      });

      const lastActiveKey = balance?.lastActive
        ? balance.lastActive.toISOString().slice(0, 10)
        : undefined;

      if (lastActiveKey === todayKey) {
        return { streakIncreased: false, newLength: balance?.streakLength ?? 0 };
      }

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);

      const newStreakLength =
        lastActiveKey === yesterdayKey ? (balance?.streakLength ?? 0) + 1 : 1;

      await tx.pointBalance.upsert({
        where: { deviceId },
        update: {
          streakLength: newStreakLength,
          lastActive: now,
        },
        create: {
          deviceId,
          totalPoints: 0,
          streakLength: newStreakLength,
          lastActive: now,
        },
      });

      return {
        streakIncreased: true,
        newLength: newStreakLength,
      };
    });
  }

  private calculateStreakBonus(length: number) {
    const bonus = [...STREAK_BONUSES].reverse().find((item) => length >= item.length);
    return bonus?.bonus ?? 0;
  }

  async getSummary(deviceId: string) {
    return this.prisma.pointBalance.findUnique({
      where: { deviceId },
      include: {
        entries: {
          orderBy: { createdAt: Prisma.SortOrder.desc },
          take: 20,
        },
      },
    });
  }

  async getLeaderboard(limit: number = 50) {
    return this.prisma.pointBalance.findMany({
      orderBy: { totalPoints: Prisma.SortOrder.desc },
      take: limit,
      select: {
        deviceId: true,
        totalPoints: true,
        streakLength: true,
        lastActive: true,
      },
    });
  }
}

