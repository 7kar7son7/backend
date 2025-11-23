import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../shared/widgets/channel_logo.dart';
import '../../../shared/widgets/search_bar.dart';
import '../../programs/data/program_dto.dart';
import '../../programs/presentation/program_schedule_page.dart';
import '../application/channels_notifier.dart';
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
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent * 0.8) {
      // Załaduj więcej gdy użytkownik jest 80% w dół
      final notifier = ref.read(channelsNotifierProvider.notifier);
      notifier.loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(channelsNotifierProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FE),
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

            if (_searchQuery.isNotEmpty && filteredChannels.isEmpty) {
              return _EmptySearchView(searchQuery: _searchQuery);
            }

            return RefreshIndicator.adaptive(
              onRefresh: () => ref.read(channelsNotifierProvider.notifier).refresh(),
              edgeOffset: 120,
              child: CustomScrollView(
                controller: _scrollController,
                physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                      child: _ChannelsHeader(
                        onCalendarTap: () => context.pushNamed(ProgramSchedulePage.routeName),
                        onTodayTap: () => ref.read(channelsNotifierProvider.notifier).refresh(),
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
                          final isFollowed = viewState.followedChannelIds.contains(channel.id);
                          final showAd = (index + 1) % 5 == 0 && _searchQuery.isEmpty;

                          return Column(
                            children: [
                              _ChannelCard(
                                channel: channel,
                                isFollowed: isFollowed,
                                onFollowToggle: () {
                                  final notifier = ref.read(channelsNotifierProvider.notifier);
                                  if (isFollowed) {
                                    notifier.unfollowChannel(channel.id);
                                  } else {
                                    notifier.followChannel(channel.id);
                                  }
                                },
                              ),
                              if (showAd) ...const [
                                SizedBox(height: 12),
                                _AdBanner(),
                              ],
                              const SizedBox(height: 18),
                            ],
                          );
                        },
                        childCount: filteredChannels.length + (viewState.isLoadingMore ? 1 : 0),
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

class _ChannelsHeader extends StatelessWidget {
  const _ChannelsHeader({
    required this.onCalendarTap,
    required this.onTodayTap,
  });

  final VoidCallback onCalendarTap;
  final VoidCallback onTodayTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

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
          Row(
            children: [
              const _BrandBadge(),
              const SizedBox(width: 14),
              Text(
                'PTV',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              const Spacer(),
              FilledButton.tonal(
                onPressed: onTodayTap,
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white.withOpacity(0.18),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  textStyle: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
                ),
                child: const Text('Dzisiaj'),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: onCalendarTap,
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: BorderSide(color: Colors.white.withOpacity(0.55)),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  textStyle: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
                ),
                child: const Text('+3 dni'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            'Aktualny program telewizyjny',
            style: theme.textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Automatycznie odświeżany codziennie nad ranem.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withOpacity(0.78),
            ),
          ),
        ],
      ),
    );
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
    required this.isFollowed,
    required this.onFollowToggle,
  });

  final ChannelDto channel;
  final bool isFollowed;
  final VoidCallback onFollowToggle;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final currentProgram = _findCurrentProgram(channel.programs);
    final upcomingPrograms = _findUpcomingPrograms(channel.programs);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 24,
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
              ChannelLogo(name: channel.name, logoUrl: channel.logoUrl),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      channel.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF1C1F2E),
                          ),
                    ),
                    if (channel.category != null && channel.category!.trim().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          channel.category!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: const Color(0xFF6C738A),
                              ),
                        ),
                      ),
                  ],
                ),
              ),
              FilledButton(
                onPressed: onFollowToggle,
                style: FilledButton.styleFrom(
                  backgroundColor: isFollowed
                      ? colorScheme.primary
                      : colorScheme.primary.withOpacity(0.12),
                  foregroundColor: isFollowed ? Colors.white : colorScheme.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                ),
                child: Text(isFollowed ? 'Śledzisz' : 'Śledź'),
              ),
            ],
          ),
          const SizedBox(height: 18),
          if (upcomingPrograms.isNotEmpty)
            Column(
              children: [
                for (final program in upcomingPrograms) ...[
                  _ProgramRow(program: program),
                  const SizedBox(height: 10),
                ],
              ],
            )
          else
            Text(
              'Brak zaplanowanych audycji',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF6C738A),
                  ),
            ),
          if (currentProgram != null) ...[
            const SizedBox(height: 4),
            Text(
              currentProgram.title,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF1C1F2E),
                  ),
            ),
          ],
        ],
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
    return upcoming.take(3).toList();
  }
}

class _ProgramRow extends StatelessWidget {
  const _ProgramRow({required this.program});

  final ProgramDto program;

  @override
  Widget build(BuildContext context) {
    final time = DateFormat.Hm().format(program.startsAt);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          time,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF1C1F2E),
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            program.title,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF50566F),
                  height: 1.2,
                ),
          ),
        ),
      ],
    );
  }
}

class _AdBanner extends StatelessWidget {
  const _AdBanner();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
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
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFE8ECF8),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'Reklama',
              style: theme.textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF55607A),
                  ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Potwierdź wydarzenie',
            style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF1C1F2E),
                ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: () {},
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('1'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () {},
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('2'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextButton(
            onPressed: () {},
            child: const Text('Odłóż na chwilę'),
          ),
        ],
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

class _EmptySearchView extends StatelessWidget {
  const _EmptySearchView({required this.searchQuery});

  final String searchQuery;

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
          ],
        ),
      ),
    );
  }
}
