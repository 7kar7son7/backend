import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/config/app_router.dart';
import '../../../core/storage/device_id_provider.dart';
import '../../../shared/widgets/channel_logo.dart';
import '../../../shared/widgets/search_bar.dart';
import '../../events/application/events_notifier.dart';
import '../../events/data/event_dto.dart';
import '../../favorites/application/favorites_provider.dart';
import '../../points/application/points_providers.dart';
import '../../programs/data/program_api.dart';
import '../../programs/data/program_dto.dart';
import '../application/channels_notifier.dart';
import '../data/channel_api.dart';
import '../data/channel_dto.dart';

class ChannelsPage extends ConsumerStatefulWidget {
  const ChannelsPage({super.key});

  static const routeName = 'channels';

  @override
  ConsumerState<ChannelsPage> createState() => _ChannelsPageState();
}

class _ChannelsPageState extends ConsumerState<ChannelsPage> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  String _searchQuery = '';
  String? _dismissedEventId; // ID wydarzenia, które zostało odłożone
  List<ProgramDto> _searchPrograms = [];
  List<ChannelDto> _searchChannels = [];
  bool _isSearchingPrograms = false;
  bool _isSearchingChannels = false;
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent * 0.8) {
      // Załaduj więcej gdy użytkownik jest 80% w dół
      final notifier = ref.read(channelsNotifierProvider.notifier);
      notifier.loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(channelsNotifierProvider);

    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        bottom: false,
        child: state.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => _ErrorView(
            message: error.toString(),
            onRetry: () => ref.read(channelsNotifierProvider.notifier).refresh(),
          ),
          data: (viewState) {
            final filteredChannels = _filterChannels(viewState.channels, _searchQuery);

            if (viewState.channels.isEmpty) {
              return const _EmptyView();
            }

            // Wyniki wyszukiwania będą pokazane pod wyszukiwarką w głównym widoku

            // Zbuduj listę slivers dynamicznie
            final slivers = <Widget>[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                  child: _TimeLineBar(),
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
                      
                      // Anuluj poprzednie wyszukiwanie
                      _searchDebounce?.cancel();
                      
                      if (query.length >= 3) {
                        // Użyj debounce - wyszukaj po 500ms od ostatniego znaku
                        _searchDebounce = Timer(const Duration(milliseconds: 500), () {
                          if (mounted) {
                            _performSearch(query);
                          }
                        });
                      } else {
                        // Wyczyść wyniki jeśli mniej niż 3 znaki
                        setState(() {
                          _searchPrograms = [];
                          _searchChannels = [];
                          _isSearchingPrograms = false;
                          _isSearchingChannels = false;
                        });
                      }
                    },
                    onClear: _searchQuery.isNotEmpty
                        ? () {
                            _searchDebounce?.cancel();
                            setState(() {
                              _searchQuery = '';
                              _searchPrograms = [];
                              _searchChannels = [];
                              _isSearchingPrograms = false;
                              _isSearchingChannels = false;
                              _searchController.clear();
                            });
                          }
                        : null,
                  ),
                ),
              ),
            ];
            
            // Dodaj wyniki wyszukiwania lub normalną listę kanałów
            if (_searchQuery.isNotEmpty && _searchQuery.length >= 3) {
              slivers.addAll(_buildSearchResultsSlivers(context, theme, ref));
            } else {
              slivers.add(
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        // Jeśli to ostatni element i ładujemy więcej, pokaż loader
                        if (index == filteredChannels.length && viewState.isLoadingMore) {
                          return const Padding(
                            padding: EdgeInsets.all(20),
                            child: Center(child: CircularProgressIndicator()),
                          );
                        }
                        
                        if (index >= filteredChannels.length) {
                          return const SizedBox.shrink();
                        }
                        
                        final channel = filteredChannels[index];
                        final isFavorite = ref.watch(favoritesProvider).contains(channel.id);
                        final shouldShowEventBanner = (index + 1) % 5 == 0 && _searchQuery.isEmpty;
                        final shouldShowAdSlot = (index + 1) % 4 == 0 && _searchQuery.isEmpty;

                        return Column(
                          children: [
                            _ChannelCard(
                              channel: channel,
                              isFavorite: isFavorite,
                              onTap: () {
                                final router = ref.read(appRouterProvider);
                                router.push('/channels/${channel.id}/programs');
                              },
                              onFavoriteToggle: () async {
                                try {
                                  await ref.read(favoritesProvider.notifier).toggleFavorite(channel.id);
                                } catch (e) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(e.toString())),
                                    );
                                  }
                                }
                              },
                            ),
                            if (shouldShowEventBanner)
                              Builder(
                                builder: (context) {
                                  final deviceId = ref.watch(deviceIdProvider);
                                  final eventsState = ref.watch(eventsNotifierProvider);
                                  final pendingEvent = eventsState.maybeWhen(
                                    data: (events) {
                                      if (deviceId == null) return null;
                                      final now = DateTime.now();
                                      for (final event in events) {
                                        if (event.id == _dismissedEventId) continue;
                                        if (event.status != EventStatusDto.PENDING) continue;
                                        if (event.expiresAt != null && event.expiresAt!.isBefore(now)) continue;
                                        final hasConfirmed = event.confirmations.any(
                                          (conf) => conf.deviceId == deviceId,
                                        );
                                        if (!hasConfirmed) {
                                          return event;
                                        }
                                      }
                                      return null;
                                    },
                                    orElse: () => null,
                                  );

                                  if (pendingEvent != null) {
                                    return Column(
                                      children: [
                                        const SizedBox(height: 12),
                                        _EventBanner(
                                          event: pendingEvent,
                                          onConfirm: (choice) async {
                                            final notifier = ref.read(eventsNotifierProvider.notifier);
                                            try {
                                              await notifier.confirmEvent(pendingEvent.id, choice);
                                              ref.invalidate(pointsSummaryProvider);
                                              if (mounted) {
                                                ScaffoldMessenger.of(context).showSnackBar(
                                                  SnackBar(
                                                    content: Text(choice == EventChoiceDto.OPTION1
                                                        ? 'Dziękujemy za potwierdzenie końca reklam!'
                                                        : 'Zgłoszenie oznaczone jako niepotwierdzone.'),
                                                  ),
                                                );
                                              }
                                            } catch (error) {
                                              if (mounted) {
                                                ScaffoldMessenger.of(context).showSnackBar(
                                                  SnackBar(
                                                    content: Text('Nie udało się wysłać potwierdzenia: $error'),
                                                  ),
                                                );
                                              }
                                            }
                                          },
                                          onDismiss: () {
                                            setState(() {
                                              _dismissedEventId = pendingEvent.id;
                                            });
                                          },
                                        ),
                                      ],
                                    );
                                  }
                                  return const SizedBox.shrink();
                                },
                              ),
                            if (shouldShowAdSlot) const _ChannelAdSlot(),
                            const SizedBox(height: 6),
                          ],
                        );
                      },
                      childCount: filteredChannels.length + (viewState.isLoadingMore ? 1 : 0),
                    ),
                  ),
                ),
              );
            }

            return RefreshIndicator.adaptive(
              onRefresh: () => ref.read(channelsNotifierProvider.notifier).refresh(),
              edgeOffset: 120,
              child: CustomScrollView(
                controller: _scrollController,
                physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                slivers: slivers,
              ),
            );
          },
        ),
      ),
    );
  }

  // Helper method to build search results slivers
  List<Widget> _buildSearchResultsSlivers(BuildContext context, ThemeData theme, WidgetRef ref) {
    final slivers = <Widget>[];
    
    if (_isSearchingPrograms || _isSearchingChannels) {
      slivers.add(
        const SliverFillRemaining(
          child: Center(child: CircularProgressIndicator()),
        ),
      );
      return slivers;
    }
    
    if (_searchPrograms.isEmpty && _searchChannels.isEmpty) {
      slivers.add(
        const SliverFillRemaining(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.search_off_rounded, size: 48, color: Colors.grey),
                SizedBox(height: 12),
                Text(
                  'Nie znaleziono wyników',
                  style: TextStyle(fontSize: 16),
                ),
              ],
            ),
          ),
        ),
      );
      return slivers;
    }
    
    // Channels
    if (_searchChannels.isNotEmpty) {
      slivers.addAll([
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          sliver: SliverToBoxAdapter(
            child: Text(
              'Kanały (${_searchChannels.length})',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                if (index >= _searchChannels.length) {
                  return const SizedBox.shrink();
                }
                final channel = _searchChannels[index];
                final isFavorite = ref.watch(favoritesProvider).contains(channel.id);
                
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _ChannelCard(
                    channel: channel,
                    isFavorite: isFavorite,
                    onTap: () {
                      final router = ref.read(appRouterProvider);
                      router.push('/channels/${channel.id}/programs');
                    },
                    onFavoriteToggle: () async {
                      try {
                        await ref.read(favoritesProvider.notifier).toggleFavorite(channel.id);
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(e.toString())),
                          );
                        }
                      }
                    },
                  ),
                );
              },
              childCount: _searchChannels.length,
            ),
          ),
        ),
      ]);
    }
    
    // Programs
    if (_searchPrograms.isNotEmpty) {
      slivers.addAll([
        SliverPadding(
          padding: EdgeInsets.fromLTRB(20, _searchChannels.isNotEmpty ? 24.0 : 12.0, 20, 0),
          sliver: SliverToBoxAdapter(
            child: Text(
              'Programy (${_searchPrograms.length})',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                if (index >= _searchPrograms.length) {
                  return const SizedBox.shrink();
                }
                final program = _searchPrograms[index];
                final now = DateTime.now();
                final isCurrent = program.startsAt.isBefore(now) &&
                    (program.endsAt?.isAfter(now) ?? program.startsAt.add(const Duration(hours: 1)).isAfter(now));

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: ChannelLogo(
                      name: program.channelName,
                      logoUrl: program.channelLogoUrl,
                      size: 40,
                    ),
                    title: Text(program.title),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(program.channelName),
                        const SizedBox(height: 4),
                        Text(
                          DateFormat('EEEE, d MMMM yyyy, HH:mm', 'pl_PL').format(program.startsAt),
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                    trailing: isCurrent
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDC2626),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text(
                              'TERAZ',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          )
                        : null,
                    onTap: () {
                      final router = ref.read(appRouterProvider);
                      router.push('/programs/${program.id}');
                    },
                  ),
                );
              },
              childCount: _searchPrograms.length,
            ),
          ),
        ),
      ]);
    }
    
    return slivers;
  }

  Future<void> _performSearch(String query) async {
    if (query.length < 3) {
      setState(() {
        _searchPrograms = [];
        _searchChannels = [];
        _isSearchingPrograms = false;
        _isSearchingChannels = false;
      });
      return;
    }

    setState(() {
      _isSearchingPrograms = true;
      _isSearchingChannels = true;
    });

    // Wyszukuj programy i kanały równolegle
    await Future.wait([
      _searchProgramsByTitle(query),
      _searchChannelsByName(query),
    ]);
  }

  Future<void> _searchProgramsByTitle(String query) async {
    try {
      final programApi = ref.read(programApiProvider);
      final response = await programApi.searchPrograms(query, limit: 50);
      if (mounted) {
        setState(() {
          _searchPrograms = response.data;
          _isSearchingPrograms = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _searchPrograms = [];
          _isSearchingPrograms = false;
        });
      }
    }
  }

  Future<void> _searchChannelsByName(String query) async {
    try {
      final channelApi = ref.read(channelApiProvider);
      final response = await channelApi.getChannels(
        search: query,
        limit: 50,
      );
      if (mounted) {
        setState(() {
          _searchChannels = response.data;
          _isSearchingChannels = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _searchChannels = [];
          _isSearchingChannels = false;
        });
      }
    }
  }

  List<ChannelDto> _filterChannels(List<ChannelDto> channels, String query) {
    if (query.isEmpty) {
      return channels;
    }

    return channels.where((channel) {
      final channelNameMatch = channel.name.toLowerCase().contains(query);
      final programMatch = channel.programs.any(
        (program) => program.title.toLowerCase().contains(query),
      );
      return channelNameMatch || programMatch;
    }).toList();
  }
}

