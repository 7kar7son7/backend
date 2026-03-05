import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:retrofit/retrofit.dart';

import '../../../core/network/api_response.dart';
import '../../../core/network/dio_provider.dart';
import 'follow_dto.dart';

part 'follow_api.g.dart';

@RestApi()
abstract class FollowApi {
  factory FollowApi(Dio dio, {String baseUrl}) = _FollowApi;

  @GET('/follows')
  Future<ApiResponse<List<FollowDto>>> getFollows();

  @POST('/follows')
  Future<ApiResponse<List<FollowDto>>> follow(@Body() FollowRequest body);

  @DELETE('/follows')
  Future<ApiResponse<List<FollowDto>>> unfollow(@Body() FollowRequest body);
}

final followApiProvider = Provider.autoDispose<FollowApi>((ref) {
  final dio = ref.watch(dioProvider);
  return FollowApi(dio);
});

class FollowRequest {
  FollowRequest({
    required this.type,
    required this.targetId,
  });

  final FollowTypeDto type;
  final String targetId;

  Map<String, dynamic> toJson() => {
        'type': type.name,
        'targetId': targetId,
      };
}

