// ignore_for_file: constant_identifier_names

import 'package:freezed_annotation/freezed_annotation.dart';

import '../../channels/data/channel_dto.dart';
import '../../programs/data/program_dto.dart';

part 'follow_dto.freezed.dart';
part 'follow_dto.g.dart';

@JsonEnum()
enum FollowTypeDto {
  CHANNEL,
  PROGRAM,
}

@freezed
class FollowDto with _$FollowDto {
  const factory FollowDto({
    required String id,
    required String deviceId,
    required FollowTypeDto type,
    ChannelDto? channel,
    ProgramDto? program,
    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _FollowDto;

  factory FollowDto.fromJson(Map<String, dynamic> json) =>
      _$FollowDtoFromJson(json);
}

