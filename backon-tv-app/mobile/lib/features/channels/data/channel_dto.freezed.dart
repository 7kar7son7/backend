// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'channel_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ChannelDto _$ChannelDtoFromJson(Map<String, dynamic> json) {
  return _ChannelDto.fromJson(json);
}

/// @nodoc
mixin _$ChannelDto {
  String get id => throw _privateConstructorUsedError;
  String get externalId => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String? get category => throw _privateConstructorUsedError;
  String? get logoUrl => throw _privateConstructorUsedError;
  String? get countryCode => throw _privateConstructorUsedError;
  List<ProgramDto> get programs => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $ChannelDtoCopyWith<ChannelDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChannelDtoCopyWith<$Res> {
  factory $ChannelDtoCopyWith(
          ChannelDto value, $Res Function(ChannelDto) then) =
      _$ChannelDtoCopyWithImpl<$Res, ChannelDto>;
  @useResult
  $Res call(
      {String id,
      String externalId,
      String name,
      String? description,
      String? category,
      String? logoUrl,
      String? countryCode,
      List<ProgramDto> programs});
}

/// @nodoc
class _$ChannelDtoCopyWithImpl<$Res, $Val extends ChannelDto>
    implements $ChannelDtoCopyWith<$Res> {
  _$ChannelDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? externalId = null,
    Object? name = null,
    Object? description = freezed,
    Object? category = freezed,
    Object? logoUrl = freezed,
    Object? countryCode = freezed,
    Object? programs = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      externalId: null == externalId
          ? _value.externalId
          : externalId // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      category: freezed == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as String?,
      logoUrl: freezed == logoUrl
          ? _value.logoUrl
          : logoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      countryCode: freezed == countryCode
          ? _value.countryCode
          : countryCode // ignore: cast_nullable_to_non_nullable
              as String?,
      programs: null == programs
          ? _value.programs
          : programs // ignore: cast_nullable_to_non_nullable
              as List<ProgramDto>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ChannelDtoImplCopyWith<$Res>
    implements $ChannelDtoCopyWith<$Res> {
  factory _$$ChannelDtoImplCopyWith(
          _$ChannelDtoImpl value, $Res Function(_$ChannelDtoImpl) then) =
      __$$ChannelDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String externalId,
      String name,
      String? description,
      String? category,
      String? logoUrl,
      String? countryCode,
      List<ProgramDto> programs});
}

/// @nodoc
class __$$ChannelDtoImplCopyWithImpl<$Res>
    extends _$ChannelDtoCopyWithImpl<$Res, _$ChannelDtoImpl>
    implements _$$ChannelDtoImplCopyWith<$Res> {
  __$$ChannelDtoImplCopyWithImpl(
      _$ChannelDtoImpl _value, $Res Function(_$ChannelDtoImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? externalId = null,
    Object? name = null,
    Object? description = freezed,
    Object? category = freezed,
    Object? logoUrl = freezed,
    Object? countryCode = freezed,
    Object? programs = null,
  }) {
    return _then(_$ChannelDtoImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      externalId: null == externalId
          ? _value.externalId
          : externalId // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      category: freezed == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as String?,
      logoUrl: freezed == logoUrl
          ? _value.logoUrl
          : logoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      countryCode: freezed == countryCode
          ? _value.countryCode
          : countryCode // ignore: cast_nullable_to_non_nullable
              as String?,
      programs: null == programs
          ? _value._programs
          : programs // ignore: cast_nullable_to_non_nullable
              as List<ProgramDto>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ChannelDtoImpl implements _ChannelDto {
  const _$ChannelDtoImpl(
      {required this.id,
      required this.externalId,
      required this.name,
      this.description,
      this.category,
      this.logoUrl,
      this.countryCode,
      final List<ProgramDto> programs = const <ProgramDto>[]})
      : _programs = programs;

  factory _$ChannelDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$ChannelDtoImplFromJson(json);

  @override
  final String id;
  @override
  final String externalId;
  @override
  final String name;
  @override
  final String? description;
  @override
  final String? category;
  @override
  final String? logoUrl;
  @override
  final String? countryCode;
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
    return 'ChannelDto(id: $id, externalId: $externalId, name: $name, description: $description, category: $category, logoUrl: $logoUrl, countryCode: $countryCode, programs: $programs)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChannelDtoImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.externalId, externalId) ||
                other.externalId == externalId) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl) &&
            (identical(other.countryCode, countryCode) ||
                other.countryCode == countryCode) &&
            const DeepCollectionEquality().equals(other._programs, _programs));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      externalId,
      name,
      description,
      category,
      logoUrl,
      countryCode,
      const DeepCollectionEquality().hash(_programs));

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$ChannelDtoImplCopyWith<_$ChannelDtoImpl> get copyWith =>
      __$$ChannelDtoImplCopyWithImpl<_$ChannelDtoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ChannelDtoImplToJson(
      this,
    );
  }
}

abstract class _ChannelDto implements ChannelDto {
  const factory _ChannelDto(
      {required final String id,
      required final String externalId,
      required final String name,
      final String? description,
      final String? category,
      final String? logoUrl,
      final String? countryCode,
      final List<ProgramDto> programs}) = _$ChannelDtoImpl;

  factory _ChannelDto.fromJson(Map<String, dynamic> json) =
      _$ChannelDtoImpl.fromJson;

  @override
  String get id;
  @override
  String get externalId;
  @override
  String get name;
  @override
  String? get description;
  @override
  String? get category;
  @override
  String? get logoUrl;
  @override
  String? get countryCode;
  @override
  List<ProgramDto> get programs;
  @override
  @JsonKey(ignore: true)
  _$$ChannelDtoImplCopyWith<_$ChannelDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
