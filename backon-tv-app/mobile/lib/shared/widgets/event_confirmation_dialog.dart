import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:flutter/material.dart';

import '../../core/services/ad_service.dart';
import '../../features/events/data/event_dto.dart';
import 'safe_banner_ad.dart';

/// Dialog potwierdzenia wydarzenia zgodny z designem.
/// StatefulWidget żeby przycisk reagował tylko na pierwsze kliknięcie (unika wielokrotnego pop).
/// Opcjonalnie przyjmuje wcześniej załadowane reklamy (popup pokazywany dopiero po preloadzie lub timeout).
class EventConfirmationDialog extends StatefulWidget {
  const EventConfirmationDialog({
    required this.title,
    super.key,
    this.topBannerAd,
    this.bottomBannerAd,
  });

  final String title;
  /// Wcześniej załadowany banner (góra). Dispose wykona widget po zamknięciu.
  final BannerAd? topBannerAd;
  final BannerAd? bottomBannerAd;

  /// Ładuje reklamy z timeoutem [AdService.loadTimeoutSeconds], potem pokazuje dialog.
  /// Fallback (szary box) jeśli reklama się nie załaduje – brak czarnego ekranu.
  static Future<EventChoiceDto?> show({
    required BuildContext context,
    required String title,
    BannerAd? topBannerAd,
    BannerAd? bottomBannerAd,
  }) async {
    return showDialog<EventChoiceDto>(
      context: context,
      barrierColor: Colors.black.withOpacity(0.7),
      barrierDismissible: true,
      builder: (context) => EventConfirmationDialog(
        title: title,
        topBannerAd: topBannerAd,
        bottomBannerAd: bottomBannerAd,
      ),
    );
  }

  /// Ładuje reklamy (max [AdService.loadTimeoutSeconds] s), potem pokazuje popup.
  /// Nie blokuje ekranu: po timeoutcie pokazuje dialog z fallbackiem (szary box zamiast reklamy).
  static Future<EventChoiceDto?> showWithAdPreload({
    required BuildContext context,
    required String title,
  }) async {
    final width = MediaQuery.sizeOf(context).width;
    final timeout = Duration(seconds: AdService.loadTimeoutSeconds);
    final results = await Future.wait<BannerAd?>([
      AdService.preloadBanner(widthPx: width, timeout: timeout),
      AdService.preloadBanner(widthPx: width, timeout: timeout),
    ]);
    if (!context.mounted) return null;
    return show(
      context: context,
      title: title,
      topBannerAd: results[0],
      bottomBannerAd: results[1],
    );
  }

  @override
  State<EventConfirmationDialog> createState() => _EventConfirmationDialogState();
}

class _EventConfirmationDialogState extends State<EventConfirmationDialog> {
  bool _alreadyPopped = false;

  void _closeWith(EventChoiceDto? choice) {
    if (_alreadyPopped) return;
    _alreadyPopped = true;
    Navigator.of(context).pop(choice);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1C1F2E), // Ciemne tło
          borderRadius: BorderRadius.circular(24),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SafeBannerAd(
              preloadedAd: widget.topBannerAd,
              fallbackHeight: 72,
            ),
            
            // Żółty przycisk z "KONIEC REKLAM ?"
            Container(
              width: double.infinity,
              margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: FilledButton(
                onPressed: () {}, // Nieaktywny - tylko wizualny
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFFFEB3B), // Żółty
                  foregroundColor: const Color(0xFF1C1F2E), // Ciemny tekst
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  'KONIEC REKLAM ?',
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: const Color(0xFF1C1F2E),
                    fontWeight: FontWeight.w800,
                    fontSize: 20,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                'Zgłoszenie powiadomiło Ciebie i innych widzów.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: Colors.white70,
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(height: 8),
            // Przyciski z ikonami (bez tekstu)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  // Zielony przycisk - kciuk w górę
                  Expanded(
                    child: FilledButton(
                      onPressed: () => _closeWith(EventChoiceDto.OPTION1),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF4CAF50), // Zielony
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 20),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: const Icon(Icons.thumb_up, size: 32),
                    ),
                  ),
                  
                  const SizedBox(width: 12),
                  
                  // Czerwony przycisk - kciuk w dół
                  Expanded(
                    child: FilledButton(
                      onPressed: () => _closeWith(EventChoiceDto.OPTION2),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFFF44336), // Czerwony
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 20),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: const Icon(Icons.thumb_down, size: 32),
                    ),
                  ),
                ],
              ),
            ),
            
                const SizedBox(height: 16),
                SafeBannerAd(
                  preloadedAd: widget.bottomBannerAd,
                  fallbackHeight: 72,
                ),
              ],
            ),
            Positioned(
              top: 8,
              right: 8,
              child: IconButton(
                onPressed: () => _closeWith(null),
                icon: const Icon(Icons.close, color: Colors.white70, size: 28),
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white12,
                  padding: const EdgeInsets.all(8),
                ),
                tooltip: 'Zamknij',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

