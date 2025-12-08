import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/channel_logo.dart';
import '../../channels/data/channel_api.dart';
import '../../channels/data/channel_dto.dart';
import '../application/settings_controller.dart';
import '../data/settings_model.dart';
import '../../../core/theme/theme_controller.dart';

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

class _SettingsContent extends ConsumerWidget {
  const _SettingsContent({required this.settings});

  final Settings settings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(settingsControllerProvider.notifier);
    final channelsAsync = ref.watch(_settingsChannelsProvider);
    final themeModeAsync = ref.watch(themeModeProvider);
    final themeController = ref.read(themeModeProvider.notifier);
    final themeMode = themeModeAsync.value ?? ThemeMode.system;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 140),
      children: [
        _SectionHeader(title: 'Powiadomienia'),
        const SizedBox(height: 12),
        _SettingsCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SwitchListTile.adaptive(
                value: settings.soundEnabled,
                onChanged: controller.toggleSound,
                title: const Text('Dźwięk powiadomień'),
                subtitle: const Text('Włącz dźwięk przy nadchodzących alertach'),
              ),
              const Divider(height: 1),
              ListTile(
                title: const Text('Czułość powiadomień'),
                subtitle: Text(settings.sensitivity.label),
                trailing: DropdownButton<NotificationSensitivity>(
                  value: settings.sensitivity,
                  underline: const SizedBox.shrink(),
                  onChanged: (value) {
                    if (value != null) {
                      controller.updateSensitivity(value);
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
                                settings.preferredChannelIds.contains(channel.id),
                            onSelected: (_) => controller.togglePreferredChannel(channel.id),
                          ),
                        )
                        .toList(),
                  ),
                  if (settings.preferredChannelIds.isNotEmpty) ...[
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
