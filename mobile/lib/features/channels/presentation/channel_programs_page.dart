import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/services/reminder_service.dart';
import '../../../shared/widgets/channel_logo.dart';
import '../../follows/data/follow_api.dart';
import '../../follows/data/follow_dto.dart';
import '../data/channel_api.dart';
import '../data/channel_dto.dart';
import '../../programs/data/program_dto.dart';
import '../../programs/presentation/program_detail_page.dart';

class ChannelProgramsPage extends ConsumerStatefulWidget {
  const ChannelProgramsPage({
    required this.channelId,
    super.key,
  });

  static const routeName = 'channel-programs';
  final String channelId;

  @override
  ConsumerState<ChannelProgramsPage> createState() => _ChannelProgramsPageState();
}

class _ChannelProgramsPageState extends ConsumerState<ChannelProgramsPage> {
  DateTime _selectedDate = DateTime.now();
  Set<String> _followedProgramIds = {};

  @override
  void initState() {
    super.initState();
    _loadFollowedPrograms();
  }

  Future<void> _loadFollowedPrograms() async {
    final followApi = ref.read(followApiProvider);
    try {
      final response = await followApi.getFollows();
      final followedPrograms = response.data
          .where((item) => item.type == FollowTypeDto.PROGRAM && item.program != null)
          .map((item) => item.program!.id)
          .toSet();
      setState(() {
        _followedProgramIds = followedPrograms;
      });
    } catch (e) {
      // Ignore errors - user can still use the app
    }
  }

