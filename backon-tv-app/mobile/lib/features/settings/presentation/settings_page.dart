import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/channel_logo.dart';
import '../../../core/services/reminder_service.dart';
import '../../channels/data/channel_api.dart';
import '../../channels/data/channel_dto.dart';
import '../../follows/data/follow_api.dart';
import '../application/settings_controller.dart';
import '../data/settings_model.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../core/network/device_token_api.dart';

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  static const routeName = 'settings';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsControllerProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FE),
      appBar: AppBar(
        title: const Text('Ustawienia'),
      ),
      body: settings.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => _ErrorView(
          message: error.toString(),
          onRetry: () => ref.refresh(settingsControllerProvider.future),
        ),
        data: (data) => _SettingsContent(settings: data),
      ),
    );
  }
}

class _SettingsContent extends ConsumerStatefulWidget {
  const _SettingsContent({required this.settings});

  final Settings settings;

  @override
  ConsumerState<_SettingsContent> createState() => _SettingsContentState();
}

class _SettingsContentState extends ConsumerState<_SettingsContent> {
  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsControllerProvider);
    final controller = ref.read(settingsControllerProvider.notifier);
    
    // Jeśli ustawienia się zmieniły, odśwież widok
    final currentSettings = settings.valueOrNull ?? widget.settings;
    final channelsAsync = ref.watch(_settingsChannelsProvider);
    final themeModeAsync = ref.watch(themeModeProvider);
    final themeController = ref.read(themeModeProvider.notifier);
    final themeMode = themeModeAsync.value ?? ThemeMode.system;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 140),
      children: [
        _SectionHeader(title: 'Powiadomienia'),
        const SizedBox(height: 12),
        // Przypomnienie o ustawieniu dźwięków powiadomień
        _NotificationSoundReminder(controller: controller),
        const SizedBox(height: 12),
        _SettingsCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SwitchListTile.adaptive(
                value: currentSettings.pushEnabled,
                onChanged: (value) async {
                  await controller.setPushEnabled(value);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(value
                            ? 'Powiadomienia push włączone'
                            : 'Powiadomienia push wyłączone'),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  }
                },
                title: const Text('Powiadomienia push'),
                subtitle: const Text('Alerty „Koniec reklam”, potwierdzenia, start programu'),
              ),
              const Divider(height: 1),
              SwitchListTile.adaptive(
                value: currentSettings.soundEnabled,
                onChanged: controller.toggleSound,
                title: const Text('Dźwięk powiadomień'),
                subtitle: const Text('Włącz dźwięk przy nadchodzących alertach'),
              ),
              if (currentSettings.soundEnabled) ...[
                const Divider(height: 1),
                ListTile(
                  title: const Text('Wybierz dźwięk'),
                  subtitle: Text(_getSoundLabel(currentSettings.selectedSound)),
                  trailing: DropdownButton<String>(
                    value: currentSettings.selectedSound,
                    underline: const SizedBox.shrink(),
                    onChanged: (value) {
                      if (value != null) {
                        controller.updateSelectedSound(value);
                      }
                    },
                    items: _availableSounds
                        .map(
                          (sound) => DropdownMenuItem(
                            value: sound.value,
                            child: Text(sound.label),
                          ),
                        )
                        .toList(),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  title: const Text('Wybierz własny plik'),
                  subtitle: const Text('Wybierz plik dźwiękowy z telefonu (MP3, OGG, WAV)'),
                  trailing: const Icon(Icons.upload_file),
                  onTap: () async {
                    try {
                      await controller.pickCustomSoundFile();
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Dźwięk został zapisany'),
                            duration: Duration(seconds: 2),
                          ),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Błąd: ${e.toString()}'),
                            backgroundColor: Theme.of(context).colorScheme.error,
                          ),
                        );
                      }
                    }
                  },
                ),
              ],
              const Divider(height: 1),
              ListTile(
                title: const Text('Czułość powiadomień'),
                subtitle: Text(currentSettings.sensitivity.label),
                trailing: DropdownButton<NotificationSensitivity>(
                  value: currentSettings.sensitivity,
                  underline: const SizedBox.shrink(),
                  onChanged: (value) async {
                    if (value != null) {
                      await controller.updateSensitivity(value);
                      try {
                        // Zaktualizuj ustawienia w backendzie
                        final deviceTokenApi = ref.read(deviceTokenApiProvider);
                        await deviceTokenApi.updateNotificationSettings(
                          UpdateNotificationSettingsRequest(
                            notificationSensitivity: value.name.toUpperCase(),
                          ),
                        );

                        // Odśwież lokalne przypomnienia
                        final followApi = ref.read(followApiProvider);
                        await ReminderService.refreshAllReminders(followApi);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Przypomnienia zaktualizowane do nowej liczby'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Błąd aktualizacji przypomnień: $e'),
                              backgroundColor: Theme.of(context).colorScheme.error,
                            ),
                          );
                        }
                      }
                    }
                  },
                  items: NotificationSensitivity.values
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text(value.label),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        _SectionHeader(title: 'Wygląd'),
        const SizedBox(height: 12),
        _SettingsCard(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
            child: themeModeAsync.when(
              loading: () => const Center(
                child: SizedBox(
                  height: 36,
                  width: 36,
                  child: CircularProgressIndicator(),
                ),
              ),
              error: (error, _) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Motyw aplikacji',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Nie udało się wczytać motywu: $error',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: Theme.of(context).colorScheme.error),
                  ),
                ],
              ),
              data: (_) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Motyw aplikacji',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Wybierz preferowany tryb kolorystyczny.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: 12),
                  RadioListTile<ThemeMode>(
                    value: ThemeMode.system,
                    groupValue: themeMode,
                    onChanged: (value) {
                      if (value != null) {
                        themeController.setThemeMode(value);
                      }
                    },
                    title: const Text('Systemowy'),
                    subtitle: const Text('Automatycznie dopasuj do ustawień systemu'),
                  ),
                  RadioListTile<ThemeMode>(
                    value: ThemeMode.light,
                    groupValue: themeMode,
                    onChanged: (value) {
                      if (value != null) {
                        themeController.setThemeMode(value);
                      }
                    },
                    title: const Text('Jasny'),
                  ),
                  RadioListTile<ThemeMode>(
                    value: ThemeMode.dark,
                    groupValue: themeMode,
                    onChanged: (value) {
                      if (value != null) {
                        themeController.setThemeMode(value);
                      }
                    },
                    title: const Text('Ciemny'),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
        _SectionHeader(title: 'Aktywność i społeczność'),
        const SizedBox(height: 12),
        _SettingsCard(
          child: ListTile(
            leading: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.emoji_events,
                color: Theme.of(context).colorScheme.primary,
                size: 24,
              ),
            ),
            title: const Text(
              'Punkty i ranking',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            subtitle: const Text('Zobacz swoje punkty, odznaki i ranking społecznościowy'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              context.go('/home/activity');
            },
          ),
        ),
        const SizedBox(height: 24),
        _SectionHeader(title: 'Preferowane kanały'),
        const SizedBox(height: 12),
        channelsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => _SettingsCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Nie udało się pobrać listy kanałów: $error'),
            ),
          ),
          data: (channels) {
            final limitedChannels = channels.take(60).toList();
            return _SettingsCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    limitedChannels.isEmpty
                        ? 'Brak dostępnych kanałów'
                        : 'Zaznacz kanały, które chcesz mieć zawsze pod ręką.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: limitedChannels
                        .map(
                          (channel) => FilterChip(
                            label: Text(channel.name),
                            avatar: ChannelLogo(
                              name: channel.name,
                              logoUrl: channel.logoUrl,
                              size: 28,
                              borderRadius: 8,
                            ),
                            selected:
                                currentSettings.preferredChannelIds.contains(channel.id),
                            onSelected: (_) => controller.togglePreferredChannel(channel.id),
                          ),
                        )
                        .toList(),
                  ),
                  if (currentSettings.preferredChannelIds.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: controller.clearPreferredChannels,
                        child: const Text('Wyczyść wybór'),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
            color: Theme.of(context).colorScheme.onSurface,
          ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48),
            const SizedBox(height: 12),
            Text(
              'Nie udało się wczytać ustawień',
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: Theme.of(context).colorScheme.error),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onRetry,
              child: const Text('Spróbuj ponownie'),
            ),
          ],
        ),
      ),
    );
  }
}