class _BrandBadge extends StatelessWidget {
  const _BrandBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.18),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.35)),
      ),
      child: Image.asset(
        'assets/logo/logo.png',
        width: 40,
        height: 40,
        fit: BoxFit.contain,
      ),
    );
  }
}

class _ChannelCard extends StatelessWidget {
  const _ChannelCard({
    required this.channel,
    required this.onTap,
    required this.isFavorite,
    required this.onFavoriteToggle,
  });

  final ChannelDto channel;
  final VoidCallback onTap;
  final bool isFavorite;
  final VoidCallback onFavoriteToggle;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final currentProgram = _findCurrentProgram(channel.programs);
    final upcomingPrograms = _findUpcomingPrograms(channel.programs);
    final programDisplay = [
      if (currentProgram != null) currentProgram,
      ...upcomingPrograms,
    ];

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Logo kanału z boku (jak w Telemagazynie)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: ChannelLogo(name: channel.name, logoUrl: channel.logoUrl, size: 32),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          channel.name,
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: colorScheme.onSurface,
                                fontSize: 14,
                              ),
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          isFavorite ? Icons.favorite : Icons.favorite_border,
                          color: isFavorite
                              ? Colors.red
                              : colorScheme.onSurface.withOpacity(0.6),
                          size: 18,
                        ),
                        onPressed: onFavoriteToggle,
                        tooltip:
                            isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych',
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  if (programDisplay.isNotEmpty)
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        for (var i = 0; i < programDisplay.length; i++) ...[
                          _ProgramRow(
                            program: programDisplay[i],
                            isCurrent: currentProgram != null && i == 0,
                          ),
                          if (i < programDisplay.length - 1)
                            const SizedBox(height: 2),
                        ],
                      ],
                    )
                  else
                    Text(
                      'Brak zaplanowanych audycji',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurface.withOpacity(0.6),
                            fontSize: 11,
                          ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  ProgramDto? _findCurrentProgram(List<ProgramDto> programs) {
    final now = DateTime.now();
    for (final program in programs) {
      final startsAt = program.startsAt;
      final endsAt = program.endsAt ?? startsAt.add(const Duration(hours: 1));
      if (!startsAt.isAfter(now) && endsAt.isAfter(now)) {
        return program;
      }
    }
    return null;
  }

  List<ProgramDto> _findUpcomingPrograms(List<ProgramDto> programs) {
    final now = DateTime.now();
    final upcoming = programs
        .where((program) => program.startsAt.isAfter(now))
        .toList()
      ..sort((a, b) => a.startsAt.compareTo(b.startsAt));
    // Pokaż tylko 2 kolejne programy (bieżący + 2 następne = 3 programy łącznie)
    return upcoming.take(2).toList();
  }
}

