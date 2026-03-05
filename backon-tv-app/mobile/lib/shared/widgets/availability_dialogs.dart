import 'package:flutter/material.dart';
import '../../core/services/availability_service.dart';

/// Dialog informujący o braku aplikacji kalendarza
class CalendarUnavailableDialog extends StatelessWidget {
  const CalendarUnavailableDialog({super.key});

  static Future<void> show(BuildContext context) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (context) => const CalendarUnavailableDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Row(
        children: [
          Icon(Icons.calendar_today, color: Color(0xFFDC2626)),
          SizedBox(width: 8),
          Text('Aplikacja kalendarza wymagana'),
        ],
      ),
      content: const Text(
        'Aby dodać program do kalendarza, musisz mieć zainstalowaną aplikację kalendarza.\n\n'
        'Zainstaluj Kalendarz Google lub inną aplikację kalendarza, aby korzystać z tej funkcji.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Anuluj'),
        ),
        FilledButton(
          onPressed: () {
            Navigator.of(context).pop();
            AvailabilityService.openCalendarInPlayStore();
          },
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFDC2626),
          ),
          child: const Text('Zainstaluj Kalendarz Google'),
        ),
      ],
    );
  }
}

/// Dialog informujący o braku uprawnień do powiadomień
class NotificationPermissionDialog extends StatelessWidget {
  const NotificationPermissionDialog({super.key});

  static Future<void> show(BuildContext context) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (context) => const NotificationPermissionDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Row(
        children: [
          Icon(Icons.notifications_off, color: Color(0xFFDC2626)),
          SizedBox(width: 8),
          Text('Uprawnienia do powiadomień wymagane'),
        ],
      ),
      content: const Text(
        'Aby otrzymywać przypomnienia o programach, musisz przyznać uprawnienia do powiadomień.\n\n'
        'Przejdź do ustawień aplikacji i włącz powiadomienia, aby korzystać z tej funkcji.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Anuluj'),
        ),
        FilledButton(
          onPressed: () {
            Navigator.of(context).pop();
            AvailabilityService.openNotificationSettings();
          },
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFDC2626),
          ),
          child: const Text('Otwórz ustawienia'),
        ),
      ],
    );
  }
}

/// Dialog informujący o braku uprawnień do dokładnych alarmów (Android 12+)
class ExactAlarmPermissionDialog extends StatelessWidget {
  const ExactAlarmPermissionDialog({super.key});

  static Future<void> show(BuildContext context) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (context) => const ExactAlarmPermissionDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Row(
        children: [
          Icon(Icons.alarm_off, color: Color(0xFFDC2626)),
          SizedBox(width: 8),
          Text('Uprawnienia do alarmów wymagane'),
        ],
      ),
      content: const Text(
        'Aby otrzymywać dokładne przypomnienia o programach, musisz przyznać uprawnienia do alarmów.\n\n'
        'Przejdź do ustawień aplikacji i włącz uprawnienia do alarmów, aby przypomnienia działały dokładnie.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Anuluj'),
        ),
        FilledButton(
          onPressed: () {
            Navigator.of(context).pop();
            AvailabilityService.openAppSettings();
          },
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFDC2626),
          ),
          child: const Text('Otwórz ustawienia'),
        ),
      ],
    );
  }
}

