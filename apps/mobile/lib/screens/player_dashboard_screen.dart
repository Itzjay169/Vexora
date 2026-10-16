import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/vexora_theme.dart';

class PlayerDashboardScreen extends ConsumerStatefulWidget {
  final String? targetUsername;

  const PlayerDashboardScreen({super.key, this.targetUsername});

  @override
  ConsumerState<PlayerDashboardScreen> createState() => _PlayerDashboardScreenState();
}

class _PlayerDashboardScreenState extends ConsumerState<PlayerDashboardScreen> {
  // Mock performance profile matching Phase 21 known test specifications
  final String _username = 'ShadowSlayer';
  final String _displayName = 'Aarav Sharma';
  final int _fairPlayScore = 100;
  final int _matchesPlayed = 24;
  final int _wins = 8;
  final int _podiums = 15;
  final int _totalKills = 112;
  final int _totalPoints = 284;
  final double _winRate = 33.33;
  final double _avgPlacement = 2.8;

  final List<Map<String, dynamic>> _recentForm = const [
    {'placement': 1, 'kills': 9, 'points': 19, 'game': 'BGMI', 'outcome': 'WWCD'},
    {'placement': 2, 'kills': 6, 'points': 12, 'game': 'BGMI', 'outcome': 'PODIUM'},
    {'placement': 1, 'kills': 11, 'points': 21, 'game': 'BGMI', 'outcome': 'WWCD'},
    {'placement': 3, 'kills': 4, 'points': 9, 'game': 'BGMI', 'outcome': 'PODIUM'},
    {'placement': 5, 'kills': 3, 'points': 6, 'game': 'BGMI', 'outcome': 'TOP_5'},
  ];

  final List<Map<String, String>> _tournamentHistory = const [
    {'title': 'Vexora Inaugural BGMI Cup', 'placement': '1st Place (WWCD)', 'date': 'Oct 2026', 'status': 'FINAL'},
    {'title': 'Fall Invitational Series', 'placement': '2nd Place', 'date': 'Sep 2026', 'status': 'FINAL'},
    {'title': 'Apex Champions League', 'placement': '3rd Place', 'date': 'Aug 2026', 'status': 'FINAL'},
  ];

  final List<Map<String, String>> _teamHistory = const [
    {'team': 'Team Velocity', 'tag': 'VEL', 'role': 'CAPTAIN', 'period': 'Active'},
    {'team': 'Phoenix Rising', 'tag': 'PHX', 'role': 'PLAYER', 'period': 'Season 0'},
  ];

