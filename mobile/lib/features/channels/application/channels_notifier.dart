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

  Future<ChannelsViewState> refresh() async {
    final newState = await _fetchData();
    state = AsyncValue.data(newState);
    return newState;
  }

  Future<ChannelsViewState> _fetchData({int limit = 100, int offset = 0}) async {
    final channelsResp = await _channelApi.getChannels(
      includePrograms: true,
      limit: limit,
      offset: offset,
    );

    // Filtruj kanały bez zaplanowanych programów
    final channelsWithPrograms = channelsResp.data
        .where((channel) => channel.programs.isNotEmpty)
        .toList();

    return ChannelsViewState(
      channels: channelsWithPrograms,
      hasMore: channelsResp.data.length == limit, // Jeśli zwrócono tyle ile limit, może być więcej
    );
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    state = AsyncValue.data(current.copyWith(isLoadingMore: true));
    
    try {
      final newChannels = await _fetchData(
        limit: 50,
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

