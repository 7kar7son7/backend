import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/activity/presentation/activity_page.dart';
import '../../features/channels/presentation/channels_page.dart';
import '../../features/home/presentation/home_shell.dart';
import '../../features/onboarding/presentation/onboarding_page.dart';
import '../../features/onboarding/providers/onboarding_providers.dart';
import '../../features/programs/presentation/program_schedule_page.dart';
import '../../features/settings/presentation/settings_page.dart';

final _rootNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'rootNavigator');
final _channelsNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'channelsNavigator');
final _scheduleNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'scheduleNavigator');
final _activityNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'activityNavigator');
final _settingsNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'settingsNavigator');

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  final notifier = RouterNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});

final appRouterProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(routerNotifierProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/onboarding',
    refreshListenable: notifier,
    redirect: notifier.handleRedirect,
    routes: [
      GoRoute(
        path: '/onboarding',
        name: OnboardingPage.routeName,
        builder: (context, state) => const OnboardingPage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            HomeShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: _channelsNavigatorKey,
            routes: [
              GoRoute(
                path: '/home/channels',
                name: ChannelsPage.routeName,
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: ChannelsPage(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _scheduleNavigatorKey,
            routes: [
              GoRoute(
                path: '/home/schedule',
                name: ProgramSchedulePage.routeName,
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: ProgramSchedulePage(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _activityNavigatorKey,
            routes: [
              GoRoute(
                path: '/home/activity',
                name: ActivityPage.routeName,
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: ActivityPage(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _settingsNavigatorKey,
            routes: [
              GoRoute(
                path: '/home/settings',
                name: SettingsPage.routeName,
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: SettingsPage(),
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

class RouterNotifier extends ChangeNotifier {
  RouterNotifier(this.ref) {
    ref.listen<bool>(
      onboardingCompletedProvider,
      (_, __) => notifyListeners(),
    );
  }

  final Ref ref;

  String? handleRedirect(BuildContext context, GoRouterState state) {
    final completed = ref.read(onboardingCompletedProvider);
    final goingOnboarding = state.matchedLocation == '/onboarding';

    if (!completed && !goingOnboarding) {
      return '/onboarding';
    }

    if (completed && goingOnboarding) {
      return '/home/channels';
    }

    return null;
  }
}
