import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/local_notifications_service.dart';
import '../../features/follows/data/follow_api.dart';
import '../../features/follows/data/follow_dto.dart';
import '../../features/programs/data/program_dto.dart';
import '../../features/settings/data/settings_model.dart';

class ReminderService {
  ReminderService._();

  static const String _dailyReminderIdKey = 'daily_reminder_id';
  static const int _dailyReminderId = 9999; // Stałe ID dla dziennej przypominajki
  static const String _sensitivityKey = 'settings_notification_sensitivity';

  /// Inicjalizuj dzienną przypominajkę (1x dziennie o 11:00)
  static Future<void> initializeDailyReminder() async {
    try {
      await LocalNotificationsService.scheduleDailyReminder(
        id: _dailyReminderId,
        time: const TimeOfDay(hour: 11, minute: 0), // 11:00
      );
      debugPrint('✅ Zainicjalizowano dzienną przypominajkę');
    } catch (e) {
      debugPrint('❌ Błąd inicjalizacji dziennej przypominajki: $e');
    }
  }

  /// Zaplanuj przypominajki dla śledzonego programu
  static Future<void> scheduleProgramReminders(ProgramDto program) async {
    try {
      // Użyj dodatniego ID - hashCode może być ujemny, więc używamy abs() i dodajemy offset
      // Offset 1000000 zapewnia, że ID będzie zawsze dodatnie i unikalne
      final programIdHash = (program.id.hashCode.abs() % 1000000) + 1000000;
      final now = DateTime.now();
      
      // ProgramDto.fromJson używa DateTimeLocalConverter który konwertuje UTC na lokalną
      // Więc program.startsAt jest już w lokalnej strefie czasowej
      final localProgramStartTime = program.startsAt;
      
      debugPrint('🔔 Planowanie przypomnień dla programu: ${program.title}');
      debugPrint('   Program ID hash: $programIdHash');
      debugPrint('   Start programu (local): ${localProgramStartTime.toString()}');
      debugPrint('   Teraz: ${now.toString()}');
      debugPrint('   Program w przyszłości: ${localProgramStartTime.isAfter(now)}');
      
      // Anuluj poprzednie przypominajki dla tego programu (jeśli istnieją)
      await cancelProgramReminders(program.id);

      // Liczba i terminy przypomnień zależą od ustawienia czułości (1/2/3 powiadomienia)
      final prefs = await SharedPreferences.getInstance();
      final sensitivityStr = prefs.getString(_sensitivityKey);
      final sensitivity = NotificationSensitivity.values.firstWhere(
        (value) => value.name == sensitivityStr,
        orElse: () => NotificationSensitivity.medium,
      );
      final reminderTimes = sensitivity.reminderMinutesBefore;
      int scheduledCount = 0;
      Exception? firstError;
      
      for (final minutes in reminderTimes) {
        // ID musi być dodatnie! Używamy programIdHash (już dodatni) + offset dla unikalności
        // Używamy tego samego wzorca dla wszystkich przypomnień - mnożymy minuty przez 100000
        // 5 min -> +500000, 10 min -> +1000000, 15 min -> +1500000
        // To zapewnia unikalność i spójność dla wszystkich przypomnień
        final offset = minutes * 100000; // Dokładnie ten sam wzorzec dla wszystkich
        final reminderId = programIdHash + offset; // Unikalne ID dla każdej przypominajki
        final reminderTime = localProgramStartTime.subtract(Duration(minutes: minutes));
        final timeDifference = reminderTime.difference(now);
        
        // Sprawdź czy przypomnienie jeszcze nie minęło i jest przynajmniej 1 minuta w przyszłości
        if (timeDifference.inMinutes >= 1) {
          try {
            debugPrint('🔔 Planowanie przypomnienia za $minutes min (za ${timeDifference.inMinutes} minut od teraz)');
            debugPrint('   Reminder ID: $reminderId (programIdHash: $programIdHash + offset: $offset)');
            await LocalNotificationsService.scheduleProgramReminder(
              id: reminderId,
              programId: program.id,
              programTitle: program.title,
              channelName: program.channelName,
              programStartTime: localProgramStartTime,
              minutesBefore: minutes,
            );
            scheduledCount++;
            debugPrint('✅ Zaplanowano przypomnienie za $minutes min (ID: $reminderId)');
          } catch (e, stackTrace) {
            debugPrint('❌ Błąd planowania przypomnienia za $minutes min (ID: $reminderId): $e');
            debugPrint('Stack trace: $stackTrace');
            // Zapisz pierwszy błąd, ale kontynuuj próby dla innych przypomnień
            if (firstError == null && e is Exception) {
              firstError = e;
            } else if (firstError == null) {
              firstError = Exception(e.toString());
            }
          }
        } else {
          debugPrint('⏰ Pominięto przypomnienie za $minutes min (za blisko lub już minęło: ${timeDifference.inMinutes} min różnicy)');
        }
      }

      debugPrint('✅ Zaplanowano $scheduledCount/${reminderTimes.length} przypomnień dla programu: ${program.title}');
      
      // Sprawdź wszystkie zaplanowane powiadomienia
      await LocalNotificationsService.checkPendingNotifications();
      
      // Jeśli zaplanowano przynajmniej jedno przypomnienie, pokaż szczegóły
      if (scheduledCount > 0) {
        final now = DateTime.now();
        final upcomingReminders = reminderTimes.where((minutes) {
          final reminderTime = localProgramStartTime.subtract(Duration(minutes: minutes));
          return reminderTime.difference(now).inMinutes >= 1;
        }).toList();
        
        if (upcomingReminders.isNotEmpty) {
          final times = upcomingReminders.map((m) {
            final time = localProgramStartTime.subtract(Duration(minutes: m));
            return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
          }).join(', ');
          debugPrint('📅 Przypomnienia zaplanowane na: $times');
        }
      }
      
      // Jeśli nie udało się zaplanować żadnego przypomnienia i był błąd, rzuć wyjątek
      if (scheduledCount == 0) {
        if (firstError != null) {
          debugPrint('❌ Nie udało się zaplanować żadnego przypomnienia. Błąd: $firstError');
          throw firstError;
        } else {
          // Wszystkie przypomnienia były w przeszłości
          debugPrint('⚠️ Wszystkie przypomnienia były w przeszłości - program może już się rozpocząć');
          throw Exception('Nie można zaplanować przypomnień - program już się rozpoczął lub wszystkie przypomnienia są w przeszłości');
        }
      }
      
      // Jeśli udało się zaplanować przynajmniej jedno, ale były błędy, tylko zaloguj
      if (scheduledCount > 0 && firstError != null) {
        debugPrint('⚠️ Udało się zaplanować tylko $scheduledCount/${reminderTimes.length} przypomnień');
      }
    } catch (e, stackTrace) {
      debugPrint('❌ Błąd planowania przypominajek: $e');
      debugPrint('Stack trace: $stackTrace');
      // Rzuć błąd dalej, aby można było go obsłużyć w UI
      rethrow;
    }
  }

