import 'package:freezed_annotation/freezed_annotation.dart';

part 'program_dto.freezed.dart';
part 'program_dto.g.dart';

class DateTimeLocalConverter implements JsonConverter<DateTime, String> {
  const DateTimeLocalConverter();

  @override
  DateTime fromJson(String json) {
    // Parsuj datę z API (UTC) i konwertuj na lokalną
    final utcDate = DateTime.parse(json);
    return utcDate.toLocal();
  }

  @override
  String toJson(DateTime object) {
    // Konwertuj lokalną datę z powrotem na UTC dla API
    return object.toUtc().toIso8601String();
  }
}

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
    @DateTimeLocalConverter() required DateTime startsAt,
    @DateTimeLocalConverter() DateTime? endsAt,
    String? imageUrl,
    @Default(<String>[]) List<String> tags,
  }) = _ProgramDto;

  factory ProgramDto.fromJson(Map<String, dynamic> json) =>
      _$ProgramDtoFromJson(json);
}

