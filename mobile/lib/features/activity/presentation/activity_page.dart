import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../events/application/events_notifier.dart';
import '../../events/data/event_dto.dart';
import '../../points/application/points_providers.dart';
import '../../points/data/point_summary_dto.dart';

class ActivityPage extends ConsumerWidget {
  const ActivityPage({super.key});

  static const routeName = 'activity';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(pointsSummaryProvider);
    final eventsAsync = ref.watch(eventsNotifierProvider);

    final isLoading = summaryAsync.isLoading || eventsAsync.isLoading;
    if (isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (summaryAsync.hasError) {
      return _ErrorScaffold(
        message: summaryAsync.error.toString(),
        onRetry: () => ref.refresh(pointsSummaryProvider.future),
      );
    }

    if (eventsAsync.hasError) {
      return _ErrorScaffold(
        message: eventsAsync.error.toString(),
        onRetry: () => ref.invalidate(eventsNotifierProvider),
      );
    }

    final summary = summaryAsync.value;
    final events = eventsAsync.value ?? const <EventDto>[];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Aktywność i punkty'),
        actions: [
          IconButton(
            onPressed: () {
              ref.invalidate(pointsSummaryProvider);
              ref.invalidate(eventsNotifierProvider);
            },
            icon: const Icon(Icons.refresh),
            tooltip: 'Odśwież dane',
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 120),
        children: [
          _ActiveEventsSection(events: events),
          const SizedBox(height: 24),
          _PointsSection(summary: summary),
        ],
      ),
    );
  }
}

class _ActiveEventsSection extends ConsumerWidget {
  const _ActiveEventsSection({required this.events});

  final List<EventDto> events;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (events.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 22,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: const Color(0xFFDC2626).withOpacity(0.15),
              child: const Icon(Icons.notifications_active_rounded, color: Color(0xFFDC2626)),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                'Nie ma aktualnych wydarzeń do potwierdzenia. Gdy społeczność coś zgłosi, pojawi się tutaj.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF4E5A89),
                    ),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Aktywne wydarzenia',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 16),
        ...events.map(
          (event) => Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _EventCard(event: event),
          ),
        ),
      ],
    );
  }
}

class _EventCard extends ConsumerWidget {
  const _EventCard({required this.event});

  final EventDto event;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final notifier = ref.read(eventsNotifierProvider.notifier);

    final startTime = DateFormat.Hm().format(event.program.startsAt.toLocal());
    final channel = event.program.channelName;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFE9EEFF),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  '$channel • $startTime',
                  style: theme.textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF4E5A89),
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              const Spacer(),
              Text(
                _statusLabel(event.status),
                style: theme.textTheme.labelSmall?.copyWith(
                      color: _statusColor(context, event.status),
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            event.program.title,
            style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF1C1F2E),
                ),
          ),
          if (event.program.description != null && event.program.description!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              event.program.description!,
              style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF50566F),
                  ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () => _showConfirmEventDialog(
              context: context,
              title: event.program.title,
              onChoice: (choice) async {
                try {
                  await notifier.confirmEvent(event.id, choice);
                  ref.invalidate(pointsSummaryProvider);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(choice == EventChoiceDto.OPTION1
                            ? 'Dziękujemy za potwierdzenie!'
                            : 'Zgłoszenie oznaczone jako niepotwierdzone.'),
                      ),
                    );
                  }
                } catch (error) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Nie udało się wysłać potwierdzenia: $error'),
                      ),
                    );
                  }
                }
              },
            ),
            icon: const Icon(Icons.how_to_vote_rounded),
            label: const Text('Potwierdź wydarzenie'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ],
      ),
    );
  }

  Color _statusColor(BuildContext context, EventStatusDto status) {
    final colorScheme = Theme.of(context).colorScheme;
    switch (status) {
      case EventStatusDto.PENDING:
        return colorScheme.primary;
      case EventStatusDto.VALIDATED:
        return Colors.green.shade600;
      case EventStatusDto.CANCELLED:
      case EventStatusDto.EXPIRED:
        return colorScheme.error;
    }
  }

  String _statusLabel(EventStatusDto status) {
    switch (status) {
      case EventStatusDto.PENDING:
        return 'Oczekuje';
      case EventStatusDto.VALIDATED:
        return 'Potwierdzone';
      case EventStatusDto.CANCELLED:
        return 'Anulowane';
      case EventStatusDto.EXPIRED:
        return 'Wygasło';
    }
  }
}

class _PointsSection extends StatelessWidget {
  const _PointsSection({required this.summary});

  final PointSummaryDto? summary;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Punkty i aktywność',
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 16),
        if (summary == null)
          const _EmptyPointsView()
        else ...[
          _PointsSummaryCard(
            colorScheme: colorScheme,
            totalPoints: summary!.totalPoints,
            streakLength: summary!.streakLength,
            lastActive: summary!.lastActive,
          ),
          const SizedBox(height: 20),
          Text(
            'Ostatnie aktywności',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          if (summary!.entries.isEmpty)
            const _NoEntries()
          else
            ...summary!.entries.map((entry) => _ActivityTile(entry: entry)),
        ],
      ],
    );
  }
}

class _PointsSummaryCard extends StatelessWidget {
  const _PointsSummaryCard({
    required this.colorScheme,
    required this.totalPoints,
    required this.streakLength,
    required this.lastActive,
  });

