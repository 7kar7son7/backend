import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Ekran z literami A–Z (np. do wyboru litery przy przeglądaniu kanałów).
/// Otwierany po wejściu w ikonę icon_AO.
class AlphabetPage extends StatelessWidget {
  const AlphabetPage({super.key});

  static const routeName = 'letters';

  static const _letters = [
    'A', 'Ą', 'B', 'C', 'Ć', 'D', 'E', 'Ę', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'Ł',
    'M', 'N', 'Ń', 'O', 'Ó', 'P', 'Q', 'R', 'S', 'Ś', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ź', 'Ż',
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Wybierz literę'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: GridView.builder(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 5,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1,
            ),
            itemCount: _letters.length,
            itemBuilder: (context, index) {
              final letter = _letters[index];
              return Material(
                color: theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  onTap: () {
                    // Można później przekazać wybraną literę (np. do filtrowania kanałów)
                    context.pop(letter);
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Center(
                    child: Text(
                      letter,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: theme.colorScheme.onSurface,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
