import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:retrofit/retrofit.dart';

import 'api_response.dart';
import 'dio_provider.dart';

part 'app_version_api.g.dart';

@RestApi()
abstract class AppVersionApi {
  factory AppVersionApi(Dio dio, {String baseUrl}) = _AppVersionApi;

  @GET('/app/version')
  Future<ApiResponse<AppVersionDto>> getLatestVersion();
}

final appVersionApiProvider = Provider.autoDispose<AppVersionApi>((ref) {
  final dio = ref.watch(dioProvider);
  return AppVersionApi(dio);
});

class AppVersionDto {
  AppVersionDto({
    required this.version,
    required this.buildNumber,
    this.minRequiredVersion,
    required this.updateUrl,
  });

  final String version;
  final int buildNumber;
  final String? minRequiredVersion;
  final String updateUrl;

  factory AppVersionDto.fromJson(Map<String, dynamic> json) {
    return AppVersionDto(
      version: json['version'] as String,
      buildNumber: json['buildNumber'] as int,
      minRequiredVersion: json['minRequiredVersion'] as String?,
      updateUrl: json['updateUrl'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
        'version': version,
        'buildNumber': buildNumber,
        if (minRequiredVersion != null) 'minRequiredVersion': minRequiredVersion,
        'updateUrl': updateUrl,
      };
}

