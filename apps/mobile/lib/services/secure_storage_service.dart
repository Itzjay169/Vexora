import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure Storage Service
/// Enforces Security Gate: Tokens only stored in hardware-backed secure storage (Keystore/Keychain).
/// Never write tokens to plain SharedPreferences or unencrypted files.
class SecureStorageService {
  static const String _keyAccessToken = 'vexora_access_token';
  static const String _keyRefreshToken = 'vexora_refresh_token';
  static const String _keyUserId = 'vexora_user_id';
  static const String _keyUsername = 'vexora_username';
  static const String _keyUserRole = 'vexora_user_role';

  final FlutterSecureStorage _storage;

  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(
                encryptedSharedPreferences: true,
                resetOnError: true,
              ),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _keyAccessToken, value: accessToken);
    await _storage.write(key: _keyRefreshToken, value: refreshToken);
  }

  Future<String?> getAccessToken() async {
    return await _storage.read(key: _keyAccessToken);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _keyRefreshToken);
  }

  Future<void> saveUserProfile({
    required String userId,
    required String username,
    required String role,
  }) async {
    await _storage.write(key: _keyUserId, value: userId);
    await _storage.write(key: _keyUsername, value: username);
    await _storage.write(key: _keyUserRole, value: role);
  }

  Future<Map<String, String?>> getUserProfile() async {
    return {
      'userId': await _storage.read(key: _keyUserId),
      'username': await _storage.read(key: _keyUsername),
      'role': await _storage.read(key: _keyUserRole),
    };
  }

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }

  Future<bool> hasValidSession() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }
}