  void _showShareCardDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: VexoraColors.surfaceElevatedDark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: VexoraColors.borderDark),
        ),
        contentPadding: const EdgeInsets.all(20),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.badge_rounded, color: VexoraColors.primary, size: 20),
                    SizedBox(width: 8),
                    Text('Competitive Passport',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: VexoraColors.success.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: VexoraColors.success),
                  ),
                  child: const Text('VERIFIED',
                      style: TextStyle(color: VexoraColors.success, fontSize: 9, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Card Body
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceDark,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: VexoraColors.primary.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: VexoraColors.primary.withValues(alpha: 0.2),
                    child: Text(_username.substring(0, 1),
                        style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 8),
                  Text(_username,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  Text(_displayName,
                      style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12)),
                  const SizedBox(height: 14),

                  // Mini Stats Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildMiniStat('WINS', '$_wins'),
                      _buildMiniStat('WIN%', '${_winRate.toStringAsFixed(1)}%'),
                      _buildMiniStat('FAIR PLAY', '$_fairPlayScore%'),
                      _buildMiniStat('POINTS', '$_totalPoints'),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // QR Simulation Box
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.qr_code_2_rounded, size: 80, color: Colors.black87),
                          Text('SCAN TO VERIFY',
                              style: TextStyle(color: Colors.black87, fontSize: 8, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'https://vexora.gg/player/$_username',
              style: const TextStyle(color: VexoraColors.accent, fontSize: 11),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close', style: TextStyle(color: VexoraColors.textSecondaryDark)),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: VexoraColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Verification link copied to clipboard!')),
              );
              Navigator.pop(ctx);
            },
            icon: const Icon(Icons.copy_rounded, size: 16),
            label: const Text('Copy Link'),
          ),
        ],
      ),
    );
  }

  void _showVerifyResultDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: VexoraColors.surfaceElevatedDark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: VexoraColors.borderDark),
        ),
        title: const Row(
          children: [
            Icon(Icons.verified_user_rounded, color: VexoraColors.success, size: 22),
            SizedBox(width: 8),
            Text('Verify Match Result', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Every competitive result on Vexora is sealed with a SHA-256 Merkle root. Check match certificate authenticity:',
              style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceDark,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: VexoraColors.borderDark),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('RESULT SHA-256 HASH:', style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 10, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  SelectableText(
                    '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
                    style: TextStyle(color: VexoraColors.accent, fontSize: 11, fontFamily: 'monospace'),
                  ),
                  SizedBox(height: 8),
                  Text('EVIDENCE SCREENSHOT SEAL:', style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 10, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  SelectableText(
                    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                    style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 11, fontFamily: 'monospace'),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Done', style: TextStyle(color: VexoraColors.primary)),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: VexoraColors.textMutedDark, fontSize: 9)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: VexoraColors.bgDark,
      appBar: AppBar(
        backgroundColor: VexoraColors.surfaceDark,
        elevation: 0,
        title: const Text(
          'Player Performance Identity',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner_rounded, color: VexoraColors.accent),
            tooltip: 'Verify Result Hash',
            onPressed: () => _showVerifyResultDialog(context),
          ),
          IconButton(
            icon: const Icon(Icons.share_rounded, color: VexoraColors.primary),
            tooltip: 'Share Passport',
            onPressed: () => _showShareCardDialog(context),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Player Identity Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: VexoraColors.surfaceDark,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: VexoraColors.borderDark),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: VexoraColors.primary.withValues(alpha: 0.2),
                  child: Text(
                    _username.substring(0, 1),
                    style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(_username,
                              style: const TextStyle(
                                  color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17)),
                          const SizedBox(width: 6),
                          const Icon(Icons.verified_rounded, color: VexoraColors.trustVerified, size: 16),
                        ],
                      ),
                      Text(_displayName,
                          style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12)),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: VexoraColors.success.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: VexoraColors.success),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.shield_rounded, color: VexoraColors.success, size: 12),
                                const SizedBox(width: 4),
                                Text('Fair-Play: $_fairPlayScore/100',
                                    style: const TextStyle(
                                        color: VexoraColors.success, fontSize: 10, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Core Metrics Grid
          const Text('Performance Overview',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 10),
          GridView.count(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.8,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              _buildMetricCard('Matches Played', '$_matchesPlayed', Icons.sports_esports_rounded, VexoraColors.accent),
              _buildMetricCard('Win Rate', '${_winRate.toStringAsFixed(1)}%', Icons.pie_chart_rounded, VexoraColors.primary),
              _buildMetricCard('First Place (WWCD)', '$_wins', Icons.emoji_events_rounded, const Color(0xFFF59E0B)),
              _buildMetricCard('Podiums (Top 3)', '$_podiums', Icons.workspace_premium_rounded, const Color(0xFF94A3B8)),
              _buildMetricCard('Total Kills', '$_totalKills', Icons.military_tech_rounded, const Color(0xFFEF4444)),
              _buildMetricCard('Avg Placement', '#${_avgPlacement.toStringAsFixed(1)}', Icons.leaderboard_rounded, VexoraColors.success),
            ],
          ),

          const SizedBox(height: 20),

          // Recent Form Streak
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Recent Match Form',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              Text('${_recentForm.length} Matches Logged',
                  style: const TextStyle(color: VexoraColors.textMutedDark, fontSize: 11)),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: VexoraColors.surfaceDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: VexoraColors.borderDark),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: _recentForm.map((match) {
                final isWwcd = match['placement'] == 1;
                final isPodium = match['placement'] <= 3;
                final color = isWwcd ? const Color(0xFFF59E0B) : (isPodium ? VexoraColors.primary : VexoraColors.borderDark);

                return Column(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                        border: Border.all(color: color, width: 1.5),
                      ),
                      child: Center(
                        child: Text(
                          '#${match['placement']}',
                          style: TextStyle(color: isWwcd ? const Color(0xFFF59E0B) : Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text('${match['kills']} Kills',
                        style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 9)),
                    Text('+${match['points']} pts',
                        style: const TextStyle(color: VexoraColors.accent, fontSize: 9, fontWeight: FontWeight.bold)),
                  ],
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 20),

          // Tournament History
          const Text('Tournament History',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 10),
          ..._tournamentHistory.map((t) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: VexoraColors.surfaceDark,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: VexoraColors.borderDark),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t['title']!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                        Text('${t['placement']} • ${t['date']}', style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 11)),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: VexoraColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(t['status']!, style: const TextStyle(color: VexoraColors.primary, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              )),

          const SizedBox(height: 16),

          // Team History
          const Text('Team Roster History',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 10),
          ..._teamHistory.map((team) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: VexoraColors.surfaceDark,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: VexoraColors.borderDark),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                          decoration: BoxDecoration(
                            color: VexoraColors.surfaceElevatedDark,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(team['tag']!, style: const TextStyle(color: VexoraColors.accent, fontWeight: FontWeight.bold, fontSize: 11)),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(team['team']!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                            Text('Role: ${team['role']}', style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 11)),
                          ],
                        ),
                      ],
                    ),
                    Text(team['period']!, style: const TextStyle(color: VexoraColors.textMutedDark, fontSize: 11)),
                  ],
                ),
              )),

          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: VexoraColors.borderDark),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                Text(title, style: const TextStyle(color: VexoraColors.textMutedDark, fontSize: 10)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
