// ignore_for_file: constant_identifier_names

import 'package:freezed_annotation/freezed_annotation.dart';

part 'point_summary_dto.freezed.dart';
part 'point_summary_dto.g.dart';

@JsonEnum()
enum PointReasonDto {
  FAST_CONFIRM,
  REMINDER_CONFIRM,
  DOUBLE_CONFIRM,
  DAILY_STREAK,
  STREAK_BONUS,
  MANUAL_ADJUSTMENT,
}

@freezed
class PointEntryDto with _$PointEntryDto {
  const factory PointEntryDto({
    required String id,
    required int points,
    required PointReasonDto reason,
    String? eventId,
    String? description,
    required DateTime createdAt,
  }) = _PointEntryDto;

  factory PointEntryDto.fromJson(Map<String, dynamic> json) =>
      _$PointEntryDtoFromJson(json);
}

@freezed
class PointSummaryDto with _$PointSummaryDto {
  const factory PointSummaryDto({
    required String deviceId,
    required int totalPoints,
    required int streakLength,
    DateTime? lastActive,
    @Default(<PointEntryDto>[]) List<PointEntryDto> entries,
  }) = _PointSummaryDto;

  factory PointSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$PointSummaryDtoFromJson(json);
}

@freezed
class LeaderboardEntryDto with _$LeaderboardEntryDto {
  const factory LeaderboardEntryDto({
    required String deviceId,
    required int totalPoints,
    required int streakLength,
    DateTime? lastActive,
  }) = _LeaderboardEntryDto;

  factory LeaderboardEntryDto.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardEntryDtoFromJson(json);
}

