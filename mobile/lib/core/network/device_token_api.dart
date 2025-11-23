import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:retrofit/retrofit.dart';

import 'dio_provider.dart';

part 'device_token_api.g.dart';

@RestApi()
abstract class DeviceTokenApi {
  factory DeviceTokenApi(Dio dio, {String baseUrl}) = _DeviceTokenApi;

  @POST('/device/tokens')
  Future<void> registerToken(@Body() RegisterTokenRequest body);

  @DELETE('/device/tokens')
  Future<void> unregisterToken(@Body() UnregisterTokenRequest body);
}

class RegisterTokenRequest {
  RegisterTokenRequest({
    required this.token,
    this.platform,
  });

  final String token;
  final String? platform;

  Map<String, dynamic> toJson() => {
        'token': token,
        if (platform != null) 'platform': platform,
      };
}

class UnregisterTokenRequest {
  UnregisterTokenRequest({required this.token});

  final String token;

  Map<String, dynamic> toJson() => {
        'token': token,
      };
}

final deviceTokenApiProvider = Provider.autoDispose<DeviceTokenApi>((ref) {
  final dio = ref.watch(dioProvider);
  return DeviceTokenApi(dio);
});

