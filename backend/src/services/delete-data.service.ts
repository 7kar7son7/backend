import type { PrismaClient } from '@prisma/client';

/**
 * Usunięcie danych przy zakończeniu umowy (zgodność z RODO/umową).
 * scope 'user' = tylko dane użytkowników (bez EPG).
 * scope 'all' = dane użytkowników + dane EPG (channels, programs, program_notification_log).
 * Kolejność usuwania zgodna z kluczami obcymi.
 */
export async function deleteDataByScope(
  prisma: PrismaClient,
  scope: 'user' | 'all',
): Promise<{ deleted: Record<string, number> }> {
  const deleted: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    // ---- Dane użytkowników (w kolejności FK) ----
    const pointEntries = await tx.pointEntry.deleteMany({});
    deleted['point_entries'] = pointEntries.count;

    const reminderLogs = await tx.reminderLog.deleteMany({});
    deleted['reminder_log'] = reminderLogs.count;

    const eventConfirmations = await tx.eventConfirmation.deleteMany({});
    deleted['event_confirmations'] = eventConfirmations.count;

    const events = await tx.event.deleteMany({});
    deleted['events'] = events.count;

    const pointBalances = await tx.pointBalance.deleteMany({});
    deleted['point_balance'] = pointBalances.count;

    const followedItems = await tx.followedItem.deleteMany({});
    deleted['followed_items'] = followedItems.count;

    const deviceTokens = await tx.deviceToken.deleteMany({});
    deleted['device_tokens'] = deviceTokens.count;

    const blockedDevices = await tx.blockedDevice.deleteMany({});
    deleted['blocked_devices'] = blockedDevices.count;

    const deviceReputation = await tx.deviceReputation.deleteMany({});
    deleted['device_reputation'] = deviceReputation.count;

    if (scope !== 'all') {
      return;
    }

    // ---- Dane EPG ----
    const programNotificationLog = await tx.programNotificationLog.deleteMany({});
    deleted['program_notification_log'] = programNotificationLog.count;

    const programs = await tx.program.deleteMany({});
    deleted['programs'] = programs.count;

    const channels = await tx.channel.deleteMany({});
    deleted['channels'] = channels.count;
  });

  return { deleted };
}
