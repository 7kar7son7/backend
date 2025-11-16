// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'event_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

EventConfirmationDto _$EventConfirmationDtoFromJson(Map<String, dynamic> json) {
  return _EventConfirmationDto.fromJson(json);
}

/// @nodoc
mixin _$EventConfirmationDto {
  String get id => throw _privateConstructorUsedError;
  String get deviceId => throw _privateConstructorUsedError;
  EventChoiceDto get choice => throw _privateConstructorUsedError;
  DateTime get confirmedAt => throw _privateConstructorUsedError;
  int? get delaySeconds => throw _privateConstructorUsedError;
  bool get reminderUsed => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $EventConfirmationDtoCopyWith<EventConfirmationDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $EventConfirmationDtoCopyWith<$Res> {
  factory $EventConfirmationDtoCopyWith(EventConfirmationDto value,
          $Res Function(EventConfirmationDto) then) =
      _$EventConfirmationDtoCopyWithImpl<$Res, EventConfirmationDto>;
  @useResult
  $Res call(
      {String id,
      String deviceId,
      EventChoiceDto choice,
      DateTime confirmedAt,
      int? delaySeconds,
      bool reminderUsed});
}

/// @nodoc
class _$EventConfirmationDtoCopyWithImpl<$Res,
        $Val extends EventConfirmationDto>
    implements $EventConfirmationDtoCopyWith<$Res> {
  _$EventConfirmationDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? deviceId = null,
    Object? choice = null,
    Object? confirmedAt = null,
    Object? delaySeconds = freezed,
    Object? reminderUsed = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      deviceId: null == deviceId
          ? _value.deviceId
          : deviceId // ignore: cast_nullable_to_non_nullable
              as String,
      choice: null == choice
          ? _value.choice
          : choice // ignore: cast_nullable_to_non_nullable
              as EventChoiceDto,
      confirmedAt: null == confirmedAt
          ? _value.confirmedAt
          : confirmedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      delaySeconds: freezed == delaySeconds
          ? _value.delaySeconds
          : delaySeconds // ignore: cast_nullable_to_non_nullable
              as int?,
      reminderUsed: null == reminderUsed
          ? _value.reminderUsed
          : reminderUsed // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$EventConfirmationDtoImplCopyWith<$Res>
    implements $EventConfirmationDtoCopyWith<$Res> {
  factory _$$EventConfirmationDtoImplCopyWith(_$EventConfirmationDtoImpl value,
          $Res Function(_$EventConfirmationDtoImpl) then) =
      __$$EventConfirmationDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String deviceId,
      EventChoiceDto choice,
      DateTime confirmedAt,
      int? delaySeconds,
      bool reminderUsed});
}

