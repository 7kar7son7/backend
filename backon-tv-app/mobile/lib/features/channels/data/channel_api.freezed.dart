// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'channel_api.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ChannelProgramsDto _$ChannelProgramsDtoFromJson(Map<String, dynamic> json) {
  return _ChannelProgramsDto.fromJson(json);
}

/// @nodoc
mixin _$ChannelProgramsDto {
  ChannelDto get channel => throw _privateConstructorUsedError;
  List<ProgramDto> get programs => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $ChannelProgramsDtoCopyWith<ChannelProgramsDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChannelProgramsDtoCopyWith<$Res> {
  factory $ChannelProgramsDtoCopyWith(
          ChannelProgramsDto value, $Res Function(ChannelProgramsDto) then) =
      _$ChannelProgramsDtoCopyWithImpl<$Res, ChannelProgramsDto>;
  @useResult
  $Res call({ChannelDto channel, List<ProgramDto> programs});

  $ChannelDtoCopyWith<$Res> get channel;
}

/// @nodoc
class _$ChannelProgramsDtoCopyWithImpl<$Res, $Val extends ChannelProgramsDto>
    implements $ChannelProgramsDtoCopyWith<$Res> {
  _$ChannelProgramsDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? channel = null,
    Object? programs = null,
  }) {
    return _then(_value.copyWith(
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as ChannelDto,
      programs: null == programs
          ? _value.programs
          : programs // ignore: cast_nullable_to_non_nullable
              as List<ProgramDto>,
    ) as $Val);
  }

  @override
  @pragma('vm:prefer-inline')
  $ChannelDtoCopyWith<$Res> get channel {
    return $ChannelDtoCopyWith<$Res>(_value.channel, (value) {
      return _then(_value.copyWith(channel: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ChannelProgramsDtoImplCopyWith<$Res>
    implements $ChannelProgramsDtoCopyWith<$Res> {
  factory _$$ChannelProgramsDtoImplCopyWith(_$ChannelProgramsDtoImpl value,
          $Res Function(_$ChannelProgramsDtoImpl) then) =
      __$$ChannelProgramsDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({ChannelDto channel, List<ProgramDto> programs});

  @override
  $ChannelDtoCopyWith<$Res> get channel;
}

/// @nodoc
class __$$ChannelProgramsDtoImplCopyWithImpl<$Res>
    extends _$ChannelProgramsDtoCopyWithImpl<$Res, _$ChannelProgramsDtoImpl>
    implements _$$ChannelProgramsDtoImplCopyWith<$Res> {
  __$$ChannelProgramsDtoImplCopyWithImpl(_$ChannelProgramsDtoImpl _value,
      $Res Function(_$ChannelProgramsDtoImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? channel = null,
    Object? programs = null,
  }) {
    return _then(_$ChannelProgramsDtoImpl(
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as ChannelDto,
      programs: null == programs
          ? _value._programs
          : programs // ignore: cast_nullable_to_non_nullable
              as List<ProgramDto>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ChannelProgramsDtoImpl implements _ChannelProgramsDto {
  const _$ChannelProgramsDtoImpl(
      {required this.channel,
      final List<ProgramDto> programs = const <ProgramDto>[]})
      : _programs = programs;

  factory _$ChannelProgramsDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$ChannelProgramsDtoImplFromJson(json);

  @override
  final ChannelDto channel;
  final List<ProgramDto> _programs;
  @override
  @JsonKey()
  List<ProgramDto> get programs {
    if (_programs is EqualUnmodifiableListView) return _programs;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_programs);
  }

  @override
  String toString() {
    return 'ChannelProgramsDto(channel: $channel, programs: $programs)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChannelProgramsDtoImpl &&
            (identical(other.channel, channel) || other.channel == channel) &&
            const DeepCollectionEquality().equals(other._programs, _programs));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(
      runtimeType, channel, const DeepCollectionEquality().hash(_programs));

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$ChannelProgramsDtoImplCopyWith<_$ChannelProgramsDtoImpl> get copyWith =>
      __$$ChannelProgramsDtoImplCopyWithImpl<_$ChannelProgramsDtoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ChannelProgramsDtoImplToJson(
      this,
    );
  }
}

abstract class _ChannelProgramsDto implements ChannelProgramsDto {
  const factory _ChannelProgramsDto(
      {required final ChannelDto channel,
      final List<ProgramDto> programs}) = _$ChannelProgramsDtoImpl;

  factory _ChannelProgramsDto.fromJson(Map<String, dynamic> json) =
      _$ChannelProgramsDtoImpl.fromJson;

  @override
  ChannelDto get channel;
  @override
  List<ProgramDto> get programs;
  @override
  @JsonKey(ignore: true)
  _$$ChannelProgramsDtoImplCopyWith<_$ChannelProgramsDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
