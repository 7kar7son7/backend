import { PrismaClient } from '@prisma/client';

export type ProgramKind = 'serial' | 'movie';

export type AdBreakStatItem = {
  channelId: string | null;
  programKind: ProgramKind | 'any';
  minutes: number;
  sampleCount: number;
};

type PairRow = {
  channelId: string;
  episodeNumber: number | null;
  title: string;
  tags: string[] | null;
  startAt: Date;
  endAt: Date;
};

const DEFAULT_MINUTES = 4;
const MIN_SECONDS = 90;
const MAX_SECONDS = 25 * 60;
const CACHE_MS = 30 * 60 * 1000;
const MIN_SAMPLES_CHANNEL_KIND = 3;
const MIN_SAMPLES_CHANNEL = 5;
const MIN_SAMPLES_KIND = 8;

export function inferProgramKind(input: {
  episodeNumber?: number | null;
  title?: string | null;
  tags?: string[] | null;
}): ProgramKind {
  const title = (input.title ?? '').toLowerCase();
  const tags = (input.tags ?? []).map((t) => t.toLowerCase());
  const isSerial =
    input.episodeNumber != null ||
    title.includes('odc.') ||
    title.includes('odcinek') ||
    title.includes('serial') ||
    tags.some((t) => t.includes('serial') || t.includes('odcinek'));
  return isSerial ? 'serial' : 'movie';
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const a = sorted[mid] ?? 0;
  if (sorted.length % 2 === 0) {
    const b = sorted[mid - 1] ?? a;
    return Math.round((a + b) / 2);
  }
  return a;
}

function keyOf(channelId: string | null, kind: ProgramKind | 'any'): string {
  return `${channelId ?? ''}|${kind}`;
}

let singleton: AdBreakStatsService | null = null;

export function getAdBreakStatsService(prisma: PrismaClient): AdBreakStatsService {
  if (!singleton) singleton = new AdBreakStatsService(prisma);
  return singleton;
}

export class AdBreakStatsService {
  private items = new Map<string, AdBreakStatItem>();
  private expiresAt = 0;
  private refreshing: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaClient) {}

  async ensureFresh(): Promise<void> {
    if (this.expiresAt > Date.now()) return;
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.refresh()
      .catch(() => undefined)
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  async refresh(): Promise<void> {
    const rows = await this.prisma.$queryRaw<PairRow[]>`
      SELECT
        p."channelId" AS "channelId",
        p."episodeNumber" AS "episodeNumber",
        p.title AS title,
        p.tags AS tags,
        s."initiatedAt" AS "startAt",
        e."initiatedAt" AS "endAt"
      FROM events s
      JOIN programs p ON p.id = s."programId"
      JOIN LATERAL (
        SELECT e2."initiatedAt"
        FROM events e2
        WHERE e2."programId" = s."programId"
          AND e2."eventType"::text = 'AD_BREAK_END'
          AND e2."initiatedAt" > s."initiatedAt"
          AND e2."initiatedAt" < s."initiatedAt" + interval '30 minutes'
        ORDER BY e2."initiatedAt" ASC
        LIMIT 1
      ) e ON TRUE
      WHERE s."eventType"::text = 'AD_BREAK_START'
        AND s."initiatedAt" > NOW() - interval '120 days'
    `;

    const buckets = new Map<string, number[]>();
    const add = (channelId: string | null, kind: ProgramKind | 'any', seconds: number) => {
      const k = keyOf(channelId, kind);
      const list = buckets.get(k) ?? [];
      list.push(seconds);
      buckets.set(k, list);
    };

    for (const row of rows) {
      const seconds = (new Date(row.endAt).getTime() - new Date(row.startAt).getTime()) / 1000;
      if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) continue;
      const kind = inferProgramKind(row);
      add(row.channelId, kind, seconds);
      add(row.channelId, 'any', seconds);
      add(null, kind, seconds);
      add(null, 'any', seconds);
    }

    const next = new Map<string, AdBreakStatItem>();
    for (const [k, seconds] of buckets) {
      const parts = k.split('|');
      const channelIdRaw = parts[0] ?? '';
      const kind = (parts[1] ?? 'any') as ProgramKind | 'any';
      const channelId = channelIdRaw.length > 0 ? channelIdRaw : null;
      const programKind = kind;
      const minSamples =
        channelId && programKind !== 'any'
          ? MIN_SAMPLES_CHANNEL_KIND
          : channelId
            ? MIN_SAMPLES_CHANNEL
            : MIN_SAMPLES_KIND;
      if (seconds.length < minSamples) continue;
      next.set(k, {
        channelId,
        programKind,
        minutes: Math.max(2, Math.round(median(seconds) / 60)),
        sampleCount: seconds.length,
      });
    }

    this.items = next;
    this.expiresAt = Date.now() + CACHE_MS;
  }

  resolveMinutes(channelId: string | null | undefined, kind: ProgramKind): number {
    const hits = [
      channelId ? this.items.get(keyOf(channelId, kind)) : undefined,
      channelId ? this.items.get(keyOf(channelId, 'any')) : undefined,
      this.items.get(keyOf(null, kind)),
      this.items.get(keyOf(null, 'any')),
    ];
    return hits.find((h) => h != null)?.minutes ?? DEFAULT_MINUTES;
  }

  snapshot(): { defaultMinutes: number; generatedAt: string; items: AdBreakStatItem[] } {
    return {
      defaultMinutes: DEFAULT_MINUTES,
      generatedAt: new Date().toISOString(),
      items: [...this.items.values()],
    };
  }
}
