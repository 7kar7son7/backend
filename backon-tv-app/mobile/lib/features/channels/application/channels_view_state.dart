import 'package:freezed_annotation/freezed_annotation.dart';

import '../data/channel_dto.dart';

part 'channels_view_state.freezed.dart';

@freezed
class ChannelsViewState with _$ChannelsViewState {
  const factory ChannelsViewState({
    required List<ChannelDto> channels,
    @Default(false) bool isLoadingMore,
    @Default(false) bool hasMore,
  }) = _ChannelsViewState;
}

