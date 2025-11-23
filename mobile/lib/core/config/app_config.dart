class AppConfig {
  AppConfig._();

  /// URL bazy API - można ustawić przez --dart-define=API_BASE_URL=...
  /// 
  /// Dla developmentu (telefon w tej samej sieci):
  ///   flutter run --dart-define=API_BASE_URL=http://192.168.8.145:3001
  /// 
  /// Dla produkcji (publiczny serwer):
  ///   flutter build appbundle --dart-define=API_BASE_URL=https://api.backontv.com
  /// 
  /// UWAGA: Na produkcji NIE używaj localhost - to nie zadziała!
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001',
  );
}

