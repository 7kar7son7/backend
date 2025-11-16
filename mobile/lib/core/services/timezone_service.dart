import 'package:timezone/data/latest.dart' as tz;

class TimezoneService {
  TimezoneService._();

  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    tz.initializeTimeZones();
    _initialized = true;
  }
}