class _ProgramRow extends StatelessWidget {
  const _ProgramRow({
    required this.program,
    this.isCurrent = false,
  });

  final ProgramDto program;
  final bool isCurrent;

  @override
  Widget build(BuildContext context) {
    final time = DateFormat.Hm().format(program.startsAt);
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 44,
          child: Text(
            time,
            style: theme.textTheme.bodySmall?.copyWith(
                  color: isCurrent
                      ? theme.colorScheme.primary
                      : theme.colorScheme.onSurface,
                  fontWeight: FontWeight.w600,
                  fontSize: 11,
                ),
          ),
        ),
        Expanded(
          child: Text(
            program.title,
            style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurface.withOpacity(0.8),
                  height: 1.2,
                  fontSize: 11,
                ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _TimeLineBar extends StatelessWidget {
  const _TimeLineBar();

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final theme = Theme.of(context);
    
    // Generuj godziny dla linii czasu
    final hours = <String>[];
    final currentHour = now.hour;
    
    // Dodaj "TERAZ" na początku
    hours.add('TERAZ');
    
    // Dodaj godziny od aktualnej +1 do +6
    for (int i = 1; i <= 6; i++) {
      final hour = (currentHour + i) % 24;
      hours.add('${hour.toString().padLeft(2, '0')}:00');
    }
    
    // Dodaj "DZIŚ" na końcu
    hours.add('DZIŚ');
    
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: hours.length,
        itemBuilder: (context, index) {
          final hour = hours[index];
          final isNow = hour == 'TERAZ';
          final isToday = hour == 'DZIŚ';
          
          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isNow 
                  ? theme.colorScheme.primary.withOpacity(0.1)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              hour,
              style: theme.textTheme.bodySmall?.copyWith(
                color: isNow 
                    ? theme.colorScheme.primary
                    : theme.colorScheme.onSurface.withOpacity(0.7),
                fontWeight: isNow || isToday ? FontWeight.w600 : FontWeight.normal,
                fontSize: 12,
              ),
            ),
          );
        },
      ),
    );
  }
}

