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

  @PUT('/device/tokens/settings')
  Future<void> updateNotificationSettings(@Body() UpdateNotificationSettingsRequest body);
}

class RegisterTokenRequest {
  RegisterTokenRequest({
    required this.token,
    this.platform,
    this.notificationSensitivity,
  });

  final String token;
  final String? platform;
  final String? notificationSensitivity;

  Map<String, dynamic> toJson() => {
        'token': token,
        if (platform != null) 'platform': platform,
        if (notificationSensitivity != null) 'notificationSensitivity': notificationSensitivity,
      };
}

class UpdateNotificationSettingsRequest {
  UpdateNotificationSettingsRequest({
    required this.notificationSensitivity,
  });

  final String notificationSensitivity;

  Map<String, dynamic> toJson() => {
        'notificationSensitivity': notificationSensitivity,
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

