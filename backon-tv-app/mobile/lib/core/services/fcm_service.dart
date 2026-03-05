import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/device_token_api.dart';
import '../config/app_router.dart';
import '../storage/device_id_provider.dart';
import '../../features/events/application/events_notifier.dart';
import 'analytics_service.dart';
import 'local_notifications_service.dart';

/// Obsługa FCM (push). Wymagane: testy osobno na Android i iOS; brak duplikatów (ID w pamięci);
/// wyświetlenie lokalne od razu po otrzymaniu (opóźnienie po stronie backendu – max kilka sekund).
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
        final type = initialMessage.data['type'] as String?;
        AnalyticsService.pushOpened(type: type);
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
      final type = message.data['type'] as String?;
      await AnalyticsService.pushReceived(type: type);

      final prefs = await SharedPreferences.getInstance();
      final pushEnabled = prefs.getBool('settings_push_enabled') ?? true;
      if (!pushEnabled) return;

      // Gdy aplikacja jest w foreground, pokaż lokalne powiadomienie
      // (Android nie pokazuje automatycznie push notifications w foreground)
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
        
        await LocalNotificationsService.showKoniecReklamNotification(
          id: eventId?.hashCode ?? DateTime.now().millisecondsSinceEpoch,
          title: title,
          body: body,
          payload: payload,
        );
      } else if (type == 'EVENT_CONFIRMED') {
        final eventId = message.data['eventId'] as String?;
        final programId = message.data['programId'] as String?;
        
        // Zabezpieczenie przed duplikatami
        final notificationKey = 'EVENT_CONFIRMED_${eventId ?? message.messageId ?? ''}';
        if (_shownNotificationIds.contains(notificationKey)) {
          debugPrint('⚠️ Duplikat powiadomienia - pomijam: $notificationKey');
          return;
        }
        
        // WAŻNE: Sprawdź czy użytkownik już potwierdził ten event
        // Jeśli nie, nie pokazuj powiadomienia "Potwierdzenie reklam" 
        // (powinien dostać tylko "KONIEC REKLAM" - EVENT_STARTED)
        if (_container != null && eventId != null) {
          try {
            final eventsState = _container!.read(eventsNotifierProvider);
            final deviceId = _container!.read(deviceIdProvider);
            
            if (deviceId != null) {
              final hasConfirmed = eventsState.maybeWhen(
                data: (events) {
                  try {
                    final event = events.firstWhere((e) => e.id == eventId);
                    return event.confirmations.any(
                      (conf) => conf.deviceId == deviceId,
                    );
                  } catch (e) {
                    // Event nie został jeszcze załadowany - załóż że użytkownik nie potwierdził
                    debugPrint('⚠️ EVENT_CONFIRMED: Event $eventId not found, skipping notification');
                    return false;
                  }
                },
                orElse: () => false,
              );
              
              if (!hasConfirmed) {
                debugPrint('⚠️ EVENT_CONFIRMED: User has not confirmed event $eventId yet, skipping notification (should only get EVENT_STARTED)');
                return;
              }
            }
          } catch (e) {
            debugPrint('⚠️ Error checking event confirmation status: $e');
            // W przypadku błędu, pokaż powiadomienie (bezpieczniejsze)
          }
        }
        
        _shownNotificationIds.add(notificationKey);
        
        // Wyczyść stare ID
        if (_shownNotificationIds.length > 100) {
          _shownNotificationIds.clear();
        }
        
        final title = message.notification?.title ?? 'Potwierdzenie reklam';
        final body = message.notification?.body ?? 'Ktoś potwierdził koniec reklam!';
        
        // Utwórz payload dla lokalnego powiadomienia
        final payload = programId != null && eventId != null
            ? 'event_${eventId}_program_$programId'
            : null;
        
        await LocalNotificationsService.showKoniecReklamNotification(
          id: eventId?.hashCode ?? DateTime.now().millisecondsSinceEpoch,
          title: title,
          body: body,
          payload: payload,
        );
      } else if (type == 'PROGRAM_STARTED' || type == 'PROGRAM_START_SOON') {
        final programId = message.data['programId'] as String?;
        
        if (programId == null) {
          debugPrint('⚠️ PROGRAM_STARTED notification without programId, skipping');
          return;
        }
        
        // Zabezpieczenie przed duplikatami - sprawdź czy już pokazaliśmy to powiadomienie
        final notificationKey = '${type}_$programId';
        if (_shownNotificationIds.contains(notificationKey)) {
          debugPrint('⚠️ Duplikat powiadomienia - pomijam: $notificationKey');
          return;
        }
        _shownNotificationIds.add(notificationKey);
        
        // Wyczyść stare ID po 1 godzinie (żeby nie zapychać pamięci)
        if (_shownNotificationIds.length > 100) {
          _shownNotificationIds.clear();
        }
        
        final title = message.notification?.title ?? 'Program właśnie się zaczął';
        final body = message.notification?.body ?? '';
        
        // Utwórz payload dla lokalnego powiadomienia - format: "program_programId"
        final payload = 'program_$programId';
        
        // Pokaż lokalne powiadomienie z poprawną treścią
        await LocalNotificationsService.showReminder(
          id: programId.hashCode,
          title: title,
          body: body,
          payload: payload,
        );
      }
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      debugPrint('📲 FCM opened app via notification: ${message.data}');
      final type = message.data['type'] as String?;
      AnalyticsService.pushOpened(type: type);
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
        // Dla EVENT_STARTED i EVENT_CONFIRMED przekieruj z eventId, żeby pokazać dialog potwierdzenia
        if (type == 'EVENT_STARTED' || type == 'EVENT_CONFIRMED') {
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

  /// Wywołane po zmianie ustawienia „Powiadomienia push”. Rejestruje lub wyrejestrowuje token.
  static Future<void> updatePushRegistration(bool pushEnabled) async {
    if (pushEnabled) {
      await _registerTokenInBackend();
    } else {
      await _unregisterTokenFromBackend();
    }
  }

  static Future<void> _unregisterTokenFromBackend() async {
    if (_container == null) return;
    try {
      final token = await fetchDeviceToken();
      if (token == null) return;
      final api = _container!.read(deviceTokenApiProvider);
      await api.unregisterToken(UnregisterTokenRequest(token: token));
      debugPrint('✅ FCM token unregistered from backend (push disabled)');
    } catch (e) {
      debugPrint('❌ Failed to unregister FCM token: $e');
    }
  }

  static Future<void> _registerTokenInBackend() async {
    if (_container == null) {
      debugPrint('⚠️ ProviderContainer not set, skipping token registration');
      return;
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final pushEnabled = prefs.getBool('settings_push_enabled') ?? true;
      if (!pushEnabled) {
        await _unregisterTokenFromBackend();
        return;
      }

      final token = await fetchDeviceToken();
      if (token == null) {
        debugPrint('⚠️ FCM token is null, skipping registration');
        return;
      }

      // Pobierz aktualne ustawienia czułości powiadomień
      final sensitivityStr = prefs.getString('settings_notification_sensitivity');
      final notificationSensitivity = sensitivityStr?.toUpperCase(); // LOW, MEDIUM, HIGH

      final deviceTokenApi = _container!.read(deviceTokenApiProvider);

      await deviceTokenApi.registerToken(
        RegisterTokenRequest(
          token: token,
          platform: defaultTargetPlatform.name,
          notificationSensitivity: notificationSensitivity,
        ),
      );

      debugPrint('✅ FCM token registered in backend with sensitivity: $notificationSensitivity');

      // Nasłuchuj zmian tokenu (np. po odświeżeniu)
      _messaging.onTokenRefresh.listen((newToken) async {
        if (_container == null) return;
        try {
          final prefs = await SharedPreferences.getInstance();
          if (!(prefs.getBool('settings_push_enabled') ?? true)) return;
          final sensitivityStr = prefs.getString('settings_notification_sensitivity');
          final notificationSensitivity = sensitivityStr?.toUpperCase();

          final api = _container!.read(deviceTokenApiProvider);
          await api.registerToken(
            RegisterTokenRequest(
              token: newToken,
              platform: defaultTargetPlatform.name,
              notificationSensitivity: notificationSensitivity,
            ),
          );
          debugPrint('✅ FCM token refreshed and re-registered in backend with sensitivity: $notificationSensitivity');
        } catch (error) {
          debugPrint('❌ Failed to re-register FCM token: $error');
        }
      });
    } catch (error) {
      debugPrint('❌ Failed to register FCM token in backend: $error');
    }
  }
}
