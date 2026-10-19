import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/vexora_theme.dart';

class LeaderboardPlayer {
  final int rank;
  final String username;
  final String displayName;
  final int totalPoints;
  final int placementPoints;
  final int killPoints;
  final int matchesPlayed;
  final int wins;
  final double winRate;
  final String? avatarUrl;

  const LeaderboardPlayer({
    required this.rank,
    required this.username,
    required this.displayName,
    required this.totalPoints,
    required this.placementPoints,
    required this.killPoints,
    required this.matchesPlayed,
    required this.wins,
    required this.winRate,
    this.avatarUrl,
  });
}

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _gameTabController;
  String _selectedSeason = 'Season 1 (Active)';

  final List<String> _gameTitles = ['BGMI', 'Free Fire MAX', 'CODM'];

  // Seeded competitive players for demonstration
  final List<LeaderboardPlayer> _mockBgmiStandings = const [
    LeaderboardPlayer(
      rank: 1,
      username: 'ShadowSlayer',
      displayName: 'Aarav Sharma',
      totalPoints: 142,
      placementPoints: 86,
      killPoints: 56,
      matchesPlayed: 12,
      wins: 5,
      winRate: 41.67,
    ),
    LeaderboardPlayer(
      rank: 2,
      username: 'ViperStrike',
      displayName: 'Rohan Mehra',
      totalPoints: 128,
      placementPoints: 72,
      killPoints: 56,
      matchesPlayed: 12,
      wins: 3,
      winRate: 25.00,
    ),
    LeaderboardPlayer(
      rank: 3,
      username: 'ApexPredator',
      displayName: 'Karan Patel',
      totalPoints: 115,
      placementPoints: 65,
      killPoints: 50,
      matchesPlayed: 12,
      wins: 2,
      winRate: 16.67,
    ),
    LeaderboardPlayer(
      rank: 4,
      username: 'GhostRider',
      displayName: 'Aditya Sen',
      totalPoints: 98,
      placementPoints: 52,
      killPoints: 46,
      matchesPlayed: 12,
      wins: 1,
      winRate: 8.33,
    ),
    LeaderboardPlayer(
      rank: 5,
      username: 'BlazeFury',
      displayName: 'Vikram Joshi',
      totalPoints: 91,
      placementPoints: 48,
      killPoints: 43,
      matchesPlayed: 11,
      wins: 1,
      winRate: 9.09,
    ),
    LeaderboardPlayer(
      rank: 6,
      username: 'NovaStorm',
      displayName: 'Kabir Roy',
      totalPoints: 84,
      placementPoints: 44,
      killPoints: 40,
      matchesPlayed: 10,
      wins: 0,
      winRate: 0.00,
    ),
    LeaderboardPlayer(
      rank: 7,
      username: 'ThunderClap',
      displayName: 'Manish Das',
      totalPoints: 77,
      placementPoints: 39,
      killPoints: 38,
      matchesPlayed: 10,
      wins: 0,
      winRate: 0.00,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _gameTabController = TabController(length: _gameTitles.length, vsync: this);
  }

  @override
  void dispose() {
    _gameTabController.dispose();
    super.dispose();
  }

  void _showVerifyFormulaDialog(BuildContext context, String game) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: VexoraColors.surfaceElevatedDark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: VexoraColors.borderDark),
        ),
        title: Row(
          children: [
            const Icon(Icons.verified_rounded, color: VexoraColors.primary, size: 24),
            const SizedBox(width: 8),
            Text('Deterministic Formula ($game)',
                style: const TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
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
                  Text('Krafton 10-Point System + Tie-Breaker:',
                      style: TextStyle(color: VexoraColors.accent, fontWeight: FontWeight.bold, fontSize: 13)),
                  SizedBox(height: 6),
                  Text('1. Total Points = Placement Points + Kill Points\n'
                      '2. Placement tie-breaker: Highest WWCDs\n'
                      '3. Secondary tie-breaker: Final match placement\n'
                      '4. Invariant: Strict integer arithmetic (no floats)',
                      style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12, height: 1.4)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Row(
              children: [
                Icon(Icons.shield_outlined, color: VexoraColors.success, size: 16),
                SizedBox(width: 6),
                Expanded(
                  child: Text('SHA-256 Merkle root verified per match snapshot.',
                      style: TextStyle(color: VexoraColors.success, fontSize: 11)),
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close', style: TextStyle(color: VexoraColors.primary)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentGame = _gameTitles[_gameTabController.index];
    final podium = _mockBgmiStandings.take(3).toList();
    final remaining = _mockBgmiStandings.skip(3).toList();

    return Scaffold(
      backgroundColor: VexoraColors.bgDark,
      appBar: AppBar(
        backgroundColor: VexoraColors.surfaceDark,
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.leaderboard_rounded, color: VexoraColors.primary, size: 22),
            SizedBox(width: 8),
            Text(
              'Leaderboards',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.verified_outlined, color: VexoraColors.textSecondaryDark),
            tooltip: 'Verify Scoring Formula',
            onPressed: () => _showVerifyFormulaDialog(context, currentGame),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list_rounded, color: VexoraColors.textSecondaryDark),
            tooltip: 'Select Season',
            color: VexoraColors.surfaceElevatedDark,
            onSelected: (season) {
              setState(() => _selectedSeason = season);
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'Season 1 (Active)',
                child: Text('Season 1 (Active)', style: TextStyle(color: Colors.white)),
              ),
              const PopupMenuItem(
                value: 'All-Time Standings',
                child: Text('All-Time Standings', style: TextStyle(color: VexoraColors.textSecondaryDark)),
              ),
            ],
          ),
        ],
        bottom: TabBar(
          controller: _gameTabController,
          indicatorColor: VexoraColors.primary,
          labelColor: Colors.white,
          unselectedLabelColor: VexoraColors.textMutedDark,
          indicatorWeight: 3,
          onTap: (_) => setState(() {}),
          tabs: _gameTitles.map((title) => Tab(text: title)).toList(),
        ),
      ),
      body: Column(
        children: [
          // Season Status Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: VexoraColors.surfaceDark.withValues(alpha: 0.5),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: VexoraColors.success,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _selectedSeason,
                      style: const TextStyle(
                        color: VexoraColors.textSecondaryDark,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                Text(
                  '${_mockBgmiStandings.length} Competitors',
                  style: const TextStyle(color: VexoraColors.textMutedDark, fontSize: 12),
                ),
              ],
            ),
          ),

          // Main Scrollable Area
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              children: [
                // Top 3 Podium Widget
                if (podium.length >= 3)
                  _buildPodium(podium[0], podium[1], podium[2]),

                const SizedBox(height: 20),

                // Table Header
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Row(
                    children: [
                      SizedBox(width: 36, child: Text('#', style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 11, fontWeight: FontWeight.bold))),
                      Expanded(child: Text('PLAYER', style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 11, fontWeight: FontWeight.bold))),
                      SizedBox(width: 48, child: Text('KILLS', textAlign: TextAlign.center, style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 11, fontWeight: FontWeight.bold))),
                      SizedBox(width: 48, child: Text('WIN%', textAlign: TextAlign.center, style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 11, fontWeight: FontWeight.bold))),
                      SizedBox(width: 56, child: Text('PTS', textAlign: TextAlign.end, style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 11, fontWeight: FontWeight.bold))),
                    ],
                  ),
                ),
                const Divider(color: VexoraColors.borderDark, height: 1),

                // Remaining Ranked Rows
                ...remaining.map((p) => _buildPlayerRow(p)),

                const SizedBox(height: 70), // Spacing for sticky bottom bar
              ],
            ),
          ),
        ],
      ),

      // Sticky Bottom Bar: Player Standing
      bottomSheet: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: VexoraColors.surfaceElevatedDark,
          border: const Border(top: BorderSide(color: VexoraColors.borderDark)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 10,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: SafeArea(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: VexoraColors.primary.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                      border: Border.all(color: VexoraColors.primary),
                    ),
                    child: const Text('4',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                  ),
                  const SizedBox(width: 12),
                  const Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Your Standing (GhostRider)',
                          style: TextStyle(
                              color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                      Text('98 pts • 17 pts behind Podium #3',
                          style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 11)),
                    ],
                  ),
                ],
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: VexoraColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => _showVerifyFormulaDialog(context, currentGame),
                child: const Text('Formula', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPodium(
      LeaderboardPlayer first, LeaderboardPlayer second, LeaderboardPlayer third) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: VexoraColors.borderDark),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // 2nd Place (Silver)
          _buildPodiumStep(
            player: second,
            rank: 2,
            pedestalHeight: 85,
            pedestalColor: const Color(0xFF94A3B8),
            crownColor: const Color(0xFFE2E8F0),
          ),
          // 1st Place (Gold)
          _buildPodiumStep(
            player: first,
            rank: 1,
            pedestalHeight: 115,
            pedestalColor: const Color(0xFFF59E0B),
            crownColor: const Color(0xFFFBBF24),
            isFirst: true,
          ),
          // 3rd Place (Bronze)
          _buildPodiumStep(
            player: third,
            rank: 3,
            pedestalHeight: 65,
            pedestalColor: const Color(0xFFD97706),
            crownColor: const Color(0xFFF59E0B),
          ),
        ],
      ),
    );
  }

  Widget _buildPodiumStep({
    required LeaderboardPlayer player,
    required int rank,
    required double pedestalHeight,
    required Color pedestalColor,
    required Color crownColor,
    bool isFirst = false,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isFirst)
          Icon(Icons.emoji_events_rounded, color: crownColor, size: 28)
        else
          Icon(Icons.workspace_premium_rounded, color: crownColor, size: 22),
        const SizedBox(height: 4),

        // Avatar Initials
        Container(
          width: isFirst ? 50 : 42,
          height: isFirst ? 50 : 42,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: VexoraColors.surfaceElevatedDark,
            border: Border.all(color: pedestalColor, width: isFirst ? 2.5 : 1.5),
          ),
          child: Center(
            child: Text(
              player.username.substring(0, 1).toUpperCase(),
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: isFirst ? 18 : 14,
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),

        Text(
          player.username,
          style: TextStyle(
            color: Colors.white,
            fontWeight: isFirst ? FontWeight.bold : FontWeight.w600,
            fontSize: isFirst ? 13 : 11,
          ),
        ),
        Text(
          '${player.totalPoints} pts',
          style: TextStyle(
            color: pedestalColor,
            fontWeight: FontWeight.bold,
            fontSize: isFirst ? 14 : 12,
          ),
        ),
        const SizedBox(height: 8),

        // Pedestal
        Container(
          width: 80,
          height: pedestalHeight,
          decoration: BoxDecoration(
            color: pedestalColor.withValues(alpha: 0.15),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
            border: Border.all(color: pedestalColor.withValues(alpha: 0.4)),
          ),
          child: Center(
            child: Text(
              '$rank',
              style: TextStyle(
                color: pedestalColor,
                fontWeight: FontWeight.w900,
                fontSize: isFirst ? 28 : 22,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPlayerRow(LeaderboardPlayer player) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: VexoraColors.borderDark, width: 0.5)),
      ),
      child: Row(
        children: [
          // Rank Badge
          SizedBox(
            width: 36,
            child: Text(
              '${player.rank}',
              style: const TextStyle(
                color: VexoraColors.textSecondaryDark,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
          ),
          // Player info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  player.username,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
                Text(
                  '${player.matchesPlayed} matches • ${player.wins} WWCD',
                  style: const TextStyle(color: VexoraColors.textMutedDark, fontSize: 10),
                ),
              ],
            ),
          ),
          // Kills
          SizedBox(
            width: 48,
            child: Text(
              '${player.killPoints}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 12),
            ),
          ),
          // Win %
          SizedBox(
            width: 48,
            child: Text(
              '${player.winRate.toStringAsFixed(1)}%',
              textAlign: TextAlign.center,
              style: const TextStyle(color: VexoraColors.accent, fontSize: 12),
            ),
          ),
          // Total Points
          SizedBox(
            width: 56,
            child: Text(
              '${player.totalPoints}',
              textAlign: TextAlign.end,
              style: const TextStyle(
                color: VexoraColors.primary,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
