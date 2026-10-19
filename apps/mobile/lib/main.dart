import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'theme/vexora_theme.dart';
import 'l10n/app_localizations.dart';
import 'providers/auth_provider.dart';
import 'screens/onboarding_screen.dart';
import 'screens/home_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const VexoraApp());
}

/// Vexora Mobile Root Application
/// Meets security and architectural gates:
/// - Riverpod State Management
/// - Multi-Language Localization (English, Hindi, Odia)
/// - Dark Mode First Theme (Electric Indigo #6366F1)
/// - Authenticated Routing with Hardware Secure Storage
class VexoraApp extends StatelessWidget {
  const VexoraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      child: Consumer(
        builder: (context, ref, _) {
          final locale = ref.watch(localeProvider);
          final authState = ref.watch(authProvider);
          final themeMode = ref.watch(themeModeProvider);

          return MaterialApp(
            title: 'Vexora Esports',
            debugShowCheckedModeBanner: false,
            locale: locale,
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: const [
              AppLocalizationsDelegate(),
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            // Vexora Electric Indigo (0xFF6366F1) with Brightness.dark default
            theme: VexoraTheme.lightTheme,
            darkTheme: VexoraTheme.darkTheme,
            themeMode: themeMode,
            home: _RootNavigationRouter(authState: authState),
          );
        },
      ),
    );
  }
}

class _RootNavigationRouter extends StatelessWidget {
  final AuthState authState;

  const _RootNavigationRouter({required this.authState});

  @override
  Widget build(BuildContext context) {
    if (authState.status == AuthStatus.initial || authState.isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F172A),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Vexora Esports Tournament Platform',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              SizedBox(height: 16),
              CircularProgressIndicator(
                color: Color(0xFF6366F1),
              ),
            ],
          ),
        ),
      );
    }

    if (authState.isAuthenticated) {
      return const HomeShell();
    }

    return const OnboardingScreen();
  }
}
