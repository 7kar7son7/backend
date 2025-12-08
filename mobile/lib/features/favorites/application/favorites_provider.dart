import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FavoritesNotifier extends StateNotifier<Set<String>> {
  static const _storageKey = 'favorite_channels';
  SharedPreferences? _prefs;

  FavoritesNotifier() : super({}) {
    _loadFavorites();
  }

  Future<void> _loadFavorites() async {
    _prefs = await SharedPreferences.getInstance();
    final favoriteIds = _prefs?.getStringList(_storageKey) ?? <String>[];
    state = favoriteIds.toSet();
  }

  Future<void> toggleFavorite(String channelId) async {
    final prefs = _prefs ??= await SharedPreferences.getInstance();
    final updated = Set<String>.from(state);
    
    if (updated.contains(channelId)) {
      updated.remove(channelId);
    } else {
      updated.add(channelId);
    }
    
    state = updated;
    await prefs.setStringList(_storageKey, updated.toList());
  }

  bool isFavorite(String channelId) {
    return state.contains(channelId);
  }

  int get count => state.length;
}

final favoritesProvider = StateNotifierProvider<FavoritesNotifier, Set<String>>(
  (ref) => FavoritesNotifier(),
);

