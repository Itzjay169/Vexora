import 'package:flutter/material.dart';

/// Vexora Design System Tokens for Flutter
class VexoraColors {
  // Brand Colors
  static const Color primary = Color(0xFF6366F1); // Electric Indigo
  static const Color electricIndigo = Color(0xFF6366F1);
  static const Color primaryHover = Color(0xFF4F46E5);
  static const Color secondary = Color(0xFFA855F7); // Cyber Violet
  static const Color accent = Color(0xFF06B6D4); // Electric Cyan
  static const Color success = Color(0xFF10B981);

  // Dark Theme Surfaces
  static const Color bgDark = Color(0xFF0A0F1D);
  static const Color surfaceDark = Color(0xFF0F172A);
  static const Color surfaceElevatedDark = Color(0xFF131B2E);
  static const Color surfaceHighlightDark = Color(0xFF1E293B);
  static const Color borderDark = Color(0xFF334155);

  // Text Colors
  static const Color textPrimaryDark = Color(0xFFF8FAFC);
  static const Color textSecondaryDark = Color(0xFF94A3B8);
  static const Color textMutedDark = Color(0xFF64748B);

  // State Machine Colors (11 Blueprint States)
  static const Color stateDraft = Color(0xFF64748B);
  static const Color statePendingReview = Color(0xFFF59E0B);
  static const Color stateScheduled = Color(0xFF0EA5E9);
  static const Color stateRegistrationOpen = Color(0xFF10B981);
  static const Color stateCheckIn = Color(0xFF8B5CF6);
  static const Color stateLive = Color(0xFFF43F5E);
  static const Color stateResultPending = Color(0xFFFB923C);
  static const Color stateDisputed = Color(0xFFEF4444);
  static const Color stateCompleted = Color(0xFF6366F1);
  static const Color stateSettled = Color(0xFF14B8A6);
  static const Color stateArchived = Color(0xFF475569);

  // Trust Tokens
  static const Color trustVerified = Color(0xFF38BDF8);
  static const Color trustHashTick = Color(0xFF10B981);
}

class VexoraTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: VexoraColors.bgDark,
      primaryColor: VexoraColors.primary,
      colorScheme: const ColorScheme.dark(
        primary: VexoraColors.primary,
        secondary: VexoraColors.secondary,
        surface: VexoraColors.surfaceDark,
        error: VexoraColors.stateDisputed,
      ),
      cardTheme: const CardThemeData(
        color: VexoraColors.surfaceElevatedDark,
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: VexoraColors.borderDark, width: 1),
          borderRadius: BorderRadius.all(Radius.circular(12)),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: VexoraColors.surfaceDark,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: VexoraColors.textPrimaryDark,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
      useMaterial3: true,
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      primaryColor: VexoraColors.primary,
      colorScheme: const ColorScheme.light(
        primary: VexoraColors.primary,
        secondary: VexoraColors.secondary,
        surface: Colors.white,
        error: VexoraColors.stateDisputed,
      ),
      useMaterial3: true,
    );
  }
}
