import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/vexora_theme.dart';

/// Phase 14: Search & Filters Mobile Screen
///
/// Implements:
///   - Real-time search across Games, Teams, Tournaments, Seasons, and Players
///   - Category filter chips (ALL, GAMES, TEAMS, TOURNAMENTS, SEASONS, PLAYERS)
///   - Fast instant results with zero-leak privacy guarantees
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _selectedCategory = 'ALL';

  // Mock catalog of search results
  final List<Map<String, dynamic>> _mockGames = [
    {'type': 'GAME', 'title': 'Battlegrounds Mobile India', 'subtitle': 'Krafton • Battle Royale', 'badge': 'ACTIVE'},
    {'type': 'GAME', 'title': 'Garena Free Fire MAX', 'subtitle': 'Garena • Battle Royale', 'badge': 'ACTIVE'},
    {'type': 'GAME', 'title': 'Call of Duty: Mobile', 'subtitle': 'Activision • FPS / BR', 'badge': 'ACTIVE'},
  ];

  final List<Map<String, dynamic>> _mockSeasons = [
    {'type': 'SEASON', 'title': 'BGMI Season 1: Genesis', 'subtitle': 'Season 1 • Active Now', 'badge': 'SEASON'},
    {'type': 'SEASON', 'title': 'Free Fire Season 1: Booyah Clash', 'subtitle': 'Season 1 • Active Now', 'badge': 'SEASON'},
    {'type': 'SEASON', 'title': 'CODM Season 1: Iron Front', 'subtitle': 'Season 1 • Active Now', 'badge': 'SEASON'},
  ];

  final List<Map<String, dynamic>> _mockTeams = [
    {'type': 'TEAM', 'title': 'Vexora Elite [VEX]', 'subtitle': 'BGMI • 5/6 Roster • IND', 'badge': 'TEAM'},
    {'type': 'TEAM', 'title': 'Alpha Squad [ALPH]', 'subtitle': 'CODM • 4/5 Roster • IND', 'badge': 'TEAM'},
  ];

  final List<Map<String, dynamic>> _mockTournaments = [
    {'type': 'TOURNAMENT', 'title': 'Vexora Sunday Showdown #12', 'subtitle': 'BGMI • 16 Teams • Free Entry', 'badge': 'FREE'},
    {'type': 'TOURNAMENT', 'title': 'Booyah Blitz Masters', 'subtitle': 'Free Fire • 12 Squads • Free Entry', 'badge': 'FREE'},
  ];

  final List<Map<String, dynamic>> _mockPlayers = [
    {'type': 'PLAYER', 'title': 'JayKing', 'subtitle': '@JayKing • Fair-Play: 100/100', 'badge': 'VERIFIED'},
    {'type': 'PLAYER', 'title': 'ShadowStrike', 'subtitle': '@ShadowStrike • Fair-Play: 98/100', 'badge': 'PLAYER'},
  ];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _getFilteredResults() {
    final query = _searchCtrl.text.trim().toLowerCase();
    final allItems = [
      ..._mockGames,
      ..._mockSeasons,
      ..._mockTeams,
      ..._mockTournaments,
      ..._mockPlayers,
    ];

    return allItems.where((item) {
      final matchesQuery = query.isEmpty ||
          item['title'].toString().toLowerCase().contains(query) ||
          item['subtitle'].toString().toLowerCase().contains(query);

      final matchesCategory = _selectedCategory == 'ALL' || item['type'] == _selectedCategory;

      return matchesQuery && matchesCategory;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final results = _getFilteredResults();

    return Scaffold(
      backgroundColor: VexoraColors.bgDark,
      appBar: AppBar(
        backgroundColor: VexoraColors.surfaceDark,
        elevation: 0,
        title: TextField(
          controller: _searchCtrl,
          autofocus: true,
          style: const TextStyle(color: VexoraColors.textPrimaryDark),
          decoration: InputDecoration(
            hintText: 'Search games, seasons, teams, tournaments...',
            hintStyle: const TextStyle(color: VexoraColors.textMutedDark),
            border: InputBorder.none,
            suffixIcon: _searchCtrl.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear_rounded, color: VexoraColors.textSecondaryDark),
                    onPressed: () {
                      _searchCtrl.clear();
                      setState(() {});
                    },
                  )
                : null,
          ),
          onChanged: (_) => setState(() {}),
        ),
      ),
      body: Column(
        children: [
          // Filter Chips Row
          Container(
            color: VexoraColors.surfaceDark,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildCategoryChip('ALL', 'All'),
                  _buildCategoryChip('GAME', 'Games'),
                  _buildCategoryChip('SEASON', 'Seasons'),
                  _buildCategoryChip('TEAM', 'Teams'),
                  _buildCategoryChip('TOURNAMENT', 'Tournaments'),
                  _buildCategoryChip('PLAYER', 'Players'),
                ],
              ),
            ),
          ),

          // Privacy Notice Bar
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: VexoraColors.surfaceElevatedDark,
            child: const Row(
              children: [
                Icon(Icons.shield_outlined, size: 14, color: VexoraColors.trustHashTick),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Per ADR-006 & Section 24: Private profiles and sensitive contact data are never exposed in search.',
                    style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 11),
                  ),
                ),
              ],
            ),
          ),

          // Results List
          Expanded(
            child: results.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.search_off_rounded, size: 64, color: VexoraColors.textMutedDark),
                        const SizedBox(height: 16),
                        Text(
                          _searchCtrl.text.isEmpty ? 'Type to search Vexora' : 'No results found',
                          style: const TextStyle(
                            color: VexoraColors.textPrimaryDark,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _searchCtrl.text.isEmpty
                              ? 'Find competitive titles, active seasons, and rosters.'
                              : 'Try adjusting your search query or filter tags.',
                          style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 14),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: results.length,
                    itemBuilder: (context, index) {
                      final item = results[index];
                      return Card(
                        color: VexoraColors.surfaceElevatedDark,
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: RoundedRectangleBorder(
                          side: const BorderSide(color: VexoraColors.borderDark),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: ListTile(
                          leading: _buildLeadingIcon(item['type']),
                          title: Text(
                            item['title'],
                            style: const TextStyle(
                              color: VexoraColors.textPrimaryDark,
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                          ),
                          subtitle: Text(
                            item['subtitle'],
                            style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12),
                          ),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: _getBadgeColor(item['badge']).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              item['badge'],
                              style: TextStyle(
                                color: _getBadgeColor(item['badge']),
                                fontWeight: FontWeight.bold,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryChip(String category, String label) {
    final isSelected = _selectedCategory == category;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        selected: isSelected,
        label: Text(label),
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : VexoraColors.textSecondaryDark,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          fontSize: 12,
        ),
        backgroundColor: VexoraColors.surfaceElevatedDark,
        selectedColor: VexoraColors.primary,
        checkmarkColor: Colors.white,
        side: BorderSide(
          color: isSelected ? VexoraColors.primary : VexoraColors.borderDark,
        ),
        onSelected: (_) {
          setState(() {
            _selectedCategory = category;
          });
        },
      ),
    );
  }

  Widget _buildLeadingIcon(String type) {
    IconData icon;
    Color color;

    switch (type) {
      case 'GAME':
        icon = Icons.sports_esports_rounded;
        color = VexoraColors.primary;
        break;
      case 'SEASON':
        icon = Icons.event_available_rounded;
        color = VexoraColors.accent;
        break;
      case 'TEAM':
        icon = Icons.groups_rounded;
        color = VexoraColors.secondary;
        break;
      case 'TOURNAMENT':
        icon = Icons.emoji_events_rounded;
        color = VexoraColors.statePendingReview;
        break;
      case 'PLAYER':
      default:
        icon = Icons.person_rounded;
        color = VexoraColors.stateRegistrationOpen;
        break;
    }

    return CircleAvatar(
      backgroundColor: color.withValues(alpha: 0.15),
      child: Icon(icon, color: color, size: 20),
    );
  }

  Color _getBadgeColor(String badge) {
    switch (badge) {
      case 'ACTIVE':
      case 'VERIFIED':
        return VexoraColors.stateRegistrationOpen;
      case 'SEASON':
        return VexoraColors.accent;
      case 'FREE':
        return VexoraColors.primary;
      case 'TEAM':
        return VexoraColors.secondary;
      default:
        return VexoraColors.textSecondaryDark;
    }
  }
}
