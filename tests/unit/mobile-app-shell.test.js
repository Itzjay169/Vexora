import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const MOBILE_DIR = path.resolve('apps/mobile');

test('Phase 10: Flavours configuration defines Player and Organiser profiles', () => {
  const flavourPath = path.join(MOBILE_DIR, 'lib/config/flavour.dart');
  assert.ok(fs.existsSync(flavourPath), 'flavour.dart must exist');

  const content = fs.readFileSync(flavourPath, 'utf8');
  assert.ok(content.includes('enum AppFlavour'), 'Must define AppFlavour enum');
  assert.ok(content.includes('player'), 'Must contain player flavour');
  assert.ok(content.includes('organiser'), 'Must contain organiser flavour');
  assert.ok(content.includes('com.vexora.player'), 'Must define player package ID');
  assert.ok(content.includes('com.vexora.organiser'), 'Must define organiser package ID');
});

test('Phase 10: Hardware-backed secure storage service implements Keystore/Keychain encapsulation', () => {
  const storagePath = path.join(MOBILE_DIR, 'lib/services/secure_storage_service.dart');
  assert.ok(fs.existsSync(storagePath), 'secure_storage_service.dart must exist');

  const content = fs.readFileSync(storagePath, 'utf8');
  assert.ok(content.includes('FlutterSecureStorage'), 'Must use FlutterSecureStorage');
  assert.ok(content.includes('encryptedSharedPreferences: true'), 'Must enable Android EncryptedSharedPreferences (Keystore backed)');
  assert.ok(content.includes('KeychainAccessibility.first_unlock'), 'Must enable iOS Keychain security');
  assert.ok(content.includes('vexora_access_token'), 'Must define secure key for access token');
  assert.ok(content.includes('vexora_refresh_token'), 'Must define secure key for refresh token');
  assert.ok(content.includes('saveTokens'), 'Must provide saveTokens method');
  assert.ok(content.includes('getAccessToken'), 'Must provide getAccessToken method');
  assert.ok(content.includes('clearAll'), 'Must provide clearAll for secure wipe on sign out');
});

test('Phase 10: Version service performs semantic version evaluation and mandatory update enforcement', () => {
  const versionPath = path.join(MOBILE_DIR, 'lib/services/version_service.dart');
  assert.ok(fs.existsSync(versionPath), 'version_service.dart must exist');

  const content = fs.readFileSync(versionPath, 'utf8');
  assert.ok(content.includes('enum VersionStatus'), 'Must define VersionStatus');
  assert.ok(content.includes('updateMandatory'), 'Must support mandatory hard-block update status');
  assert.ok(content.includes('updateRecommended'), 'Must support soft update recommendation');
  assert.ok(content.includes('compareVersions'), 'Must implement semantic compareVersions method');
  assert.ok(content.includes('evaluateVersion'), 'Must evaluate minSupportedVersion against current version');
});

test('Phase 10: Multi-language localization supports English, Hindi, and Odia', () => {
  const l10nPath = path.join(MOBILE_DIR, 'lib/l10n/app_localizations.dart');
  assert.ok(fs.existsSync(l10nPath), 'app_localizations.dart must exist');

  const content = fs.readFileSync(l10nPath, 'utf8');
  assert.ok(content.includes("Locale('en')"), 'Must declare en locale');
  assert.ok(content.includes("Locale('hi')"), 'Must declare hi locale');
  assert.ok(content.includes("Locale('or')"), 'Must declare or (Odia) locale');

  // Verify Hindi translation strings exist
  assert.ok(content.includes('वेक्सोरा ईस्पोर्ट्स'), 'Must include Hindi appTitle');
  assert.ok(content.includes('सत्यापित टूर्नामेंट'), 'Must include Hindi onboarding text');

  // Verify Odia translation strings exist
  assert.ok(content.includes('ଭେକ୍ସୋରା ଇ-ସ୍ପୋର୍ଟସ୍'), 'Must include Odia appTitle');
  assert.ok(content.includes('ଯାଞ୍ଚ ହୋଇଥିବା ଟୁର୍ଣ୍ଣାମେଣ୍ଟ'), 'Must include Odia onboarding text');

  assert.ok(content.includes('AppLocalizationsDelegate'), 'Must define AppLocalizationsDelegate');
});

