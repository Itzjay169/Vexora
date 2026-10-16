import 'dart:async';
import 'dart:math';
import 'package:dio/dio.dart';
import 'secure_storage_service.dart';

/// Network Client with Automated Token Refresh Queue and Security Interceptors
class ApiClient {
  final Dio dio;
  final SecureStorageService storage;
  final void Function()? onAuthenticationFailed;

  bool _isRefreshing = false;
  Completer<String?>? _refreshCompleter;

  ApiClient({
    required String baseUrl,
    required this.storage,
    this.onAuthenticationFailed,
  }) : dio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 10),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Platform': 'mobile',
            },
          ),
        ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Injects unique X-Correlation-ID for end-to-end request tracing
          if (!options.headers.containsKey('X-Correlation-ID')) {
            final timestamp = DateTime.now().millisecondsSinceEpoch;
            final rand = Random().nextInt(0xFFFFFF).toRadixString(16).padLeft(6, '0');
            options.headers['X-Correlation-ID'] = 'mbl-$timestamp-$rand';
          }

          // Inject access token if available
          final token = await storage.getAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          // Automatic Token Refresh on 401 Unauthorized with queueing
          if (error.response?.statusCode == 401) {
            // If already refreshing, wait for active refresh operation
            if (_isRefreshing) {
              final newAccessToken = await _refreshCompleter?.future;
              if (newAccessToken != null && newAccessToken.isNotEmpty) {
                final retryOptions = error.requestOptions;
                retryOptions.headers['Authorization'] = 'Bearer $newAccessToken';
                try {
                  final retryResponse = await dio.fetch(retryOptions);
                  return handler.resolve(retryResponse);
                } catch (retryError) {
                  return handler.next(error);
                }
              } else {
                return handler.next(error);
              }
            }

            _isRefreshing = true;
            _refreshCompleter = Completer<String?>();

            final refreshToken = await storage.getRefreshToken();
            if (refreshToken != null && refreshToken.isNotEmpty) {
              try {
                // Request token refresh using separate dio instance to prevent loops
                final refreshResponse = await Dio(
                  BaseOptions(baseUrl: dio.options.baseUrl),
                ).post(
                  '/auth/refresh',
                  data: {'refreshToken': refreshToken},
                );

                if (refreshResponse.statusCode == 200 &&
                    refreshResponse.data['success'] == true) {
                  final newAccessToken =
                      refreshResponse.data['data']['accessToken'] as String;
                  final newRefreshToken =
                      refreshResponse.data['data']['refreshToken'] as String;

                  // Save rotated tokens to hardware-backed secure storage
                  await storage.saveTokens(
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                  );

                  _refreshCompleter?.complete(newAccessToken);
                  _isRefreshing = false;

                  // Retry original failed request with refreshed token
                  final originalOptions = error.requestOptions;
                  originalOptions.headers['Authorization'] =
                      'Bearer $newAccessToken';

                  final retryResponse = await dio.fetch(originalOptions);
                  return handler.resolve(retryResponse);
                } else {
                  throw Exception('Token refresh rejected');
                }
              } catch (_) {
                // Refresh failed or reuse detected -> force logout & clear secure storage
                _refreshCompleter?.complete(null);
                _isRefreshing = false;
                await storage.clearAll();
                onAuthenticationFailed?.call();
              }
            } else {
              _refreshCompleter?.complete(null);
              _isRefreshing = false;
              await storage.clearAll();
              onAuthenticationFailed?.call();
            }
          }
          return handler.next(error);
        },
      ),
    );
  }
}
