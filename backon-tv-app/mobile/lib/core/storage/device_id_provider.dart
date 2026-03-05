import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

final deviceIdFutureProvider = FutureProvider<String>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  const key = 'device_id';

  final existing = prefs.getString(key);
  if (existing != null && existing.isNotEmpty) {
    return existing;
  }

  final generated = _generateDeviceId();
  await prefs.setString(key, generated);
  return generated;
});

final deviceIdProvider = Provider<String?>((ref) {
  final result = ref.watch(deviceIdFutureProvider);
  return result.valueOrNull;
});

String _generateDeviceId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  final random = Random.secure();
  final buffer = StringBuffer('dev-');
  for (var i = 0; i < 24; i++) {
    buffer.write(chars[random.nextInt(chars.length)]);
  }
  return buffer.toString();
}