test('Phase 10: Riverpod authentication provider manages user profile and session state', () => {
  const authProviderPath = path.join(MOBILE_DIR, 'lib/providers/auth_provider.dart');
  assert.ok(fs.existsSync(authProviderPath), 'auth_provider.dart must exist');

  const content = fs.readFileSync(authProviderPath, 'utf8');
  assert.ok(content.includes('class UserProfile'), 'Must define UserProfile');
  assert.ok(content.includes('enum AuthStatus'), 'Must define AuthStatus');
  assert.ok(content.includes('class AuthNotifier extends StateNotifier<AuthState>'), 'Must extend StateNotifier');
  assert.ok(content.includes('signInWithPhone'), 'Must support OTP sign in');
  assert.ok(content.includes('signInWithEmail'), 'Must support email sign in');
  assert.ok(content.includes('signOut'), 'Must support sign out');
  assert.ok(content.includes('final authProvider = StateNotifierProvider'), 'Must export authProvider');
  assert.ok(content.includes('final localeProvider = StateProvider'), 'Must export localeProvider');
  assert.ok(content.includes('final flavourProvider = StateProvider'), 'Must export flavourProvider');
});

test('Phase 10: Mobile screens implement onboarding, sign in, gamer profile, and home shell', () => {
  const onboardingPath = path.join(MOBILE_DIR, 'lib/screens/onboarding_screen.dart');
  const signInPath = path.join(MOBILE_DIR, 'lib/screens/sign_in_screen.dart');
  const profilePath = path.join(MOBILE_DIR, 'lib/screens/profile_screen.dart');
  const homeShellPath = path.join(MOBILE_DIR, 'lib/screens/home_shell.dart');

  assert.ok(fs.existsSync(onboardingPath), 'onboarding_screen.dart must exist');
  assert.ok(fs.existsSync(signInPath), 'sign_in_screen.dart must exist');
  assert.ok(fs.existsSync(profilePath), 'profile_screen.dart must exist');
  assert.ok(fs.existsSync(homeShellPath), 'home_shell.dart must exist');

  const onboardingContent = fs.readFileSync(onboardingPath, 'utf8');
  assert.ok(onboardingContent.includes('PageView.builder'), 'Onboarding must use PageView carousel');
  assert.ok(onboardingContent.includes('Semantics'), 'Onboarding must use accessibility Semantics');

  const signInContent = fs.readFileSync(signInPath, 'utf8');
  assert.ok(signInContent.includes('phoneSignIn') || signInContent.includes('Phone'), 'Must support Phone OTP UI');
  assert.ok(signInContent.includes('emailSignIn') || signInContent.includes('Email'), 'Must support Email UI');
  assert.ok(signInContent.includes('googleSignIn') || signInContent.includes('Google'), 'Must support Google Sign In button');

  const profileContent = fs.readFileSync(profilePath, 'utf8');
  assert.ok(profileContent.includes('linkedGameIds'), 'Profile must display linked game IDs');
  assert.ok(profileContent.includes('Battlegrounds Mobile India'), 'Must support BGMI in-game ID');
  assert.ok(profileContent.includes('Free Fire'), 'Must support Free Fire in-game ID');
  assert.ok(profileContent.includes('flavourProvider'), 'Profile must allow toggling app flavour');

  const homeContent = fs.readFileSync(homeShellPath, 'utf8');
  assert.ok(homeContent.includes('BottomNavigationBar'), 'HomeShell must feature BottomNavigationBar');
  assert.ok(homeContent.includes('AppFlavour.player'), 'HomeShell must render Player views');
  assert.ok(homeContent.includes('AppFlavour.organiser'), 'HomeShell must render Organiser views');
});

test('Phase 10: Dio HTTP client handles 401 token refresh queue and correlation IDs', () => {
  const apiClientPath = path.join(MOBILE_DIR, 'lib/services/api_client.dart');
  assert.ok(fs.existsSync(apiClientPath), 'api_client.dart must exist');

  const content = fs.readFileSync(apiClientPath, 'utf8');
  assert.ok(content.includes('Dio'), 'Must configure Dio HTTP client');
  assert.ok(content.includes('Authorization'), 'Must inject Bearer authorization');
  assert.ok(content.includes('X-Correlation-ID'), 'Must generate and inject correlation ID');
  assert.ok(content.includes('401'), 'Must intercept 401 responses');
  assert.ok(content.includes('_isRefreshing'), 'Must queue requests to prevent concurrent refresh thundering herd');
});

test('Phase 10: App entry point coordinates Riverpod, Localization, and Root Navigation', () => {
  const mainDartPath = path.join(MOBILE_DIR, 'lib/main.dart');
  const mainContent = fs.readFileSync(mainDartPath, 'utf8');

  assert.ok(mainContent.includes('ProviderScope'), 'Must encapsulate with Riverpod ProviderScope');
  assert.ok(mainContent.includes('AppLocalizations.supportedLocales'), 'Must register supported locales');
  assert.ok(mainContent.includes('AppLocalizationsDelegate'), 'Must register localization delegate');
  assert.ok(mainContent.includes('HomeShell'), 'Must navigate to HomeShell when authenticated');
  assert.ok(mainContent.includes('OnboardingScreen'), 'Must navigate to OnboardingScreen when unauthenticated');
});
