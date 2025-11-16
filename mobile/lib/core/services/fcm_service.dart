import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

class FcmService {
  FcmService._();

  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  static Future<void> initialize() async {
    if (_isUnsupportedPlatform) {
      debugPrint('FCM initialization skipped on unsupported platform.');
      return;
    }

    await _messaging.setAutoInitEnabled(true);
    await _requestPermissions();
    await _configureForegroundHandling();
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
}
