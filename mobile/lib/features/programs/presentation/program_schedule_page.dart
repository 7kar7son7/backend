import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/widgets/channel_logo.dart';
import '../../../shared/widgets/search_bar.dart';
import '../../events/application/events_notifier.dart';
import '../application/program_schedule_notifier.dart';
import '../application/program_schedule_state.dart';

class ProgramSchedulePage extends ConsumerStatefulWidget {
  const ProgramSchedulePage({super.key});

  static const routeName = 'schedule';

  @override
  ConsumerState<ProgramSchedulePage> createState() => _ProgramSchedulePageState();
}

class _ProgramSchedulePageState extends ConsumerState<ProgramSchedulePage> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    // Ładuj więcej gdy użytkownik jest 50% w dół - wcześniej i w tle
    if (_scrollController.hasClients && 
        _scrollController.position.pixels >= _scrollController.position.maxScrollExtent * 0.5) {
      final notifier = ref.read(programScheduleNotifierProvider.notifier);
      final currentState = ref.read(programScheduleNotifierProvider).value;
      // Ładuj tylko jeśli nie ładuje się już i są jeszcze programy do załadowania
      if (currentState != null && !currentState.isLoadingMore && currentState.hasMore) {
        notifier.loadMore();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(programScheduleNotifierProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FE),
      body: SafeArea(
        bottom: false,
        child: state.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) {
            String userFriendlyMessage = 'Nie udało się pobrać programu';
            
            // Sprawdź czy to DioException i wyciągnij statusCode
            if (error is DioException) {
              final statusCode = error.response?.statusCode;
              if (statusCode == 502 || statusCode == 503 || statusCode == 504) {
                userFriendlyMessage = 'Serwer jest tymczasowo niedostępny. Spróbuj ponownie za chwilę.';
              } else if (error.type == DioExceptionType.connectionTimeout ||
                         error.type == DioExceptionType.receiveTimeout ||
                         error.type == DioExceptionType.sendTimeout) {
                userFriendlyMessage = 'Przekroczono limit czasu połączenia. Sprawdź połączenie internetowe.';
              } else if (error.type == DioExceptionType.connectionError ||
                         error.type == DioExceptionType.unknown) {
                userFriendlyMessage = 'Brak połączenia z internetem. Sprawdź połączenie sieciowe.';
              } else if (statusCode != null) {
                userFriendlyMessage = 'Błąd serwera (kod $statusCode). Spróbuj ponownie za chwilę.';
              }
            } else {
              // Fallback dla innych typów błędów
              final errorStr = error.toString();
              if (errorStr.contains('502') || errorStr.contains('503') || errorStr.contains('504')) {
                userFriendlyMessage = 'Serwer jest tymczasowo niedostępny. Spróbuj ponownie za chwilę.';
              } else if (errorStr.contains('timeout') || errorStr.contains('Timeout')) {
                userFriendlyMessage = 'Przekroczono limit czasu połączenia. Sprawdź połączenie internetowe.';
              } else if (errorStr.contains('SocketException') || errorStr.contains('Network')) {
                userFriendlyMessage = 'Brak połączenia z internetem. Sprawdź połączenie sieciowe.';
              }
            }
            
            return _ErrorView(
              message: userFriendlyMessage,
              onRetry: () => ref
                  .read(programScheduleNotifierProvider.notifier)
                  .changeDay(DateTime.now()),
            );
          },
          data: (data) {
            final filteredPrograms = _filterPrograms(data.programs, _searchQuery);

            if (data.programs.isEmpty) {
              return const _EmptyScheduleView();
            }

            if (_searchQuery.isNotEmpty && filteredPrograms.isEmpty) {
              return _EmptySearchView(
                searchQuery: _searchQuery,
                onClear: () {
                  setState(() {
                    _searchQuery = '';
                    _searchController.clear();
                  });
                },
              );
            }

            return RefreshIndicator.adaptive(
              edgeOffset: 120,
              onRefresh: () => ref
                  .read(programScheduleNotifierProvider.notifier)
                  .changeDay(data.selectedDate),
              child: CustomScrollView(
                controller: _scrollController,
                physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                      child: _ScheduleHeader(
                        selectedDate: data.selectedDate,
                        onPickDate: () => _pickDate(context, ref),
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                      child: AppSearchBar(
                        hintText: 'Szukaj kanału lub programu...',
                        onChanged: (query) {
                          setState(() {
                            _searchQuery = query.toLowerCase();
                          });
                        },
                        onClear: _searchQuery.isNotEmpty
                            ? () {
                                setState(() {
                                  _searchQuery = '';
                                  _searchController.clear();
                                });
                              }
                            : null,
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          // Jeśli to ostatni element i są jeszcze programy do załadowania, pokaż subtelny loader
                          if (index == filteredPrograms.length) {
                            if (data.hasMore && !_searchQuery.isNotEmpty) {
                              // Automatycznie załaduj więcej w tle (tylko jeśli nie ma wyszukiwania)
                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                final notifier = ref.read(programScheduleNotifierProvider.notifier);
                                final currentState = ref.read(programScheduleNotifierProvider).value;
                                if (currentState != null && !currentState.isLoadingMore) {
                                  notifier.loadMore();
                                }
                              });
                              return const Padding(
                                padding: EdgeInsets.all(20),
                                child: Center(
                                  child: SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  ),
                                ),
                              );
                            }
                            return const SizedBox.shrink();
                          }
                          
                          if (index >= filteredPrograms.length) {
                            return const SizedBox.shrink();
                          }
                          
                          final entry = filteredPrograms[index];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 18),
                            child: _ProgramTile(
                              entry: entry,
                              onFollowToggle: () async {
                                final notifier = ref.read(programScheduleNotifierProvider.notifier);
                                try {
                                  await notifier.toggleFollowProgram(
                                    entry.program.id,
                                    !entry.isFollowed,
                                  );
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          !entry.isFollowed
                                              ? 'Zacząłeś śledzić program "${entry.program.title}"'
                                              : 'Przestałeś śledzić program "${entry.program.title}"',
                                        ),
                                        duration: const Duration(seconds: 2),
                                      ),
                                    );
                                  }
                                } catch (error) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          'Nie udało się ${!entry.isFollowed ? 'śledzić' : 'odśledzić'} programu: $error',
                                        ),
                                        backgroundColor: Theme.of(context).colorScheme.error,
                                        duration: const Duration(seconds: 3),
                                      ),
                                    );
                                  }
                                }
                              },
                              onCreateEvent: () => _showCreateEventDialog(
                                context: context,
                                onConfirm: () async {
                                  final notifier = ref.read(eventsNotifierProvider.notifier);
                                  await notifier.createEvent(entry.program.id);
                                },
                              ),
                            ),
                          );
                        },
                        childCount: filteredPrograms.length + (data.hasMore && !_searchQuery.isNotEmpty ? 1 : 0),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Future<void> _pickDate(BuildContext context, WidgetRef ref) async {
    final current = ref.read(programScheduleNotifierProvider).value;
    final now = DateTime.now();
    final initialDate = current?.selectedDate ?? DateTime(now.year, now.month, now.day);

    final result = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: initialDate.subtract(const Duration(days: 7)),
      lastDate: initialDate.add(const Duration(days: 14)),
      locale: const Locale('pl'),
    );

    if (result != null) {
      await ref.read(programScheduleNotifierProvider.notifier).changeDay(result);
    }
  }

  List<ScheduledProgram> _filterPrograms(List<ScheduledProgram> programs, String query) {
    if (query.isEmpty) {
      return programs;
    }

    return programs.where((entry) {
      final channelNameMatch = entry.channelName.toLowerCase().contains(query);
      final programTitleMatch = entry.program.title.toLowerCase().contains(query);
      final programDescriptionMatch = entry.program.description
              ?.toLowerCase()
              .contains(query) ??
          false;
      return channelNameMatch || programTitleMatch || programDescriptionMatch;
    }).toList();
  }
}

