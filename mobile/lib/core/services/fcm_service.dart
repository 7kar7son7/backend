import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/device_token_api.dart';
import '../network/dio_provider.dart';
import '../storage/device_id_provider.dart';

class FcmService {
  FcmService._();

  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static ProviderContainer? _container;

  static Future<void> initialize() async {
    if (_isUnsupportedPlatform) {
      debugPrint('FCM initialization skipped on unsupported platform.');
      return;
    }

    await _messaging.setAutoInitEnabled(true);
    await _requestPermissions();
    await _configureForegroundHandling();
  }

  /// Wywołaj tę funkcję po utworzeniu ProviderScope w aplikacji
  static Future<void> registerTokenInBackend(ProviderContainer container) async {
    _container = container;
    await _registerTokenInBackend();
  }

  static bool get _isUnsupportedPlatform {
    if (kIsWeb) {
      return true;
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
      case TargetPlatform.iOS:
        return false;
      default:
        return true;
    }
  }

  static Future<void> _requestPermissions() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: true,
    );

    debugPrint('🔔 FCM permission: ${settings.authorizationStatus}');
  }

  static Future<void> _configureForegroundHandling() async {
    FirebaseMessaging.onMessage.listen((message) {
      debugPrint('📨 FCM message received: ${message.messageId}');
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      debugPrint('📲 FCM opened app via notification: ${message.data}');
    });
  }

  static Future<String?> fetchDeviceToken() => _messaging.getToken();

  static Future<void> _registerTokenInBackend() async {
    if (_container == null) {
      debugPrint('⚠️ ProviderContainer not set, skipping token registration');
      return;
    }

    try {
      final token = await fetchDeviceToken();
      if (token == null) {
        debugPrint('⚠️ FCM token is null, skipping registration');
        return;
      }

      final deviceTokenApi = _container!.read(deviceTokenApiProvider);

      await deviceTokenApi.registerToken(
        RegisterTokenRequest(
          token: token,
          platform: defaultTargetPlatform.name,
        ),
      );

      debugPrint('✅ FCM token registered in backend');

      // Nasłuchuj zmian tokenu (np. po odświeżeniu)
      _messaging.onTokenRefresh.listen((newToken) async {
        if (_container == null) return;
        try {
          final api = _container!.read(deviceTokenApiProvider);
          await api.registerToken(
            RegisterTokenRequest(
              token: newToken,
              platform: defaultTargetPlatform.name,
            ),
          );
          debugPrint('✅ FCM token refreshed and re-registered in backend');
        } catch (error) {
          debugPrint('❌ Failed to re-register FCM token: $error');
        }
      });
    } catch (error) {
      debugPrint('❌ Failed to register FCM token in backend: $error');
    }
  }
}
