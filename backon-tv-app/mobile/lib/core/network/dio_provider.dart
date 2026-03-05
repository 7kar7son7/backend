import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/device_id_provider.dart';

final dioProvider = Provider<Dio>((ref) {
  final baseUrl = AppConfig.apiBaseUrl.replaceFirst(RegExp(r'/$'), '');
  final dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
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

  // GET /channels – wymuszenie formatu { "data": [ ... ] } (jak przy starym EPG)
  dio.interceptors.add(
    InterceptorsWrapper(
      onResponse: (response, handler) {
        final path = response.requestOptions.path;
        if (!path.contains('channels') || response.requestOptions.method != 'GET') {
          handler.next(response);
          return;
        }
        List<dynamic>? list;
        if (response.data is Map<String, dynamic>) {
          final map = response.data as Map<String, dynamic>;
          final data = map['data'];
          if (data is List) {
            list = data;
          } else if (data is Map) {
            if (data['data'] is List) {
              list = data['data'] as List<dynamic>;
            } else if (data['channels'] is List) {
              list = data['channels'] as List<dynamic>;
            } else if (data['items'] is List) {
              list = data['items'] as List<dynamic>;
            }
          }
          if (list == null && map['channels'] is List) {
            list = map['channels'] as List<dynamic>;
          }
        } else if (response.data is List) {
          list = response.data as List<dynamic>;
        }
        if (list != null) {
          response.data = <String, dynamic>{'data': list};
        }
        handler.next(response);
      },
    ),
  );

  return dio;
});

