import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:add_2_calendar/add_2_calendar.dart';

import '../../../shared/widgets/channel_logo.dart';
import '../../../shared/widgets/availability_dialogs.dart';
import '../../../shared/widgets/event_confirmation_dialog.dart';
import '../../../../core/storage/device_id_provider.dart';
import '../../points/application/points_providers.dart';
import '../../events/data/event_dto.dart';
import '../../events/application/events_notifier.dart';
import '../../follows/data/follow_api.dart';
import '../../follows/data/follow_dto.dart';
import '../data/program_api.dart';
import '../data/program_dto.dart';
import '../../../../core/services/analytics_service.dart';
import '../../../../core/services/reminder_service.dart';
import '../../../../core/services/availability_service.dart';

class ProgramDetailPage extends ConsumerStatefulWidget {
  const ProgramDetailPage({
    required this.programId,
    this.eventId,
    super.key,
  });

  static const routeName = 'program-detail';
  final String programId;
  final String? eventId;

  @override
  ConsumerState<ProgramDetailPage> createState() => _ProgramDetailPageState();
}

class _ProgramDetailPageState extends ConsumerState<ProgramDetailPage> {
  bool _isFollowed = false;
  bool _hasReportedEvent = false;
  bool _isLoadingFollow = true;
  EventDto? _cachedActiveEvent;
  bool _hasShownEventDialog = false;

