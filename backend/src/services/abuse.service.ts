import { PrismaClient } from '@prisma/client';

const BLOCKED_STATUS = 'BLOCKED' as const;
const REPUTATION_PENALTY_HOURLY_EXCEEDED = 10;
const REPUTATION_MIN_SCORE = 0;
const REPUTATION_MAX_SCORE = 100;

export class AbuseService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Czy urządzenie jest zablokowane (BLOCKED) – wtedy odrzucamy żądania. */
  async isDeviceBlocked(deviceId: string): Promise<boolean> {
    const row = await this.prisma.blockedDevice.findUnique({
      where: { deviceId },
      select: { status: true },
    });
    return row?.status === BLOCKED_STATUS;
  }

  /** Oznacz urządzenie jako nadużywające (FLAGGED) lub zablokuj (BLOCKED). */
  async flagOrBlockDevice(
    deviceId: string,
    reason: string,
    status: 'FLAGGED' | 'BLOCKED' = 'FLAGGED',
  ): Promise<void> {
    await this.prisma.blockedDevice.upsert({
      where: { deviceId },
      create: { deviceId, reason, status },
      update: { reason, status, updatedAt: new Date() },
    });
  }

  /** Zablokuj konto/urządzenie – od tej pory żądania będą odrzucane (403). */
  async blockDevice(deviceId: string, reason: string): Promise<void> {
    await this.flagOrBlockDevice(deviceId, reason, 'BLOCKED');
  }

  /** Zmniejsz reputację (np. przy przekroczeniu limitu). Opcjonalny system reputacji. */
  async decreaseReputation(deviceId: string, penalty: number = REPUTATION_PENALTY_HOURLY_EXCEEDED): Promise<void> {
    await decreaseReputationScore(this.prisma, deviceId, penalty);
  }

  /** Pobierz aktualny wynik reputacji (domyślnie 100). */
  async getReputationScore(deviceId: string): Promise<number> {
    const row = await this.prisma.deviceReputation.findUnique({
      where: { deviceId },
      select: { score: true },
    });
    return row?.score ?? 100;
  }
}

/** Zmniejsz score w device_reputation. Opcjonalny system reputacji. */
export async function decreaseReputationScore(
  prisma: PrismaClient,
  deviceId: string,
  penalty: number,
): Promise<void> {
  const initialScore = REPUTATION_MAX_SCORE - penalty;
  const existing = await prisma.deviceReputation.findUnique({ where: { deviceId }, select: { score: true } });
  const newScore = Math.max(REPUTATION_MIN_SCORE, (existing?.score ?? REPUTATION_MAX_SCORE) - penalty);
  await prisma.deviceReputation.upsert({
    where: { deviceId },
    create: { deviceId, score: Math.max(REPUTATION_MIN_SCORE, initialScore), updatedAt: new Date() },
    update: { score: newScore, updatedAt: new Date() },
  });
}
