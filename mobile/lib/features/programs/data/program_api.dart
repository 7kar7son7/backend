import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:retrofit/retrofit.dart';

import '../../../core/network/api_response.dart';
import '../../../core/network/dio_provider.dart';
import 'program_dto.dart';

part 'program_api.g.dart';

@RestApi()
abstract class ProgramApi {
  factory ProgramApi(Dio dio, {String baseUrl}) = _ProgramApi;

  @GET('/programs/day')
  Future<ApiResponse<List<ProgramDto>>> getProgramsForDay(
    @Query('date') DateTime? date, {
    @Query('limit') int? limit,
    @Query('offset') int? offset,
  });
}

final programApiProvider = Provider.autoDispose<ProgramApi>((ref) {
  final dio = ref.watch(dioProvider);
  return ProgramApi(dio);
});
