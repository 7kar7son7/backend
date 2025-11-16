import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../channels/data/channel_api.dart';
import '../../follows/data/follow_api.dart';
import '../../follows/data/follow_dto.dart';
import '../data/program_api.dart';
import 'program_schedule_state.dart';

class ProgramScheduleNotifier
    extends AutoDisposeAsyncNotifier<ProgramScheduleState> {
  late final ProgramApi _programApi;
  late final ChannelApi _channelApi;
  late final FollowApi _followApi;
  Timer? _refreshTimer;

  @override
  Future<ProgramScheduleState> build() async {
    _programApi = ref.watch(programApiProvider);
    _channelApi = ref.watch(channelApiProvider);
    _followApi = ref.watch(followApiProvider);

    final now = DateTime.now();
    final result = await _loadForDate(DateTime(now.year, now.month, now.day));
    _restartAutoRefresh();
    ref.onDispose(() {
      _refreshTimer?.cancel();
    });
    return result;
  }

  Future<void> changeDay(DateTime day) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _loadForDate(day));
    _restartAutoRefresh();
  }

  Future<void> toggleFollowChannel(String channelId, bool follow) async {
    if (follow) {
      await _followApi.follow(
        FollowRequest(type: FollowTypeDto.CHANNEL, targetId: channelId),
      );
    } else {
      await _followApi.unfollow(
        FollowRequest(type: FollowTypeDto.CHANNEL, targetId: channelId),
      );
    }

    final current = state.value;
    if (current != null) {
      final refreshed = await _loadForDate(current.selectedDate);
      state = AsyncValue.data(refreshed);
    }
    _restartAutoRefresh();
  }

  Future<ProgramScheduleState> _loadForDate(DateTime day) async {
    final programsResp = await _programApi.getProgramsForDay(day);
    final channelsResp = await _channelApi.getChannels();
    final followsResp = await _followApi.getFollows();
    final followedChannelIds = followsResp.data
        .where((f) => f.type == FollowTypeDto.CHANNEL)
        .map((f) => f.channel?.id)
        .whereType<String>()
        .toSet();

    final channelById = {
      for (final channel in channelsResp.data) channel.id: channel,
    };

    final scheduled = programsResp.data.map((program) {
      final channel = channelById[program.channelId];
      return ScheduledProgram(
        channelId: program.channelId,
        channelName: channel?.name ?? program.channelName,
        channelLogoUrl: channel?.logoUrl,
        program: program,
        isFollowed: followedChannelIds.contains(program.channelId),
      );
    }).toList()
      ..sort(
        (a, b) =>
            a.program.startsAt.compareTo(b.program.startsAt),
      );

    return ProgramScheduleState(
      selectedDate: DateTime(day.year, day.month, day.day),
      programs: scheduled,
      hasChannelFollows: followedChannelIds.isNotEmpty,
    );
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
