import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/device_id_provider.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 60),
      headers: {
        'Content-Type': 'application/json',
      },
    ),
  );

  // Dodaj retry interceptor dla błędów 502/503/504
  dio.interceptors.add(
    InterceptorsWrapper(
      onError: (error, handler) {
        if (error.response?.statusCode == 502 || 
            error.response?.statusCode == 503 || 
            error.response?.statusCode == 504) {
          // Błąd serwera - możliwy timeout lub przeciążenie
          // Nie retry automatycznie - użytkownik może spróbować ponownie
        }
        handler.next(error);
      },
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final deviceId = await ref.read(deviceIdFutureProvider.future);
        options.headers['X-Device-Id'] = deviceId;
        handler.next(options);
      },
    ),
  );

  return dio;
});

