// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'channels_view_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$ChannelsViewState {
  List<ChannelDto> get channels => throw _privateConstructorUsedError;
  Set<String> get followedChannelIds => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $ChannelsViewStateCopyWith<ChannelsViewState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChannelsViewStateCopyWith<$Res> {
  factory $ChannelsViewStateCopyWith(
          ChannelsViewState value, $Res Function(ChannelsViewState) then) =
      _$ChannelsViewStateCopyWithImpl<$Res, ChannelsViewState>;
  @useResult
  $Res call({List<ChannelDto> channels, Set<String> followedChannelIds});
}

/// @nodoc
class _$ChannelsViewStateCopyWithImpl<$Res, $Val extends ChannelsViewState>
    implements $ChannelsViewStateCopyWith<$Res> {
  _$ChannelsViewStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? channels = null,
    Object? followedChannelIds = null,
  }) {
    return _then(_value.copyWith(
      channels: null == channels
          ? _value.channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<ChannelDto>,
      followedChannelIds: null == followedChannelIds
          ? _value.followedChannelIds
          : followedChannelIds // ignore: cast_nullable_to_non_nullable
              as Set<String>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ChannelsViewStateImplCopyWith<$Res>
    implements $ChannelsViewStateCopyWith<$Res> {
  factory _$$ChannelsViewStateImplCopyWith(_$ChannelsViewStateImpl value,
          $Res Function(_$ChannelsViewStateImpl) then) =
      __$$ChannelsViewStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<ChannelDto> channels, Set<String> followedChannelIds});
}

/// @nodoc
class __$$ChannelsViewStateImplCopyWithImpl<$Res>
    extends _$ChannelsViewStateCopyWithImpl<$Res, _$ChannelsViewStateImpl>
    implements _$$ChannelsViewStateImplCopyWith<$Res> {
  __$$ChannelsViewStateImplCopyWithImpl(_$ChannelsViewStateImpl _value,
      $Res Function(_$ChannelsViewStateImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? channels = null,
    Object? followedChannelIds = null,
  }) {
    return _then(_$ChannelsViewStateImpl(
      channels: null == channels
          ? _value._channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<ChannelDto>,
      followedChannelIds: null == followedChannelIds
          ? _value._followedChannelIds
          : followedChannelIds // ignore: cast_nullable_to_non_nullable
              as Set<String>,
    ));
  }
}

/// @nodoc

class _$ChannelsViewStateImpl extends _ChannelsViewState {
  const _$ChannelsViewStateImpl(
      {required final List<ChannelDto> channels,
      required final Set<String> followedChannelIds})
      : _channels = channels,
        _followedChannelIds = followedChannelIds,
        super._();

  final List<ChannelDto> _channels;
  @override
  List<ChannelDto> get channels {
    if (_channels is EqualUnmodifiableListView) return _channels;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_channels);
  }

  final Set<String> _followedChannelIds;
  @override
  Set<String> get followedChannelIds {
    if (_followedChannelIds is EqualUnmodifiableSetView)
      return _followedChannelIds;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableSetView(_followedChannelIds);
  }

  @override
  String toString() {
    return 'ChannelsViewState(channels: $channels, followedChannelIds: $followedChannelIds)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChannelsViewStateImpl &&
            const DeepCollectionEquality().equals(other._channels, _channels) &&
            const DeepCollectionEquality()
                .equals(other._followedChannelIds, _followedChannelIds));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      const DeepCollectionEquality().hash(_channels),
      const DeepCollectionEquality().hash(_followedChannelIds));

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$ChannelsViewStateImplCopyWith<_$ChannelsViewStateImpl> get copyWith =>
      __$$ChannelsViewStateImplCopyWithImpl<_$ChannelsViewStateImpl>(
          this, _$identity);
}

abstract class _ChannelsViewState extends ChannelsViewState {
  const factory _ChannelsViewState(
      {required final List<ChannelDto> channels,
      required final Set<String> followedChannelIds}) = _$ChannelsViewStateImpl;
  const _ChannelsViewState._() : super._();

  @override
  List<ChannelDto> get channels;
  @override
  Set<String> get followedChannelIds;
  @override
  @JsonKey(ignore: true)
  _$$ChannelsViewStateImplCopyWith<_$ChannelsViewStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
