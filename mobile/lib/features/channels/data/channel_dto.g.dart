// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'channel_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ChannelDtoImpl _$$ChannelDtoImplFromJson(Map<String, dynamic> json) =>
    _$ChannelDtoImpl(
      id: json['id'] as String,
      externalId: json['externalId'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      category: json['category'] as String?,
      logoUrl: json['logoUrl'] as String?,
      countryCode: json['countryCode'] as String?,
      programs: (json['programs'] as List<dynamic>?)
              ?.map((e) => ProgramDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ProgramDto>[],
    );

Map<String, dynamic> _$$ChannelDtoImplToJson(_$ChannelDtoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'externalId': instance.externalId,
      'name': instance.name,
      'description': instance.description,
      'category': instance.category,
      'logoUrl': instance.logoUrl,
      'countryCode': instance.countryCode,
      'programs': instance.programs,
    };
