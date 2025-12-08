import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/favorites/presentation/favorites_page.dart';
import '../../features/channels/presentation/channel_programs_page.dart';
import '../../features/channels/presentation/channels_page.dart';
import '../../features/home/presentation/home_shell.dart';
import '../../features/onboarding/presentation/onboarding_page.dart';
import '../../features/onboarding/providers/onboarding_providers.dart';
import '../../features/programs/presentation/program_detail_page.dart';
import '../../features/settings/presentation/settings_page.dart';
import '../../features/activity/presentation/activity_page.dart';

final _rootNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'rootNavigator');
final _channelsNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'channelsNavigator');
final _favoritesNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'favoritesNavigator');
final _settingsNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'settingsNavigator');
final _activityNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'activityNavigator');

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  final notifier = RouterNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});

final appRouterProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(routerNotifierProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/home/channels', // Start od razu na listę kanałów (jak w TELEMAGAZYN)
    refreshListenable: notifier,
    redirect: notifier.handleRedirect,
    routes: [
      GoRoute(
        path: '/onboarding',
        name: OnboardingPage.routeName,
        builder: (context, state) => const OnboardingPage(),
      ),
      GoRoute(
        path: '/channels/:channelId/programs',
        name: ChannelProgramsPage.routeName,
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final channelId = state.pathParameters['channelId']!;
          return MaterialPage(
            key: state.pageKey,
            child: ChannelProgramsPage(channelId: channelId),
          );
        },
      ),
      GoRoute(
        path: '/programs/:programId',
        name: ProgramDetailPage.routeName,
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final programId = state.pathParameters['programId']!;
          final eventId = state.uri.queryParameters['eventId'];
          return MaterialPage(
            key: state.pageKey,
            child: ProgramDetailPage(
              programId: programId,
              eventId: eventId,
            ),
          );
        },
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
            navigatorKey: _favoritesNavigatorKey,
            routes: [
              GoRoute(
                path: '/home/favorites',
                name: FavoritesPage.routeName,
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: FavoritesPage(),
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
    // Onboarding jest opcjonalny - aplikacja startuje od razu na listę kanałów
    // Jeśli użytkownik chce zobaczyć onboarding, może do niego wrócić
    final goingOnboarding = state.matchedLocation == '/onboarding';
    final completed = ref.read(onboardingCompletedProvider);
    
    // Jeśli użytkownik ukończył onboarding i próbuje do niego wrócić, przekieruj na kanały
    if (completed && goingOnboarding) {
      return '/home/channels';
    }

    return null;
  }
}
