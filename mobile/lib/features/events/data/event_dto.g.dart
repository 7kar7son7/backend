// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'event_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$EventConfirmationDtoImpl _$$EventConfirmationDtoImplFromJson(
        Map<String, dynamic> json) =>
    _$EventConfirmationDtoImpl(
      id: json['id'] as String,
      deviceId: json['deviceId'] as String,
      choice: $enumDecode(_$EventChoiceDtoEnumMap, json['choice']),
      confirmedAt: DateTime.parse(json['confirmedAt'] as String),
      delaySeconds: (json['delaySeconds'] as num?)?.toInt(),
      reminderUsed: json['reminderUsed'] as bool? ?? false,
    );

Map<String, dynamic> _$$EventConfirmationDtoImplToJson(
        _$EventConfirmationDtoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'deviceId': instance.deviceId,
      'choice': _$EventChoiceDtoEnumMap[instance.choice]!,
      'confirmedAt': instance.confirmedAt.toIso8601String(),
      'delaySeconds': instance.delaySeconds,
      'reminderUsed': instance.reminderUsed,
    };

const _$EventChoiceDtoEnumMap = {
  EventChoiceDto.OPTION1: 'OPTION1',
  EventChoiceDto.OPTION2: 'OPTION2',
};

_$EventDtoImpl _$$EventDtoImplFromJson(Map<String, dynamic> json) =>
    _$EventDtoImpl(
      id: json['id'] as String,
      initiatorDeviceId: json['initiatorDeviceId'] as String,
      programId: json['programId'] as String,
      status: $enumDecode(_$EventStatusDtoEnumMap, json['status']),
      initiatedAt: DateTime.parse(json['initiatedAt'] as String),
      validatedAt: json['validatedAt'] == null
          ? null
          : DateTime.parse(json['validatedAt'] as String),
      expiresAt: json['expiresAt'] == null
          ? null
          : DateTime.parse(json['expiresAt'] as String),
      followerCountLimit: (json['followerCountLimit'] as num?)?.toInt(),
      program: ProgramDto.fromJson(json['program'] as Map<String, dynamic>),
      confirmations: (json['confirmations'] as List<dynamic>?)
              ?.map((e) =>
                  EventConfirmationDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <EventConfirmationDto>[],
    );

Map<String, dynamic> _$$EventDtoImplToJson(_$EventDtoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'initiatorDeviceId': instance.initiatorDeviceId,
      'programId': instance.programId,
      'status': _$EventStatusDtoEnumMap[instance.status]!,
      'initiatedAt': instance.initiatedAt.toIso8601String(),
      'validatedAt': instance.validatedAt?.toIso8601String(),
      'expiresAt': instance.expiresAt?.toIso8601String(),
      'followerCountLimit': instance.followerCountLimit,
      'program': instance.program,
      'confirmations': instance.confirmations,
    };

const _$EventStatusDtoEnumMap = {
  EventStatusDto.PENDING: 'PENDING',
  EventStatusDto.VALIDATED: 'VALIDATED',
  EventStatusDto.CANCELLED: 'CANCELLED',
  EventStatusDto.EXPIRED: 'EXPIRED',
};
