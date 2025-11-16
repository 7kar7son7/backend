import 'package:characters/characters.dart';
import 'package:flutter/material.dart';

class ChannelLogo extends StatelessWidget {
  const ChannelLogo({
    super.key,
    required this.name,
    this.logoUrl,
    this.size = 56,
    this.borderRadius = 18,
  });

  final String name;
  final String? logoUrl;
  final double size;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final normalizedUrl = _normalizeUrl(logoUrl);
    final initials = _buildInitials(name);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: normalizedUrl != null
            ? Image.network(
                normalizedUrl,
                fit: BoxFit.contain,
                filterQuality: FilterQuality.high,
                errorBuilder: (context, _, __) => _Fallback(initials: initials),
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) {
                    return child;
                  }
                  return const Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)));
                },
              )
            : _Fallback(initials: initials),
      ),
    );
  }

  String? _normalizeUrl(String? value) {
    if (value == null || value.trim().isEmpty) {
      return null;
    }
    final trimmed = value.trim();
    if (trimmed.startsWith('http://')) {
      return trimmed.replaceFirst('http://', 'https://');
    }
    return trimmed;
  }

  String _buildInitials(String rawName) {
    final normalized = rawName.trim();
    if (normalized.isEmpty) {
      return '?';
    }

    final segments = normalized.split(RegExp(r'\s+')).where((segment) => segment.isNotEmpty);
    final buffer = StringBuffer();

    for (final segment in segments) {
      final chars = segment.characters;
      if (chars.isEmpty) {
        continue;
      }
      final first = chars.first.trim();
      if (first.isEmpty) {
        continue;
      }
      buffer.write(first.toUpperCase());
      if (buffer.length >= 2) {
        break;
      }
    }

    if (buffer.isEmpty) {
      final fallbackChars = normalized.characters.where((char) => char.trim().isNotEmpty).take(2).toList();
      if (fallbackChars.isEmpty) {
        return '?';
      }
      return fallbackChars.map((char) => char.toUpperCase()).join();
    }

    return buffer.toString();
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.initials});

  final String initials;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      color: colorScheme.primaryContainer.withOpacity(0.35),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: colorScheme.primary,
            ),
      ),
    );
  }
}