  Future<void> _toggleFollowProgram(String programId, bool isFollowed, ProgramDto program) async {
    final followApi = ref.read(followApiProvider);
    try {
      if (isFollowed) {
        await followApi.unfollow(
          FollowRequest(type: FollowTypeDto.PROGRAM, targetId: programId),
        );
        await ReminderService.cancelProgramReminders(programId);
      } else {
        await followApi.follow(
          FollowRequest(type: FollowTypeDto.PROGRAM, targetId: programId),
        );
        if (program.startsAt.isAfter(DateTime.now())) {
          await ReminderService.scheduleProgramReminders(program);
        }
      }
      await _loadFollowedPrograms();
    } catch (e) {
      // Show error to user
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Nie udało się ${isFollowed ? 'od' : ''}śledzić programu')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final channelApi = ref.watch(channelApiProvider);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: FutureBuilder(
          future: channelApi.getChannel(widget.channelId),
          builder: (context, snapshot) {
            if (snapshot.hasData && snapshot.data?.data != null) {
              final channel = snapshot.data!.data;
              // Format daty jak w TELEMAGAZYN: "wtorek, 25 lis."
              final dateFormat = DateFormat('EEEE, d MMM', 'pl_PL');
              final dateStr = dateFormat.format(_selectedDate).toLowerCase();
              // Kapitalizuj pierwszą literę
              final formattedDate = dateStr.isEmpty 
                  ? dateStr 
                  : dateStr[0].toUpperCase() + dateStr.substring(1);
              
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    formattedDate,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withOpacity(0.7),
                    ),
                  ),
                ],
              );
            }
            return const Text('Program');
          },
        ),
      ),
      body: FutureBuilder(
        key: ValueKey(_selectedDate.toIso8601String()), // Wymusza przebudowanie przy zmianie daty
        future: _loadChannelPrograms(channelApi),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
                  const SizedBox(height: 16),
                  Text(
                    'Nie udało się pobrać programu',
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  if (snapshot.error != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Text(
                        snapshot.error.toString(),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.error,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => setState(() {}),
                    style: FilledButton.styleFrom(
                      backgroundColor: theme.colorScheme.primary,
                    ),
                    child: const Text('Spróbuj ponownie'),
                  ),
                ],
              ),
            );
          }

          if (!snapshot.hasData) {
            return const Center(child: Text('Brak danych'));
          }

          final data = snapshot.data!;
          final channel = data.channel;
          final programs = data.programs;

          if (programs.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.tv_off, size: 48, color: theme.colorScheme.onSurface.withOpacity(0.6)),
                  const SizedBox(height: 16),
                  Text(
                    'Brak programów na ten dzień',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: theme.colorScheme.onSurface.withOpacity(0.6),
                    ),
                  ),
                ],
              ),
            );
          }

          return Column(
            children: [
              // Date selector
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: theme.cardColor,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    _DateButton(
                      label: 'DZIŚ',
                      isSelected: _isToday(_selectedDate),
                      onTap: () {
                        setState(() {
                          _selectedDate = DateTime.now();
                        });
                      },
                    ),
                    const SizedBox(width: 8),
                    _DateButton(
                      label: 'JUTRO',
                      isSelected: _isTomorrow(_selectedDate),
                      onTap: () {
                        setState(() {
                          _selectedDate = DateTime.now().add(const Duration(days: 1));
                        });
                      },
                    ),
                    const SizedBox(width: 8),
                    _DateButton(
                      label: _getDayName(DateTime.now().add(const Duration(days: 2))),
                      isSelected: !_isToday(_selectedDate) && !_isTomorrow(_selectedDate),
                      onTap: () {
                        setState(() {
                          _selectedDate = DateTime.now().add(const Duration(days: 2));
                        });
                      },
                    ),
                  ],
                ),
              ),
              // Programs list
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _getSortedPrograms(programs).length,
                  itemBuilder: (context, index) {
                    final program = _getSortedPrograms(programs)[index];
                    final isFollowed = _followedProgramIds.contains(program.id);
                    return _ProgramCard(
                      program: program,
                      channel: channel,
                      isFollowed: isFollowed,
                      onFollowToggle: () => _toggleFollowProgram(program.id, isFollowed, program),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<ChannelProgramsDto> _loadChannelPrograms(ChannelApi channelApi) async {
    try {
      // Użyj UTC dla dat, aby uniknąć problemów ze strefami czasowymi
      final startOfDay = DateTime.utc(_selectedDate.year, _selectedDate.month, _selectedDate.day);
      final endOfDay = startOfDay.add(const Duration(days: 1));

      final response = await channelApi.getChannelPrograms(
        widget.channelId,
        from: startOfDay,
        to: endOfDay,
      );

      return response.data;
    } catch (e) {
      // Log error for debugging
      debugPrint('Error loading channel programs: $e');
      debugPrint('ChannelId: ${widget.channelId}');
      debugPrint('Selected date: $_selectedDate');
      debugPrint('Error type: ${e.runtimeType}');
      if (e is DioException) {
        debugPrint('DioException status: ${e.response?.statusCode}');
        debugPrint('DioException message: ${e.message}');
        debugPrint('DioException response: ${e.response?.data}');
      }
      rethrow;
    }
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month && date.day == now.day;
  }

  bool _isTomorrow(DateTime date) {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    return date.year == tomorrow.year && date.month == tomorrow.month && date.day == tomorrow.day;
  }

  String _getDayName(DateTime date) {
    final days = ['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'NIE'];
    return days[date.weekday - 1];
  }

  /// Sortuj programy - dla dzisiejszego dnia: aktualne na górze, potem przyszłe
  /// Dla innych dni: po prostu sortuj chronologicznie
  List<ProgramDto> _getSortedPrograms(List<ProgramDto> programs) {
    final now = DateTime.now();
    final isToday = _isToday(_selectedDate);
    
    if (!isToday) {
      // Dla innych dni - po prostu sortuj chronologicznie
      final sorted = List<ProgramDto>.from(programs);
      sorted.sort((a, b) => a.startsAt.compareTo(b.startsAt));
      return sorted;
    }
    
    // Dla dzisiejszego dnia - aktualne na górze, potem przyszłe
    final currentPrograms = <ProgramDto>[];
    final upcomingPrograms = <ProgramDto>[];
    final pastPrograms = <ProgramDto>[];
    
    for (final program in programs) {
      final startsAt = program.startsAt;
      final endsAt = program.endsAt ?? startsAt.add(const Duration(hours: 1));
      
      if (!startsAt.isAfter(now) && endsAt.isAfter(now)) {
        // Program aktualnie trwający
        currentPrograms.add(program);
      } else if (startsAt.isAfter(now)) {
        // Program przyszły
        upcomingPrograms.add(program);
      } else {
        // Program przeszły
        pastPrograms.add(program);
      }
    }
    
    // Sortuj przyszłe programy chronologicznie
    upcomingPrograms.sort((a, b) => a.startsAt.compareTo(b.startsAt));
    
    // Zwróć: aktualne, potem przyszłe, potem przeszłe (jeśli w ogóle)
    return [...currentPrograms, ...upcomingPrograms, ...pastPrograms];
  }
}

class _DateButton extends StatelessWidget {
  const _DateButton({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          backgroundColor: isSelected
              ? theme.colorScheme.primary
              : theme.cardColor,
          foregroundColor: isSelected
              ? theme.colorScheme.onPrimary
              : theme.colorScheme.onSurface,
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}

class _ProgramCard extends StatelessWidget {
  const _ProgramCard({
    required this.program,
    required this.channel,
    required this.isFollowed,
    required this.onFollowToggle,
  });

  final ProgramDto program;
  final ChannelDto channel;
  final bool isFollowed;
  final VoidCallback onFollowToggle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final time = DateFormat.Hm().format(program.startsAt);
    final now = DateTime.now();
    final isCurrent = program.startsAt.isBefore(now) &&
        (program.endsAt?.isAfter(now) ?? program.startsAt.add(const Duration(hours: 1)).isAfter(now));

    return InkWell(
      onTap: () {
        context.pushNamed(
          ProgramDetailPage.routeName,
          pathParameters: {'programId': program.id},
        );
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: BorderRadius.circular(16),
          border: isCurrent
              ? Border.all(color: theme.colorScheme.primary, width: 2)
              : null,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 50,
            child: Text(
              time,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.onSurface,
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        program.title,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                          color: theme.colorScheme.onSurface,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    if (isFollowed)
                      Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: Icon(
                          Icons.access_time,
                          size: 16,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                  ],
                ),
                if (program.endsAt != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    '${program.endsAt!.difference(program.startsAt).inMinutes} min',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withOpacity(0.6),
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
        ),
      ),
    );
  }
}

