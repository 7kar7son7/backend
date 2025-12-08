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

  Future<void> toggleFollowProgram(String programId, bool follow) async {
    try {
      if (follow) {
        await _followApi.follow(
          FollowRequest(type: FollowTypeDto.PROGRAM, targetId: programId),
        );
      } else {
        await _followApi.unfollow(
          FollowRequest(type: FollowTypeDto.PROGRAM, targetId: programId),
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
    
    // Debug: sprawdź czy otrzymaliśmy programy
    if (programsResp.data.isEmpty) {
      // Jeśli nie ma programów, zwróć pusty stan
      return ProgramScheduleState(
        selectedDate: DateTime(day.year, day.month, day.day),
        programs: [],
        hasChannelFollows: false,
        hasMore: false,
      );
    }
    
    final followsResp = await _followApi.getFollows();
    final followedProgramIds = followsResp.data
        .where((f) => f.type == FollowTypeDto.PROGRAM && f.program != null)
        .map((f) => f.program!.id)
        .toSet();

    // Używamy channelLogoUrl z API - nie trzeba już pobierać kanałów osobno!
    final scheduled = programsResp.data.map((program) {
      return ScheduledProgram(
        channelId: program.channelId,
        channelName: program.channelName,
        channelLogoUrl: program.channelLogoUrl,
        program: program,
        isFollowed: followedProgramIds.contains(program.id), // Śledzimy program, nie kanał
      );
    }).toList();
    // Sortowanie nie jest już potrzebne - backend zwraca już posortowane programy

    return ProgramScheduleState(
      selectedDate: DateTime(day.year, day.month, day.day),
      programs: scheduled,
      hasChannelFollows: false, // Nie używamy już śledzenia kanałów
      hasMore: programsResp.data.length == limit, // Jeśli zwrócono tyle ile limit, może być więcej
    );
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    // Ustaw isLoadingMore na true przed rozpoczęciem ładowania
    state = AsyncValue.data(current.copyWith(isLoadingMore: true));

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
