// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'program_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ProgramDtoImpl _$$ProgramDtoImplFromJson(Map<String, dynamic> json) =>
    _$ProgramDtoImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      channelId: json['channelId'] as String,
      channelName: json['channelName'] as String,
      description: json['description'] as String?,
      seasonNumber: (json['seasonNumber'] as num?)?.toInt(),
      episodeNumber: (json['episodeNumber'] as num?)?.toInt(),
      startsAt: DateTime.parse(json['startsAt'] as String),
      endsAt: json['endsAt'] == null
          ? null
          : DateTime.parse(json['endsAt'] as String),
      imageUrl: json['imageUrl'] as String?,
      tags:
          (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
              const <String>[],
    );

Map<String, dynamic> _$$ProgramDtoImplToJson(_$ProgramDtoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'channelId': instance.channelId,
      'channelName': instance.channelName,
      'description': instance.description,
      'seasonNumber': instance.seasonNumber,
      'episodeNumber': instance.episodeNumber,
      'startsAt': instance.startsAt.toIso8601String(),
      'endsAt': instance.endsAt?.toIso8601String(),
      'imageUrl': instance.imageUrl,
      'tags': instance.tags,
    };
