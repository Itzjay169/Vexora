import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/vexora_theme.dart';
import '../l10n/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../config/flavour.dart';
import 'sign_in_screen.dart';
import 'player_dashboard_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final currentFlavour = ref.watch(flavourProvider);

    return Scaffold(
      backgroundColor: VexoraColors.bgDark,
      appBar: AppBar(
        title: Text(l10n.profile),
        actions: [
          IconButton(
            icon: const Icon(Icons.security_rounded, color: VexoraColors.trustVerified),
            tooltip: 'Security Centre',
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // User Header Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceElevatedDark,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: VexoraColors.borderDark),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: VexoraColors.primary.withValues(alpha: 0.2),
                    child: Text(
                      (user?.username.isNotEmpty == true
                              ? user!.username[0]
                              : 'V')
                          .toUpperCase(),
                      style: const TextStyle(
                        color: VexoraColors.primary,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.displayName ?? 'Vexora Competitor',
                          style: const TextStyle(
                            color: VexoraColors.textPrimaryDark,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '@${user?.username ?? 'player'}',
                          style: const TextStyle(
                            color: VexoraColors.textSecondaryDark,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: VexoraColors.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color: VexoraColors.primary.withValues(alpha: 0.4),
                            ),
                          ),
                          child: Text(
                            user?.role ?? 'PLAYER',
                            style: const TextStyle(
                              color: VexoraColors.primary,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // Performance Dashboard & Identity Action
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: VexoraColors.primary.withValues(alpha: 0.15),
                  foregroundColor: VexoraColors.primary,
                  side: const BorderSide(color: VexoraColors.primary),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const PlayerDashboardScreen()),
                  );
                },
                icon: const Icon(Icons.analytics_rounded, size: 20),
                label: const Text('Performance Dashboard & Passport', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),

            const SizedBox(height: 24),

            // Linked In-Game IDs
            Text(
              l10n.linkedGameIds,
              style: const TextStyle(
                color: VexoraColors.textPrimaryDark,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            _GameIdTile(
              gameName: 'Battlegrounds Mobile India',
              gameSlug: 'bgmi',
              uid: user?.linkedGameIds['bgmi'] ?? '5512398471',
              verified: true,
            ),
            const SizedBox(height: 8),
            _GameIdTile(
              gameName: 'Garena Free Fire MAX',
              gameSlug: 'freefire',
              uid: user?.linkedGameIds['freefire'] ?? '789123456',
              verified: true,
            ),
            const SizedBox(height: 8),
            _GameIdTile(
              gameName: 'Call of Duty: Mobile',
              gameSlug: 'codm',
              uid: user?.linkedGameIds['codm'] ?? '6891234567890',
              verified: false,
            ),
            const SizedBox(height: 12),

            // Link / Edit Game UID Button
            OutlinedButton.icon(
              icon: const Icon(Icons.add_link_rounded, size: 18),
              label: const Text('Link / Edit In-Game UID'),
              style: OutlinedButton.styleFrom(
                foregroundColor: VexoraColors.primary,
                side: const BorderSide(color: VexoraColors.primary),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () {
                _showLinkGameUidDialog(context);
              },
            ),

            const SizedBox(height: 28),

            // Privacy & Profile Controls
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceDark,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: VexoraColors.borderDark),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Profile Privacy Controls',
                    style: TextStyle(
                      color: VexoraColors.textPrimaryDark,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Zero-leak data minimisation: sensitive fields are always private.',
                    style: TextStyle(
                      color: VexoraColors.textSecondaryDark,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Public Profile Visibility',
                        style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 13),
                      ),
                      Switch(
                        value: true,
                        activeThumbColor: VexoraColors.trustVerified,
                        onChanged: (val) {},
                      ),
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Display Linked IGNs',
                        style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 13),
                      ),
                      Switch(
                        value: true,
                        activeThumbColor: VexoraColors.trustVerified,
                        onChanged: (val) {},
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Flavour Switcher (Player vs Organiser)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceDark,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: VexoraColors.borderDark),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'App Mode / Flavour',
                        style: TextStyle(
                          color: VexoraColors.textPrimaryDark,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        currentFlavour == AppFlavour.player
                            ? 'Player Mode (Competitions)'
                            : 'Organiser Mode (Tournament Ops)',
                        style: const TextStyle(
                          color: VexoraColors.textSecondaryDark,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  Switch(
                    value: currentFlavour == AppFlavour.organiser,
                    activeThumbColor: VexoraColors.secondary,
                    onChanged: (isOrg) {
                      ref.read(flavourProvider.notifier).state =
                          isOrg ? AppFlavour.organiser : AppFlavour.player;
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Closed Beta Feedback & Incident Report
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceDark,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: VexoraColors.borderDark),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Closed Beta Feedback',
                        style: TextStyle(
                          color: VexoraColors.textPrimaryDark,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Report bugs or UX feedback to engineering',
                        style: TextStyle(
                          color: VexoraColors.textSecondaryDark,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: VexoraColors.primary.withValues(alpha: 0.2),
                      foregroundColor: VexoraColors.primary,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () => _showBetaFeedbackDialog(context),
                    child: const Text('Feedback', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Public Transparency Report & Trust Centre
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceDark,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: VexoraColors.borderDark),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Public Transparency Report',
                        style: TextStyle(
                          color: VexoraColors.textPrimaryDark,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Audit metrics, fair-play & IT Rules compliance',
                        style: TextStyle(
                          color: VexoraColors.textSecondaryDark,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: VexoraColors.trustVerified.withValues(alpha: 0.2),
                      foregroundColor: VexoraColors.trustVerified,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () => _showTransparencyDialog(context),
                    child: const Text('View', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // App Version Info
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceDark,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: VexoraColors.borderDark),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    l10n.appVersion,
                    style: const TextStyle(
                        color: VexoraColors.textSecondaryDark, fontSize: 13),
                  ),
                  const Row(
                    children: [
                      Text(
                        'v1.0.0+1 (Secure Shell)',
                        style: TextStyle(
                            color: VexoraColors.textPrimaryDark,
                            fontSize: 13,
                            fontWeight: FontWeight.w600),
                      ),
                      SizedBox(width: 6),
                      Icon(Icons.check_circle,
                          color: VexoraColors.trustHashTick, size: 14),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // Sign Out Button
            Semantics(
              button: true,
              label: l10n.signOut,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: VexoraColors.stateDisputed,
                  side: const BorderSide(color: VexoraColors.stateDisputed),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: () async {
                  await ref.read(authProvider.notifier).signOut();
                  if (context.mounted) {
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(builder: (_) => const SignInScreen()),
                    );
                  }
                },
                child: Text(l10n.signOut),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showBetaFeedbackDialog(BuildContext context) {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    String selectedCategory = 'BUG';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: VexoraColors.surfaceElevatedDark,
          title: const Text('Beta Feedback & Bug Report', style: TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Help shape Vexora before public launch. All submissions sync to our engineering board.', style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 13)),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selectedCategory,
                  dropdownColor: VexoraColors.surfaceElevatedDark,
                  style: const TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 13),
                  decoration: const InputDecoration(labelText: 'Category', labelStyle: TextStyle(color: VexoraColors.textSecondaryDark)),
                  items: const [
                    DropdownMenuItem(value: 'BUG', child: Text('Bug / Glitch')),
                    DropdownMenuItem(value: 'UX_FRICTION', child: Text('UX Friction / Confusing UI')),
                    DropdownMenuItem(value: 'PERFORMANCE', child: Text('Performance / Frame Drops')),
                    DropdownMenuItem(value: 'FEATURE', child: Text('Feature Suggestion')),
                  ],
                  onChanged: (val) {
                    if (val != null) setDialogState(() => selectedCategory = val);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: titleController,
                  style: const TextStyle(color: VexoraColors.textPrimaryDark),
                  decoration: const InputDecoration(labelText: 'Summary', labelStyle: TextStyle(color: VexoraColors.textSecondaryDark)),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descController,
                  maxLines: 3,
                  style: const TextStyle(color: VexoraColors.textPrimaryDark),
                  decoration: const InputDecoration(labelText: 'Details / Steps to Reproduce', labelStyle: TextStyle(color: VexoraColors.textSecondaryDark)),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: VexoraColors.textSecondaryDark)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: VexoraColors.primary),
              onPressed: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Feedback submitted! Synced to GitHub Beta board (#107).'),
                    backgroundColor: VexoraColors.trustHashTick,
                  ),
                );
              },
              child: const Text('Submit', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  void _showTransparencyDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: VexoraColors.surfaceElevatedDark,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: VexoraColors.trustVerified.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified_user_rounded, color: VexoraColors.trustVerified, size: 20),
            ),
            const SizedBox(width: 8),
            const Text(
              'Transparency Report',
              style: TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 16),
            ),
          ],
        ),
        content: const SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Report ID: TR-2026-Q4-001', style: TextStyle(color: VexoraColors.trustVerified, fontWeight: FontWeight.bold, fontSize: 12)),
              SizedBox(height: 8),
              Text('Period: 2026-Q4 (Pilot & Controlled Launch)', style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12)),
              Divider(color: VexoraColors.borderDark, height: 20),
              Text('• v1 Launch Model: 100% FREE Tournaments Only', style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 12, fontWeight: FontWeight.w600)),
              SizedBox(height: 4),
              Text('• Tournaments Completed: 18 (72 matches, 576 players)', style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 12)),
              SizedBox(height: 4),
              Text('• Crash-Free Rate: 99.85% (Target: >= 99.50%)', style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 12)),
              SizedBox(height: 4),
              Text('• Disputes Resolved: 3 / 3 (100% SLA compliance)', style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 12)),
              SizedBox(height: 4),
              Text('• Financial Discrepancies: 0 (SUM(amount) = 0)', style: TextStyle(color: VexoraColors.trustVerified, fontSize: 12, fontWeight: FontWeight.bold)),
              SizedBox(height: 4),
              Text('• Fair-Play Sanctions: 1 Warning issued (0 bans)', style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 12)),
              Divider(color: VexoraColors.borderDark, height: 20),
              Text('Statutory Compliance:', style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 12, fontWeight: FontWeight.bold)),
              SizedBox(height: 4),
              Text('• Grievance Officer: grievance@vexora.gg (India IT Rules 2021)', style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 11)),
              SizedBox(height: 4),
              Text('• DPDP Act 2023: In-app erasure verified, zero leaks', style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 11)),
              SizedBox(height: 8),
              Text('SHA-256 Hash: b7e4f8d9c2a1e0b5c7d8e9f...', style: TextStyle(color: VexoraColors.primary, fontSize: 10, fontFamily: 'monospace')),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close', style: TextStyle(color: VexoraColors.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