final _settingsChannelsProvider =
    FutureProvider.autoDispose<List<ChannelDto>>((ref) async {
  final api = ref.watch(channelApiProvider);
  final response = await api.getChannels();
  return response.data;
});

/// Widget z przypomnieniem o ustawieniu dźwięków powiadomień
class _NotificationSoundReminder extends ConsumerStatefulWidget {
  const _NotificationSoundReminder({required this.controller});

  final SettingsController controller;

  @override
  ConsumerState<_NotificationSoundReminder> createState() =>
      _NotificationSoundReminderState();
}

class _NotificationSoundReminderState
    extends ConsumerState<_NotificationSoundReminder> {
  bool _shouldShow = true;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _checkVisibility();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Odśwież widoczność bannera, gdy ustawienia się zmienią
    final settings = ref.watch(settingsControllerProvider);
    settings.whenData((_) => _checkVisibility());
  }

  Future<void> _checkVisibility() async {
    final shouldShow = await widget.controller.shouldShowSoundReminder();
    if (mounted) {
      setState(() {
        _shouldShow = shouldShow;
        _isLoading = false;
      });
    }
  }

  Future<void> _dismiss() async {
    await widget.controller.dismissSoundReminder();
    if (mounted) {
      setState(() {
        _shouldShow = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || !_shouldShow) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).colorScheme.primary.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.notifications_active,
            color: Theme.of(context).colorScheme.primary,
            size: 28,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ustaw dźwięki powiadomień',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Wybierz dźwięk powiadomień dla BackOn.tv, aby nie przegapić ulubionych programów',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.close, size: 20),
            onPressed: _dismiss,
            tooltip: 'Ukryj',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(
              minWidth: 32,
              minHeight: 32,
            ),
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ],
      ),
    );
  }
}

// Dostępne dźwięki alarmów
class _SoundOption {
  const _SoundOption({required this.value, required this.label});
  final String value;
  final String label;
}

const _availableSounds = [
  _SoundOption(value: 'default', label: 'Domyślny systemowy'),
  _SoundOption(value: 'backon_notification_v1', label: 'Dźwięk BackOn (domyślny)'),
  _SoundOption(value: 'notification_sound', label: 'Klasyczny alarm'),
  _SoundOption(value: 'alert_gentle', label: 'Delikatny'),
  _SoundOption(value: 'alert_urgent', label: 'Pilny'),
  _SoundOption(value: 'bell_ring', label: 'Dzwonek'),
  _SoundOption(value: 'custom_file', label: 'Własny plik'),
];

String _getSoundLabel(String soundValue) {
  if (soundValue == 'custom_file') {
    return 'Własny plik';
  }
  return _availableSounds
      .firstWhere(
        (sound) => sound.value == soundValue,
        orElse: () => _availableSounds[0],
      )
      .label;
}
