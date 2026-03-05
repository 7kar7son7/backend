import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:retrofit/retrofit.dart';

import '../../../core/network/api_response.dart';
import '../../../core/network/dio_provider.dart';
import 'point_summary_dto.dart';

part 'points_api.g.dart';

@RestApi()
abstract class PointsApi {
  factory PointsApi(Dio dio, {String baseUrl}) = _PointsApi;

  @GET('/points/me')
  Future<ApiResponse<PointSummaryDto?>> getMyPoints();

  @GET('/points/leaderboard')
  Future<ApiResponse<List<LeaderboardEntryDto>>> getLeaderboard({
    @Query('limit') int? limit,
  });

  @POST('/points/manual')
  Future<void> addManualPoints(
    @Body() ManualPointsRequest body,
  );
}

final pointsApiProvider = Provider.autoDispose<PointsApi>((ref) {
  final dio = ref.watch(dioProvider);
  return PointsApi(dio);
});

class ManualPointsRequest {
  ManualPointsRequest({
    required this.deviceId,
    required this.amount,
    required this.description,
  });

  final String deviceId;
  final int amount;
  final String description;

  Map<String, dynamic> toJson() => {
        'deviceId': deviceId,
        'amount': amount,
        'description': description,
      };
}

