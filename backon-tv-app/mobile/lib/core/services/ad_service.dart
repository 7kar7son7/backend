import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'analytics_service.dart';

/// Konfiguracja i preload reklam z timeoutem. Jedna instancja requestu na preload (brak podwójnych requestów).
class AdService {
  AdService._();

  static bool _initialized = false;

  /// Testowe Ad Unit ID (banner) – Android. Przed publikacją zamień na własne.
  static const String _testBannerAdUnitIdAndroid =
      'ca-app-pub-3940256099942544/6300978111';
  /// Testowe Ad Unit ID (banner) – iOS.
  static const String _testBannerAdUnitIdIos =
      'ca-app-pub-3940256099942544/2435281174';

  static String get _bannerAdUnitId {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return _testBannerAdUnitIdAndroid;
    }
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      return _testBannerAdUnitIdIos;
    }
    return _testBannerAdUnitIdAndroid;
  }

  /// Inicjalizacja SDK (wywołać raz przy starcie aplikacji).
  static Future<void> initialize() async {
    if (_initialized) return;
    try {
      await MobileAds.instance.initialize();
      _initialized = true;
      debugPrint('AdService: Mobile Ads SDK initialized');
    } catch (e) {
      debugPrint('AdService: init failed: $e');
    }
  }

  /// Preload jednego bannera: ładuje reklamę, zwraca po załadowaniu lub po [timeout].
  /// Zwraca [BannerAd] (należy go później dispose) lub null przy timeout/błędzie.
  /// Jeden wywołanie = jeden request (brak podwójnych requestów).
  static Future<BannerAd?> preloadBanner({
    required double widthPx,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    if (!_initialized) await initialize();
    final completer = Completer<BannerAd?>();
    BannerAd? ad;

    // Szerokość min. 320 (adaptive wymaga sensownej wartości; w ListView bywa 0 w pierwszej klatce)
    final width = (widthPx < 320 ? 320.0 : widthPx).truncate();
    AdSize? size = await AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(width);
    if (size == null) {
      size = AdSize.banner; // 320x50 – fallback, żeby reklama w ogóle się załadowała
      debugPrint('AdService: using fallback AdSize.banner');
    }

    ad = BannerAd(
      adUnitId: _bannerAdUnitId,
      size: size,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (Ad ad) {
          if (!completer.isCompleted) {
            completer.complete(ad as BannerAd);
            AnalyticsService.adLoaded(adUnitId: _bannerAdUnitId);
          } else {
            (ad as BannerAd).dispose();
          }
        },
        onAdFailedToLoad: (Ad ad, LoadAdError error) {
          ad.dispose();
          if (!completer.isCompleted) {
            completer.complete(null);
          }
          debugPrint('AdService: banner failed to load: $error');
        },
        onAdClicked: (Ad ad) {
          AnalyticsService.adClick(adUnitId: _bannerAdUnitId);
        },
      ),
    );
    ad.load();

    try {
      final result = await completer.future.timeout(
        timeout,
        onTimeout: () {
          if (!completer.isCompleted) completer.complete(null);
          ad?.dispose();
          debugPrint('AdService: banner preload timeout');
          return null;
        },
      );
      return result;
    } catch (_) {
      ad?.dispose();
      return null;
    }
  }

  /// Domyślny timeout ładowania reklamy przed pokazaniem popupa (sekundy).
  static const int loadTimeoutSeconds = 5;

  /// Minimalny czas widoczności reklamy (viewability) w sekundach przed zaliczeniem impression.
  static const int viewabilitySeconds = 2;
}
