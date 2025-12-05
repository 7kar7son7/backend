import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/device_token_api.dart';
import '../config/app_router.dart';
import 'local_notifications_service.dart';

class FcmService {
  FcmService._();

  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static ProviderContainer? _container;
  static final Set<String> _shownNotificationIds = <String>{};

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
    
    // Obsługa powiadomienia gdy aplikacja była zamknięta i użytkownik kliknął w powiadomienie
    // Czekamy chwilę, żeby router był gotowy
    Future.delayed(const Duration(milliseconds: 800), () async {
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        debugPrint('📲 FCM initial message (app was closed): ${initialMessage.data}');
        _handleNotificationTap(initialMessage.data);
      }
    });
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
    FirebaseMessaging.onMessage.listen((message) async {
      debugPrint('📨 FCM message received (foreground): ${message.messageId}');
      debugPrint('   Data: ${message.data}');
      debugPrint('   Notification: ${message.notification?.title} - ${message.notification?.body}');
      
      // Gdy aplikacja jest w foreground, pokaż lokalne powiadomienie
      // (Android nie pokazuje automatycznie push notifications w foreground)
      final type = message.data['type'] as String?;
      if (type == 'EVENT_STARTED') {
        final eventId = message.data['eventId'] as String?;
        final programId = message.data['programId'] as String?;
        
        // Zabezpieczenie przed duplikatami - sprawdź czy już pokazaliśmy to powiadomienie
        final notificationKey = eventId ?? message.messageId ?? '';
        if (_shownNotificationIds.contains(notificationKey)) {
          debugPrint('⚠️ Duplikat powiadomienia - pomijam: $notificationKey');
          return;
        }
        _shownNotificationIds.add(notificationKey);
        
        // Wyczyść stare ID po 1 godzinie (żeby nie zapychać pamięci)
        if (_shownNotificationIds.length > 100) {
          _shownNotificationIds.clear();
        }
        
        final title = message.notification?.title ?? 'KONIEC REKLAM';
        final body = message.notification?.body ?? 'Reklamy zakończone? Potwierdź!';
        
        // Utwórz payload dla lokalnego powiadomienia
        final payload = programId != null && eventId != null
            ? 'event_${eventId}_program_$programId'
            : null;
        
        // Pokaż lokalne powiadomienie z poprawną treścią
        await LocalNotificationsService.showReminder(
          id: eventId?.hashCode ?? DateTime.now().millisecondsSinceEpoch,
          title: title,
          body: body,
          payload: payload,
        );
      }
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      debugPrint('📲 FCM opened app via notification: ${message.data}');
      _handleNotificationTap(message.data);
    });
  }

  static void _handleNotificationTap(Map<String, dynamic> data) {
    if (_container == null) {
      debugPrint('⚠️ ProviderContainer not set, cannot handle notification tap');
      return;
    }

    try {
      final router = _container!.read(appRouterProvider);
      final type = data['type'] as String?;
      final programId = data['programId'] as String?;

      if (type != null && programId != null) {
        // Dla EVENT_STARTED przekieruj z eventId, żeby pokazać dialog potwierdzenia
        if (type == 'EVENT_STARTED') {
          final eventId = data['eventId'] as String?;
          debugPrint('🔔 Navigating to program with event: $programId, eventId: $eventId');
          Future.delayed(const Duration(milliseconds: 300), () {
            if (eventId != null) {
              router.go('/programs/$programId?eventId=$eventId');
            } else {
              router.go('/programs/$programId');
            }
          });
        } else if (type == 'PROGRAM_START_SOON' || type == 'PROGRAM_STARTED') {
          debugPrint('🔔 Navigating to program: $programId');
          Future.delayed(const Duration(milliseconds: 300), () {
            router.go('/programs/$programId');
          });
        }
      }
    } catch (error) {
      debugPrint('❌ Error handling notification tap: $error');
    }
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
