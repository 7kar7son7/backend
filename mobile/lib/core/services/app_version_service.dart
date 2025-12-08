import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/app_version_api.dart';

class AppVersionService {
  AppVersionService._();

  /// Sprawdź czy jest dostępna nowa wersja aplikacji
  static Future<bool> checkForUpdate(BuildContext context, WidgetRef ref) async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version;
      final currentBuildNumber = int.tryParse(packageInfo.buildNumber) ?? 0;

      debugPrint('📱 Aktualna wersja aplikacji: $currentVersion+$currentBuildNumber');

      final api = ref.read(appVersionApiProvider);
      final response = await api.getLatestVersion();

      final latestVersion = response.data.version;
      final latestBuildNumber = response.data.buildNumber;

      debugPrint('🌐 Najnowsza wersja w backendzie: $latestVersion+$latestBuildNumber');

      // Porównaj wersje
      final isUpdateAvailable = _compareVersions(
        currentVersion,
        currentBuildNumber,
        latestVersion,
        latestBuildNumber,
      );

      debugPrint('🔄 Czy dostępna aktualizacja: $isUpdateAvailable');

      if (isUpdateAvailable && context.mounted) {
        debugPrint('✅ Pokazuję dialog aktualizacji');
        _showUpdateDialog(
          context,
          latestVersion,
          response.data.updateUrl,
        );
        return true;
      }

      return false;
    } catch (e, stackTrace) {
      debugPrint('❌ Błąd sprawdzania wersji aplikacji: $e');
      debugPrint('Stack trace: $stackTrace');
      return false;
    }
  }

  /// Porównaj wersje - zwraca true jeśli dostępna jest nowsza wersja
  static bool _compareVersions(
    String currentVersion,
    int currentBuildNumber,
    String latestVersion,
    int latestBuildNumber,
  ) {
    // Najpierw sprawdź build number (bardziej precyzyjne)
    if (latestBuildNumber > currentBuildNumber) {
      return true;
    }

    // Jeśli build number jest równy, sprawdź wersję
    final currentParts = currentVersion.split('.').map(int.parse).toList();
    final latestParts = latestVersion.split('.').map(int.parse).toList();

    // Uzupełnij do 3 części (major.minor.patch)
    while (currentParts.length < 3) {
      currentParts.add(0);
    }
    while (latestParts.length < 3) {
      latestParts.add(0);
    }

    for (int i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) {
        return true;
      } else if (latestParts[i] < currentParts[i]) {
        return false;
      }
    }

    return false;
  }

  /// Pokaż dialog z informacją o nowej wersji
  static void _showUpdateDialog(
    BuildContext context,
    String latestVersion,
    String updateUrl,
  ) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Dostępna nowa wersja'),
        content: Text(
          'Dostępna jest nowa wersja aplikacji ($latestVersion).\n\n'
          'Zaktualizuj aplikację, aby korzystać z najnowszych funkcji i poprawek.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Później'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(context).pop();
              final uri = Uri.parse(updateUrl);
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            child: const Text('Aktualizuj'),
          ),
        ],
      ),
    );
  }
}