class _ScheduleHeader extends StatelessWidget {
  const _ScheduleHeader({
    required this.selectedDate,
    required this.onPickDate,
  });

  final DateTime selectedDate;
  final VoidCallback onPickDate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final now = DateTime.now();
    final isToday = _isSameDay(selectedDate, now);
    final subtitle = DateFormat('EEEE, d MMMM', 'pl_PL').format(selectedDate).capitalize();

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFDC2626), Color(0xFFEF4444)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFDC2626).withOpacity(0.25),
            blurRadius: 28,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Program TV',
            style: theme.textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isToday ? 'Dzisiaj • $subtitle' : subtitle,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withOpacity(0.78),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: onPickDate,
            icon: const Icon(Icons.calendar_today_rounded, size: 20),
            label: const Text('Wybierz dzień'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: BorderSide(color: Colors.white.withOpacity(0.55)),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              textStyle: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }
}

class _ProgramTile extends StatelessWidget {
  const _ProgramTile({
    required this.entry,
    required this.onFollowToggle,
    required this.onCreateEvent,
  });

  final ScheduledProgram entry;
  final VoidCallback onFollowToggle;
  final Future<void> Function() onCreateEvent;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final timeLabel = _formatTimeRange(entry.program.startsAt, entry.program.endsAt);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ChannelLogo(
                name: entry.channelName,
                logoUrl: entry.channelLogoUrl,
                size: 52,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.channelName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF1C1F2E),
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      timeLabel,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: const Color(0xFF6C738A),
                          ),
                    ),
                  ],
                ),
              ),
              FilledButton(
                onPressed: onFollowToggle,
                style: FilledButton.styleFrom(
                  backgroundColor: entry.isFollowed
                      ? colorScheme.primary
                      : colorScheme.primary.withOpacity(0.12),
                  foregroundColor: entry.isFollowed ? Colors.white : colorScheme.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                ),
                child: Text(entry.isFollowed ? 'Śledzisz' : 'Śledź'),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            entry.program.title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF1C1F2E),
                ),
          ),
          if (entry.program.description != null && entry.program.description!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              entry.program.description!,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF50566F),
                    height: 1.4,
                  ),
            ),
          ],
          if (entry.program.tags.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: entry.program.tags
                  .map(
                    (tag) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE9EEFF),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        tag,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: const Color(0xFF4E5A89),
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: onCreateEvent,
            icon: const Icon(Icons.stop_circle),
            label: const Text('KONIEC REKLAM'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              minimumSize: const Size(double.infinity, 0),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTimeRange(DateTime start, DateTime? end) {
    final formatter = DateFormat.Hm();
    // Backend zwraca daty w UTC, konwertuj na lokalny czas urządzenia
    final startStr = formatter.format(start.toLocal());
    final endStr = end != null ? formatter.format(end.toLocal()) : '';
    return end != null ? '$startStr – $endStr' : startStr;
  }
}

class _EmptyScheduleView extends StatelessWidget {
  const _EmptyScheduleView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.event_busy, size: 48),
          const SizedBox(height: 16),
          Text(
            'Brak programu na wybrany dzień',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Spróbuj wybrać inny dzień lub odświeżyć listę.',
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

class _EmptySearchView extends StatelessWidget {
  const _EmptySearchView({
    required this.searchQuery,
    required this.onClear,
  });

  final String searchQuery;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.search_off_rounded, size: 48, color: Color(0xFF6C738A)),
            const SizedBox(height: 12),
            Text(
              'Nie znaleziono wyników',
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Brak kanałów lub programów pasujących do "$searchQuery"',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onClear,
              icon: const Icon(Icons.clear_rounded),
              label: const Text('Wyczyść wyszukiwanie'),
              style: FilledButton.styleFrom(
                backgroundColor: theme.colorScheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48),
            const SizedBox(height: 12),
            Text(
              message,
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Spróbuj ponownie za chwilę lub sprawdź połączenie internetowe.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onRetry,
              child: const Text('Spróbuj ponownie'),
            ),
          ],
        ),
      ),
    );
  }
}

extension on String {
  String capitalize() {
    if (isEmpty) {
      return this;
    }
    return this[0].toUpperCase() + substring(1);
  }
}

Future<void> _showCreateEventDialog({
  required BuildContext context,
  required Future<void> Function() onConfirm,
}) async {
  final theme = Theme.of(context);
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) {
      return AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(
          'KONIEC REKLAM?',
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Powiadomimy obserwujących, że reklamy się skończyły. Czy na pewno chcesz wysłać zgłoszenie?',
          style: theme.textTheme.bodyMedium,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Anuluj'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Wyślij'),
          ),
        ],
      );
    },
  );

  if (confirmed == true) {
    try {
      await onConfirm();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Zgłoszenie "KONIEC REKLAM" wysłane do obserwujących.')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Nie udało się zgłosić wydarzenia: $error')),
        );
      }
    }
  }
}
