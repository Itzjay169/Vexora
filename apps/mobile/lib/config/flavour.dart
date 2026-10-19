/// Vexora Mobile Flavours & Platform Configuration
enum AppFlavour {
  player,
  organiser,
  admin,
}

class AppConfig {
  final AppFlavour flavour;
  final String appName;
  final String apiBaseUrl;
  final String appVersion;
  final int buildNumber;
  final String bundleId;

  const AppConfig({
    required this.flavour,
    required this.appName,
    required this.apiBaseUrl,
    required this.appVersion,
    required this.buildNumber,
    required this.bundleId,
  });

  bool get isPlayer => flavour == AppFlavour.player;
  bool get isOrganiser => flavour == AppFlavour.organiser;
  bool get isAdmin => flavour == AppFlavour.admin;

  static const AppConfig playerConfig = AppConfig(
    flavour: AppFlavour.player,
    appName: 'Vexora Esports',
    apiBaseUrl: 'http://localhost:3000/api/v1',
    appVersion: '1.0.0',
    buildNumber: 1,
    bundleId: 'com.vexora.player',
  );

  static const AppConfig organiserConfig = AppConfig(
    flavour: AppFlavour.organiser,
    appName: 'Vexora Organiser',
    apiBaseUrl: 'http://localhost:3000/api/v1',
    appVersion: '1.0.0',
    buildNumber: 1,
    bundleId: 'com.vexora.organiser',
  );

  static const AppConfig adminConfig = AppConfig(
    flavour: AppFlavour.admin,
    appName: 'Vexora Admin',
    apiBaseUrl: 'http://localhost:3000/api/v1',
    appVersion: '1.0.0',
    buildNumber: 1,
    bundleId: 'com.vexora.admin',
  );
}
