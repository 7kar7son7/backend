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
  bool get isLoadingMore => throw _privateConstructorUsedError;
  bool get hasMore => throw _privateConstructorUsedError;

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
  $Res call({List<ChannelDto> channels, bool isLoadingMore, bool hasMore});
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
    Object? isLoadingMore = null,
    Object? hasMore = null,
  }) {
    return _then(_value.copyWith(
      channels: null == channels
          ? _value.channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<ChannelDto>,
      isLoadingMore: null == isLoadingMore
          ? _value.isLoadingMore
          : isLoadingMore // ignore: cast_nullable_to_non_nullable
              as bool,
      hasMore: null == hasMore
          ? _value.hasMore
          : hasMore // ignore: cast_nullable_to_non_nullable
              as bool,
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
  $Res call({List<ChannelDto> channels, bool isLoadingMore, bool hasMore});
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
    Object? isLoadingMore = null,
    Object? hasMore = null,
  }) {
    return _then(_$ChannelsViewStateImpl(
      channels: null == channels
          ? _value._channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<ChannelDto>,
      isLoadingMore: null == isLoadingMore
          ? _value.isLoadingMore
          : isLoadingMore // ignore: cast_nullable_to_non_nullable
              as bool,
      hasMore: null == hasMore
          ? _value.hasMore
          : hasMore // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$ChannelsViewStateImpl implements _ChannelsViewState {
  const _$ChannelsViewStateImpl(
      {required final List<ChannelDto> channels,
      this.isLoadingMore = false,
      this.hasMore = false})
      : _channels = channels;

  final List<ChannelDto> _channels;
  @override
  List<ChannelDto> get channels {
    if (_channels is EqualUnmodifiableListView) return _channels;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_channels);
  }

  @override
  @JsonKey()
  final bool isLoadingMore;
  @override
  @JsonKey()
  final bool hasMore;

  @override
  String toString() {
    return 'ChannelsViewState(channels: $channels, isLoadingMore: $isLoadingMore, hasMore: $hasMore)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChannelsViewStateImpl &&
            const DeepCollectionEquality().equals(other._channels, _channels) &&
            (identical(other.isLoadingMore, isLoadingMore) ||
                other.isLoadingMore == isLoadingMore) &&
            (identical(other.hasMore, hasMore) || other.hasMore == hasMore));
  }

  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_channels), isLoadingMore, hasMore);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$ChannelsViewStateImplCopyWith<_$ChannelsViewStateImpl> get copyWith =>
      __$$ChannelsViewStateImplCopyWithImpl<_$ChannelsViewStateImpl>(
          this, _$identity);
}

abstract class _ChannelsViewState implements ChannelsViewState {
  const factory _ChannelsViewState(
      {required final List<ChannelDto> channels,
      final bool isLoadingMore,
      final bool hasMore}) = _$ChannelsViewStateImpl;

  @override
  List<ChannelDto> get channels;
  @override
  bool get isLoadingMore;
  @override
  bool get hasMore;
  @override
  @JsonKey(ignore: true)
  _$$ChannelsViewStateImplCopyWith<_$ChannelsViewStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
