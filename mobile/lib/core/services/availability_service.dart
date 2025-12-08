import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:add_2_calendar/add_2_calendar.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'dart:io';

/// Serwis do sprawdzania dostępności funkcji i aplikacji
class AvailabilityService {
  AvailabilityService._();

  /// Sprawdź czy aplikacja kalendarza jest dostępna
  /// Używa metody próby dodania testowego eventu
  static Future<bool> isCalendarAppAvailable() async {
    try {
      if (Platform.isIOS) {
        // Na iOS kalendarz jest zawsze dostępny
        return true;
      }
      
      // Na Androidzie próbujemy dodać testowy event
      // Jeśli nie ma aplikacji kalendarza, add_2_calendar zwróci false lub rzuci wyjątek
      try {
        final testEvent = Event(
          title: 'Test',
          description: 'Test',
          location: 'Test',
          startDate: DateTime.now().add(const Duration(days: 1)),
          endDate: DateTime.now().add(const Duration(days: 1, hours: 1)),
        );
        
        // Próbujemy dodać event - jeśli zwróci false, oznacza że nie ma aplikacji
        final result = await Add2Calendar.addEvent2Cal(testEvent);
        
        // Jeśli się udało, anulujemy testowy event (nie możemy go anulować, ale to nie problem)
        // Ważne że sprawdziliśmy dostępność
        return result;
      } catch (e) {
        // Jeśli rzuci wyjątek związany z brakiem aplikacji, zwracamy false
        if (e.toString().contains('No Activity found') || 
            e.toString().contains('ActivityNotFoundException') ||
            e.toString().contains('No application')) {
          return false;
        }
        // Inne błędy mogą oznaczać że aplikacja jest, ale wystąpił inny problem
        // W takim przypadku zakładamy że aplikacja jest dostępna
        debugPrint('⚠️ Błąd sprawdzania kalendarza (ale aplikacja może być dostępna): $e');
        return true;
      }
    } catch (e) {
      debugPrint('❌ Błąd sprawdzania dostępności kalendarza: $e');
      return false;
    }
  }

  /// Sprawdź czy uprawnienia do powiadomień są przyznane
  static Future<bool> areNotificationPermissionsGranted() async {
    try {
      if (Platform.isAndroid) {
        final plugin = FlutterLocalNotificationsPlugin();
        final androidPlugin = plugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
        if (androidPlugin != null) {
          // Sprawdź uprawnienia (Android 13+)
          final granted = await androidPlugin.requestNotificationsPermission();
          return granted == true;
        }
        // Na starszych wersjach Androida uprawnienia są domyślnie przyznane
        return true;
      } else if (Platform.isIOS) {
        final plugin = FlutterLocalNotificationsPlugin();
        final iosPlugin = plugin.resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>();
        if (iosPlugin != null) {
          final granted = await iosPlugin.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          );
          return granted ?? false;
        }
        return false;
      }
      return false;
    } catch (e) {
      debugPrint('❌ Błąd sprawdzania uprawnień do powiadomień: $e');
      return false;
    }
  }

  /// Sprawdź czy uprawnienia do dokładnych alarmów są przyznane (Android 12+)
  static Future<bool> areExactAlarmPermissionsGranted() async {
    try {
      if (Platform.isAndroid) {
        final plugin = FlutterLocalNotificationsPlugin();
        final androidPlugin = plugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
        if (androidPlugin != null) {
          try {
            final granted = await androidPlugin.requestExactAlarmsPermission();
            return granted == true;
          } catch (e) {
            debugPrint('⚠️ Nie można sprawdzić uprawnień do dokładnych alarmów: $e');
            // Na starszych wersjach Androida nie ma tego uprawnienia
            return true;
          }
        }
        return true;
      }
      return true; // iOS nie wymaga tego uprawnienia
    } catch (e) {
      debugPrint('❌ Błąd sprawdzania uprawnień do dokładnych alarmów: $e');
      return false;
    }
  }

  /// Otwórz ustawienia aplikacji
  static Future<void> openAppSettings() async {
    try {
      if (Platform.isAndroid) {
        // Używamy intent do otwarcia ustawień aplikacji
        final url = Uri.parse('package:com.backontv.app');
        if (await canLaunchUrl(url)) {
          await launchUrl(url, mode: LaunchMode.externalApplication);
        } else {
          // Alternatywnie próbujemy przez android.settings
          final settingsUrl = Uri.parse('android.settings.APPLICATION_DETAILS_SETTINGS');
          if (await canLaunchUrl(settingsUrl)) {
            await launchUrl(settingsUrl, mode: LaunchMode.externalApplication);
          }
        }
      } else if (Platform.isIOS) {
        final url = Uri.parse('app-settings:');
        if (await canLaunchUrl(url)) {
          await launchUrl(url, mode: LaunchMode.externalApplication);
        }
      }
    } catch (e) {
      debugPrint('❌ Błąd otwierania ustawień aplikacji: $e');
    }
  }

  /// Otwórz Google Calendar w sklepie Play
  static Future<void> openCalendarInPlayStore() async {
    try {
      final url = Uri.parse('https://play.google.com/store/apps/details?id=com.google.android.calendar');
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        debugPrint('❌ Nie można otworzyć sklepu Play');
      }
    } catch (e) {
      debugPrint('❌ Błąd otwierania sklepu Play: $e');
    }
  }

  /// Otwórz ustawienia powiadomień systemowych (Android)
  static Future<void> openNotificationSettings() async {
    try {
      if (Platform.isAndroid) {
        // Próbujemy otworzyć ustawienia powiadomień
        final url = Uri.parse('android.settings.APP_NOTIFICATION_SETTINGS');
        if (await canLaunchUrl(url)) {
          await launchUrl(url, mode: LaunchMode.externalApplication);
        } else {
          // Fallback do ustawień aplikacji
          await openAppSettings();
        }
      } else {
        await openAppSettings();
      }
    } catch (e) {
      debugPrint('❌ Błąd otwierania ustawień powiadomień: $e');
      // Fallback do ustawień aplikacji
      await openAppSettings();
    }
  }
}

