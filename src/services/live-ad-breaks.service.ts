import { PrismaClient } from '@prisma/client';

import { getAdBreakStatsService, inferProgramKind } from './ad-break-stats.service';

type LiveRow = {
  programId: string;
  channelId: string;
  startedAt: Date;
  episodeNumber: number | null;
  title: string;
  tags: string[] | null;
};

export type LiveAdBreakDto = {
  programId: string;
  channelId: string;
  startedAt: string;
  estimatedMinutes: number;
  estimatedEndsAt: string;
};

export async function listLiveAdBreaks(prisma: PrismaClient): Promise<LiveAdBreakDto[]> {
  const stats = getAdBreakStatsService(prisma);
  await stats.ensureFresh();

  const rows = await prisma.$queryRaw<LiveRow[]>`
    SELECT DISTINCT ON (s."programId")
      s."programId" AS "programId",
      p."channelId" AS "channelId",
      s."initiatedAt" AS "startedAt",
      p."episodeNumber" AS "episodeNumber",
      p.title AS title,
      p.tags AS tags
    FROM events s
    JOIN programs p ON p.id = s."programId"
    WHERE s."eventType"::text = 'AD_BREAK_START'
      AND s."initiatedAt" > NOW() - interval '40 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM events e
        WHERE e."programId" = s."programId"
          AND e."eventType"::text = 'AD_BREAK_END'
          AND e."initiatedAt" > s."initiatedAt"
      )
    ORDER BY s."programId", s."initiatedAt" DESC
  `;

  const now = Date.now();
  const result: LiveAdBreakDto[] = [];
  for (const row of rows) {
    const kind = inferProgramKind(row);
    const minutes = stats.resolveMinutes(row.channelId, kind);
    const startedAt = new Date(row.startedAt);
    const endsAt = new Date(startedAt.getTime() + minutes * 60 * 1000);
    if (endsAt.getTime() <= now) continue;
    result.push({
      programId: row.programId,
      channelId: row.channelId,
      startedAt: startedAt.toISOString(),
      estimatedMinutes: minutes,
      estimatedEndsAt: endsAt.toISOString(),
    });
  }
  return result;
}