  @override
  void initState() {
    super.initState();
    // Resetuj flagę zgłoszenia wydarzenia przy inicjalizacji
    _hasReportedEvent = false;
    // Resetuj flagę pokazania dialogu gdy eventId jest przekazany
    if (widget.eventId != null) {
      _hasShownEventDialog = false;
    }
    // Sprawdź czy program jest śledzony po załadowaniu
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      _checkIfFollowed();
      
      // Jeśli eventId jest przekazany z push notification, odśwież listę eventów
      // Użyj refresh zamiast invalidate, żeby od razu załadować dane
      if (widget.eventId != null) {
        debugPrint('🔄 initState: eventId=${widget.eventId}, refreshing events...');
        // Odśwież dane i poczekaj na zakończenie, żeby mieć pewność że dane są załadowane
        ref.refresh(eventsNotifierProvider);
        // Poczekaj na załadowanie danych
        try {
          final events = await ref.read(eventsNotifierProvider.future);
          debugPrint('✅ initState: Events loaded, count=${events.length}');
          
          // Spróbuj znaleźć event i pokazać dialog bezpośrednio
          try {
            final event = events.firstWhere((e) => e.id == widget.eventId);
            debugPrint('✅ initState: Found event ${event.id}, will show dialog');
            
            // Poczekaj chwilę, żeby program się załadował, a potem poczekaj na program
            await Future.delayed(const Duration(milliseconds: 500));
            
            if (mounted && !_hasShownEventDialog) {
              // Pobierz program - poczekaj na załadowanie (może być w stanie loading)
              try {
                final program = await ref.read(programProvider(widget.programId).future);
                if (mounted && !_hasShownEventDialog) {
                  debugPrint('🎯 initState: Program loaded, showing dialog directly');
                  _checkAndShowEventDialog(program, event);
                }
              } catch (e) {
                debugPrint('⚠️ initState: Failed to load program: $e');
                // Program nie został jeszcze załadowany - retry w _buildProgramContent
              }
            }
          } catch (e) {
            debugPrint('⚠️ initState: Event ${widget.eventId} not found in loaded events: $e');
            // Event nie został jeszcze załadowany - retry w addPostFrameCallback w _buildProgramContent
          }
        } catch (e) {
          // Ignoruj błędy - retry w addPostFrameCallback w _buildProgramContent
          debugPrint('⚠️ Failed to load events in initState: $e');
        }
      }
    });
  }

  @override
  void didUpdateWidget(ProgramDetailPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Resetuj flagę gdy program się zmienia LUB gdy eventId się zmienia
    if (oldWidget.programId != widget.programId || oldWidget.eventId != widget.eventId) {
      _hasReportedEvent = false;
      _cachedActiveEvent = null;
      _hasShownEventDialog = false;
      debugPrint('🔄 Widget updated - reset flags. programId: ${widget.programId}, eventId: ${widget.eventId}');
    }
  }

  Future<void> _checkIfFollowed() async {
    try {
      final followApi = ref.read(followApiProvider);
      final response = await followApi.getFollows();
      final isFollowed = response.data.any(
        (item) => item.type == FollowTypeDto.PROGRAM && item.program?.id == widget.programId,
      );
      if (mounted) {
        setState(() {
          _isFollowed = isFollowed;
          _isLoadingFollow = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingFollow = false;
        });
      }
    }
  }

  EventDto? _findActiveEvent(List<EventDto> events, String programId, {String? deviceId}) {
    final now = DateTime.now();
    
    // Najpierw szukaj eventów które użytkownik jeszcze nie potwierdził
    if (deviceId != null) {
      for (final event in events) {
        if (event.programId != programId) continue;
        if (event.status != EventStatusDto.PENDING && 
            event.status != EventStatusDto.VALIDATED) continue;
        if (event.expiresAt != null && event.expiresAt!.isBefore(now)) continue;
        
        // Sprawdź czy użytkownik już potwierdził ten event
        final hasConfirmed = event.confirmations.any(
          (conf) => conf.deviceId == deviceId,
        );
        
        if (!hasConfirmed) {
          return event; // Zwróć pierwszy niepotwierdzony event
        }
      }
    }
    
    // Jeśli nie znaleziono niepotwierdzonego eventu, zwróć pierwszy aktywny
    for (final event in events) {
      if (event.programId != programId) continue;
      if (event.status != EventStatusDto.PENDING && 
          event.status != EventStatusDto.VALIDATED) continue;
      if (event.expiresAt != null && event.expiresAt!.isBefore(now)) continue;
      return event;
    }
    return null;
  }

  Future<void> _showEventReportDialog(ProgramDto program) async {
    await AnalyticsService.popupOpen(popupName: 'koniec_reklam_report');
    final startedAt = DateTime.now();
    final result = await showDialog<bool>(
      context: context,
        builder: (context) => AlertDialog(
        title: const Text('KONIEC REKLAM'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Czy reklamy zakończyły się w programie "${program.title}"?'),
            const SizedBox(height: 12),
            Text(
              'Twoje zgłoszenie powiadomi innych widzów.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('NIE'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
            ),
            child: const Text('TAK'),
          ),
        ],
      ),
    );
    final visibleSeconds = DateTime.now().difference(startedAt).inSeconds;
    await AnalyticsService.popupVisibleTime(popupName: 'koniec_reklam_report', seconds: visibleSeconds);

    if (result == true) {
      await AnalyticsService.koniecReklamClicked(programId: program.id, source: 'report');
      // Wyślij zgłoszenie wydarzenia do backendu
      // Sprawdź czy program.id istnieje i nie jest pusty
      try {
        final programId = program.id;
        if (programId.isEmpty) {
          debugPrint('❌ Błąd: program.id jest pusty. Program: ${program.title}');
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Błąd: Brak ID programu')),
            );
          }
          return;
        }
        
        debugPrint('📝 Tworzenie wydarzenia dla programu: ${program.title}, ID: $programId');
        debugPrint('📝 Program object: ${program.toString()}');
        
        // Użyj notifiera zamiast bezpośrednio API - to automatycznie odświeży listę eventów
        final notifier = ref.read(eventsNotifierProvider.notifier);
        final event = await notifier.createEvent(programId);
        
        debugPrint('✅ Wydarzenie utworzone: ${event.id}');
        
        if (mounted) {
          setState(() {
            _hasReportedEvent = true;
          });
          
          final count = event.recipientsCount ?? 0;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Dzięki! Jesteś 1 z ${count > 0 ? count : "?"}'),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'Pierwszy zgłaszający',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              duration: const Duration(seconds: 4),
            ),
          );
        }
      } catch (e, stackTrace) {
        debugPrint('❌ Błąd podczas tworzenia wydarzenia: $e');
        debugPrint('❌ Typ błędu: ${e.runtimeType}');
        debugPrint('❌ Stack trace: $stackTrace');
        debugPrint('❌ Program: ${program.toString()}');
        debugPrint('❌ Program.id: ${program.id}');
        
        String errorMessage = 'Nie udało się zgłosić wydarzenia';
        if (e.toString().contains('type null is not a subtype of type string')) {
          errorMessage = 'Błąd: Brak ID programu. Spróbuj ponownie.';
        } else {
          errorMessage = 'Nie udało się zgłosić wydarzenia: ${e.toString()}';
        }
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(errorMessage)),
          );
        }
      }
    }
  }

  Future<void> _toggleFollow(ProgramDto program) async {
    if (program.id.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Błąd: brak ID programu')),
        );
      }
      return;
    }

    // Zablokuj przycisk podczas operacji
    if (_isLoadingFollow) {
      debugPrint('⚠️ Follow operation already in progress, ignoring click');
      return;
    }

    setState(() {
      _isLoadingFollow = true;
    });

    final followApi = ref.read(followApiProvider);
    try {
      if (_isFollowed) {
        debugPrint('🔔 Unfollow program: ${program.id}');
        final response = await followApi.unfollow(
          FollowRequest(type: FollowTypeDto.PROGRAM, targetId: program.id),
        );
        debugPrint('✅ Unfollow response: ${response.data.length} items');
        for (var item in response.data) {
          debugPrint('  - FollowDto: id=${item.id}, deviceId=${item.deviceId}, type=${item.type}, channel=${item.channel?.id}, program=${item.program?.id}');
        }
        await ReminderService.cancelProgramReminders(program.id);
        
        if (mounted) {
          setState(() {
            _isFollowed = false;
            _isLoadingFollow = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Przypomnienie wyłączone')),
          );
        }
      } else {
        debugPrint('🔔 Follow program: ${program.id}');
        final response = await followApi.follow(
          FollowRequest(type: FollowTypeDto.PROGRAM, targetId: program.id),
        );
        debugPrint('✅ Follow response: ${response.data.length} items');
        for (var item in response.data) {
          debugPrint('  - FollowDto: id=${item.id}, deviceId=${item.deviceId}, type=${item.type}, channel=${item.channel?.id}, program=${item.program?.id}');
        }
        
        // NIE zmieniaj stanu _isFollowed na true jeszcze - poczekaj aż przypomnienia zostaną zaplanowane
        // Jeśli przypomnienia nie mogą być zaplanowane, program nie powinien być oznaczony jako śledzony
        
        if (program.startsAt.isAfter(DateTime.now())) {
          // Sprawdź uprawnienia do powiadomień przed planowaniem
          final hasNotificationPermission = await AvailabilityService.areNotificationPermissionsGranted();
          if (!hasNotificationPermission) {
            if (mounted) {
              await NotificationPermissionDialog.show(context);
              // Po pokazaniu dialogu, sprawdź ponownie uprawnienia
              final permissionAfterDialog = await AvailabilityService.areNotificationPermissionsGranted();
              if (!permissionAfterDialog) {
                // Użytkownik nie przyznał uprawnień - program jest śledzony, ale bez przypomnień
                if (mounted) {
                  setState(() {
                    _isFollowed = true; // Program jest śledzony, ale bez przypomnień
                    _isLoadingFollow = false;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Program jest śledzony, ale przypomnienia wymagają uprawnień do powiadomień'),
                      duration: Duration(seconds: 4),
                    ),
                  );
                }
                return;
              }
            } else {
              if (mounted) {
                setState(() {
                  _isLoadingFollow = false;
                });
              }
              return;
            }
          }

          // Sprawdź uprawnienia do dokładnych alarmów (Android 12+) - tylko informacyjnie
          final hasExactAlarmPermission = await AvailabilityService.areExactAlarmPermissionsGranted();
          if (!hasExactAlarmPermission) {
            debugPrint('⚠️ Brak uprawnień do dokładnych alarmów - powiadomienia mogą być niedokładne');
            // Nie pokazuj dialogu - niedokładne powiadomienia też działają
          }

          try {
            await ReminderService.scheduleProgramReminders(program);
            if (mounted) {
              setState(() {
                _isFollowed = true; // Dopiero teraz ustaw jako śledzony
                _isLoadingFollow = false;
              });
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Przypomnienie włączone'),
                  duration: Duration(seconds: 3),
                ),
              );
            }
          } catch (e, stackTrace) {
            debugPrint('❌ Błąd podczas włączania przypomnienia: $e');
            debugPrint('Stack trace: $stackTrace');
            
            // Jeśli przypomnienia nie mogą być zaplanowane, program NIE powinien być śledzony
            // Odśwież stan follow, żeby przycisk pokazywał poprawny stan
            try {
              await _checkIfFollowed();
            } catch (checkError) {
              debugPrint('⚠️ Błąd podczas sprawdzania stanu follow: $checkError');
              if (mounted) {
                setState(() {
                  _isLoadingFollow = false;
                });
              }
            }
            
            if (mounted) {
              String errorMessage = 'Nie udało się włączyć przypomnienia.';
              
              // Sprawdź typ błędu
              final errorString = e.toString().toLowerCase();
              if (errorString.contains('permission') || 
                  errorString.contains('uprawnień') ||
                  errorString.contains('brak uprawnień')) {
                errorMessage = 'Brak uprawnień do powiadomień. Sprawdź ustawienia aplikacji.';
                await NotificationPermissionDialog.show(context);
              } else if (errorString.contains('minęło') || 
                         errorString.contains('przeszłości')) {
                errorMessage = 'Program już się rozpoczął lub przypomnienia są w przeszłości.';
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(errorMessage),
                    duration: const Duration(seconds: 3),
                  ),
                );
              } else {
                // Pokaż bardziej szczegółowy komunikat
                errorMessage = 'Nie udało się włączyć przypomnienia: ${e.toString()}';
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(errorMessage),
                    duration: const Duration(seconds: 5),
                    backgroundColor: Colors.red,
                  ),
                );
              }
            }
          }
        } else {
          // Program już się rozpoczął - nie można zaplanować przypomnień, ale można śledzić
          if (mounted) {
            setState(() {
              _isFollowed = true;
              _isLoadingFollow = false;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Program już się rozpoczął - nie można zaplanować przypomnień')),
            );
          }
        }
      }
    } catch (e, stackTrace) {
      debugPrint('❌ Błąd śledzenia programu: $e');
      debugPrint('Stack trace: $stackTrace');
      
      // Odśwież stan follow, żeby przycisk pokazywał poprawny stan
      try {
        await _checkIfFollowed();
      } catch (checkError) {
        debugPrint('⚠️ Błąd podczas sprawdzania stanu follow: $checkError');
        if (mounted) {
          setState(() {
            _isLoadingFollow = false;
          });
        }
      }
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Nie udało się ${_isFollowed ? 'od' : ''}śledzić programu: ${e.toString()}'),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  Future<void> _addToCalendar(ProgramDto program) async {
    try {
      // Sprawdź czy aplikacja kalendarza jest dostępna
      final isAvailable = await AvailabilityService.isCalendarAppAvailable();
      if (!isAvailable) {
        if (mounted) {
          await CalendarUnavailableDialog.show(context);
        }
        return;
      }

      // Upewnij się, że daty są w lokalnym czasie
      final startDate = program.startsAt.isUtc ? program.startsAt.toLocal() : program.startsAt;
      final endDate = program.endsAt != null
          ? (program.endsAt!.isUtc ? program.endsAt!.toLocal() : program.endsAt!)
          : startDate.add(const Duration(hours: 1));

      // Sprawdź czy daty są poprawne
      if (endDate.isBefore(startDate)) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Błąd: Nieprawidłowe daty programu')),
          );
        }
        return;
      }

      final event = Event(
        title: program.title,
        description: program.description != null && program.description!.isNotEmpty
            ? '${program.description}\n\nKanał: ${program.channelName}'
            : 'Program TV: ${program.channelName}',
        location: program.channelName,
        startDate: startDate,
        endDate: endDate,
        iosParams: const IOSParams(
          reminder: Duration(minutes: 15),
        ),
        androidParams: AndroidParams(
          emailInvites: [],
        ),
      );

      debugPrint('📅 Próba dodania do kalendarza:');
      debugPrint('   Tytuł: ${program.title}');
      debugPrint('   Start: ${startDate.toString()}');
      debugPrint('   Koniec: ${endDate.toString()}');

      final result = await Add2Calendar.addEvent2Cal(event);
      
      debugPrint('📅 Wynik dodania do kalendarza: $result');
      
      if (mounted) {
        if (result) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Dodano do kalendarza'),
              duration: Duration(seconds: 2),
            ),
          );
        } else {
          // Sprawdź czy to Android i czy może brakować aplikacji kalendarza
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Nie udało się dodać do kalendarza. Sprawdź czy masz zainstalowaną aplikację kalendarza.'),
              duration: Duration(seconds: 5),
            ),
          );
        }
      }
    } catch (e, stackTrace) {
      debugPrint('❌ Błąd dodawania do kalendarza: $e');
      debugPrint('Stack trace: $stackTrace');
      
      if (mounted) {
        String errorMessage = 'Nie udało się dodać do kalendarza.';
        if (e.toString().contains('No Activity found') || 
            e.toString().contains('ActivityNotFoundException')) {
          errorMessage = 'Nie znaleziono aplikacji kalendarza. Zainstaluj aplikację Kalendarz Google lub inną aplikację kalendarza.';
        } else if (e.toString().isNotEmpty) {
          errorMessage = 'Błąd: ${e.toString()}';
        }
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  Future<void> _showOtherBroadcasts(ProgramDto program) async {
    try {
      final programApi = ref.read(programApiProvider);
      
      // Pobierz programy z następnych 7 dni
      final now = DateTime.now();
      final programs = <ProgramDto>[];
      
      for (int i = 0; i < 7; i++) {
        final date = now.add(Duration(days: i));
        try {
          final response = await programApi.getProgramsForDay(date);
          final samePrograms = response.data.where((p) => 
            p.title.toLowerCase() == program.title.toLowerCase() &&
            p.id != program.id
          ).toList();
          programs.addAll(samePrograms);
        } catch (e) {
          // Ignoruj błędy dla poszczególnych dni
        }
      }

      if (!mounted) return;

      if (programs.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Brak innych emisji tego programu')),
        );
        return;
      }

      // Pokaż dialog z listą innych emisji
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Inne emisje: ${program.title}'),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: programs.length,
              itemBuilder: (context, index) {
                final p = programs[index];
                return ListTile(
                  leading: ChannelLogo(
                    name: p.channelName,
                    logoUrl: p.channelLogoUrl,
                    size: 32,
                  ),
                  title: Text(p.channelName),
                  subtitle: Text(
                    DateFormat('EEEE, d MMMM yyyy, HH:mm', 'pl_PL').format(p.startsAt),
                  ),
                  onTap: () {
                    Navigator.of(context).pop();
                    context.push('/programs/${p.id}');
                  },
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Zamknij'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Błąd: ${e.toString()}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final programAsync = ref.watch(programProvider(widget.programId));
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: programAsync.when(
        data: (program) {
          return _buildProgramContent(context, theme, program);
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Color(0xFFDC2626)),
                const SizedBox(height: 16),
                Text(
                  'Nie udało się pobrać szczegółów programu',
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.refresh(programProvider(widget.programId)),
                  child: const Text('Spróbuj ponownie'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _tryShowEventDialogWithRetry(ProgramDto program, String eventId, {int maxRetries = 5, int retryCount = 0}) async {
    if (_hasShownEventDialog && retryCount > 0) {
      // Jeśli dialog został już pokazany i to nie jest pierwsza próba, nie kontynuuj
      debugPrint('⚠️ Dialog already shown, skipping retry');
      return;
    }
    
    if (retryCount >= maxRetries) {
      debugPrint('❌ Max retries reached for event $eventId');
      // Jeśli nie udało się pokazać dialogu po wszystkich próbach, zresetuj flagę
      // żeby można było spróbować ponownie gdy event zostanie załadowany
      if (!_hasShownEventDialog) {
        debugPrint('⚠️ Resetting _hasShownEventDialog flag after max retries');
        _hasShownEventDialog = false;
      }
      return;
    }
    
    debugPrint('🔄 Retry $retryCount/$maxRetries - looking for event $eventId');
    
    final eventsState = ref.read(eventsNotifierProvider);
    eventsState.maybeWhen(
      data: (events) {
        try {
          final event = events.firstWhere(
            (e) => e.id == eventId,
          );
          debugPrint('✅ Found event in retry $retryCount');
          if (mounted && !_hasShownEventDialog) {
            _checkAndShowEventDialog(program, event);
          } else if (_hasShownEventDialog) {
            debugPrint('✅ Dialog already shown, skipping');
          }
        } catch (e) {
          // Event nie został jeszcze załadowany - spróbuj ponownie później
          debugPrint('⚠️ Event $eventId not found in retry $retryCount (${events.length} events loaded), will retry in ${(retryCount + 1) * 500}ms');
          Future.delayed(Duration(milliseconds: (retryCount + 1) * 500), () {
            if (mounted && !_hasShownEventDialog) {
              _tryShowEventDialogWithRetry(program, eventId, maxRetries: maxRetries, retryCount: retryCount + 1);
            }
          });
        }
      },
      loading: () {
        debugPrint('⏳ Events still loading in retry $retryCount, will retry');
        Future.delayed(Duration(milliseconds: (retryCount + 1) * 500), () {
          if (mounted && !_hasShownEventDialog) {
            _tryShowEventDialogWithRetry(program, eventId, maxRetries: maxRetries, retryCount: retryCount + 1);
          }
        });
      },
      error: (error, stack) {
        debugPrint('❌ Error loading events in retry $retryCount: $error');
        // Spróbuj jeszcze raz po dłuższym czasie
        if (retryCount < maxRetries - 1) {
          Future.delayed(Duration(milliseconds: (retryCount + 1) * 1000), () {
            if (mounted && !_hasShownEventDialog) {
              _tryShowEventDialogWithRetry(program, eventId, maxRetries: maxRetries, retryCount: retryCount + 1);
            }
          });
        } else {
          // Po ostatniej próbie, zresetuj flagę jeśli dialog nie został pokazany
          if (!_hasShownEventDialog) {
            debugPrint('⚠️ Resetting _hasShownEventDialog flag after error');
            _hasShownEventDialog = false;
          }
        }
      },
      orElse: () {
        debugPrint('⚠️ Events state is in unknown state, will retry');
        if (retryCount < maxRetries - 1) {
          Future.delayed(Duration(milliseconds: (retryCount + 1) * 500), () {
            if (mounted && !_hasShownEventDialog) {
              _tryShowEventDialogWithRetry(program, eventId, maxRetries: maxRetries, retryCount: retryCount + 1);
            }
          });
        }
      },
    );
  }

  Future<void> _checkAndShowEventDialog(ProgramDto program, [EventDto? providedEvent]) async {
    // ATOMICZNE sprawdzenie i ustawienie flagi - zapobiega równoległym wywołaniom
    if (_hasShownEventDialog) {
      debugPrint('⚠️ Dialog already shown, skipping');
      return;
    }
    // Ustaw flagę NATYCHMIAST - przed jakimkolwiek await - żeby zapobiec równoległym wywołaniom
    _hasShownEventDialog = true;
    
    final deviceId = ref.read(deviceIdProvider);
    if (deviceId == null) {
      debugPrint('⚠️ No deviceId, cannot show dialog');
      _hasShownEventDialog = false; // Resetuj flagę jeśli nie można pokazać
      return;
    }
    
    EventDto? activeEvent;
    
    // Jeśli event jest przekazany jako parametr (z ref.listen), użyj go
    if (providedEvent != null) {
      activeEvent = providedEvent;
      debugPrint('✅ Using provided event: ${activeEvent.id}');
    } else {
      // W przeciwnym razie sprawdź w providerze
      final eventsState = ref.read(eventsNotifierProvider);
      
      // Jeśli eventId jest przekazany z push notification, użyj go bezpośrednio
      if (widget.eventId != null) {
        debugPrint('🔍 Looking for event with ID: ${widget.eventId}');
        activeEvent = eventsState.maybeWhen(
          data: (events) {
            debugPrint('📋 Found ${events.length} events');
            try {
              final found = events.firstWhere(
                (event) => event.id == widget.eventId,
              );
              debugPrint('✅ Found event: ${found.id}');
              return found;
            } catch (e) {
              // Event nie został jeszcze załadowany - spróbuj ponownie później
              debugPrint('❌ Event ${widget.eventId} not found in ${events.length} events');
              return null;
            }
          },
          loading: () {
            debugPrint('⏳ Events still loading...');
            return null;
          },
          error: (error, stack) {
            debugPrint('❌ Error loading events: $error');
            return null;
          },
          orElse: () => null,
        );
      } else {
        // W przeciwnym razie szukaj aktywnego eventu dla tego programu
        activeEvent = eventsState.maybeWhen(
          data: (events) => _findActiveEvent(events, program.id, deviceId: deviceId),
          orElse: () => null,
        );
      }
    }
    
    if (activeEvent == null) {
      debugPrint('⚠️ No active event found, cannot show dialog');
      _hasShownEventDialog = false; // Resetuj flagę jeśli event nie został znaleziony
      return;
    }
    
    debugPrint('✅ Active event found: ${activeEvent.id}, status: ${activeEvent.status}');
    
    // Sprawdź czy użytkownik już potwierdził
    final hasConfirmed = activeEvent.confirmations.any(
      (conf) => conf.deviceId == deviceId,
    );
    
    debugPrint('👤 User has confirmed: $hasConfirmed (deviceId: $deviceId)');
    
    if (!hasConfirmed && mounted) {
      debugPrint('🎯 Showing event confirmation dialog...');
      
      // Flaga już jest ustawiona na początku funkcji - nie trzeba ustawiać ponownie
      
      // Poczekaj chwilę, żeby widok się załadował
      await Future.delayed(const Duration(milliseconds: 500));
      
      if (!mounted) {
        debugPrint('⚠️ Widget unmounted before showing dialog');
        return;
      }
      
      try {
        debugPrint('✅ Showing EventConfirmationDialog');
        final choice = await EventConfirmationDialog.showWithAdPreload(
          context: context,
          title: program.title,
        );
        
        debugPrint('✅ User choice: $choice');
        
        // Upewnij się, że dialog jest zamknięty przed dalszym przetwarzaniem
        if (choice != null && mounted) {
          // Flaga już jest ustawiona na początku funkcji
          
          final notifier = ref.read(eventsNotifierProvider.notifier);
          try {
            await notifier.confirmEvent(activeEvent.id, choice);
            // Odśwież tylko punkty - nie odświeżaj eventów, żeby nie wywołać ref.listen ponownie
            ref.invalidate(pointsSummaryProvider);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(choice == EventChoiceDto.OPTION1
                      ? 'Dziękujemy za potwierdzenie końca reklam!'
                      : 'Zgłoszenie oznaczone jako niepotwierdzone.'),
                  duration: const Duration(seconds: 2),
                ),
              );
            }
          } catch (error) {
            debugPrint('❌ Error confirming event: $error');
            // W przypadku błędu, zresetuj flagę, żeby użytkownik mógł spróbować ponownie
            _hasShownEventDialog = false;
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Nie udało się wysłać potwierdzenia: $error'),
                  duration: const Duration(seconds: 2),
                ),
              );
            }
          }
        } else if (choice == null) {
          // Użytkownik zamknął dialog bez wyboru - zresetuj flagę, żeby mógł spróbować ponownie
          debugPrint('⚠️ Dialog closed without choice');
          _hasShownEventDialog = false;
        }
      } catch (e) {
        // Jeśli dialog nie mógł się pokazać (np. context nie jest dostępny), zresetuj flagę
        debugPrint('❌ Failed to show dialog: $e');
        _hasShownEventDialog = false;
        // Spróbuj ponownie później
        Future.delayed(const Duration(milliseconds: 1000), () {
          if (mounted && !_hasShownEventDialog) {
            debugPrint('🔄 Retrying to show dialog after error');
            _checkAndShowEventDialog(program, activeEvent);
          }
        });
      }
    } else if (hasConfirmed) {
      debugPrint('ℹ️ User already confirmed this event');
      // Ustaw flagę, żeby nie próbować pokazywać dialogu ponownie
      _hasShownEventDialog = true;
    }
  }

  Widget _buildProgramContent(BuildContext context, ThemeData theme, ProgramDto program) {
    final now = DateTime.now();
    final isCurrent = program.startsAt.isBefore(now) &&
        (program.endsAt?.isAfter(now) ?? program.startsAt.add(const Duration(hours: 1)).isAfter(now));

    // Sprawdź aktualny stan eventów PRZED nasłuchiwaniem (ref.listen reaguje tylko na zmiany!)
    if (widget.eventId != null && !_hasShownEventDialog) {
      final currentEventsState = ref.read(eventsNotifierProvider);
      currentEventsState.maybeWhen(
        data: (events) {
          try {
            final event = events.firstWhere((e) => e.id == widget.eventId);
            debugPrint('✅ _buildProgramContent: Found event in current state, will show dialog');
            Future.delayed(const Duration(milliseconds: 300), () {
              if (mounted && !_hasShownEventDialog) {
                _checkAndShowEventDialog(program, event);
              }
            });
          } catch (e) {
            debugPrint('⚠️ _buildProgramContent: Event ${widget.eventId} not in current state');
          }
        },
        orElse: () {},
      );
    }

    // Nasłuchuj zmian w eventach - gdy eventId jest przekazany, pokaż dialog z kciukami
    // UWAGA: Nie pokazuj dialogu jeśli użytkownik już potwierdził event
    ref.listen<AsyncValue<List<EventDto>>>(eventsNotifierProvider, (previous, next) {
      // Sprawdź czy to faktycznie nowa zmiana (nie pierwsze załadowanie)
      if (previous == null || previous == next) {
        return; // Ignoruj pierwsze załadowanie lub identyczne stany
      }
      
      next.maybeWhen(
        data: (events) {
          // Jeśli eventId jest przekazany z push notification, sprawdź czy event jest już załadowany
          if (widget.eventId != null && !_hasShownEventDialog && mounted) {
            try {
              final event = events.firstWhere(
                (e) => e.id == widget.eventId,
              );
              
              // Sprawdź czy użytkownik już potwierdził ten event
              final deviceId = ref.read(deviceIdProvider);
              final hasConfirmed = event.confirmations.any(
                (conf) => conf.deviceId == deviceId,
              );
              
              if (hasConfirmed) {
                debugPrint('✅ ref.listen: User already confirmed event, skipping dialog');
                _hasShownEventDialog = true; // Ustaw flagę, żeby nie pokazywać dialogu
                return;
              }
              
              debugPrint('✅ ref.listen: Event found after change, will show dialog');
              // Poczekaj chwilę, żeby widok się załadował
              Future.delayed(const Duration(milliseconds: 300), () {
                if (mounted && !_hasShownEventDialog) {
                  _checkAndShowEventDialog(program, event);
                }
              });
            } catch (e) {
              // Event nie został jeszcze załadowany - to OK, spróbujemy później
              debugPrint('⚠️ ref.listen: Event ${widget.eventId} not found yet, will retry');
            }
          }
        },
        orElse: () {},
      );
    });

    // Sprawdź i pokaż dialog potwierdzenia wydarzenia po załadowaniu
    // To działa zarówno dla przypadków z eventId (z push notification) jak i bez
    WidgetsBinding.instance.addPostFrameCallback((_) {
      debugPrint('🎬 PostFrameCallback - eventId: ${widget.eventId}, hasShownDialog: $_hasShownEventDialog');
      
      // Jeśli eventId jest przekazany, od razu spróbuj pokazać dialog (z retry)
      if (widget.eventId != null && !_hasShownEventDialog) {
        _tryShowEventDialogWithRetry(program, widget.eventId!, maxRetries: 5);
      } else if (widget.eventId == null && !_hasShownEventDialog) {
        // Dla przypadków bez eventId, użyj standardowej logiki
        Future.delayed(const Duration(milliseconds: 500), () {
          if (mounted && !_hasShownEventDialog) {
            _checkAndShowEventDialog(program);
          }
        });
      }
    });

    return CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 280,
                pinned: true,
                elevation: 0,
                flexibleSpace: FlexibleSpaceBar(
                  titlePadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
                  title: Text(
                    program.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      shadows: [
                        Shadow(
                          color: Colors.black87,
                          blurRadius: 12,
                          offset: Offset(0, 2),
                        ),
                        Shadow(
                          color: Colors.black54,
                          blurRadius: 6,
                          offset: Offset(0, 1),
                        ),
                      ],
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      // Obraz tła
                      program.imageUrl != null
                          ? Image.network(
                              program.imageUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) {
                                return Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                      colors: [
                                        const Color(0xFFDC2626),
                                        const Color(0xFF991B1B),
                                      ],
                                    ),
                                  ),
                                  child: const Center(
                                    child: Icon(Icons.tv, size: 64, color: Colors.white),
                                  ),
                                );
                              },
                            )
                          : Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    const Color(0xFFDC2626),
                                    const Color(0xFF991B1B),
                                  ],
                                ),
                              ),
                              child: const Center(
                                child: Icon(Icons.tv, size: 64, color: Colors.white),
                              ),
                            ),
                      // Gradient overlay z lepszym efektem
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.black.withOpacity(0.0),
                              Colors.black.withOpacity(0.2),
                              Colors.black.withOpacity(0.5),
                              Colors.black.withOpacity(0.85),
                            ],
                            stops: const [0.0, 0.4, 0.7, 1.0],
                          ),
                        ),
                      ),
                      // Dodatkowy gradient dla głębi
                      Positioned(
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 120,
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.transparent,
                                Colors.black.withOpacity(0.9),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Channel info
                      Row(
                        children: [
                          ChannelLogo(
                            name: program.channelName,
                            logoUrl: program.channelLogoUrl,
                            size: 40,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  program.channelName,
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  DateFormat('EEEE, d MMMM yyyy, HH:mm', 'pl_PL').format(program.startsAt),
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (isCurrent)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDC2626),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                'TERAZ',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      
                      // "Zgłoś wydarzenie" - tylko gdy program trwa i nie ma aktywnego wydarzenia (przeniesione wyżej)
                      Builder(
                        builder: (context) {
                          // Użyj watch, żeby widget się automatycznie przebudowywał gdy zmienia się stan eventów
                          final deviceId = ref.watch(deviceIdProvider);
                          final eventsState = ref.watch(eventsNotifierProvider);
                          final activeEvent = eventsState.maybeWhen(
                            data: (events) => _findActiveEvent(events, program.id, deviceId: deviceId),
                            orElse: () => null,
                          );

                          // Cache active event
                          if (activeEvent != null && _cachedActiveEvent?.id != activeEvent.id) {
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              if (mounted) {
                                setState(() {
                                  _cachedActiveEvent = activeEvent;
                                  // Resetuj flagę gdy pojawi się aktywne wydarzenie
                                  _hasReportedEvent = false;
                                });
                              }
                            });
                          }

                          // Resetuj flagę zgłoszenia gdy nie ma aktywnego wydarzenia
                          if (activeEvent == null && _hasReportedEvent) {
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              if (mounted) {
                                setState(() {
                                  _hasReportedEvent = false;
                                });
                              }
                            });
                          }

                          // Nie pokazuj przycisku "KONIEC REKLAM" jeśli eventId jest przekazany
                          // (to oznacza, że ktoś inny już zgłosił event i użytkownik powinien zobaczyć dialog z kciukami)
                          final shouldShowReportButton = activeEvent == null && 
                              isCurrent && 
                              !_hasReportedEvent && 
                              widget.eventId == null;
                          
                          if (shouldShowReportButton) {
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                FilledButton.icon(
                                  onPressed: () => _showEventReportDialog(program),
                                  icon: const Icon(Icons.stop_circle),
                                  label: const Text('KONIEC REKLAM'),
                                  style: FilledButton.styleFrom(
                                    backgroundColor: const Color(0xFFDC2626),
                                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                                    minimumSize: const Size(double.infinity, 0),
                                  ),
                                ),
                                const SizedBox(height: 24),
                              ],
                            );
                          }
                          return const SizedBox.shrink();
                        },
                      ),
                      
                      // Action buttons - zgodnie z TELEMAGAZYN: Alarm, Kalendarz, Inne emisje
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _isLoadingFollow ? null : () => _toggleFollow(program),
                              icon: Icon(_isFollowed ? Icons.alarm : Icons.alarm_outlined),
                              label: const Text('Alarm'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: _isFollowed
                                    ? const Color(0xFFDC2626)
                                    : theme.colorScheme.onSurface,
                                side: BorderSide(
                                  color: _isFollowed
                                      ? const Color(0xFFDC2626)
                                      : theme.colorScheme.outline,
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _addToCalendar(program),
                              icon: const Icon(Icons.calendar_today),
                              label: const Text('Kalendarz'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _showOtherBroadcasts(program),
                              icon: const Icon(Icons.repeat),
                              label: const Text('Inne emisje'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Description
                      if (program.description != null && program.description!.isNotEmpty) ...[
                        Text(
                          'Opis',
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          program.description!,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],

                      // Tags
                      if (program.tags.isNotEmpty) ...[
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: program.tags.map((tag) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                tag,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 24),
                      ],

                      // Event tracker lub "Zgłoś wydarzenie"
                      Builder(
                        builder: (context) {
                          // Użyj cached event lub przeczytaj z providera (bez watch, żeby nie powodować przebudowy)
                          final deviceId = ref.read(deviceIdProvider);
                          final activeEvent = _cachedActiveEvent ?? 
                            ref.read(eventsNotifierProvider).maybeWhen(
                              data: (events) => _findActiveEvent(events, program.id, deviceId: deviceId),
                              orElse: () => null,
                            );

                          if (activeEvent != null) {
                            // Event tracker - pokaż liczbę potwierdzeń i pozostały czas
                            final confirmationsCount = activeEvent.confirmations.length;
                            final limit = activeEvent.followerCountLimit ?? 10;
                            final now = DateTime.now();
                            final expiresAt = activeEvent.expiresAt ?? program.endsAt ?? program.startsAt.add(const Duration(hours: 1));
                            final remaining = expiresAt.difference(now);
                            final remainingMinutes = remaining.inMinutes;
                            final remainingSeconds = remaining.inSeconds % 60;

                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Divider(),
                                const SizedBox(height: 16),
                                Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: theme.colorScheme.surfaceContainerHighest.withOpacity(0.5),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: theme.colorScheme.primary.withOpacity(0.3),
                                      width: 1,
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Icon(
                                            Icons.event_available,
                                            color: theme.colorScheme.primary,
                                            size: 20,
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            'Wydarzenie aktywne',
                                            style: theme.textTheme.titleMedium?.copyWith(
                                              fontWeight: FontWeight.w700,
                                              color: theme.colorScheme.primary,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'Potwierdzenia',
                                                  style: theme.textTheme.bodySmall?.copyWith(
                                                    color: theme.colorScheme.onSurfaceVariant,
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  '$confirmationsCount / $limit',
                                                  style: theme.textTheme.titleLarge?.copyWith(
                                                    fontWeight: FontWeight.w700,
                                                    color: theme.colorScheme.onSurface,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'Pozostały czas',
                                                  style: theme.textTheme.bodySmall?.copyWith(
                                                    color: theme.colorScheme.onSurfaceVariant,
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  remainingMinutes > 0
                                                      ? '${remainingMinutes}m ${remainingSeconds}s'
                                                      : '${remainingSeconds}s',
                                                  style: theme.textTheme.titleLarge?.copyWith(
                                                    fontWeight: FontWeight.w700,
                                                    color: theme.colorScheme.onSurface,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: LinearProgressIndicator(
                                          value: confirmationsCount / limit,
                                          backgroundColor: theme.colorScheme.surfaceContainerHighest,
                                          valueColor: AlwaysStoppedAnimation<Color>(
                                            theme.colorScheme.primary,
                                          ),
                                          minHeight: 8,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            );
                          }


                          return const SizedBox.shrink();
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
    );
  }
}

