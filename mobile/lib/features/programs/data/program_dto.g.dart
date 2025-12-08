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
      channelLogoUrl: json['channelLogoUrl'] as String?,
      description: json['description'] as String?,
      seasonNumber: (json['seasonNumber'] as num?)?.toInt(),
      episodeNumber: (json['episodeNumber'] as num?)?.toInt(),
      startsAt:
          const DateTimeLocalConverter().fromJson(json['startsAt'] as String),
      endsAt: _$JsonConverterFromJson<String, DateTime>(
          json['endsAt'], const DateTimeLocalConverter().fromJson),
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
      'channelLogoUrl': instance.channelLogoUrl,
      'description': instance.description,
      'seasonNumber': instance.seasonNumber,
      'episodeNumber': instance.episodeNumber,
      'startsAt': const DateTimeLocalConverter().toJson(instance.startsAt),
      'endsAt': _$JsonConverterToJson<String, DateTime>(
          instance.endsAt, const DateTimeLocalConverter().toJson),
      'imageUrl': instance.imageUrl,
      'tags': instance.tags,
    };

Value? _$JsonConverterFromJson<Json, Value>(
  Object? json,
  Value? Function(Json json) fromJson,
) =>
    json == null ? null : fromJson(json as Json);

Json? _$JsonConverterToJson<Json, Value>(
  Value? value,
  Json? Function(Value value) toJson,
) =>
    value == null ? null : toJson(value);
