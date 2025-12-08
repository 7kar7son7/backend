import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/timezone.dart' as tz;

class LocalNotificationsService {
  LocalNotificationsService._();

  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;
  static Function(NotificationResponse)? _onNotificationTap;
  static const String _soundSettingsKey = 'settings_sound_enabled';
  static const String _customSoundKey = 'settings_custom_sound';
  
  /// Nazwy dostępnych dźwięków (bez rozszerzenia)
  /// Pliki muszą być w: Android: res/raw/, iOS: bundle
  static const String defaultSound = 'default'; // Domyślny systemowy
  static const String customSound1 = 'notification_sound'; // Przykładowy własny dźwięk

  /// Ustaw callback dla kliknięcia w notyfikację
  static void setNotificationTapHandler(Function(NotificationResponse) handler) {
    _onNotificationTap = handler;
  }

  /// Sprawdź czy dźwięk powiadomień jest włączony
  static Future<bool> _isSoundEnabled() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_soundSettingsKey) ?? true; // Domyślnie włączone
    } catch (e) {
      debugPrint('⚠️ Błąd sprawdzania ustawienia dźwięku: $e');
      return true; // W przypadku błędu, domyślnie włączone
    }
  }

  /// Pobierz wybrany dźwięk powiadomień
  static Future<String> _getCustomSound() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_customSoundKey) ?? defaultSound;
    } catch (e) {
      debugPrint('⚠️ Błąd pobierania ustawienia dźwięku: $e');
      return defaultSound;
    }
  }

  /// Ustaw dźwięk powiadomień i natychmiast zaktualizuj kanały
  static Future<void> setCustomSound(String soundName) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_customSoundKey, soundName);
      debugPrint('🔊 Ustawiono dźwięk powiadomień: $soundName');
      
      // Natychmiast zaktualizuj kanały powiadomień
      await _updateNotificationChannels();
    } catch (e) {
      debugPrint('⚠️ Błąd ustawiania dźwięku: $e');
    }
  }

  /// Pobierz aktualny wybrany dźwięk
  static Future<String> getCustomSound() async {
    return await _getCustomSound();
  }

  /// Zaktualizuj kanały powiadomień z aktualnym wybranym dźwiękiem
  static Future<void> _updateNotificationChannels() async {
    final androidPlugin = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin == null) {
      debugPrint('⚠️ Android plugin nie jest dostępny - nie można zaktualizować kanałów');
      return;
    }

    try {
      // Pobierz wybrany dźwięk
      final selectedSound = await _getCustomSound();
      final notificationSound = selectedSound == defaultSound
          ? null // null = domyślny systemowy
          : RawResourceAndroidNotificationSound(selectedSound);
      
      // Aktualizuj kanał dla przypomnień o programach
      await androidPlugin.createNotificationChannel(
        AndroidNotificationChannel(
          'program_reminders_channel',
          'Przypomnienia o programach',
          description: 'Przypomnienia o nadchodzących programach TV',
          importance: Importance.high,
          playSound: true,
          enableVibration: true,
          sound: notificationSound,
        ),
      );
      debugPrint('✅ Zaktualizowano kanał: program_reminders_channel z dźwiękiem: $selectedSound');
      
      // Aktualizuj kanał dla wydarzeń
      await androidPlugin.createNotificationChannel(
        AndroidNotificationChannel(
          'events_channel',
          'Wydarzenia TV',
          description: 'Przypomnienia o wydarzeniach telewizyjnych',
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
          sound: notificationSound,
        ),
      );
      debugPrint('✅ Zaktualizowano kanał: events_channel z dźwiękiem: $selectedSound');
      
      // Aktualizuj kanał dla dziennych przypomnień
      await androidPlugin.createNotificationChannel(
        AndroidNotificationChannel(
          'daily_reminders_channel',
          'Dzienne przypomnienia',
          description: 'Codzienne przypomnienia o śledzonych programach',
          importance: Importance.defaultImportance,
          playSound: true,
          enableVibration: false,
          sound: notificationSound,
        ),
      );
      debugPrint('✅ Zaktualizowano kanał: daily_reminders_channel z dźwiękiem: $selectedSound');
    } catch (e) {
      debugPrint('⚠️ Błąd aktualizacji kanałów powiadomień: $e');
    }
  }

  static Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    try {
      final initialized = await _plugin.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (details) {
          debugPrint('🔔 Local notification tapped: ${details.payload}');
          if (_onNotificationTap != null) {
            _onNotificationTap!(details);
          }
        },
      );

      if (initialized != true) {
        debugPrint('⚠️ Failed to initialize local notifications');
        return;
      }
    } catch (e, stackTrace) {
      debugPrint('❌ Błąd inicjalizacji powiadomień: $e');
      debugPrint('Stack trace: $stackTrace');
      
      // Jeśli błąd związany z "Missing type parameter" lub serializacją,
      // wyczyść wszystkie powiadomienia i spróbuj ponownie
      if (e.toString().contains('Missing type parameter') || 
          e.toString().contains('type parameter') ||
          e.toString().contains('RuntimeException') ||
          e.toString().contains('Gson') ||
          e.toString().contains('getSuperclassTypeParameter')) {
        debugPrint('🔧 Wykryto błąd serializacji - czyszczenie wszystkich powiadomień...');
        try {
          // Wyczyść wszystkie powiadomienia przed ponowną inicjalizacją
          await _plugin.cancelAll();
          debugPrint('✅ Wyczyszczono wszystkie powiadomienia');
          
          // Wyczyść też SharedPreferences z uszkodzonymi danymi (jeśli plugin je używa)
          try {
            final prefs = await SharedPreferences.getInstance();
            // Plugin może używać kluczy zaczynających się od "flutter_local_notifications"
            final keys = prefs.getKeys().where((key) => 
              key.startsWith('flutter_local_notifications') || 
              key.startsWith('dexterous')
            ).toList();
            for (final key in keys) {
              await prefs.remove(key);
              debugPrint('🗑️ Usunięto klucz: $key');
            }
          } catch (prefsError) {
            debugPrint('⚠️ Błąd czyszczenia SharedPreferences: $prefsError');
          }
          
          // Spróbuj ponownie zainicjalizować
          final retryInitialized = await _plugin.initialize(
            initSettings,
            onDidReceiveNotificationResponse: (details) {
              debugPrint('🔔 Local notification tapped: ${details.payload}');
              if (_onNotificationTap != null) {
                _onNotificationTap!(details);
              }
            },
          );
          
          if (retryInitialized != true) {
            debugPrint('⚠️ Nie udało się zainicjalizować powiadomień po czyszczeniu');
            return;
          }
          // Ustaw _initialized po pomyślnej ponownej inicjalizacji
          _initialized = true;
        } catch (retryError) {
          debugPrint('❌ Błąd podczas ponownej inicjalizacji: $retryError');
          return;
        }
      } else {
        // Inny błąd - nie kontynuuj
        return;
      }
    }

    // Poproś o uprawnienia (Android 13+)
    final androidPlugin = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin != null) {
      // Utwórz kanały powiadomień z dźwiękiem (wymagane dla Android 8.0+)
      // Kanały muszą być utworzone przed użyciem, a ustawienia dźwięku są kontrolowane przez kanał
      try {
        await _updateNotificationChannels();
      } catch (e) {
        debugPrint('⚠️ Błąd tworzenia kanałów powiadomień: $e');
        // Kontynuuj - kanały mogą już istnieć lub być tworzone automatycznie
      }
      
      final granted = await androidPlugin.requestNotificationsPermission();
      debugPrint('🔔 Notification permission granted: $granted');
      
      if (granted != true) {
        debugPrint('⚠️ Brak uprawnień do powiadomień - użytkownik musi je przyznać w ustawieniach');
      }
      
      // Sprawdź uprawnienie do dokładnych alarmów (Android 12+)
      // SCHEDULE_EXACT_ALARM jest automatycznie przyznawane dla aplikacji z główną funkcją "Budzik"
      // Nie używamy USE_EXACT_ALARM - używamy tylko SCHEDULE_EXACT_ALARM
      try {
        final canScheduleExactAlarms = await androidPlugin.requestExactAlarmsPermission();
        debugPrint('⏰ Exact alarms permission: $canScheduleExactAlarms');
        if (canScheduleExactAlarms != true) {
          debugPrint('⚠️ Brak uprawnień do dokładnych alarmów - powiadomienia mogą być niedokładne');
        }
      } catch (e) {
        debugPrint('⏰ Nie można sprawdzić uprawnień do dokładnych alarmów: $e');
        // Kontynuuj - może to być starsza wersja Androida
      }
    }

    // Poproś o uprawnienia iOS
    final iosPlugin = _plugin.resolvePlatformSpecificImplementation<
        IOSFlutterLocalNotificationsPlugin>();
    if (iosPlugin != null) {
      final granted = await iosPlugin.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
      debugPrint('🔔 iOS notification permission granted: $granted');
    }

    _initialized = true;
  }

  static Future<void> showReminder({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (!_initialized) {
      await initialize();
    }

    final soundEnabled = await _isSoundEnabled();
    final selectedSound = await _getCustomSound();
    debugPrint('🔊 Ustawienie dźwięku: $soundEnabled (dla przypomnienia o wydarzeniu), wybrany: $selectedSound');

    // Ustaw dźwięk dla Androida
    final androidSound = soundEnabled && selectedSound != defaultSound
        ? RawResourceAndroidNotificationSound(selectedSound)
        : null; // null = domyślny systemowy lub wyłączony

    final androidDetails = AndroidNotificationDetails(
      'events_channel',
      'Wydarzenia TV',
      channelDescription: 'Przypomnienia o wydarzeniach telewizyjnych',
      importance: Importance.max,
      priority: Priority.high,
      playSound: soundEnabled,
      sound: androidSound,
      // TODO: Dodać smallIcon gdy będzie dostępne w nowszej wersji biblioteki
      // Używamy domyślnej ikony launcher (może być z tekstem BackOn)
    );

    // Ustaw dźwięk dla iOS
    final iosSound = soundEnabled && selectedSound != defaultSound
        ? '$selectedSound.caf' // iOS wymaga rozszerzenia .caf
        : 'default'; // 'default' = domyślny systemowy

    final iosDetails = DarwinNotificationDetails(
      presentSound: soundEnabled,
      sound: iosSound,
    );

    final notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _plugin.show(id, title, body, notificationDetails, payload: payload);
  }

  /// Zaplanuj przypominajkę o programie (5, 10 lub 15 minut przed startem)
  static Future<void> scheduleProgramReminder({
    required int id,
    required String programId,
    required String programTitle,
    required String channelName,
    required DateTime programStartTime,
    required int minutesBefore, // 5, 10 lub 15
  }) async {
    if (!_initialized) {
      await initialize();
    }

    final now = DateTime.now();
    
    // Upewnij się że programStartTime jest w lokalnej strefie czasowej
    // ProgramDto.fromJson konwertuje UTC na lokalną, więc powinno być już OK
    // Ale na wszelki wypadek konwertujmy jeśli jest w UTC
    final localProgramStartTime = programStartTime.isUtc 
        ? programStartTime.toLocal() 
        : programStartTime;
    
    final reminderTime = localProgramStartTime.subtract(Duration(minutes: minutesBefore));
    
    debugPrint('⏰ Planowanie przypomnienia:');
    debugPrint('  Program: $programTitle');
    debugPrint('  Start programu (UTC): ${programStartTime.toString()}');
    debugPrint('  Start programu (local): ${localProgramStartTime.toString()}');
    debugPrint('  Czas przypomnienia: ${reminderTime.toString()}');
    debugPrint('  Teraz: ${now.toString()}');
    debugPrint('  Minuty przed: $minutesBefore');
    debugPrint('  Różnica czasu: ${reminderTime.difference(now).inMinutes} minut');
    
    // Jeśli czas przypomnienia już minął lub jest w ciągu najbliższej minuty, nie planuj
    final timeDifference = reminderTime.difference(now);
    if (timeDifference.inMinutes < 1) {
      debugPrint('⏰ ⚠️ Czas przypomnienia już minął lub jest za blisko dla programu: $programTitle');
      debugPrint('   Różnica: ${timeDifference.inMinutes} minut (minimum 1 minuta)');
      return;
    }

    // Utwórz TZDateTime bezpośrednio z lokalnego czasu (reminderTime jest już w lokalnej strefie)
    // TZDateTime.from() zakłada UTC, więc używamy konstruktora bezpośrednio
    final tz.TZDateTime scheduledDate = tz.TZDateTime(
      tz.local,
      reminderTime.year,
      reminderTime.month,
      reminderTime.day,
      reminderTime.hour,
      reminderTime.minute,
      reminderTime.second,
      reminderTime.millisecond,
      reminderTime.microsecond,
    );

    // Sprawdź uprawnienia przed planowaniem
    // UWAGA: Uprawnienia powinny być sprawdzane wcześniej w wywołującym kodzie
    // Tutaj tylko weryfikujemy i logujemy, ale nie blokujemy jeśli brakuje uprawnień
    final androidPlugin = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin != null) {
      // Sprawdź aktualny status uprawnień (nie proś ponownie, tylko sprawdź)
      try {
        // Na Androidzie 13+ możemy sprawdzić status bez prośby
        final currentPermission = await androidPlugin.requestNotificationsPermission();
        debugPrint('🔔 Status uprawnień do powiadomień: $currentPermission');
        
        if (currentPermission != true) {
          debugPrint('⚠️ Brak uprawnień do powiadomień - przypomnienie może nie działać');
          // Nie rzucaj wyjątku - pozwól próbować zaplanować (może działać mimo braku uprawnień)
          // Wyjątek zostanie rzucony przez system jeśli rzeczywiście nie można zaplanować
        }
      } catch (e) {
        debugPrint('⚠️ Błąd sprawdzania uprawnień: $e');
        // Kontynuuj - może działać mimo błędu sprawdzania
      }
      
      // Sprawdź uprawnienie do dokładnych alarmów (opcjonalne)
      try {
        final exactAlarmPermission = await androidPlugin.requestExactAlarmsPermission();
        if (exactAlarmPermission != true) {
          debugPrint('⚠️ Brak uprawnień do dokładnych alarmów - używam niedokładnego trybu');
        }
      } catch (e) {
        debugPrint('⏰ Nie można sprawdzić uprawnień do dokładnych alarmów: $e');
        // Kontynuuj - niedokładny tryb też działa
      }
    }

    final soundEnabled = await _isSoundEnabled();
    final selectedSound = await _getCustomSound();
    debugPrint('🔊 Ustawienie dźwięku: $soundEnabled (dla przypomnienia o programie), wybrany: $selectedSound');

    // Ustaw dźwięk dla Androida
    final androidSound = soundEnabled && selectedSound != defaultSound
        ? RawResourceAndroidNotificationSound(selectedSound)
        : null; // null = domyślny systemowy lub wyłączony

    final androidDetails = AndroidNotificationDetails(
      'program_reminders_channel',
      'Przypomnienia o programach',
      channelDescription: 'Przypomnienia o nadchodzących programach TV',
      importance: Importance.high,
      priority: Priority.high,
      playSound: soundEnabled,
      sound: androidSound,
      enableVibration: true,
      // TODO: Dodać smallIcon gdy będzie dostępne w nowszej wersji biblioteki
      // Używamy domyślnej ikony launcher (może być z tekstem BackOn)
    );

    // Ustaw dźwięk dla iOS
    final iosSound = soundEnabled && selectedSound != defaultSound
        ? '$selectedSound.caf' // iOS wymaga rozszerzenia .caf
        : 'default'; // 'default' = domyślny systemowy

    final iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: soundEnabled,
      sound: iosSound,
    );

    final notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    try {
      // Usuń androidScheduleMode całkowicie - może powodować problemy z serializacją
      // Uprość payload - użyj tylko programId bez dwukropka (może powodować problemy z JSON)
      final safePayload = 'program_$programId'; // Użyj podkreślnika zamiast dwukropka
      
      debugPrint('🔔 Próba zaplanowania powiadomienia przez zonedSchedule...');
      debugPrint('   ID: $id');
      debugPrint('   Scheduled date: $scheduledDate');
      debugPrint('   Payload: $safePayload');
      
      await _plugin.zonedSchedule(
        id,
        '$programTitle',
        'Za $minutesBefore min na $channelName',
        scheduledDate,
        notificationDetails,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        payload: safePayload,
      );
      
      debugPrint('✅ zonedSchedule zakończone bez błędów');
      
      debugPrint('✅ Zaplanowano przypomnienie ID=$id: $programTitle za $minutesBefore min');

      debugPrint('   Czas zaplanowania: ${scheduledDate.toString()}');
      debugPrint('   Czas teraz: ${tz.TZDateTime.now(tz.local).toString()}');
      debugPrint('   Różnica: ${scheduledDate.difference(tz.TZDateTime.now(tz.local)).inMinutes} minut');
      
      // Sprawdź czy powiadomienie zostało rzeczywiście zaplanowane
      await Future.delayed(const Duration(milliseconds: 500));
      await checkPendingNotifications();
    } catch (e, stackTrace) {
      debugPrint('❌ Błąd planowania przypomnienia: $e');
      debugPrint('Stack trace: $stackTrace');
      
      // Jeśli błąd związany z serializacją (Missing type parameter), wyczyść wszystkie powiadomienia
      if (e.toString().contains('Missing type parameter') || 
          e.toString().contains('type parameter') ||
          e.toString().contains('RuntimeException')) {
        debugPrint('🔧 Wykryto błąd serializacji - czyszczenie wszystkich powiadomień...');
        try {
          await _plugin.cancelAll();
          debugPrint('✅ Wyczyszczono wszystkie powiadomienia, spróbuj ponownie zaplanować');
        } catch (clearError) {
          debugPrint('❌ Błąd podczas czyszczenia powiadomień: $clearError');
        }
      }
      
      // Jeśli błąd związany z uprawnieniami, zaloguj szczegółowo
      if (e.toString().contains('permission') || 
          e.toString().contains('Permission') ||
          e.toString().contains('SCHEDULE_EXACT_ALARM') ||
          e.toString().contains('USE_EXACT_ALARM')) {
        debugPrint('⚠️ Błąd związany z uprawnieniami - sprawdź ustawienia aplikacji');
      }
      
      // Rzuć błąd dalej, aby można było go obsłużyć w wywołującym kodzie
      rethrow;
    }
  }

  /// Zaplanuj dzienną przypominajkę "czy coś dzisiaj śledzimy?"
  static Future<void> scheduleDailyReminder({
    required int id,
    required TimeOfDay time, // np. 11:00
  }) async {
    if (!_initialized) {
      await initialize();
    }

    final now = DateTime.now();
    final scheduledTime = DateTime(
      now.year,
      now.month,
      now.day,
      time.hour,
      time.minute,
    );

    // Jeśli czas już minął dzisiaj, zaplanuj na jutro
    final timeToSchedule = scheduledTime.isBefore(now)
        ? scheduledTime.add(const Duration(days: 1))
        : scheduledTime;
    
    // Utwórz TZDateTime bezpośrednio z lokalnego czasu (scheduledTime jest już w lokalnej strefie)
    final tz.TZDateTime scheduledDate = tz.TZDateTime(
      tz.local,
      timeToSchedule.year,
      timeToSchedule.month,
      timeToSchedule.day,
      timeToSchedule.hour,
      timeToSchedule.minute,
      timeToSchedule.second,
    );

    final soundEnabled = await _isSoundEnabled();
    final selectedSound = await _getCustomSound();
    debugPrint('🔊 Ustawienie dźwięku: $soundEnabled (dla dziennej przypominajki), wybrany: $selectedSound');

    // Ustaw dźwięk dla Androida
    final androidSound = soundEnabled && selectedSound != defaultSound
        ? RawResourceAndroidNotificationSound(selectedSound)
        : null; // null = domyślny systemowy lub wyłączony

    final androidDetails = AndroidNotificationDetails(
      'daily_reminders_channel',
      'Dzienne przypomnienia',
      channelDescription: 'Codzienne przypomnienia o śledzonych programach',
      importance: Importance.defaultImportance,
      priority: Priority.defaultPriority,
      playSound: soundEnabled,
      sound: androidSound,
      // TODO: Dodać smallIcon gdy będzie dostępne w nowszej wersji biblioteki
      // Używamy domyślnej ikony launcher (może być z tekstem BackOn)
    );

    // Ustaw dźwięk dla iOS
    final iosSound = soundEnabled && selectedSound != defaultSound
        ? '$selectedSound.caf' // iOS wymaga rozszerzenia .caf
        : 'default'; // 'default' = domyślny systemowy

    final iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: soundEnabled,
      sound: iosSound,
    );

    final notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _plugin.zonedSchedule(
      id,
      'Czy coś dzisiaj śledzimy?',
      'Sprawdź swoje ulubione programy na dziś',
      scheduledDate,
      notificationDetails,
      matchDateTimeComponents: DateTimeComponents.time, // Powtarzaj codziennie o tej samej godzinie
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      payload: 'daily_reminder',
    );

    debugPrint('✅ Zaplanowano dzienną przypominajkę: ${scheduledDate.toString()}');
  }

  /// Anuluj zaplanowaną notyfikację
  static Future<void> cancelNotification(int id) async {
    await _plugin.cancel(id);
    debugPrint('❌ Anulowano notyfikację: $id');
  }

  /// Anuluj wszystkie notyfikacje
  static Future<void> cancelAllNotifications() async {
    await _plugin.cancelAll();
    debugPrint('❌ Anulowano wszystkie notyfikacje');
  }

  /// Sprawdź zaplanowane powiadomienia (do debugowania)
  static Future<void> checkPendingNotifications() async {
    try {
      final pendingNotifications = await _plugin.pendingNotificationRequests();
      debugPrint('📋 Zaplanowane powiadomienia: ${pendingNotifications.length}');
      for (final notification in pendingNotifications) {
        debugPrint('  - ID: ${notification.id}, Tytuł: ${notification.title}, Czas: ${notification.body}');
      }
    } catch (e) {
      debugPrint('❌ Błąd sprawdzania zaplanowanych powiadomień: $e');
    }
  }
}