/// @nodoc
class __$$EventConfirmationDtoImplCopyWithImpl<$Res>
    extends _$EventConfirmationDtoCopyWithImpl<$Res, _$EventConfirmationDtoImpl>
    implements _$$EventConfirmationDtoImplCopyWith<$Res> {
  __$$EventConfirmationDtoImplCopyWithImpl(_$EventConfirmationDtoImpl _value,
      $Res Function(_$EventConfirmationDtoImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? deviceId = null,
    Object? choice = null,
    Object? confirmedAt = null,
    Object? delaySeconds = freezed,
    Object? reminderUsed = null,
  }) {
    return _then(_$EventConfirmationDtoImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      deviceId: null == deviceId
          ? _value.deviceId
          : deviceId // ignore: cast_nullable_to_non_nullable
              as String,
      choice: null == choice
          ? _value.choice
          : choice // ignore: cast_nullable_to_non_nullable
              as EventChoiceDto,
      confirmedAt: null == confirmedAt
          ? _value.confirmedAt
          : confirmedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      delaySeconds: freezed == delaySeconds
          ? _value.delaySeconds
          : delaySeconds // ignore: cast_nullable_to_non_nullable
              as int?,
      reminderUsed: null == reminderUsed
          ? _value.reminderUsed
          : reminderUsed // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$EventConfirmationDtoImpl implements _EventConfirmationDto {
  const _$EventConfirmationDtoImpl(
      {required this.id,
      required this.deviceId,
      required this.choice,
      required this.confirmedAt,
      this.delaySeconds,
      this.reminderUsed = false});

  factory _$EventConfirmationDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$EventConfirmationDtoImplFromJson(json);

  @override
  final String id;
  @override
  final String deviceId;
  @override
  final EventChoiceDto choice;
  @override
  final DateTime confirmedAt;
  @override
  final int? delaySeconds;
  @override
  @JsonKey()
  final bool reminderUsed;

  @override
  String toString() {
    return 'EventConfirmationDto(id: $id, deviceId: $deviceId, choice: $choice, confirmedAt: $confirmedAt, delaySeconds: $delaySeconds, reminderUsed: $reminderUsed)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$EventConfirmationDtoImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.deviceId, deviceId) ||
                other.deviceId == deviceId) &&
            (identical(other.choice, choice) || other.choice == choice) &&
            (identical(other.confirmedAt, confirmedAt) ||
                other.confirmedAt == confirmedAt) &&
            (identical(other.delaySeconds, delaySeconds) ||
                other.delaySeconds == delaySeconds) &&
            (identical(other.reminderUsed, reminderUsed) ||
                other.reminderUsed == reminderUsed));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(runtimeType, id, deviceId, choice,
      confirmedAt, delaySeconds, reminderUsed);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$EventConfirmationDtoImplCopyWith<_$EventConfirmationDtoImpl>
      get copyWith =>
          __$$EventConfirmationDtoImplCopyWithImpl<_$EventConfirmationDtoImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$EventConfirmationDtoImplToJson(
      this,
    );
  }
}

abstract class _EventConfirmationDto implements EventConfirmationDto {
  const factory _EventConfirmationDto(
      {required final String id,
      required final String deviceId,
      required final EventChoiceDto choice,
      required final DateTime confirmedAt,
      final int? delaySeconds,
      final bool reminderUsed}) = _$EventConfirmationDtoImpl;

  factory _EventConfirmationDto.fromJson(Map<String, dynamic> json) =
      _$EventConfirmationDtoImpl.fromJson;

  @override
  String get id;
  @override
  String get deviceId;
  @override
  EventChoiceDto get choice;
  @override
  DateTime get confirmedAt;
  @override
  int? get delaySeconds;
  @override
  bool get reminderUsed;
  @override
  @JsonKey(ignore: true)
  _$$EventConfirmationDtoImplCopyWith<_$EventConfirmationDtoImpl>
      get copyWith => throw _privateConstructorUsedError;
}

EventDto _$EventDtoFromJson(Map<String, dynamic> json) {
  return _EventDto.fromJson(json);
}

