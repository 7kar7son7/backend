import 'package:flex_color_scheme/flex_color_scheme.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  AppTheme._();

  static const FlexSchemeColor _scheme = FlexSchemeColor(
    primary: Color(0xFFDC2626),
    primaryContainer: Color(0xFFFFE5E5),
    secondary: Color(0xFFEF4444),
    secondaryContainer: Color(0xFFFFE5E5),
    tertiary: Color(0xFFFF8A65),
    tertiaryContainer: Color(0xFFFFD7CC),
    error: Color(0xFFBA1A1A),
  );

  static ThemeData get light => FlexThemeData.light(
        colors: _scheme,
        surfaceMode: FlexSurfaceMode.highBackgroundLowScaffold,
        blendLevel: 10,
        useMaterial3: true,
        swapLegacyOnMaterial3: true,
        visualDensity: VisualDensity.comfortable,
      ).copyWith(
        scaffoldBackgroundColor: const Color(0xFFF5F7FE),
        cardColor: Colors.white,
        textTheme: GoogleFonts.interTextTheme(),
        appBarTheme: const AppBarTheme(
          elevation: 0,
          centerTitle: true,
          backgroundColor: Colors.transparent,
          foregroundColor: Color(0xFF1C1F2E),
          titleTextStyle: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 20,
            color: Color(0xFF1C1F2E),
          ),
        ),
      );

  static ThemeData get dark => FlexThemeData.dark(
        colors: _scheme,
        surfaceMode: FlexSurfaceMode.levelSurfacesLowScaffold,
        blendLevel: 20,
        useMaterial3: true,
        swapLegacyOnMaterial3: true,
        visualDensity: VisualDensity.comfortable,
      ).copyWith(
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        appBarTheme: const AppBarTheme(
          elevation: 0,
          centerTitle: true,
        ),
      );
}
