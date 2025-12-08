import 'package:flutter/material.dart';
import '../../features/events/data/event_dto.dart';

/// Dialog potwierdzenia wydarzenia zgodny z designem
class EventConfirmationDialog extends StatelessWidget {
  const EventConfirmationDialog({
    required this.title,
    super.key,
  });

  final String title;

  static Future<EventChoiceDto?> show({
    required BuildContext context,
    required String title,
  }) async {
    return showDialog<EventChoiceDto>(
      context: context,
      barrierColor: Colors.black.withOpacity(0.7),
      barrierDismissible: true,
      builder: (context) => EventConfirmationDialog(title: title),
    );
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Szary baner reklamowy - góra
            _AdPlaceholderBanner(),
            
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
            
            // Przyciski z ikonami (bez tekstu)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  // Zielony przycisk - kciuk w górę
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.of(context).pop(EventChoiceDto.OPTION1),
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
                      onPressed: () => Navigator.of(context).pop(EventChoiceDto.OPTION2),
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
            
            // Szary baner reklamowy - dół
            _AdPlaceholderBanner(),
          ],
        ),
      ),
    );
  }
}

/// Szary baner reklamowy - placeholder
class _AdPlaceholderBanner extends StatelessWidget {
  const _AdPlaceholderBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
      decoration: BoxDecoration(
        color: const Color(0xFF9E9E9E), // Szary
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        'MIEJSCE NA REKLAMĘ',
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          color: const Color(0xFF1C1F2E), // Ciemny tekst
          fontWeight: FontWeight.w600,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

