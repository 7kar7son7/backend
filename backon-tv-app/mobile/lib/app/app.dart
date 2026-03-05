import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/app_router.dart';
import '../core/services/analytics_service.dart';
import '../core/services/app_version_service.dart';
import '../core/services/fcm_service.dart';
import '../core/services/local_notifications_service.dart';
import '../core/services/reminder_service.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/theme_controller.dart';
import '../features/follows/data/follow_api.dart';

class App extends ConsumerStatefulWidget {
  const App({super.key});

  @override
  ConsumerState<App> createState() => _AppState();
}

class _AppState extends ConsumerState<App> {
  @override
  void initState() {
    super.initState();
    // Zarejestruj token FCM po utworzeniu ProviderScope
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final container = ProviderScope.containerOf(context);
      FcmService.registerTokenInBackend(container);
      _setupNotificationHandlers(container);

      // Odśwież przypomnienia przy starcie – dopasuj do aktualnej czułości (1/2/3)
      final followApi = container.read(followApiProvider);
      ReminderService.refreshAllReminders(followApi).catchError((e) {
        debugPrint('⚠️ Odświeżanie przypomnień przy starcie: $e');
      });

      // Sprawdź czy jest dostępna nowa wersja (z opóźnieniem, żeby UI było gotowe)
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          AppVersionService.checkForUpdate(context, ref);
        }
      });
    });
  }

  void _setupNotificationHandlers(ProviderContainer container) {
    // Obsługa kliknięcia w lokalną notyfikację
    LocalNotificationsService.setNotificationTapHandler((response) {
      final payload = response.payload;
      if (payload == null) return;

      final router = container.read(appRouterProvider);
      
      // Obsługa dziennej przypominajki - nawiguj do listy kanałów
      if (payload == 'daily_reminder') {
        router.go('/home/channels');
        return;
      }

      // Obsługa wydarzenia "KONIEC REKLAM" - payload format: "event_eventId_program_programId"
      if (payload.startsWith('event_')) {
        final parts = payload.split('_');
        if (parts.length >= 4 && parts[0] == 'event' && parts[2] == 'program') {
          final eventId = parts[1];
          final programId = parts[3];
          debugPrint('🔔 Local notification tapped - event: $eventId, program: $programId');
          Future.delayed(const Duration(milliseconds: 300), () {
            router.go('/programs/$programId?eventId=$eventId');
          });
          return;
        }
      }

      // Obsługa przypominajki o programie - payload format: "program_programId" (użyto podkreślnika zamiast dwukropka)
      if (payload.startsWith('program_')) {
        final programId = payload.substring(8); // Usuń "program_" prefix
        debugPrint('🔔 Local notification tapped - program: $programId');
        AnalyticsService.reminderTriggered(programId: programId);
        Future.delayed(const Duration(milliseconds: 300), () {
          router.go('/programs/$programId');
        });
        return;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final themeModeAsync = ref.watch(themeModeProvider);
    final themeMode = themeModeAsync.value ?? ThemeMode.system;
    final locale = ref.watch(localeProvider);

    return MaterialApp.router(
      title: 'Telemagazyn Events',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      locale: locale,
      supportedLocales: const [
        Locale('pl'),
        Locale('en'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      routerConfig: router,
    );
  }
}
