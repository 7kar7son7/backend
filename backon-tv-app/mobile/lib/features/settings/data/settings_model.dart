import 'package:flutter/foundation.dart';

@immutable
class Settings {
  const Settings._internal({
    required this.soundEnabled,
    required this.selectedSound,
    required this.sensitivity,
    required this.pushEnabled,
    required this.preferredChannelIds,
  });

  factory Settings({
    bool soundEnabled = true,
    String selectedSound = 'backon_notification_v1',
    NotificationSensitivity sensitivity = NotificationSensitivity.medium,
    bool pushEnabled = true,
    Set<String>? preferredChannelIds,
  }) {
    return Settings._internal(
      soundEnabled: soundEnabled,
      selectedSound: selectedSound,
      sensitivity: sensitivity,
      pushEnabled: pushEnabled,
      preferredChannelIds: Set.unmodifiable(preferredChannelIds ?? const <String>{}),
    );
  }

  final bool soundEnabled;
  final String selectedSound;
  final NotificationSensitivity sensitivity;
  /// Czy powiadomienia push (FCM) są włączone. Wyłączenie wyrejestrowuje token w backendzie.
  final bool pushEnabled;
  final Set<String> preferredChannelIds;

  Settings copyWith({
    bool? soundEnabled,
    String? selectedSound,
    NotificationSensitivity? sensitivity,
    bool? pushEnabled,
    Set<String>? preferredChannelIds,
  }) {
    return Settings(
      soundEnabled: soundEnabled ?? this.soundEnabled,
      selectedSound: selectedSound ?? this.selectedSound,
      sensitivity: sensitivity ?? this.sensitivity,
      pushEnabled: pushEnabled ?? this.pushEnabled,
      preferredChannelIds: preferredChannelIds ?? this.preferredChannelIds,
    );
  }
}

enum NotificationSensitivity { low, medium, high }

extension NotificationSensitivityLabel on NotificationSensitivity {
  String get label {
    switch (this) {
      case NotificationSensitivity.low:
        return '1 powiadomienie';
      case NotificationSensitivity.medium:
        return '2 powiadomienia';
      case NotificationSensitivity.high:
        return '3 powiadomienia';
    }
  }
}

extension NotificationSensitivityReminderMinutes on NotificationSensitivity {
  /// Minuty przed startem programu: czeste=15,10,5; standard=10,5; delikatne=5
  List<int> get reminderMinutesBefore {
    switch (this) {
      case NotificationSensitivity.high:
        return [15, 10, 5];
      case NotificationSensitivity.medium:
        return [10, 5];
      case NotificationSensitivity.low:
        return [5];
    }
  }
}
