import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/points_api.dart';
import '../data/point_summary_dto.dart';

final pointsSummaryProvider =
    FutureProvider.autoDispose<PointSummaryDto?>((ref) async {
  final api = ref.watch(pointsApiProvider);
  final response = await api.getMyPoints();
  return response.data;
});