/// @nodoc
mixin _$EventDto {
  String get id => throw _privateConstructorUsedError;
  String get initiatorDeviceId => throw _privateConstructorUsedError;
  String get programId => throw _privateConstructorUsedError;
  EventStatusDto get status => throw _privateConstructorUsedError;
  DateTime get initiatedAt => throw _privateConstructorUsedError;
  DateTime? get validatedAt => throw _privateConstructorUsedError;
  DateTime? get expiresAt => throw _privateConstructorUsedError;
  int? get followerCountLimit => throw _privateConstructorUsedError;
  ProgramDto get program => throw _privateConstructorUsedError;
  List<EventConfirmationDto> get confirmations =>
      throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $EventDtoCopyWith<EventDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $EventDtoCopyWith<$Res> {
  factory $EventDtoCopyWith(EventDto value, $Res Function(EventDto) then) =
      _$EventDtoCopyWithImpl<$Res, EventDto>;
  @useResult
  $Res call(
      {String id,
      String initiatorDeviceId,
      String programId,
      EventStatusDto status,
      DateTime initiatedAt,
      DateTime? validatedAt,
      DateTime? expiresAt,
      int? followerCountLimit,
      ProgramDto program,
      List<EventConfirmationDto> confirmations});

  $ProgramDtoCopyWith<$Res> get program;
}

/// @nodoc
class _$EventDtoCopyWithImpl<$Res, $Val extends EventDto>
    implements $EventDtoCopyWith<$Res> {
  _$EventDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? initiatorDeviceId = null,
    Object? programId = null,
    Object? status = null,
    Object? initiatedAt = null,
    Object? validatedAt = freezed,
    Object? expiresAt = freezed,
    Object? followerCountLimit = freezed,
    Object? program = null,
    Object? confirmations = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      initiatorDeviceId: null == initiatorDeviceId
          ? _value.initiatorDeviceId
          : initiatorDeviceId // ignore: cast_nullable_to_non_nullable
              as String,
      programId: null == programId
          ? _value.programId
          : programId // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as EventStatusDto,
      initiatedAt: null == initiatedAt
          ? _value.initiatedAt
          : initiatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      validatedAt: freezed == validatedAt
          ? _value.validatedAt
          : validatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      expiresAt: freezed == expiresAt
          ? _value.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      followerCountLimit: freezed == followerCountLimit
          ? _value.followerCountLimit
          : followerCountLimit // ignore: cast_nullable_to_non_nullable
              as int?,
      program: null == program
          ? _value.program
          : program // ignore: cast_nullable_to_non_nullable
              as ProgramDto,
      confirmations: null == confirmations
          ? _value.confirmations
          : confirmations // ignore: cast_nullable_to_non_nullable
              as List<EventConfirmationDto>,
    ) as $Val);
  }

  @override
  @pragma('vm:prefer-inline')
  $ProgramDtoCopyWith<$Res> get program {
    return $ProgramDtoCopyWith<$Res>(_value.program, (value) {
      return _then(_value.copyWith(program: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$EventDtoImplCopyWith<$Res>
    implements $EventDtoCopyWith<$Res> {
  factory _$$EventDtoImplCopyWith(
          _$EventDtoImpl value, $Res Function(_$EventDtoImpl) then) =
      __$$EventDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String initiatorDeviceId,
      String programId,
      EventStatusDto status,
      DateTime initiatedAt,
      DateTime? validatedAt,
      DateTime? expiresAt,
      int? followerCountLimit,
      ProgramDto program,
      List<EventConfirmationDto> confirmations});

  @override
  $ProgramDtoCopyWith<$Res> get program;
}

/// @nodoc
class __$$EventDtoImplCopyWithImpl<$Res>
    extends _$EventDtoCopyWithImpl<$Res, _$EventDtoImpl>
    implements _$$EventDtoImplCopyWith<$Res> {
  __$$EventDtoImplCopyWithImpl(
      _$EventDtoImpl _value, $Res Function(_$EventDtoImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? initiatorDeviceId = null,
    Object? programId = null,
    Object? status = null,
    Object? initiatedAt = null,
    Object? validatedAt = freezed,
    Object? expiresAt = freezed,
    Object? followerCountLimit = freezed,
    Object? program = null,
    Object? confirmations = null,
  }) {
    return _then(_$EventDtoImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      initiatorDeviceId: null == initiatorDeviceId
          ? _value.initiatorDeviceId
          : initiatorDeviceId // ignore: cast_nullable_to_non_nullable
              as String,
      programId: null == programId
          ? _value.programId
          : programId // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as EventStatusDto,
      initiatedAt: null == initiatedAt
          ? _value.initiatedAt
          : initiatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      validatedAt: freezed == validatedAt
          ? _value.validatedAt
          : validatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      expiresAt: freezed == expiresAt
          ? _value.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      followerCountLimit: freezed == followerCountLimit
          ? _value.followerCountLimit
          : followerCountLimit // ignore: cast_nullable_to_non_nullable
              as int?,
      program: null == program
          ? _value.program
          : program // ignore: cast_nullable_to_non_nullable
              as ProgramDto,
      confirmations: null == confirmations
          ? _value._confirmations
          : confirmations // ignore: cast_nullable_to_non_nullable
              as List<EventConfirmationDto>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$EventDtoImpl implements _EventDto {
  const _$EventDtoImpl(
      {required this.id,
      required this.initiatorDeviceId,
      required this.programId,
      required this.status,
      required this.initiatedAt,
      this.validatedAt,
      this.expiresAt,
      this.followerCountLimit,
      required this.program,
      final List<EventConfirmationDto> confirmations =
          const <EventConfirmationDto>[]})
      : _confirmations = confirmations;

  factory _$EventDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$EventDtoImplFromJson(json);

  @override
  final String id;
  @override
  final String initiatorDeviceId;
  @override
  final String programId;
  @override
  final EventStatusDto status;
  @override
  final DateTime initiatedAt;
  @override
  final DateTime? validatedAt;
  @override
  final DateTime? expiresAt;
  @override
  final int? followerCountLimit;
  @override
  final ProgramDto program;
  final List<EventConfirmationDto> _confirmations;
  @override
  @JsonKey()
  List<EventConfirmationDto> get confirmations {
    if (_confirmations is EqualUnmodifiableListView) return _confirmations;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_confirmations);
  }

  @override
  String toString() {
    return 'EventDto(id: $id, initiatorDeviceId: $initiatorDeviceId, programId: $programId, status: $status, initiatedAt: $initiatedAt, validatedAt: $validatedAt, expiresAt: $expiresAt, followerCountLimit: $followerCountLimit, program: $program, confirmations: $confirmations)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$EventDtoImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.initiatorDeviceId, initiatorDeviceId) ||
                other.initiatorDeviceId == initiatorDeviceId) &&
            (identical(other.programId, programId) ||
                other.programId == programId) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.initiatedAt, initiatedAt) ||
                other.initiatedAt == initiatedAt) &&
            (identical(other.validatedAt, validatedAt) ||
                other.validatedAt == validatedAt) &&
            (identical(other.expiresAt, expiresAt) ||
                other.expiresAt == expiresAt) &&
            (identical(other.followerCountLimit, followerCountLimit) ||
                other.followerCountLimit == followerCountLimit) &&
            (identical(other.program, program) || other.program == program) &&
            const DeepCollectionEquality()
                .equals(other._confirmations, _confirmations));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      initiatorDeviceId,
      programId,
      status,
      initiatedAt,
      validatedAt,
      expiresAt,
      followerCountLimit,
      program,
      const DeepCollectionEquality().hash(_confirmations));

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$EventDtoImplCopyWith<_$EventDtoImpl> get copyWith =>
      __$$EventDtoImplCopyWithImpl<_$EventDtoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$EventDtoImplToJson(
      this,
    );
  }
}

abstract class _EventDto implements EventDto {
  const factory _EventDto(
      {required final String id,
      required final String initiatorDeviceId,
      required final String programId,
      required final EventStatusDto status,
      required final DateTime initiatedAt,
      final DateTime? validatedAt,
      final DateTime? expiresAt,
      final int? followerCountLimit,
      required final ProgramDto program,
      final List<EventConfirmationDto> confirmations}) = _$EventDtoImpl;

  factory _EventDto.fromJson(Map<String, dynamic> json) =
      _$EventDtoImpl.fromJson;

  @override
  String get id;
  @override
  String get initiatorDeviceId;
  @override
  String get programId;
  @override
  EventStatusDto get status;
  @override
  DateTime get initiatedAt;
  @override
  DateTime? get validatedAt;
  @override
  DateTime? get expiresAt;
  @override
  int? get followerCountLimit;
  @override
  ProgramDto get program;
  @override
  List<EventConfirmationDto> get confirmations;
  @override
  @JsonKey(ignore: true)
  _$$EventDtoImplCopyWith<_$EventDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
