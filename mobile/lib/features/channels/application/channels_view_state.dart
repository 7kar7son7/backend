import 'package:freezed_annotation/freezed_annotation.dart';

import '../data/channel_dto.dart';

part 'channels_view_state.freezed.dart';

@freezed
class ChannelsViewState with _$ChannelsViewState {
  const factory ChannelsViewState({
    required List<ChannelDto> channels,
    required Set<String> followedChannelIds,
    @Default(false) bool isLoadingMore,
    @Default(false) bool hasMore,
  }) = _ChannelsViewState;

  const ChannelsViewState._();

  bool isChannelFollowed(String channelId) =>
      followedChannelIds.contains(channelId);
}

