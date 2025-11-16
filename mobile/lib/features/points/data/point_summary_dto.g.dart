// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'point_summary_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PointEntryDtoImpl _$$PointEntryDtoImplFromJson(Map<String, dynamic> json) =>
    _$PointEntryDtoImpl(
      id: json['id'] as String,
      points: (json['points'] as num).toInt(),
      reason: $enumDecode(_$PointReasonDtoEnumMap, json['reason']),
      eventId: json['eventId'] as String?,
      description: json['description'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$$PointEntryDtoImplToJson(_$PointEntryDtoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'points': instance.points,
      'reason': _$PointReasonDtoEnumMap[instance.reason]!,
      'eventId': instance.eventId,
      'description': instance.description,
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$PointReasonDtoEnumMap = {
  PointReasonDto.FAST_CONFIRM: 'FAST_CONFIRM',
  PointReasonDto.REMINDER_CONFIRM: 'REMINDER_CONFIRM',
  PointReasonDto.DOUBLE_CONFIRM: 'DOUBLE_CONFIRM',
  PointReasonDto.DAILY_STREAK: 'DAILY_STREAK',
  PointReasonDto.STREAK_BONUS: 'STREAK_BONUS',
  PointReasonDto.MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
};

_$PointSummaryDtoImpl _$$PointSummaryDtoImplFromJson(
        Map<String, dynamic> json) =>
    _$PointSummaryDtoImpl(
      deviceId: json['deviceId'] as String,
      totalPoints: (json['totalPoints'] as num).toInt(),
      streakLength: (json['streakLength'] as num).toInt(),
      lastActive: json['lastActive'] == null
          ? null
          : DateTime.parse(json['lastActive'] as String),
      entries: (json['entries'] as List<dynamic>?)
              ?.map((e) => PointEntryDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <PointEntryDto>[],
    );

Map<String, dynamic> _$$PointSummaryDtoImplToJson(
        _$PointSummaryDtoImpl instance) =>
    <String, dynamic>{
      'deviceId': instance.deviceId,
      'totalPoints': instance.totalPoints,
      'streakLength': instance.streakLength,
      'lastActive': instance.lastActive?.toIso8601String(),
      'entries': instance.entries,
    };
