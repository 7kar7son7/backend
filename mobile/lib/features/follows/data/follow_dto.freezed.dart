// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'follow_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

FollowDto _$FollowDtoFromJson(Map<String, dynamic> json) {
  return _FollowDto.fromJson(json);
}

/// @nodoc
mixin _$FollowDto {
  String get id => throw _privateConstructorUsedError;
  String get deviceId => throw _privateConstructorUsedError;
  FollowTypeDto get type => throw _privateConstructorUsedError;
  ChannelDto? get channel => throw _privateConstructorUsedError;
  ProgramDto? get program => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $FollowDtoCopyWith<FollowDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $FollowDtoCopyWith<$Res> {
  factory $FollowDtoCopyWith(FollowDto value, $Res Function(FollowDto) then) =
      _$FollowDtoCopyWithImpl<$Res, FollowDto>;
  @useResult
  $Res call(
      {String id,
      String deviceId,
      FollowTypeDto type,
      ChannelDto? channel,
      ProgramDto? program,
      DateTime createdAt,
      DateTime? updatedAt});

  $ChannelDtoCopyWith<$Res>? get channel;
  $ProgramDtoCopyWith<$Res>? get program;
}

/// @nodoc
class _$FollowDtoCopyWithImpl<$Res, $Val extends FollowDto>
    implements $FollowDtoCopyWith<$Res> {
  _$FollowDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? deviceId = null,
    Object? type = null,
    Object? channel = freezed,
    Object? program = freezed,
    Object? createdAt = null,
    Object? updatedAt = freezed,
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
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as FollowTypeDto,
      channel: freezed == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as ChannelDto?,
      program: freezed == program
          ? _value.program
          : program // ignore: cast_nullable_to_non_nullable
              as ProgramDto?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }

  @override
  @pragma('vm:prefer-inline')
  $ChannelDtoCopyWith<$Res>? get channel {
    if (_value.channel == null) {
      return null;
    }

    return $ChannelDtoCopyWith<$Res>(_value.channel!, (value) {
      return _then(_value.copyWith(channel: value) as $Val);
    });
  }

  @override
  @pragma('vm:prefer-inline')
  $ProgramDtoCopyWith<$Res>? get program {
    if (_value.program == null) {
      return null;
    }

    return $ProgramDtoCopyWith<$Res>(_value.program!, (value) {
      return _then(_value.copyWith(program: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$FollowDtoImplCopyWith<$Res>
    implements $FollowDtoCopyWith<$Res> {
  factory _$$FollowDtoImplCopyWith(
          _$FollowDtoImpl value, $Res Function(_$FollowDtoImpl) then) =
      __$$FollowDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String deviceId,
      FollowTypeDto type,
      ChannelDto? channel,
      ProgramDto? program,
      DateTime createdAt,
      DateTime? updatedAt});

  @override
  $ChannelDtoCopyWith<$Res>? get channel;
  @override
  $ProgramDtoCopyWith<$Res>? get program;
}

/// @nodoc
class __$$FollowDtoImplCopyWithImpl<$Res>
    extends _$FollowDtoCopyWithImpl<$Res, _$FollowDtoImpl>
    implements _$$FollowDtoImplCopyWith<$Res> {
  __$$FollowDtoImplCopyWithImpl(
      _$FollowDtoImpl _value, $Res Function(_$FollowDtoImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? deviceId = null,
    Object? type = null,
    Object? channel = freezed,
    Object? program = freezed,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_$FollowDtoImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      deviceId: null == deviceId
          ? _value.deviceId
          : deviceId // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as FollowTypeDto,
      channel: freezed == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as ChannelDto?,
      program: freezed == program
          ? _value.program
          : program // ignore: cast_nullable_to_non_nullable
              as ProgramDto?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$FollowDtoImpl implements _FollowDto {
  const _$FollowDtoImpl(
      {required this.id,
      required this.deviceId,
      required this.type,
      this.channel,
      this.program,
      required this.createdAt,
      this.updatedAt});

  factory _$FollowDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$FollowDtoImplFromJson(json);

  @override
  final String id;
  @override
  final String deviceId;
  @override
  final FollowTypeDto type;
  @override
  final ChannelDto? channel;
  @override
  final ProgramDto? program;
  @override
  final DateTime createdAt;
  @override
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'FollowDto(id: $id, deviceId: $deviceId, type: $type, channel: $channel, program: $program, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$FollowDtoImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.deviceId, deviceId) ||
                other.deviceId == deviceId) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.program, program) || other.program == program) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, deviceId, type, channel, program, createdAt, updatedAt);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$FollowDtoImplCopyWith<_$FollowDtoImpl> get copyWith =>
      __$$FollowDtoImplCopyWithImpl<_$FollowDtoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$FollowDtoImplToJson(
      this,
    );
  }
}

abstract class _FollowDto implements FollowDto {
  const factory _FollowDto(
      {required final String id,
      required final String deviceId,
      required final FollowTypeDto type,
      final ChannelDto? channel,
      final ProgramDto? program,
      required final DateTime createdAt,
      final DateTime? updatedAt}) = _$FollowDtoImpl;

  factory _FollowDto.fromJson(Map<String, dynamic> json) =
      _$FollowDtoImpl.fromJson;

  @override
  String get id;
  @override
  String get deviceId;
  @override
  FollowTypeDto get type;
  @override
  ChannelDto? get channel;
  @override
  ProgramDto? get program;
  @override
  DateTime get createdAt;
  @override
  DateTime? get updatedAt;
  @override
  @JsonKey(ignore: true)
  _$$FollowDtoImplCopyWith<_$FollowDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
