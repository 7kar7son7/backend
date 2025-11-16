import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/settings_model.dart';

final settingsControllerProvider = AutoDisposeAsyncNotifierProvider<SettingsController, Settings>(
  SettingsController.new,
);

class SettingsController extends AutoDisposeAsyncNotifier<Settings> {
  static const _soundKey = 'settings_sound_enabled';
  static const _sensitivityKey = 'settings_notification_sensitivity';
  static const _channelsKey = 'settings_preferred_channels';

  SharedPreferences? _prefs;

  @override
  Future<Settings> build() async {
    _prefs = await SharedPreferences.getInstance();
    final prefs = _prefs!;

    final soundEnabled = prefs.getBool(_soundKey) ?? true;
    final sensitivityStr = prefs.getString(_sensitivityKey);
    final sensitivity = NotificationSensitivity.values.firstWhere(
      (value) => value.name == sensitivityStr,
      orElse: () => NotificationSensitivity.medium,
    );
    final channelIds = prefs.getStringList(_channelsKey) ?? <String>[];

    return Settings(
      soundEnabled: soundEnabled,
      sensitivity: sensitivity,
      preferredChannelIds: channelIds.toSet(),
    );
  }

  Future<void> toggleSound(bool value) async {
    final current = state.value ?? await future;
    final updated = current.copyWith(soundEnabled: value);
    state = AsyncData(updated);
    await _prefs?.setBool(_soundKey, value);
  }

  Future<void> updateSensitivity(NotificationSensitivity value) async {
    final current = state.value ?? await future;
    final updated = current.copyWith(sensitivity: value);
    state = AsyncData(updated);
    await _prefs?.setString(_sensitivityKey, value.name);
  }

  Future<void> togglePreferredChannel(String channelId) async {
    final current = state.value ?? await future;
    final updatedSet = Set<String>.from(current.preferredChannelIds);
    if (updatedSet.contains(channelId)) {
      updatedSet.remove(channelId);
    } else {
      updatedSet.add(channelId);
    }

    final updated = current.copyWith(preferredChannelIds: updatedSet);
    state = AsyncData(updated);
    await _prefs?.setStringList(_channelsKey, updated.preferredChannelIds.toList());
  }

  Future<void> clearPreferredChannels() async {
    final current = state.value ?? await future;
    final updated = current.copyWith(preferredChannelIds: const <String>{});
    state = AsyncData(updated);
    await _prefs?.remove(_channelsKey);
  }
}