class _EventBanner extends ConsumerWidget {
  const _EventBanner({
    required this.event,
    required this.onConfirm,
    required this.onDismiss,
  });

  final EventDto event;
  final Future<void> Function(EventChoiceDto) onConfirm;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        color: theme.cardColor,
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
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'KONIEC REKLAM',
              style: theme.textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: theme.colorScheme.onSurface.withOpacity(0.7),
                  ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Czy reklamy się skończyły?',
            style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: theme.colorScheme.onSurface,
                ),
          ),
          if (event.program.title.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              event.program.title,
              style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurface.withOpacity(0.6),
                  ),
            ),
          ],
          const SizedBox(height: 14),
          // Banery reklamowe (2-3 banery, redukcja do 1 po 100 pkt)
          Builder(
            builder: (context) {
              final pointsSummaryAsync = ref.watch(pointsSummaryProvider);
              final totalPoints = pointsSummaryAsync.valueOrNull?.totalPoints ?? 0;
              final adCount = totalPoints >= 100 ? 1 : 3; // Redukcja do 1 banera po 100 pkt
              
              return Column(
                children: [
                  ...List.generate(adCount, (index) {
                    return Padding(
                      padding: EdgeInsets.only(bottom: index < adCount - 1 ? 8 : 0),
                      child: Container(
                        width: double.infinity,
                        height: 80,
                        decoration: BoxDecoration(
                          color: theme.colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: theme.colorScheme.outline.withOpacity(0.2),
                            width: 1,
                          ),
                        ),
                        child: Center(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.ads_click,
                                size: 20,
                                color: theme.colorScheme.onSurface.withOpacity(0.4),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Reklama',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: theme.colorScheme.onSurface.withOpacity(0.4),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 14),
                ],
              );
            },
          ),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: () async {
                    await onConfirm(EventChoiceDto.OPTION1);
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.primary,
                    foregroundColor: theme.colorScheme.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('TAK'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () async {
                    await onConfirm(EventChoiceDto.OPTION2);
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.primary,
                    foregroundColor: theme.colorScheme.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('NIE'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextButton(
            onPressed: onDismiss,
            child: const Text('Odłóż na chwilę'),
          ),
        ],
      ),
    );
  }
}

class _ChannelAdSlot extends StatelessWidget {
  const _ChannelAdSlot();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.only(top: 10),
      width: double.infinity,
      height: 90,
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceVariant,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: theme.colorScheme.outline.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Center(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.campaign,
              size: 20,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 8),
            Text(
              'Miejsce na reklamę',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.onSurfaceVariant,
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
              'Nie udało się pobrać kanałów',
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.error,
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

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.live_tv, size: 48),
            const SizedBox(height: 12),
            Text(
              'Brak kanałów w katalogu',
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Wróć później lub spróbuj odświeżyć listę.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