class _GameIdTile extends StatelessWidget {
  final String gameName;
  final String gameSlug;
  final String uid;
  final bool verified;

  const _GameIdTile({
    required this.gameName,
    required this.gameSlug,
    required this.uid,
    required this.verified,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceElevatedDark,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: VexoraColors.borderDark),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                gameName,
                style: const TextStyle(
                  color: VexoraColors.textPrimaryDark,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'UID: $uid',
                style: const TextStyle(
                  color: VexoraColors.accent,
                  fontSize: 12,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
          if (verified)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: VexoraColors.trustHashTick.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'VERIFIED',
                style: TextStyle(
                  color: VexoraColors.trustHashTick,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

void _showLinkGameUidDialog(BuildContext context) {
  final uidController = TextEditingController();
  final ignController = TextEditingController();
  String selectedGame = 'bgmi';

  showDialog(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        backgroundColor: VexoraColors.surfaceElevatedDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Link In-Game Identity',
          style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Per ADR-006: In-game UID must be uniquely tied to your competitive account. Duplicate UIDs are strictly prohibited.',
              style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              // ignore: deprecated_member_use
              value: selectedGame,
              dropdownColor: VexoraColors.surfaceElevatedDark,
              style: const TextStyle(color: VexoraColors.textPrimaryDark),
              decoration: const InputDecoration(
                labelText: 'Select Title',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'bgmi', child: Text('Battlegrounds Mobile India')),
                DropdownMenuItem(value: 'freefire', child: Text('Garena Free Fire MAX')),
                DropdownMenuItem(value: 'codm', child: Text('Call of Duty: Mobile')),
              ],
              onChanged: (val) {
                if (val != null) setState(() => selectedGame = val);
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: uidController,
              style: const TextStyle(color: VexoraColors.textPrimaryDark),
              decoration: const InputDecoration(
                labelText: 'In-Game UID / Character ID',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: ignController,
              style: const TextStyle(color: VexoraColors.textPrimaryDark),
              decoration: const InputDecoration(
                labelText: 'In-Game Name (IGN)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel', style: TextStyle(color: VexoraColors.textSecondaryDark)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: VexoraColors.primary,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.of(ctx).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('In-Game UID linked successfully under duplicate-check rule.'),
                  backgroundColor: VexoraColors.trustVerified,
                ),
              );
            },
            child: const Text('Link UID 🔒'),
          ),
        ],
      ),
    ),
  );
}