  /// Anuluj przypominajki dla programu (wszystkie możliwe 5, 10, 15 min)
  static Future<void> cancelProgramReminders(String programId) async {
    try {
      final programIdHash = (programId.hashCode.abs() % 1000000) + 1000000;
      const allPossibleMinutes = [5, 10, 15];

      for (final minutes in allPossibleMinutes) {
        // Użyj dokładnie tego samego algorytmu co w scheduleProgramReminders
        final offset = minutes * 100000; // Dokładnie ten sam wzorzec
        final reminderId = programIdHash + offset;
        await LocalNotificationsService.cancelNotification(reminderId);
      }

      debugPrint('✅ Anulowano przypominajki dla programu: $programId');
    } catch (e) {
      debugPrint('❌ Błąd anulowania przypominajek: $e');
    }
  }

  /// Odśwież wszystkie przypominajki na podstawie aktualnie śledzonych programów
  static Future<void> refreshAllReminders(FollowApi followApi) async {
    try {
      // Pobierz wszystkie śledzone programy
      final response = await followApi.getFollows();
      final followedPrograms = response.data
          .where((item) => item.type == FollowTypeDto.PROGRAM && item.program != null)
          .map((item) => item.program!)
          .toList();

      // Anuluj wszystkie przypominajki programów (żeby uniknąć duplikatów)
      for (final follow in response.data) {
        if (follow.type == FollowTypeDto.PROGRAM && follow.program != null) {
          await cancelProgramReminders(follow.program!.id);
        }
      }

      // Zaplanuj nowe przypominajki tylko dla programów w przyszłości
      // ProgramDto.fromJson używa DateTimeLocalConverter - program.startsAt jest już lokalny
      final now = DateTime.now();
      for (final program in followedPrograms) {
        if (program.startsAt.isAfter(now)) {
          await scheduleProgramReminders(program);
        }
      }

      debugPrint('✅ Odświeżono przypominajki dla ${followedPrograms.length} programów');
    } catch (e) {
      debugPrint('❌ Błąd odświeżania przypominajek: $e');
    }
  }
}

/// Provider dla ReminderService
final reminderServiceProvider = Provider<ReminderService>((ref) {
  return ReminderService._();
});

