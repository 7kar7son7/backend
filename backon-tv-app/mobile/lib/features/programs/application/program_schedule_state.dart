import 'package:freezed_annotation/freezed_annotation.dart';

import '../../programs/data/program_dto.dart';

part 'program_schedule_state.freezed.dart';

@freezed
class ScheduledProgram with _$ScheduledProgram {
  const factory ScheduledProgram({
    required String channelId,
    required String channelName,
    String? channelLogoUrl,
    required ProgramDto program,
    required bool isFollowed,
  }) = _ScheduledProgram;
}

@freezed
class ProgramScheduleState with _$ProgramScheduleState {
  const factory ProgramScheduleState({
    required DateTime selectedDate,
    required List<ScheduledProgram> programs,
    required bool hasChannelFollows,
    @Default(false) bool isLoadingMore,
    @Default(false) bool hasMore,
  }) = _ProgramScheduleState;
}