  final ColorScheme colorScheme;
  final int totalPoints;
  final int streakLength;
  final DateTime? lastActive;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lastActiveText = lastActive != null
        ? DateFormat.yMMMd().add_Hm().format(lastActive!.toLocal())
        : 'Brak danych';

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          colors: [
            colorScheme.primary.withOpacity(0.85),
            colorScheme.secondary.withOpacity(0.85),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: colorScheme.primary.withOpacity(0.25),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Łącznie zdobyte punkty',
            style: theme.textTheme.titleMedium?.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: 12),
          Text(
            '$totalPoints pkt',
            style: theme.textTheme.displaySmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              _BadgeChip(
                icon: Icons.local_fire_department,
                label: 'Aktualny streak: $streakLength dni',
              ),
              _BadgeChip(
                icon: Icons.access_time_rounded,
                label: 'Ostatnia aktywność: $lastActiveText',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BadgeChip extends StatelessWidget {
  const _BadgeChip({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Chip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      backgroundColor: Colors.white.withOpacity(0.18),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
      labelStyle: theme.textTheme.bodyMedium?.copyWith(
        color: Colors.white,
        fontWeight: FontWeight.w500,
      ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.entry});

  final PointEntryDto entry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: colorScheme.primary.withOpacity(0.18),
            child: Icon(_iconForReason(entry.reason), color: colorScheme.primary),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _reasonTitle(entry.reason),
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  entry.description ?? _reasonDescription(entry.reason),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  DateFormat.yMMMd().add_Hm().format(entry.createdAt.toLocal()),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '+${entry.points}',
            style: theme.textTheme.labelLarge?.copyWith(
              color: colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }

  IconData _iconForReason(PointReasonDto reason) {
    switch (reason) {
      case PointReasonDto.FAST_CONFIRM:
        return Icons.flash_on;
      case PointReasonDto.REMINDER_CONFIRM:
        return Icons.alarm_on;
      case PointReasonDto.DOUBLE_CONFIRM:
        return Icons.task_alt;
      case PointReasonDto.DAILY_STREAK:
        return Icons.calendar_today;
      case PointReasonDto.STREAK_BONUS:
        return Icons.emoji_events;
      case PointReasonDto.MANUAL_ADJUSTMENT:
        return Icons.build_circle;
    }
  }

  String _reasonTitle(PointReasonDto reason) {
    switch (reason) {
      case PointReasonDto.FAST_CONFIRM:
        return 'Szybka reakcja';
      case PointReasonDto.REMINDER_CONFIRM:
        return 'Potwierdzenie po przypomnieniu';
      case PointReasonDto.DOUBLE_CONFIRM:
        return 'Potwierdzenie wydarzenia';
      case PointReasonDto.DAILY_STREAK:
        return 'Dzienny bonus';
      case PointReasonDto.STREAK_BONUS:
        return 'Bonus za serię';
      case PointReasonDto.MANUAL_ADJUSTMENT:
        return 'Korekta ręczna';
    }
  }

  String _reasonDescription(PointReasonDto reason) {
    switch (reason) {
      case PointReasonDto.FAST_CONFIRM:
        return 'Potwierdzenie w mniej niż minutę.';
      case PointReasonDto.REMINDER_CONFIRM:
        return 'Potwierdzenie po przypomnieniu push.';
      case PointReasonDto.DOUBLE_CONFIRM:
        return 'Aktywność w trakcie wydarzenia.';
      case PointReasonDto.DAILY_STREAK:
        return 'Utrzymujesz aktywność dzień po dniu.';
      case PointReasonDto.STREAK_BONUS:
        return 'Nagroda za dłuższą serię potwierdzeń.';
      case PointReasonDto.MANUAL_ADJUSTMENT:
        return 'Punkty przyznane przez obsługę.';
    }
  }
}

class _NoEntries extends StatelessWidget {
  const _NoEntries();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Brak aktywności',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Gdy potwierdzisz wydarzenie, pojawi się ono na liście.',
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _EmptyPointsView extends StatelessWidget {
  const _EmptyPointsView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.workspace_premium_outlined, size: 48),
            const SizedBox(height: 12),
            Text(
              'Zacznij od potwierdzenia wydarzenia',
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Za każdą aktywność otrzymasz punkty, które pojawią się tutaj.',
              textAlign: TextAlign.center,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorScaffold extends StatelessWidget {
  const _ErrorScaffold({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Aktywność i punkty')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48),
              const SizedBox(height: 12),
              Text(
                'Nie udało się pobrać danych',
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: Theme.of(context).colorScheme.error),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: onRetry,
                child: const Text('Spróbuj ponownie'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _showConfirmEventDialog({
  required BuildContext context,
  required String title,
  required Future<void> Function(EventChoiceDto) onChoice,
}) async {
  final result = await showDialog<EventChoiceDto>(
    context: context,
    builder: (context) {
      return AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(
          'Czy wydarzenie trwa?',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Potwierdź proszę, czy audycja "$title" rzeczywiście się odbywa.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(EventChoiceDto.OPTION2),
            child: const Text('Nie / Fałszywy alarm'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(EventChoiceDto.OPTION1),
            child: const Text('Tak, dzieje się'),
          ),
        ],
      );
    },
  );

  if (result != null) {
    await onChoice(result);
  }
}
