import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

final themeModeProvider =
    AutoDisposeAsyncNotifierProvider<ThemeModeController, ThemeMode>(
  ThemeModeController.new,
);

final localeProvider = StateProvider<Locale?>((ref) => null);

class ThemeModeController extends AutoDisposeAsyncNotifier<ThemeMode> {
  static const _storageKey = 'settings_theme_mode';

  SharedPreferences? _prefs;

  @override
  Future<ThemeMode> build() async {
    _prefs = await SharedPreferences.getInstance();
    final stored = _prefs?.getString(_storageKey);
    return _stringToMode(stored);
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    state = AsyncData(mode);
    final prefs = _prefs ??= await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, _modeToString(mode));
  }

  String _modeToString(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.system:
        return 'system';
      case ThemeMode.light:
        return 'light';
      case ThemeMode.dark:
        return 'dark';
    }
  }

  ThemeMode _stringToMode(String? value) {
    switch (value) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      case 'system':
      default:
        return ThemeMode.system;
    }
  }
}
