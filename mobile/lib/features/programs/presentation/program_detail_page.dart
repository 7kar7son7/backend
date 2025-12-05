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
import '../../events/data/event_api.dart';
import '../../events/data/event_dto.dart';
import '../../events/application/events_notifier.dart';
import '../../follows/data/follow_api.dart';
import '../../follows/data/follow_dto.dart';
import '../data/program_api.dart';
import '../data/program_dto.dart';
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
    // Sprawdź czy program jest śledzony po załadowaniu
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkIfFollowed();
      
      // Jeśli eventId jest przekazany z push notification, odśwież listę eventów
      if (widget.eventId != null) {
        ref.invalidate(eventsNotifierProvider);
      }
    });
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

  EventDto? _findActiveEvent(List<EventDto> events, String programId) {
    final now = DateTime.now();
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
    final result = await showDialog<bool>(
      context: context,
        builder: (context) => AlertDialog(
        title: const Text('KONIEC REKLAM'),
        content: Text('Czy reklamy zakończyły się w programie "${program.title}"?'),
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

    if (result == true) {
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
        
        final eventApi = ref.read(eventApiProvider);
        final request = CreateEventRequest(programId: programId);
        debugPrint('📝 Request: ${request.toJson()}');
        
        final response = await eventApi.createEvent(request);
        
        debugPrint('✅ Wydarzenie utworzone: ${response.data.id}');
        
        if (mounted) {
          setState(() {
            _hasReportedEvent = true;
          });
          
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Zgłoszenie "KONIEC REKLAM" zostało wysłane')),
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
        
        // Zmień stan przed sprawdzaniem uprawnień (follow już się udało)
        setState(() {
          _isFollowed = true;
        });
        
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
            
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Błąd: ${e.toString()}'),
                  duration: const Duration(seconds: 5),
                  backgroundColor: Colors.red,
                ),
              );
            }
            debugPrint('Stack trace: $stackTrace');
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
                  ),
                );
              }
            }
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Program już się rozpoczął')),
            );
          }
        }
      }
    } catch (e, stackTrace) {
      debugPrint('❌ Błąd śledzenia programu: $e');
      debugPrint('Stack trace: $stackTrace');
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

  Future<void> _checkAndShowEventDialog(ProgramDto program) async {
    if (_hasShownEventDialog) return;
    
    final deviceId = ref.read(deviceIdProvider);
    if (deviceId == null) return;
    
    final eventsState = ref.read(eventsNotifierProvider);
    EventDto? activeEvent;
    
    // Jeśli eventId jest przekazany z push notification, użyj go bezpośrednio
    if (widget.eventId != null) {
      activeEvent = eventsState.maybeWhen(
        data: (events) {
          try {
            return events.firstWhere(
              (event) => event.id == widget.eventId,
            );
          } catch (e) {
            // Event nie został jeszcze załadowany lub nie istnieje
            return null;
          }
        },
        orElse: () => null,
      );
    } else {
      // W przeciwnym razie szukaj aktywnego eventu dla tego programu
      activeEvent = eventsState.maybeWhen(
        data: (events) => _findActiveEvent(events, program.id),
        orElse: () => null,
      );
    }
    
    if (activeEvent == null) return;
    
    // Sprawdź czy użytkownik już potwierdził
    final hasConfirmed = activeEvent.confirmations.any(
      (conf) => conf.deviceId == deviceId,
    );
    
    if (!hasConfirmed && mounted) {
      _hasShownEventDialog = true;
      
      // Poczekaj chwilę, żeby widok się załadował
      await Future.delayed(const Duration(milliseconds: 500));
      
      if (!mounted) return;
      
      final choice = await EventConfirmationDialog.show(
        context: context,
        title: program.title,
      );
      
      if (choice != null && mounted) {
        final notifier = ref.read(eventsNotifierProvider.notifier);
        try {
          await notifier.confirmEvent(activeEvent.id, choice);
          ref.invalidate(pointsSummaryProvider);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(choice == EventChoiceDto.OPTION1
                    ? 'Dziękujemy za potwierdzenie końca reklam!'
                    : 'Zgłoszenie oznaczone jako niepotwierdzone.'),
              ),
            );
          }
        } catch (error) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Nie udało się wysłać potwierdzenia: $error'),
              ),
            );
          }
        }
      }
    }
  }

  Widget _buildProgramContent(BuildContext context, ThemeData theme, ProgramDto program) {
    final now = DateTime.now();
    final isCurrent = program.startsAt.isBefore(now) &&
        (program.endsAt?.isAfter(now) ?? program.startsAt.add(const Duration(hours: 1)).isAfter(now));

    // Sprawdź i pokaż dialog potwierdzenia wydarzenia po załadowaniu
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAndShowEventDialog(program);
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
                                    color: const Color(0xFF6C738A),
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
                          // Użyj read zamiast watch, żeby nie powodować przebudowy
                          final eventsState = ref.read(eventsNotifierProvider);
                          final activeEvent = eventsState.maybeWhen(
                            data: (events) => _findActiveEvent(events, program.id),
                            orElse: () => null,
                          );

                          // Cache active event
                          if (activeEvent != null && _cachedActiveEvent?.id != activeEvent.id) {
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              if (mounted) {
                                setState(() {
                                  _cachedActiveEvent = activeEvent;
                                });
                              }
                            });
                          }

                          if (activeEvent == null && isCurrent && !_hasReportedEvent) {
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                FilledButton.icon(
                                  onPressed: () => _showEventReportDialog(program),
                                  icon: const Icon(Icons.stop_circle),
                                  label: const Text('KONIEC REKLAM'),
                                  style: FilledButton.styleFrom(
                                    backgroundColor: const Color(0xFFDC2626),
                                    padding: const EdgeInsets.symmetric(vertical: 16),
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
                            color: const Color(0xFF50566F),
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
                                color: const Color(0xFFE8ECF8),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                tag,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: const Color(0xFF55607A),
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
                          final activeEvent = _cachedActiveEvent ?? 
                            ref.read(eventsNotifierProvider).maybeWhen(
                              data: (events) => _findActiveEvent(events, program.id),
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
                                                    color: const Color(0xFF6C738A),
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
                                                    color: const Color(0xFF6C738A),
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

