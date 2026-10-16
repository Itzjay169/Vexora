import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/secure_storage_service.dart';
import '../config/flavour.dart';

/// User Profile Model
class UserProfile {
  final String id;
  final String username;
  final String displayName;
  final String? email;
  final String? phone;
  final String role;
  final Map<String, String> linkedGameIds;

  const UserProfile({
    required this.id,
    required this.username,
    required this.displayName,
    this.email,
    this.phone,
    required this.role,
    this.linkedGameIds = const {},
  });

  bool get isOrganiser => role == 'ORGANISER' || role == 'ADMIN' || role == 'SUPER_ADMIN';
}

/// Authentication State
enum AuthStatus {
  initial,
  loading,
  authenticated,
  unauthenticated,
  error,
}

class AuthState {
  final AuthStatus status;
  final UserProfile? user;
  final String? errorMessage;

  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.errorMessage,
  });

  bool get isAuthenticated => status == AuthStatus.authenticated && user != null;
  bool get isLoading => status == AuthStatus.loading;

  AuthState copyWith({
    AuthStatus? status,
    UserProfile? user,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

/// Auth State Notifier using Riverpod
class AuthNotifier extends StateNotifier<AuthState> {
  final SecureStorageService _storage;

  AuthNotifier({SecureStorageService? storage})
      : _storage = storage ?? SecureStorageService(),
        super(const AuthState()) {
    // Deferred to a timer callback so the first frame renders the splash screen
    // before the async secure-storage probe runs (also prevents MissingPluginException
    // from crashing widget tests where no platform channel is available).
    Future.delayed(Duration.zero, checkSession);
  }

  Future<void> checkSession() async {
    try {
      final hasSession = await _storage.hasValidSession();
      if (hasSession) {
        final profile = await _storage.getUserProfile();
        if (profile['userId'] != null) {
          state = AuthState(
            status: AuthStatus.authenticated,
            user: UserProfile(
              id: profile['userId']!,
              username: profile['username'] ?? 'Player',
              displayName: profile['username'] ?? 'Player',
              role: profile['role'] ?? 'PLAYER',
              linkedGameIds: const {
                'bgmi': '5512398471',
                'freefire': '789123456',
              },
            ),
          );
          return;
        }
      }
    } catch (_) {
      // Gracefully fallback to unauthenticated state if hardware storage is uninitialized or in test mode
    }
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  Future<bool> signInWithPhone(String phone, String otp) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);

    // Simulate OTP verification & token storage
    await Future.delayed(const Duration(milliseconds: 300));

    if (otp.length != 6 || otp == '000000') {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: 'Invalid verification code. Please check SMS.',
      );
      return false;
    }

    final user = UserProfile(
      id: 'usr_mobile_${DateTime.now().millisecondsSinceEpoch}',
      username: 'gamer_${phone.substring(phone.length - 4)}',
      displayName: 'Vexora Warrior',
      phone: phone,
      role: 'PLAYER',
      linkedGameIds: const {
        'bgmi': '5598124410',
      },
    );

    // Security Gate: Save tokens to secure storage (Keystore/Keychain)
    await _storage.saveTokens(
      accessToken: 'simulated_jwt_access_token_${user.id}',
      refreshToken: 'simulated_jwt_refresh_token_${user.id}',
    );

    await _storage.saveUserProfile(
      userId: user.id,
      username: user.username,
      role: user.role,
    );

    state = AuthState(status: AuthStatus.authenticated, user: user);
    return true;
  }

  Future<bool> signInWithEmail(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);

    await Future.delayed(const Duration(milliseconds: 300));

    if (password.length < 8) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: 'Password must be at least 8 characters.',
      );
      return false;
    }

    final user = UserProfile(
      id: 'usr_email_${DateTime.now().millisecondsSinceEpoch}',
      username: email.split('@')[0],
      displayName: email.split('@')[0],
      email: email,
      role: 'PLAYER',
    );

    await _storage.saveTokens(
      accessToken: 'simulated_jwt_access_token_${user.id}',
      refreshToken: 'simulated_jwt_refresh_token_${user.id}',
    );

    await _storage.saveUserProfile(
      userId: user.id,
      username: user.username,
      role: user.role,
    );

    state = AuthState(status: AuthStatus.authenticated, user: user);
    return true;
  }

  Future<void> signOut() async {
    await _storage.clearAll();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

// ─── Riverpod Providers ──────────────────────────────────────────────────────

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return AuthNotifier(storage: storage);
});

final localeProvider = StateProvider<Locale>((ref) {
  return const Locale('en');
});

final flavourProvider = StateProvider<AppFlavour>((ref) {
  return AppFlavour.player;
});
