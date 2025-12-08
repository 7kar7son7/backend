import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../channels/application/channels_notifier.dart';
import '../../channels/data/channel_api.dart';
import '../../channels/data/channel_dto.dart';
import '../../channels/presentation/channel_programs_page.dart';
import '../../programs/data/program_dto.dart';
import '../application/favorites_provider.dart';
import '../../../shared/widgets/channel_logo.dart';

class FavoritesPage extends ConsumerWidget {
  const FavoritesPage({super.key});

  static const routeName = 'favorites';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(channelsNotifierProvider);
    final favoriteIds = ref.watch(favoritesProvider);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Moje ulubione'),
      ),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text(
                'Nie udało się pobrać kanałów',
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => ref.read(channelsNotifierProvider.notifier).refresh(),
                child: const Text('Spróbuj ponownie'),
              ),
            ],
          ),
        ),
        data: (viewState) {
          final favoriteChannels = viewState.channels
              .where((channel) => favoriteIds.contains(channel.id))
              .toList();

          if (favoriteIds.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.favorite_border,
                    size: 64,
                    color: theme.colorScheme.onSurface.withOpacity(0.3),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Brak ulubionych kanałów',
                    style: theme.textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      'Wybierz ulubione kanały z listy kanałów',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurface.withOpacity(0.6),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
            itemCount: favoriteChannels.length,
            itemBuilder: (context, index) {
              final channel = favoriteChannels[index];
              return _FavoriteChannelCard(
                channel: channel,
                onTap: () {
                  context.pushNamed(
                    ChannelProgramsPage.routeName,
                    pathParameters: {'channelId': channel.id},
                  );
                },
                onRemove: () async {
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
              );
            },
          );
        },
      ),
    );
  }
}

// Provider do pobierania programów dla kanału
final channelProgramsProvider = FutureProvider.autoDispose.family<ChannelProgramsDto, String>((ref, channelId) async {
  final channelApi = ref.watch(channelApiProvider);
  final now = DateTime.now();
  final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59);
  
  final response = await channelApi.getChannelPrograms(
    channelId,
    from: now.toUtc(),
    to: endOfDay.toUtc(),
  );
  
  return response.data;
});

class _FavoriteChannelCard extends ConsumerWidget {
  const _FavoriteChannelCard({
    required this.channel,
    required this.onTap,
    required this.onRemove,
  });

  final ChannelDto channel;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final programsAsync = ref.watch(channelProgramsProvider(channel.id));
    
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Logo kanału z boku (jak w KANAŁY)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: ChannelLogo(
                  name: channel.name,
                  logoUrl: channel.logoUrl,
                  size: 32,
                ),
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
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: theme.colorScheme.onSurface,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.favorite, color: Colors.red, size: 18),
                          onPressed: onRemove,
                          tooltip: 'Usuń z ulubionych',
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    programsAsync.when(
                      loading: () => const SizedBox(
                        height: 30,
                        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                      ),
                      error: (error, stack) => Text(
                        'Brak danych',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurface.withOpacity(0.6),
                          fontSize: 11,
                        ),
                      ),
                      data: (channelPrograms) {
                        final programs = channelPrograms.programs;
                        final currentProgram = _findCurrentProgram(programs);
                        final nextPrograms = _findNextPrograms(programs);
                        
                        if (currentProgram == null && nextPrograms.isEmpty) {
                          return Text(
                            'Brak zaplanowanych audycji',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface.withOpacity(0.6),
                              fontSize: 11,
                            ),
                          );
                        }
                        
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (currentProgram != null) ...[
                              _CurrentProgramRow(program: currentProgram),
                              if (nextPrograms.isNotEmpty) const SizedBox(height: 2),
                            ],
                            for (var i = 0; i < nextPrograms.length; i++) ...[
                              _NextProgramRow(program: nextPrograms[i]),
                              if (i < nextPrograms.length - 1) const SizedBox(height: 2),
                            ],
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
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

  List<ProgramDto> _findNextPrograms(List<ProgramDto> programs) {
    final now = DateTime.now();
    final upcoming = programs
        .where((program) => program.startsAt.isAfter(now))
        .toList()
      ..sort((a, b) => a.startsAt.compareTo(b.startsAt));
    // Pokaż 2 następne programy
    return upcoming.take(2).toList();
  }
}

class _CurrentProgramRow extends StatelessWidget {
  const _CurrentProgramRow({required this.program});

  final ProgramDto program;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final now = DateTime.now();
    final startsAt = program.startsAt;
    final endsAt = program.endsAt ?? startsAt.add(const Duration(hours: 1));
    
    // Oblicz postęp (0.0 - 1.0)
    final totalDuration = endsAt.difference(startsAt).inMilliseconds;
    final elapsed = now.difference(startsAt).inMilliseconds;
    final progress = totalDuration > 0 
        ? (elapsed / totalDuration).clamp(0.0, 1.0)
        : 0.0;
    
    final timeText = DateFormat.Hm().format(startsAt);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 44,
              child: Text(
                timeText,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                  fontSize: 11,
                ),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    program.title,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
                      height: 1.2,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress,
                      backgroundColor: theme.colorScheme.surfaceContainerHighest,
                      valueColor: AlwaysStoppedAnimation<Color>(theme.colorScheme.primary),
                      minHeight: 3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _NextProgramRow extends StatelessWidget {
  const _NextProgramRow({required this.program});

  final ProgramDto program;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final time = DateFormat.Hm().format(program.startsAt);
    
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 44,
          child: Text(
            time,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurface,
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
              fontSize: 11,
              height: 1.2,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
