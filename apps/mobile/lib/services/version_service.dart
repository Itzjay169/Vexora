/// Version Check & Enforcement Service
/// PDF refs: Section 13 (App version enforcement for critical security updates)
enum VersionStatus {
  upToDate,
  updateRecommended,
  updateMandatory,
}

class VersionService {
  final String currentVersion;
  final int currentBuild;

  const VersionService({
    this.currentVersion = '1.0.0',
    this.currentBuild = 1,
  });

  /// Compare two semantic version strings e.g. "1.0.0" vs "1.2.0"
  /// Returns:
  ///   < 0 if v1 < v2
  ///   0 if v1 == v2
  ///   > 0 if v1 > v2
  static int compareVersions(String v1, String v2) {
    final v1Parts = v1.split('.').map(int.tryParse).map((e) => e ?? 0).toList();
    final v2Parts = v2.split('.').map(int.tryParse).map((e) => e ?? 0).toList();

    final maxLength = v1Parts.length > v2Parts.length ? v1Parts.length : v2Parts.length;

    for (int i = 0; i < maxLength; i++) {
      final part1 = i < v1Parts.length ? v1Parts[i] : 0;
      final part2 = i < v2Parts.length ? v2Parts[i] : 0;

      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }

    return 0;
  }

  /// Evaluate version status based on server policies (e.g. Firebase Remote Config or Backend Health)
  VersionStatus evaluateVersion({
    required String minSupportedVersion,
    required String latestVersion,
  }) {
    // If current version is less than the mandatory minimum supported version -> hard block
    if (compareVersions(currentVersion, minSupportedVersion) < 0) {
      return VersionStatus.updateMandatory;
    }

    // If current version is less than the latest available -> soft update prompt
    if (compareVersions(currentVersion, latestVersion) < 0) {
      return VersionStatus.updateRecommended;
    }

    return VersionStatus.upToDate;
  }
}
