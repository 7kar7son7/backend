import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/local_notifications_service.dart';
import '../../features/follows/data/follow_api.dart';
import '../../features/follows/data/follow_dto.dart';
import '../../features/programs/data/program_dto.dart';

class ReminderService {
  ReminderService._();

  static const String _dailyReminderIdKey = 'daily_reminder_id';
  static const int _dailyReminderId = 9999; // Stałe ID dla dziennej przypominajki
  static const int _reminderMinutes = 15; // Domyślnie 15 minut przed

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
      final programIdHash = program.id.hashCode;
      final now = DateTime.now();
      
      debugPrint('🔔 Planowanie przypomnień dla programu: ${program.title}');
      debugPrint('   Start programu: ${program.startsAt.toString()}');
      debugPrint('   Teraz: ${now.toString()}');
      debugPrint('   Program w przyszłości: ${program.startsAt.isAfter(now)}');
      
      // Anuluj poprzednie przypominajki dla tego programu (jeśli istnieją)
      await cancelProgramReminders(program.id);

      // Zaplanuj przypominajki: 5, 10 i 15 minut przed startem
      final reminderTimes = [5, 10, 15];
      int scheduledCount = 0;
      Exception? firstError;
      
      for (final minutes in reminderTimes) {
        final reminderId = programIdHash + minutes; // Unikalne ID dla każdej przypominajki
        final reminderTime = program.startsAt.subtract(Duration(minutes: minutes));
        final timeDifference = reminderTime.difference(now);
        
        // Sprawdź czy przypomnienie jeszcze nie minęło i jest przynajmniej 1 minuta w przyszłości
        if (timeDifference.inMinutes >= 1) {
          try {
            debugPrint('🔔 Planowanie przypomnienia za $minutes min (za ${timeDifference.inMinutes} minut od teraz)');
            await LocalNotificationsService.scheduleProgramReminder(
              id: reminderId,
              programId: program.id,
              programTitle: program.title,
              channelName: program.channelName,
              programStartTime: program.startsAt,
              minutesBefore: minutes,
            );
            scheduledCount++;
            debugPrint('✅ Zaplanowano przypomnienie za $minutes min');
          } catch (e, stackTrace) {
            debugPrint('❌ Błąd planowania przypomnienia za $minutes min: $e');
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
          final reminderTime = program.startsAt.subtract(Duration(minutes: minutes));
          return reminderTime.difference(now).inMinutes >= 1;
        }).toList();
        
        if (upcomingReminders.isNotEmpty) {
          final times = upcomingReminders.map((m) {
            final time = program.startsAt.subtract(Duration(minutes: m));
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

  /// Anuluj przypominajki dla programu
  static Future<void> cancelProgramReminders(String programId) async {
    try {
      final programIdHash = programId.hashCode;
      final reminderTimes = [5, 10, 15];
      
      for (final minutes in reminderTimes) {
        final reminderId = programIdHash + minutes;
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

