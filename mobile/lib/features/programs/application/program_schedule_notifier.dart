import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../follows/data/follow_api.dart';
import '../../follows/data/follow_dto.dart';
import '../data/program_api.dart';
import 'program_schedule_state.dart';

class ProgramScheduleNotifier
    extends AutoDisposeAsyncNotifier<ProgramScheduleState> {
  late final ProgramApi _programApi;
  late final FollowApi _followApi;
  Timer? _refreshTimer;

  @override
  Future<ProgramScheduleState> build() async {
    _programApi = ref.watch(programApiProvider);
    _followApi = ref.watch(followApiProvider);

    final now = DateTime.now();
    final result = await _loadForDate(DateTime(now.year, now.month, now.day), limit: 20, offset: 0);
    _restartAutoRefresh();
    ref.onDispose(() {
      _refreshTimer?.cancel();
    });
    return result;
  }

  Future<void> changeDay(DateTime day) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _loadForDate(day, limit: 20, offset: 0));
    _restartAutoRefresh();
  }

  Future<void> toggleFollowChannel(String channelId, bool follow) async {
    try {
      if (follow) {
        await _followApi.follow(
          FollowRequest(type: FollowTypeDto.CHANNEL, targetId: channelId),
        );
      } else {
        await _followApi.unfollow(
          FollowRequest(type: FollowTypeDto.CHANNEL, targetId: channelId),
        );
      }

      // Odśwież dane po zmianie follow/unfollow
      final current = state.value;
      if (current != null) {
        state = await AsyncValue.guard(() => _loadForDate(current.selectedDate));
      }
      _restartAutoRefresh();
    } catch (error) {
      // Jeśli wystąpi błąd, zachowaj poprzedni stan
      // Błąd zostanie zalogowany przez Riverpod
      final current = state.value;
      if (current != null) {
        state = AsyncValue.data(current);
      }
    }
  }

  Future<ProgramScheduleState> _loadForDate(DateTime day, {int limit = 20, int offset = 0}) async {
    // Pobierz programy i follows równolegle (nie czekamy na kanały - nie są już potrzebne!)
    final programsResp = await _programApi.getProgramsForDay(
      day,
      limit: limit,
      offset: offset,
    );
    final followsResp = await _followApi.getFollows();
    final followedChannelIds = followsResp.data
        .where((f) => f.type == FollowTypeDto.CHANNEL)
        .map((f) => f.channel?.id)
        .whereType<String>()
        .toSet();

    // Używamy channelLogoUrl z API - nie trzeba już pobierać kanałów osobno!
    final scheduled = programsResp.data.map((program) {
      return ScheduledProgram(
        channelId: program.channelId,
        channelName: program.channelName,
        channelLogoUrl: program.channelLogoUrl,
        program: program,
        isFollowed: followedChannelIds.contains(program.channelId),
      );
    }).toList();
    // Sortowanie nie jest już potrzebne - backend zwraca już posortowane programy

    return ProgramScheduleState(
      selectedDate: DateTime(day.year, day.month, day.day),
      programs: scheduled,
      hasChannelFollows: followedChannelIds.isNotEmpty,
      hasMore: programsResp.data.length == limit, // Jeśli zwrócono tyle ile limit, może być więcej
    );
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    // Nie zmieniaj stanu na loading - ładuj w tle, żeby nie blokować UI
    try {
      final newPrograms = await _loadForDate(
        current.selectedDate,
        limit: 10,
        offset: current.programs.length,
      );
      
      final updated = current.copyWith(
        programs: [...current.programs, ...newPrograms.programs],
        hasMore: newPrograms.hasMore,
        isLoadingMore: false,
      );
      
      state = AsyncValue.data(updated);
    } catch (error) {
      // W przypadku błędu, po prostu nie aktualizuj - użytkownik może spróbować ponownie
      state = AsyncValue.data(current.copyWith(isLoadingMore: false));
    }
  }

  void _restartAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(
      const Duration(minutes: 5),
      (_) {
        _refreshCurrentDay();
      },
    );
  }

  Future<void> _refreshCurrentDay() async {
    final current = state.value ?? await future;
    state = await AsyncValue.guard(() => _loadForDate(current.selectedDate));
  }
}

final programScheduleNotifierProvider = AutoDisposeAsyncNotifierProvider<
    ProgramScheduleNotifier, ProgramScheduleState>(ProgramScheduleNotifier.new);
