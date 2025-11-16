import 'package:freezed_annotation/freezed_annotation.dart';

import '../../programs/data/program_dto.dart';

part 'channel_dto.freezed.dart';
part 'channel_dto.g.dart';

@freezed
class ChannelDto with _$ChannelDto {
  const factory ChannelDto({
    required String id,
    required String externalId,
    required String name,
    String? description,
    String? category,
    String? logoUrl,
    String? countryCode,
    @Default(<ProgramDto>[]) List<ProgramDto> programs,
  }) = _ChannelDto;

  factory ChannelDto.fromJson(Map<String, dynamic> json) =>
      _$ChannelDtoFromJson(json);
}

