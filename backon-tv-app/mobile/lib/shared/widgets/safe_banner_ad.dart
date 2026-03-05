import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../../core/services/ad_service.dart';
import '../../core/services/analytics_service.dart';

/// Slot na reklamę: pokazuje załadowany [BannerAd] lub fallback (szary box) po timeout.
/// Pomiar viewability: [AnalyticsService.adImpression] po min. [AdService.viewabilitySeconds] sek widoczności.
/// Klik: [AnalyticsService.adClick]. Jedna instancja = jeden request (brak podwójnych).
class SafeBannerAd extends StatefulWidget {
  const SafeBannerAd({
    super.key,
    this.preloadedAd,
    this.fallbackHeight = 90,
    this.loadOnMount = false,
  }) : assert(preloadedAd == null || preloadedAd is BannerAd),
       assert(!(preloadedAd != null && loadOnMount));

  /// Opcjonalnie wcześniej załadowany banner (np. z [AdService.preloadBanner]).
  /// Jeśli null i [loadOnMount] false – pokazuje od razu fallback.
  final BannerAd? preloadedAd;

  /// Wysokość fallbacku (px) gdy reklama nie załadowana.
  final double fallbackHeight;

  /// Gdy true i [preloadedAd] null: ładuje reklamę po zamontowaniu (jedno żądanie, timeout jak w AdService).
  final bool loadOnMount;

  @override
  State<SafeBannerAd> createState() => _SafeBannerAdState();
}

class _SafeBannerAdState extends State<SafeBannerAd> {
  BannerAd? _ad;
  bool _disposed = false;
  Timer? _viewabilityTimer;
  bool _impressionLogged = false;

  @override
  void initState() {
    super.initState();
    _ad = widget.preloadedAd is BannerAd ? widget.preloadedAd as BannerAd : null;
    if (_ad != null) {
      _startViewabilityTimer();
    } else if (widget.loadOnMount) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadOnMount());
    }
  }

  Future<void> _loadOnMount() async {
    if (_disposed || !mounted) return;
    final width = MediaQuery.sizeOf(context).width;
    // Min. 320 – w scroll view szerokość może być 0 w pierwszej klatce
    final widthPx = width > 0 ? width : 320.0;
    final loaded = await AdService.preloadBanner(
      widthPx: widthPx,
      timeout: Duration(seconds: AdService.loadTimeoutSeconds),
    );
    if (_disposed || !mounted) return;
    setState(() {
      _ad = loaded;
      if (_ad != null) _startViewabilityTimer();
    });
  }

  void _startViewabilityTimer() {
    _viewabilityTimer?.cancel();
    _viewabilityTimer = Timer(
      Duration(seconds: AdService.viewabilitySeconds),
      () {
        if (_disposed || !mounted) return;
        if (!_impressionLogged) {
          _impressionLogged = true;
          AnalyticsService.adImpression(adUnitId: null);
        }
      },
    );
  }

  @override
  void didUpdateWidget(covariant SafeBannerAd oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.preloadedAd != widget.preloadedAd) {
      _viewabilityTimer?.cancel();
      _ad = widget.preloadedAd is BannerAd ? widget.preloadedAd as BannerAd : null;
      if (_ad != null) _startViewabilityTimer();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _viewabilityTimer?.cancel();
    _ad?.dispose();
    _ad = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ad = _ad;
    if (ad != null) {
      return SizedBox(
        width: ad.size.width.toDouble(),
        height: ad.size.height.toDouble(),
        child: AdWidget(ad: ad),
      );
    }
    return _FallbackBanner(height: widget.fallbackHeight);
  }
}

/// Szary placeholder gdy reklama nie załadowana (brak czarnego ekranu).
class _FallbackBanner extends StatelessWidget {
  const _FallbackBanner({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      height: height,
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
      decoration: BoxDecoration(
        color: const Color(0xFF9E9E9E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.campaign,
              size: 20,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 8),
            Text(
              'Miejsce na reklamę',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: const Color(0xFF1C1F2E),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
