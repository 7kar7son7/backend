import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../follows/data/follow_api.dart';
import '../../follows/data/follow_dto.dart';
import '../data/channel_api.dart';
import 'channels_view_state.dart';

class ChannelsNotifier extends AutoDisposeAsyncNotifier<ChannelsViewState> {
  late final ChannelApi _channelApi;
  late final FollowApi _followApi;

  @override
  Future<ChannelsViewState> build() async {
    _channelApi = ref.watch(channelApiProvider);
    _followApi = ref.watch(followApiProvider);

    return _fetchData();
  }

  Future<void> followChannel(String channelId) async {
    await _followApi.follow(
      FollowRequest(type: FollowTypeDto.CHANNEL, targetId: channelId),
    );
    state = await AsyncValue.guard(_fetchData);
  }

  Future<void> unfollowChannel(String channelId) async {
    await _followApi.unfollow(
      FollowRequest(type: FollowTypeDto.CHANNEL, targetId: channelId),
    );
    state = await AsyncValue.guard(_fetchData);
  }

  Future<ChannelsViewState> refresh() async {
    final newState = await _fetchData();
    state = AsyncValue.data(newState);
    return newState;
  }

  Future<ChannelsViewState> _fetchData({int limit = 20, int offset = 0}) async {
    final channelsResp = await _channelApi.getChannels(
      includePrograms: true,
      limit: limit,
      offset: offset,
    );
    final followsResp = await _followApi.getFollows();

    final followedChannelIds = followsResp.data
        .where((item) => item.type == FollowTypeDto.CHANNEL)
        .map((item) => item.channel?.id)
        .whereType<String>()
        .toSet();

    return ChannelsViewState(
      channels: channelsResp.data,
      followedChannelIds: followedChannelIds,
      hasMore: channelsResp.data.length == limit, // Jeśli zwrócono tyle ile limit, może być więcej
    );
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    state = AsyncValue.data(current.copyWith(isLoadingMore: true));
    
    try {
      final newChannels = await _fetchData(
        limit: 10,
        offset: current.channels.length,
      );
      
      final updated = current.copyWith(
        channels: [...current.channels, ...newChannels.channels],
        hasMore: newChannels.hasMore,
        isLoadingMore: false,
      );
      
      state = AsyncValue.data(updated);
    } catch (error) {
      state = AsyncValue.data(current.copyWith(isLoadingMore: false));
      rethrow;
    }
  }
}

final channelsNotifierProvider = AutoDisposeAsyncNotifierProvider<
    ChannelsNotifier, ChannelsViewState>(ChannelsNotifier.new);

