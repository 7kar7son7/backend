import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

/// Tracking zdarzeń (analityka) – każdy event wysyłany do Firebase Analytics.
/// Nazwy eventów zgodne z wymaganiami produktowymi.
class AnalyticsService {
  AnalyticsService._();

  static FirebaseAnalytics? _instance;
  static FirebaseAnalytics get _analytics {
    _instance ??= FirebaseAnalytics.instance;
    return _instance!;
  }

  static bool get _isSupported {
    if (kIsWeb) return true;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
      case TargetPlatform.iOS:
        return true;
      default:
        return false;
    }
  }

  static Future<void> _logEvent(String name, [Map<String, Object>? params]) async {
    if (!_isSupported) return;
    try {
      await _analytics.logEvent(name: name, parameters: params);
    } catch (e) {
      debugPrint('AnalyticsService: failed to log $name: $e');
    }
  }

  /// Popup został otwarty (np. dialog „Koniec reklam?”).
  static Future<void> popupOpen({String? popupName}) async {
    await _logEvent('popup_open', popupName != null ? {'popup_name': popupName} : null);
  }

  /// Czas widoczności popupa w sekundach (logować przy zamknięciu).
  static Future<void> popupVisibleTime({required String popupName, required int seconds}) async {
    await _logEvent('popup_visible_time', {
      'popup_name': popupName,
      'visible_seconds': seconds,
    });
  }

  /// Reklama się załadowała (wywołać z integracji reklam).
  static Future<void> adLoaded({String? adUnitId}) async {
    await _logEvent('ad_loaded', adUnitId != null ? {'ad_unit_id': adUnitId} : null);
  }

  /// Reklama była wyświetlona (impression).
  static Future<void> adImpression({String? adUnitId}) async {
    await _logEvent('ad_impression', adUnitId != null ? {'ad_unit_id': adUnitId} : null);
  }

  /// Kliknięcie w reklamę.
  static Future<void> adClick({String? adUnitId}) async {
    await _logEvent('ad_click', adUnitId != null ? {'ad_unit_id': adUnitId} : null);
  }

  /// Użytkownik kliknął „Koniec reklam” (wysłano zgłoszenie lub potwierdzenie).
  static Future<void> koniecReklamClicked({String? programId, String? source}) async {
    final params = <String, Object>{};
    if (programId != null) params['program_id'] = programId;
    if (source != null) params['source'] = source;
    await _logEvent('koniec_reklam_clicked', params.isNotEmpty ? params : null);
  }

  /// Push notification dotarł na urządzenie (FCM onMessage).
  static Future<void> pushReceived({String? type}) async {
    await _logEvent('push_received', type != null ? {'type': type} : null);
  }

  /// Użytkownik otworzył aplikację z pusha (tap na powiadomienie).
  static Future<void> pushOpened({String? type}) async {
    await _logEvent('push_opened', type != null ? {'type': type} : null);
  }

  /// Użytkownik ustawił przypomnienie (np. X min przed programem).
  static Future<void> reminderSet({String? programId, int? minutesBefore}) async {
    final params = <String, Object>{};
    if (programId != null) params['program_id'] = programId;
    if (minutesBefore != null) params['minutes_before'] = minutesBefore;
    await _logEvent('reminder_set', params.isNotEmpty ? params : null);
  }

  /// Przypomnienie się odpaliło (lokalne powiadomienie wyświetlone).
  static Future<void> reminderTriggered({String? programId}) async {
    await _logEvent('reminder_triggered', programId != null ? {'program_id': programId} : null);
  }
}
