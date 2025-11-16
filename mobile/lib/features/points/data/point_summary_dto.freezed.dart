// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'point_summary_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

PointEntryDto _$PointEntryDtoFromJson(Map<String, dynamic> json) {
  return _PointEntryDto.fromJson(json);
}

/// @nodoc
mixin _$PointEntryDto {
  String get id => throw _privateConstructorUsedError;
  int get points => throw _privateConstructorUsedError;
  PointReasonDto get reason => throw _privateConstructorUsedError;
  String? get eventId => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $PointEntryDtoCopyWith<PointEntryDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PointEntryDtoCopyWith<$Res> {
  factory $PointEntryDtoCopyWith(
          PointEntryDto value, $Res Function(PointEntryDto) then) =
      _$PointEntryDtoCopyWithImpl<$Res, PointEntryDto>;
  @useResult
  $Res call(
      {String id,
      int points,
      PointReasonDto reason,
      String? eventId,
      String? description,
      DateTime createdAt});
}

/// @nodoc
class _$PointEntryDtoCopyWithImpl<$Res, $Val extends PointEntryDto>
    implements $PointEntryDtoCopyWith<$Res> {
  _$PointEntryDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? points = null,
    Object? reason = null,
    Object? eventId = freezed,
    Object? description = freezed,
    Object? createdAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      points: null == points
          ? _value.points
          : points // ignore: cast_nullable_to_non_nullable
              as int,
      reason: null == reason
          ? _value.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as PointReasonDto,
      eventId: freezed == eventId
          ? _value.eventId
          : eventId // ignore: cast_nullable_to_non_nullable
              as String?,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PointEntryDtoImplCopyWith<$Res>
    implements $PointEntryDtoCopyWith<$Res> {
  factory _$$PointEntryDtoImplCopyWith(
          _$PointEntryDtoImpl value, $Res Function(_$PointEntryDtoImpl) then) =
      __$$PointEntryDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int points,
      PointReasonDto reason,
      String? eventId,
      String? description,
      DateTime createdAt});
}

