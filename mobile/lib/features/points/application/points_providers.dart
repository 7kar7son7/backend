import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/points_api.dart';
import '../data/point_summary_dto.dart';

final pointsSummaryProvider =
    FutureProvider.autoDispose<PointSummaryDto?>((ref) async {
  final api = ref.watch(pointsApiProvider);
  final response = await api.getMyPoints();
  return response.data;
});

final leaderboardProvider =
    FutureProvider.autoDispose<List<LeaderboardEntryDto>>((ref) async {
  final api = ref.watch(pointsApiProvider);
  final response = await api.getLeaderboard(limit: 50);
  return response.data;
});

