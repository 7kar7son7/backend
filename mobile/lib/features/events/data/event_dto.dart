// ignore_for_file: constant_identifier_names

import 'package:freezed_annotation/freezed_annotation.dart';

import '../../programs/data/program_dto.dart';

part 'event_dto.freezed.dart';
part 'event_dto.g.dart';

@JsonEnum()
enum EventStatusDto {
  PENDING,
  VALIDATED,
  CANCELLED,
  EXPIRED,
}

@JsonEnum()
enum EventChoiceDto {
  OPTION1,
  OPTION2,
}

@freezed
class EventConfirmationDto with _$EventConfirmationDto {
  const factory EventConfirmationDto({
    required String id,
    required String deviceId,
    required EventChoiceDto choice,
    required DateTime confirmedAt,
    int? delaySeconds,
    @Default(false) bool reminderUsed,
  }) = _EventConfirmationDto;

  factory EventConfirmationDto.fromJson(Map<String, dynamic> json) =>
      _$EventConfirmationDtoFromJson(json);
}

@freezed
class EventDto with _$EventDto {
  const factory EventDto({
    required String id,
    required String initiatorDeviceId,
    required String programId,
    required EventStatusDto status,
    required DateTime initiatedAt,
    DateTime? validatedAt,
    DateTime? expiresAt,
    int? followerCountLimit,
    required ProgramDto program,
    @Default(<EventConfirmationDto>[]) List<EventConfirmationDto> confirmations,
  }) = _EventDto;

  factory EventDto.fromJson(Map<String, dynamic> json) =>
      _$EventDtoFromJson(json);
}