/// @nodoc
class __$$PointEntryDtoImplCopyWithImpl<$Res>
    extends _$PointEntryDtoCopyWithImpl<$Res, _$PointEntryDtoImpl>
    implements _$$PointEntryDtoImplCopyWith<$Res> {
  __$$PointEntryDtoImplCopyWithImpl(
      _$PointEntryDtoImpl _value, $Res Function(_$PointEntryDtoImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? points = null,
    Object? reason = null,
    Object? eventId = freezed,
    Object? description = freezed,
    Object? createdAt = null,
  }) {
    return _then(_$PointEntryDtoImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      points: null == points
          ? _value.points
          : points // ignore: cast_nullable_to_non_nullable
              as int,
      reason: null == reason
          ? _value.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as PointReasonDto,
      eventId: freezed == eventId
          ? _value.eventId
          : eventId // ignore: cast_nullable_to_non_nullable
              as String?,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PointEntryDtoImpl implements _PointEntryDto {
  const _$PointEntryDtoImpl(
      {required this.id,
      required this.points,
      required this.reason,
      this.eventId,
      this.description,
      required this.createdAt});

  factory _$PointEntryDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$PointEntryDtoImplFromJson(json);

  @override
  final String id;
  @override
  final int points;
  @override
  final PointReasonDto reason;
  @override
  final String? eventId;
  @override
  final String? description;
  @override
  final DateTime createdAt;

  @override
  String toString() {
    return 'PointEntryDto(id: $id, points: $points, reason: $reason, eventId: $eventId, description: $description, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PointEntryDtoImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.points, points) || other.points == points) &&
            (identical(other.reason, reason) || other.reason == reason) &&
            (identical(other.eventId, eventId) || other.eventId == eventId) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, points, reason, eventId, description, createdAt);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$PointEntryDtoImplCopyWith<_$PointEntryDtoImpl> get copyWith =>
      __$$PointEntryDtoImplCopyWithImpl<_$PointEntryDtoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PointEntryDtoImplToJson(
      this,
    );
  }
}

abstract class _PointEntryDto implements PointEntryDto {
  const factory _PointEntryDto(
      {required final String id,
      required final int points,
      required final PointReasonDto reason,
      final String? eventId,
      final String? description,
      required final DateTime createdAt}) = _$PointEntryDtoImpl;

  factory _PointEntryDto.fromJson(Map<String, dynamic> json) =
      _$PointEntryDtoImpl.fromJson;

  @override
  String get id;
  @override
  int get points;
  @override
  PointReasonDto get reason;
  @override
  String? get eventId;
  @override
  String? get description;
  @override
  DateTime get createdAt;
  @override
  @JsonKey(ignore: true)
  _$$PointEntryDtoImplCopyWith<_$PointEntryDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PointSummaryDto _$PointSummaryDtoFromJson(Map<String, dynamic> json) {
  return _PointSummaryDto.fromJson(json);
}

/// @nodoc
mixin _$PointSummaryDto {
  String get deviceId => throw _privateConstructorUsedError;
  int get totalPoints => throw _privateConstructorUsedError;
  int get streakLength => throw _privateConstructorUsedError;
  DateTime? get lastActive => throw _privateConstructorUsedError;
  List<PointEntryDto> get entries => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $PointSummaryDtoCopyWith<PointSummaryDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PointSummaryDtoCopyWith<$Res> {
  factory $PointSummaryDtoCopyWith(
          PointSummaryDto value, $Res Function(PointSummaryDto) then) =
      _$PointSummaryDtoCopyWithImpl<$Res, PointSummaryDto>;
  @useResult
  $Res call(
      {String deviceId,
      int totalPoints,
      int streakLength,
      DateTime? lastActive,
      List<PointEntryDto> entries});
}

/// @nodoc
class _$PointSummaryDtoCopyWithImpl<$Res, $Val extends PointSummaryDto>
    implements $PointSummaryDtoCopyWith<$Res> {
  _$PointSummaryDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? deviceId = null,
    Object? totalPoints = null,
    Object? streakLength = null,
    Object? lastActive = freezed,
    Object? entries = null,
  }) {
    return _then(_value.copyWith(
      deviceId: null == deviceId
          ? _value.deviceId
          : deviceId // ignore: cast_nullable_to_non_nullable
              as String,
      totalPoints: null == totalPoints
          ? _value.totalPoints
          : totalPoints // ignore: cast_nullable_to_non_nullable
              as int,
      streakLength: null == streakLength
          ? _value.streakLength
          : streakLength // ignore: cast_nullable_to_non_nullable
              as int,
      lastActive: freezed == lastActive
          ? _value.lastActive
          : lastActive // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      entries: null == entries
          ? _value.entries
          : entries // ignore: cast_nullable_to_non_nullable
              as List<PointEntryDto>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PointSummaryDtoImplCopyWith<$Res>
    implements $PointSummaryDtoCopyWith<$Res> {
  factory _$$PointSummaryDtoImplCopyWith(_$PointSummaryDtoImpl value,
          $Res Function(_$PointSummaryDtoImpl) then) =
      __$$PointSummaryDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String deviceId,
      int totalPoints,
      int streakLength,
      DateTime? lastActive,
      List<PointEntryDto> entries});
}

/// @nodoc
class __$$PointSummaryDtoImplCopyWithImpl<$Res>
    extends _$PointSummaryDtoCopyWithImpl<$Res, _$PointSummaryDtoImpl>
    implements _$$PointSummaryDtoImplCopyWith<$Res> {
  __$$PointSummaryDtoImplCopyWithImpl(
      _$PointSummaryDtoImpl _value, $Res Function(_$PointSummaryDtoImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? deviceId = null,
    Object? totalPoints = null,
    Object? streakLength = null,
    Object? lastActive = freezed,
    Object? entries = null,
  }) {
    return _then(_$PointSummaryDtoImpl(
      deviceId: null == deviceId
          ? _value.deviceId
          : deviceId // ignore: cast_nullable_to_non_nullable
              as String,
      totalPoints: null == totalPoints
          ? _value.totalPoints
          : totalPoints // ignore: cast_nullable_to_non_nullable
              as int,
      streakLength: null == streakLength
          ? _value.streakLength
          : streakLength // ignore: cast_nullable_to_non_nullable
              as int,
      lastActive: freezed == lastActive
          ? _value.lastActive
          : lastActive // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      entries: null == entries
          ? _value._entries
          : entries // ignore: cast_nullable_to_non_nullable
              as List<PointEntryDto>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PointSummaryDtoImpl implements _PointSummaryDto {
  const _$PointSummaryDtoImpl(
      {required this.deviceId,
      required this.totalPoints,
      required this.streakLength,
      this.lastActive,
      final List<PointEntryDto> entries = const <PointEntryDto>[]})
      : _entries = entries;

  factory _$PointSummaryDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$PointSummaryDtoImplFromJson(json);

  @override
  final String deviceId;
  @override
  final int totalPoints;
  @override
  final int streakLength;
  @override
  final DateTime? lastActive;
  final List<PointEntryDto> _entries;
  @override
  @JsonKey()
  List<PointEntryDto> get entries {
    if (_entries is EqualUnmodifiableListView) return _entries;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_entries);
  }

  @override
  String toString() {
    return 'PointSummaryDto(deviceId: $deviceId, totalPoints: $totalPoints, streakLength: $streakLength, lastActive: $lastActive, entries: $entries)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PointSummaryDtoImpl &&
            (identical(other.deviceId, deviceId) ||
                other.deviceId == deviceId) &&
            (identical(other.totalPoints, totalPoints) ||
                other.totalPoints == totalPoints) &&
            (identical(other.streakLength, streakLength) ||
                other.streakLength == streakLength) &&
            (identical(other.lastActive, lastActive) ||
                other.lastActive == lastActive) &&
            const DeepCollectionEquality().equals(other._entries, _entries));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(runtimeType, deviceId, totalPoints,
      streakLength, lastActive, const DeepCollectionEquality().hash(_entries));

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$PointSummaryDtoImplCopyWith<_$PointSummaryDtoImpl> get copyWith =>
      __$$PointSummaryDtoImplCopyWithImpl<_$PointSummaryDtoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PointSummaryDtoImplToJson(
      this,
    );
  }
}

abstract class _PointSummaryDto implements PointSummaryDto {
  const factory _PointSummaryDto(
      {required final String deviceId,
      required final int totalPoints,
      required final int streakLength,
      final DateTime? lastActive,
      final List<PointEntryDto> entries}) = _$PointSummaryDtoImpl;

  factory _PointSummaryDto.fromJson(Map<String, dynamic> json) =
      _$PointSummaryDtoImpl.fromJson;

  @override
  String get deviceId;
  @override
  int get totalPoints;
  @override
  int get streakLength;
  @override
  DateTime? get lastActive;
  @override
  List<PointEntryDto> get entries;
  @override
  @JsonKey(ignore: true)
  _$$PointSummaryDtoImplCopyWith<_$PointSummaryDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
