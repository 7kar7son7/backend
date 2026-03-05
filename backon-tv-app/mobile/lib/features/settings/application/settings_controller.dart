import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;

import '../data/settings_model.dart';
import '../../../core/services/fcm_service.dart';
import '../../../core/services/local_notifications_service.dart';

final settingsControllerProvider = AutoDisposeAsyncNotifierProvider<SettingsController, Settings>(
  SettingsController.new,
);

class SettingsController extends AutoDisposeAsyncNotifier<Settings> {
  static const _soundKey = 'settings_sound_enabled';
  static const _customSoundKey = 'settings_custom_sound';
  static const _customSoundPathKey = 'settings_custom_sound_path';
  static const _sensitivityKey = 'settings_notification_sensitivity';
  static const _pushEnabledKey = 'settings_push_enabled';
  static const _channelsKey = 'settings_preferred_channels';
  static const _soundReminderDismissedKey = 'settings_sound_reminder_dismissed';

  SharedPreferences? _prefs;

  @override
  Future<Settings> build() async {
    _prefs = await SharedPreferences.getInstance();
    final prefs = _prefs!;

    final soundEnabled = prefs.getBool(_soundKey) ?? true;
    // Domyślnie używamy 'backon_notification_v1' (własny dźwięk BackOn)
    final selectedSound = prefs.getString(_customSoundKey) ?? 'backon_notification_v1';
    final sensitivityStr = prefs.getString(_sensitivityKey);
    final sensitivity = NotificationSensitivity.values.firstWhere(
      (value) => value.name == sensitivityStr,
      orElse: () => NotificationSensitivity.medium,
    );
    final pushEnabled = prefs.getBool(_pushEnabledKey) ?? true;
    final channelIds = prefs.getStringList(_channelsKey) ?? <String>[];

    return Settings(
      soundEnabled: soundEnabled,
      selectedSound: selectedSound,
      sensitivity: sensitivity,
      pushEnabled: pushEnabled,
      preferredChannelIds: channelIds.toSet(),
    );
  }

  Future<void> toggleSound(bool value) async {
    final current = state.value ?? await future;
    final updated = current.copyWith(soundEnabled: value);
    state = AsyncData(updated);
    await _prefs?.setBool(_soundKey, value);
  }

  Future<void> updateSelectedSound(String soundName) async {
    final current = state.value ?? await future;
    final updated = current.copyWith(selectedSound: soundName);
    state = AsyncData(updated);
    await _prefs?.setString(_customSoundKey, soundName);
    // Jeśli to nie jest własny plik, usuń ścieżkę
    if (soundName != 'custom_file') {
      await _prefs?.remove(_customSoundPathKey);
    }
    // Zaktualizuj dźwięk w serwisie powiadomień
    await LocalNotificationsService.setCustomSound(soundName);
    
    // Automatycznie ukryj banner, jeśli użytkownik ustawił dźwięk inny niż domyślny
    if (soundName != 'backon_notification_v1' && soundName != 'notification_sound' && soundName != 'default') {
      await dismissSoundReminder();
    }
  }
  
  /// Sprawdź, czy banner przypomnienia powinien być pokazany
  Future<bool> shouldShowSoundReminder() async {
    try {
      final prefs = _prefs ?? await SharedPreferences.getInstance();
      final dismissed = prefs.getBool(_soundReminderDismissedKey) ?? false;
      if (dismissed) return false;
      
      // Sprawdź, czy użytkownik ustawił dźwięk inny niż domyślny
      final current = state.value ?? await future;
      // Jeśli dźwięk jest ustawiony na coś innego niż domyślny, nie pokazuj bannera
      if (current.selectedSound != 'backon_notification_v1' &&
          current.selectedSound != 'notification_sound' && 
          current.selectedSound != 'default') {
        return false;
      }
      
      return true;
    } catch (e) {
      return true; // W przypadku błędu, pokaż banner
    }
  }
  
  /// Ukryj banner przypomnienia
  Future<void> dismissSoundReminder() async {
    try {
      final prefs = _prefs ?? await SharedPreferences.getInstance();
      await prefs.setBool(_soundReminderDismissedKey, true);
    } catch (e) {
      // Ignoruj błędy
    }
  }

  Future<void> pickCustomSoundFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['mp3', 'ogg', 'wav', 'm4a', 'aac'],
        withData: false,
      );

      if (result != null && result.files.single.path != null) {
        final sourcePath = result.files.single.path!;
        final sourceFile = File(sourcePath);
        
        // Sprawdź rozmiar pliku (max 5MB)
        final fileSize = await sourceFile.length();
        if (fileSize > 5 * 1024 * 1024) {
          throw Exception('Plik jest za duży. Maksymalny rozmiar: 5MB');
        }

        // Skopiuj plik do lokalnego storage aplikacji
        final appDir = await getApplicationDocumentsDirectory();
        final soundsDir = Directory(path.join(appDir.path, 'notification_sounds'));
        if (!await soundsDir.exists()) {
          await soundsDir.create(recursive: true);
        }

        final fileName = 'custom_notification_sound${path.extension(sourcePath)}';
        final destPath = path.join(soundsDir.path, fileName);
        final destFile = await sourceFile.copy(destPath);

        // Zapisz ścieżkę i ustaw jako wybrany dźwięk
        await _prefs?.setString(_customSoundPathKey, destFile.path);
        await updateSelectedSound('custom_file');
      }
    } catch (e) {
      rethrow;
    }
  }

  String? getCustomSoundPath() {
    return _prefs?.getString(_customSoundPathKey);
  }

  Future<void> updateSensitivity(NotificationSensitivity value) async {
    final current = state.value ?? await future;
    final updated = current.copyWith(sensitivity: value);
    state = AsyncData(updated);
    await _prefs?.setString(_sensitivityKey, value.name);
  }

  /// Włącz/wyłącz powiadomienia push. Przy wyłączeniu token jest wyrejestrowywany w backendzie.
  Future<void> setPushEnabled(bool value) async {
    final current = state.value ?? await future;
    final updated = current.copyWith(pushEnabled: value);
    state = AsyncData(updated);
    await _prefs?.setBool(_pushEnabledKey, value);
    await FcmService.updatePushRegistration(value);
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
