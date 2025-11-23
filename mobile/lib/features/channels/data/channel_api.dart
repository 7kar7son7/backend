import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:retrofit/retrofit.dart';

import '../../../core/network/api_response.dart';
import '../../../core/network/dio_provider.dart';
import '../../programs/data/program_dto.dart';
import 'channel_dto.dart';

part 'channel_api.g.dart';
part 'channel_api.freezed.dart';

@RestApi()
abstract class ChannelApi {
  factory ChannelApi(Dio dio, {String baseUrl}) = _ChannelApi;

  @GET('/channels')
  Future<ApiResponse<List<ChannelDto>>> getChannels({
    @Query('search') String? search,
    @Query('includePrograms') bool? includePrograms,
    @Query('limit') int? limit,
    @Query('offset') int? offset,
  });

  @GET('/channels/{channelId}')
  Future<ApiResponse<ChannelDto>> getChannel(@Path() String channelId);

  @GET('/channels/{channelId}/programs')
  Future<ApiResponse<ChannelProgramsDto>> getChannelPrograms(
    @Path() String channelId, {
    @Query('from') DateTime? from,
    @Query('to') DateTime? to,
  });
}

final channelApiProvider = Provider.autoDispose<ChannelApi>((ref) {
  final dio = ref.watch(dioProvider);
  return ChannelApi(dio);
});

@freezed
class ChannelProgramsDto with _$ChannelProgramsDto {
  const factory ChannelProgramsDto({
    required ChannelDto channel,
    @Default(<ProgramDto>[]) List<ProgramDto> programs,
  }) = _ChannelProgramsDto;

  factory ChannelProgramsDto.fromJson(Map<String, dynamic> json) =>
      _$ChannelProgramsDtoFromJson(json);
}

