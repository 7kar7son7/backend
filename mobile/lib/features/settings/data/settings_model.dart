import 'package:flutter/foundation.dart';

@immutable
class Settings {
  const Settings._internal({
    required this.soundEnabled,
    required this.sensitivity,
    required this.preferredChannelIds,
  });

  factory Settings({
    bool soundEnabled = true,
    NotificationSensitivity sensitivity = NotificationSensitivity.medium,
    Set<String>? preferredChannelIds,
  }) {
    return Settings._internal(
      soundEnabled: soundEnabled,
      sensitivity: sensitivity,
      preferredChannelIds: Set.unmodifiable(preferredChannelIds ?? const <String>{}),
    );
  }

  final bool soundEnabled;
  final NotificationSensitivity sensitivity;
  final Set<String> preferredChannelIds;

  Settings copyWith({
    bool? soundEnabled,
    NotificationSensitivity? sensitivity,
    Set<String>? preferredChannelIds,
  }) {
    return Settings(
      soundEnabled: soundEnabled ?? this.soundEnabled,
      sensitivity: sensitivity ?? this.sensitivity,
      preferredChannelIds: preferredChannelIds ?? this.preferredChannelIds,
    );
  }
}

enum NotificationSensitivity { low, medium, high }

extension NotificationSensitivityLabel on NotificationSensitivity {
  String get label {
    switch (this) {
      case NotificationSensitivity.low:
        return 'Delikatne';
      case NotificationSensitivity.medium:
        return 'Standardowe';
      case NotificationSensitivity.high:
        return 'Częste';
    }
  }
}
