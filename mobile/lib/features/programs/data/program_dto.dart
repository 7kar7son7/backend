import 'package:freezed_annotation/freezed_annotation.dart';

part 'program_dto.freezed.dart';
part 'program_dto.g.dart';

@freezed
class ProgramDto with _$ProgramDto {
  const factory ProgramDto({
    required String id,
    required String title,
    required String channelId,
    required String channelName,
    String? channelLogoUrl,
    String? description,
    int? seasonNumber,
    int? episodeNumber,
    required DateTime startsAt,
    DateTime? endsAt,
    String? imageUrl,
    @Default(<String>[]) List<String> tags,
  }) = _ProgramDto;

  factory ProgramDto.fromJson(Map<String, dynamic> json) =>
      _$ProgramDtoFromJson(json);
}

