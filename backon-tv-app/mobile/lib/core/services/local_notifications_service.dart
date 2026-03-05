import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:package_info_plus/package_info_plus.dart';
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
  static const String _customSoundPathKey = 'settings_custom_sound_path';
  
  /// Nazwy dostępnych dźwięków (bez rozszerzenia)
  /// Pliki muszą być w: Android: res/raw/, iOS: bundle
  static const String defaultSound = 'default'; // Domyślny systemowy
  /// Domyślny dźwięk BackOn – musi być plik backon_notification_v1.ogg lub .mp3 w res/raw/
  static const String customSound1 = 'backon_notification_v1';

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
      // Domyślnie backon_notification_v1 (zgodne z ustawieniami)
      return prefs.getString(_customSoundKey) ?? customSound1;
    } catch (e) {
      debugPrint('⚠️ Błąd pobierania ustawienia dźwięku: $e');
      return customSound1; // Fallback na wbudowany dźwięk zamiast systemowego
    }
  }

  /// Pobierz ścieżkę do własnego pliku dźwiękowego
  static Future<String?> _getCustomSoundPath() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final path = prefs.getString(_customSoundPathKey);
      if (path != null && await File(path).exists()) {
        return path;
      }
      return null;
    } catch (e) {
      debugPrint('⚠️ Błąd pobierania ścieżki dźwięku: $e');
      return null;
    }
  }

  /// Konwertuj ścieżkę pliku na FileProvider URI (content://) dla Androida 10+
  static Future<String?> _getFileProviderUri(String filePath) async {
    try {
      final file = File(filePath);
      if (!await file.exists()) {
        debugPrint('⚠️ Plik dźwiękowy nie istnieje: $filePath');
        return null;
      }

      // Pobierz package name aplikacji
      final packageInfo = await PackageInfo.fromPlatform();
      final packageName = packageInfo.packageName;
      
      // Utwórz FileProvider URI (content://)
      // Format: content://{packageName}.fileprovider/notification_sounds/{filename}
      final fileName = file.path.split('/').last;
      final contentUri = 'content://$packageName.fileprovider/notification_sounds/$fileName';
      
      debugPrint('🔊 Konwertowano ścieżkę na FileProvider URI: $filePath -> $contentUri');
      return contentUri;
    } catch (e) {
      debugPrint('⚠️ Błąd konwersji ścieżki na FileProvider URI: $e');
      return null;
    }
  }

  /// Utwórz obiekt dźwięku dla Androida (obsługuje własne pliki)
  static Future<AndroidNotificationSound?> _createAndroidSound(String selectedSound) async {
    if (selectedSound == 'custom_file') {
      final customPath = await _getCustomSoundPath();
      if (customPath != null) {
        // Dla Android 10+ (API 29+) użyj FileProvider URI zamiast file://
        final fileProviderUri = await _getFileProviderUri(customPath);
        if (fileProviderUri != null) {
          return UriAndroidNotificationSound(fileProviderUri);
        }
        // Fallback: spróbuj użyć file:// URI (może działać na starszych wersjach)
        debugPrint('⚠️ Używam file:// URI jako fallback');
        return UriAndroidNotificationSound(Uri.file(customPath).toString());
      }
      // Jeśli plik nie istnieje, użyj domyślnego
      return null;
    }
    if (selectedSound == defaultSound) {
      return null; // Domyślny systemowy
    }
    // Dźwięk z res/raw/
    return RawResourceAndroidNotificationSound(selectedSound);
  }

  /// Ustaw dźwięk powiadomień i natychmiast zaktualizuj kanały
  static Future<void> setCustomSound(String soundName) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_customSoundKey, soundName);
      debugPrint('🔊 Ustawiono dźwięk powiadomień: $soundName');

      // Na Androidzie dźwięk kanału jest zapisany tylko przy pierwszym utworzeniu – usuń stare kanały, żeby nowy dźwięk zadziałał
      final androidPlugin = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        try {
          await androidPlugin.deleteNotificationChannel('program_reminders_channel');
          await androidPlugin.deleteNotificationChannel('events_channel');
          await androidPlugin.deleteNotificationChannel('daily_reminders_channel');
        } catch (_) {}
      }

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
      AndroidNotificationSound? notificationSound = selectedSound == defaultSound
          ? null // null = domyślny systemowy
          : await _createAndroidSound(selectedSound);

      // Helper: utwórz kanał; jeśli invalid_sound (brak pliku w res/raw), użyj dźwięku systemowego
      Future<void> createChannel(AndroidNotificationChannel channel) async {
        try {
          await androidPlugin.createNotificationChannel(channel);
        } on PlatformException catch (e) {
          if (e.code == 'invalid_sound' || (e.message?.contains('could not be found') ?? false)) {
            debugPrint('⚠️ Zasób dźwięku nie znaleziony (${e.message}), używam dźwięku systemowego');
            await androidPlugin.createNotificationChannel(
              AndroidNotificationChannel(
                channel.id,
                channel.name,
                description: channel.description,
                importance: channel.importance,
                playSound: channel.playSound,
                enableVibration: channel.enableVibration,
                sound: null, // fallback na dźwięk systemowy
              ),
            );
          } else {
            rethrow;
          }
        }
      }

      await createChannel(
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

      await createChannel(
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

      await createChannel(
        AndroidNotificationChannel(
          'daily_reminders_channel',
          'Dzienne przypomnienia',
          description: 'Codzienne przypomnienia o śledzonych programach',
          importance: Importance.high, // Zwiększ importance żeby Android nie opóźniał powiadomień
          playSound: true,
          enableVibration: true, // Włącz wibrację dla lepszej widoczności
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

  /// Powiadomienie "koniec reklam" / potwierdzenie (FCM → lokalne)
  static Future<void> showKoniecReklamNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    await showReminder(id: id, title: title, body: body, payload: payload);
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
        ? await _createAndroidSound(selectedSound)
        : null; // null = domyślny systemowy lub wyłączony

    final androidDetails = AndroidNotificationDetails(
      'events_channel',
      'Wydarzenia TV',
      channelDescription: 'Przypomnienia o wydarzeniach telewizyjnych',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true, // Zawsze włącz dźwięk - użytkownik może go wyłączyć w ustawieniach telefonu
      sound: androidSound, // null = domyślny systemowy, jeśli soundEnabled jest false
      // TODO: Dodać smallIcon gdy będzie dostępne w nowszej wersji biblioteki
      // Używamy domyślnej ikony launcher (może być z tekstem BackOn)
    );

    // Ustaw dźwięk dla iOS
    // Uwaga: iOS wymaga plików dźwiękowych w bundle aplikacji, więc custom_file nie jest obsługiwany
    // Używamy domyślnego dźwięku dla custom_file na iOS
    final iosSound = soundEnabled && selectedSound != defaultSound && selectedSound != 'custom_file'
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
        ? await _createAndroidSound(selectedSound)
        : null; // null = domyślny systemowy lub wyłączony

    final androidDetails = AndroidNotificationDetails(
      'program_reminders_channel',
      'Przypomnienia o programach',
      channelDescription: 'Przypomnienia o nadchodzących programach TV',
      importance: Importance.high,
      priority: Priority.high,
      playSound: true, // Zawsze włącz dźwięk - użytkownik może go wyłączyć w ustawieniach telefonu
      sound: androidSound, // null = domyślny systemowy, jeśli soundEnabled jest false
      enableVibration: true,
      // TODO: Dodać smallIcon gdy będzie dostępne w nowszej wersji biblioteki
      // Używamy domyślnej ikony launcher (może być z tekstem BackOn)
    );

    // Ustaw dźwięk dla iOS
    // Uwaga: iOS wymaga plików dźwiękowych w bundle aplikacji, więc custom_file nie jest obsługiwany
    // Używamy domyślnego dźwięku dla custom_file na iOS
    final iosSound = soundEnabled && selectedSound != defaultSound && selectedSound != 'custom_file'
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
      
      try {
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
      } on PlatformException catch (e) {
        if (e.code == 'invalid_sound' || (e.message?.contains('could not be found') ?? false)) {
          debugPrint('⚠️ Zasób dźwięku nie znaleziony przy planowaniu, ponawiam z dźwiękiem systemowym');
          final fallbackDetails = NotificationDetails(
            android: AndroidNotificationDetails(
              'program_reminders_channel',
              'Przypomnienia o programach',
              channelDescription: 'Przypomnienia o nadchodzących programach TV',
              importance: Importance.high,
              priority: Priority.high,
              playSound: true,
              sound: null,
              enableVibration: true,
            ),
            iOS: iosDetails,
          );
          await _plugin.zonedSchedule(
            id,
            '$programTitle',
            'Za $minutesBefore min na $channelName',
            scheduledDate,
            fallbackDetails,
            uiLocalNotificationDateInterpretation:
                UILocalNotificationDateInterpretation.absoluteTime,
            payload: safePayload,
          );
        } else {
          rethrow;
        }
      }
      
      debugPrint('✅ zonedSchedule zakończone bez błędów');
      
      debugPrint('✅ Zaplanowano przypomnienie ID=$id: $programTitle za $minutesBefore min');
      debugPrint('   Program ID: $programId');
      debugPrint('   Czas zaplanowania: ${scheduledDate.toString()}');
      debugPrint('   Czas teraz: ${tz.TZDateTime.now(tz.local).toString()}');
      debugPrint('   Różnica: ${scheduledDate.difference(tz.TZDateTime.now(tz.local)).inMinutes} minut');
      debugPrint('   Start programu: ${localProgramStartTime.toString()}');
      debugPrint('   Czas przypomnienia: ${reminderTime.toString()}');
      
      // Sprawdź czy powiadomienie zostało rzeczywiście zaplanowane
      await Future.delayed(const Duration(milliseconds: 1000));
      final pendingNotifications = await _plugin.pendingNotificationRequests();
      
      debugPrint('📋 Sprawdzam zaplanowane powiadomienia (łącznie: ${pendingNotifications.length})...');
      
      try {
        final foundNotification = pendingNotifications.firstWhere(
          (n) => n.id == id,
        );
        
        debugPrint('✅ WERYFIKACJA: Powiadomienie ID=$id jest w liście zaplanowanych');
        debugPrint('   Tytuł: ${foundNotification.title}');
        debugPrint('   Treść: ${foundNotification.body}');
        debugPrint('   ID: ${foundNotification.id}');
      } catch (e) {
        debugPrint('❌ BŁĄD KRYTYCZNY: Powiadomienie ID=$id NIE ZOSTAŁO zaplanowane!');
        debugPrint('   Lista zaplanowanych ID: ${pendingNotifications.map((n) => n.id).join(", ")}');
        debugPrint('   Błąd: $e');
        // Nie rzucaj wyjątku - może Android anulował powiadomienie z powodu uprawnień
        // Ale zaloguj jako błąd
      }
      
      await checkPendingNotifications();
    } catch (e, stackTrace) {
      debugPrint('❌ Błąd planowania przypomnienia: $e');
      debugPrint('Stack trace: $stackTrace');
      
      // Fallback: jeśli błąd invalid_sound (zasób nie znaleziony na tym urządzeniu), spróbuj z dźwiękiem systemowym
      if (e is PlatformException &&
          (e.code == 'invalid_sound' || (e.message?.contains('could not be found') ?? false))) {
        debugPrint('⚠️ Ponawiam planowanie z dźwiękiem systemowym (fallback)');
        try {
          final fallbackDetails = NotificationDetails(
            android: AndroidNotificationDetails(
              'program_reminders_channel',
              'Przypomnienia o programach',
              channelDescription: 'Przypomnienia o nadchodzących programach TV',
              importance: Importance.high,
              priority: Priority.high,
              playSound: true,
              sound: null,
              enableVibration: true,
            ),
            iOS: DarwinNotificationDetails(
              presentAlert: true,
              presentBadge: true,
              presentSound: true,
              sound: 'default',
            ),
          );
          final safePayload = 'program_$programId';
          await _plugin.zonedSchedule(
            id,
            '$programTitle',
            'Za $minutesBefore min na $channelName',
            scheduledDate,
            fallbackDetails,
            uiLocalNotificationDateInterpretation:
                UILocalNotificationDateInterpretation.absoluteTime,
            payload: safePayload,
          );
          debugPrint('✅ Przypomnienie zaplanowane z dźwiękiem systemowym');
          return; // sukces, nie rzucaj dalej
        } catch (retryError) {
          debugPrint('❌ Fallback też się nie udał: $retryError');
        }
      }
      
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
        ? await _createAndroidSound(selectedSound)
        : null; // null = domyślny systemowy lub wyłączony

    final androidDetails = AndroidNotificationDetails(
      'daily_reminders_channel',
      'Dzienne przypomnienia',
      channelDescription: 'Codzienne przypomnienia o śledzonych programach',
      importance: Importance.high, // Zwiększ importance żeby Android nie opóźniał powiadomień
      priority: Priority.high, // Zwiększ priority dla dokładniejszego czasu
      playSound: soundEnabled,
      sound: androidSound,
      enableVibration: true, // Włącz wibrację dla lepszej widoczności
      // TODO: Dodać smallIcon gdy będzie dostępne w nowszej wersji biblioteki
      // Używamy domyślnej ikony launcher (może być z tekstem BackOn)
    );

    // Ustaw dźwięk dla iOS
    // Uwaga: iOS wymaga plików dźwiękowych w bundle aplikacji, więc custom_file nie jest obsługiwany
    // Używamy domyślnego dźwięku dla custom_file na iOS
    final iosSound = soundEnabled && selectedSound != defaultSound && selectedSound != 'custom_file'
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
      'Programy na dziś',
      'Sprawdź swoje ulubione programy',
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
