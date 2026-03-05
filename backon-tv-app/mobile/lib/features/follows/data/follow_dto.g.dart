// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'follow_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$FollowDtoImpl _$$FollowDtoImplFromJson(Map<String, dynamic> json) =>
    _$FollowDtoImpl(
      id: json['id'] as String,
      deviceId: json['deviceId'] as String,
      type: $enumDecode(_$FollowTypeDtoEnumMap, json['type']),
      channel: json['channel'] == null
          ? null
          : ChannelDto.fromJson(json['channel'] as Map<String, dynamic>),
      program: json['program'] == null
          ? null
          : ProgramDto.fromJson(json['program'] as Map<String, dynamic>),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$$FollowDtoImplToJson(_$FollowDtoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'deviceId': instance.deviceId,
      'type': _$FollowTypeDtoEnumMap[instance.type]!,
      'channel': instance.channel,
      'program': instance.program,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };

const _$FollowTypeDtoEnumMap = {
  FollowTypeDto.CHANNEL: 'CHANNEL',
  FollowTypeDto.PROGRAM: 'PROGRAM',
};
