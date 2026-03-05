import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/onboarding_slide.dart';

final onboardingCompletedProvider = StateProvider<bool>((ref) => false);

final onboardingSlidesProvider = Provider<List<OnboardingSlide>>(
  (ref) => const [
    OnboardingSlide(
      title: 'Śledź swoje kanały',
      subtitle:
          'Przeglądaj telemagazyn i dodawaj kanały oraz programy do ulubionych.',
      icon: Icons.live_tv_rounded,
    ),
    OnboardingSlide(
      title: 'Bądź pierwszy przy wydarzeniu',
      subtitle:
          'Zainicjuj wydarzenie, a reszta społeczności dostanie powiadomienie push.',
      icon: Icons.notifications_active_rounded,
    ),
    OnboardingSlide(
      title: 'Zbieraj punkty i odznaki',
      subtitle:
          'Potwierdzaj wydarzenia i buduj streak, by zmniejszać liczbę reklam.',
      icon: Icons.emoji_events_rounded,
    ),
  ],
);
