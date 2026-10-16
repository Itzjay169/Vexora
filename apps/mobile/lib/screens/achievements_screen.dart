import 'package:flutter/material.dart';

/// Vexora — Achievements & Missions Screen
///
/// Phase 32: Achievements, Gamification & Retention
///
/// Features:
/// - Earned badges with source tournament and date
/// - Mission progress with daily/weekly tracking
/// - Streak status cards
/// - Rarity-colored badge cards

class AchievementsScreen extends StatefulWidget {
  const AchievementsScreen({super.key});

  @override
  State<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends State<AchievementsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const Map<String, Color> _rarityColors = {
    'COMMON': Color(0xFF94A3B8),
    'UNCOMMON': Color(0xFF10B981),
    'RARE': Color(0xFF3B82F6),
    'EPIC': Color(0xFFA855F7),
    'LEGENDARY': Color(0xFFF59E0B),
  };

  final List<Map<String, dynamic>> _achievements = [
    {'title': 'First Steps', 'desc': 'Join your first tournament', 'rarity': 'COMMON', 'xp': 50, 'earned': true, 'date': '2026-04-10', 'source': 'BGMI Weekly #12'},
    {'title': 'Victory Royale', 'desc': 'Win your first match', 'rarity': 'COMMON', 'xp': 100, 'earned': true, 'date': '2026-04-15', 'source': 'FF MAX Open #3'},
    {'title': 'Rising Star', 'desc': 'Win 10 matches', 'rarity': 'UNCOMMON', 'xp': 300, 'earned': true, 'date': '2026-06-20', 'source': 'BGMI Pro League'},
    {'title': 'Champion', 'desc': 'Win 50 matches', 'rarity': 'RARE', 'xp': 750, 'earned': false, 'date': null, 'source': null},
    {'title': 'Good Sport', 'desc': 'Fair play score ≥ 90', 'rarity': 'UNCOMMON', 'xp': 250, 'earned': true, 'date': '2026-05-01', 'source': 'Fair Play'},
    {'title': 'Legend', 'desc': 'Win 100 matches', 'rarity': 'EPIC', 'xp': 1500, 'earned': false, 'date': null, 'source': null},
  ];

  final List<Map<String, dynamic>> _missions = [
    {'title': 'Daily Warrior', 'desc': 'Play 1 match today', 'type': 'DAILY', 'current': 1, 'target': 1, 'xp': 15, 'done': true},
    {'title': 'Roll Call', 'desc': 'Check in to a tournament', 'type': 'DAILY', 'current': 0, 'target': 1, 'xp': 10, 'done': false},
    {'title': 'Weekly Grind', 'desc': 'Play 5 matches this week', 'type': 'WEEKLY', 'current': 3, 'target': 5, 'xp': 50, 'done': false},
    {'title': 'Weekly Victor', 'desc': 'Win 3 matches this week', 'type': 'WEEKLY', 'current': 1, 'target': 3, 'xp': 75, 'done': false},
  ];

  final List<Map<String, dynamic>> _streaks = [
    {'title': 'Login Streak', 'current': 12, 'longest': 24, 'nextMilestone': 14, 'xpPerDay': 5},
    {'title': 'Match Streak', 'current': 5, 'longest': 11, 'nextMilestone': 7, 'xpPerDay': 10},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: const Text('Achievements', style: TextStyle(color: Color(0xFFF8FAFC), fontSize: 20, fontWeight: FontWeight.w700)),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF6366F1),
          labelColor: const Color(0xFF818CF8),
          unselectedLabelColor: const Color(0xFF64748B),
          labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [Tab(text: '🏅 Badges'), Tab(text: '🎯 Missions'), Tab(text: '🔥 Streaks')],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [_buildBadgesTab(), _buildMissionsTab(), _buildStreaksTab()],
      ),
    );
  }

  Widget _buildBadgesTab() {
    final earned = _achievements.where((a) => a['earned'] == true).length;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFF1E1B4B), Color(0xFF0F172A)]),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _buildStatColumn('$earned', 'Earned'),
            _buildStatColumn('${_achievements.length - earned}', 'Locked'),
            _buildStatColumn('${_achievements.where((a) => a['earned'] == true).fold<int>(0, (s, a) => s + (a['xp'] as int))}', 'Total XP'),
          ]),
        ),
        const SizedBox(height: 16),
        ..._achievements.map((a) => _buildBadgeCard(a)),
      ],
    );
  }

  Widget _buildBadgeCard(Map<String, dynamic> ach) {
    final color = _rarityColors[ach['rarity']] ?? const Color(0xFF94A3B8);
    final isEarned = ach['earned'] as bool;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isEarned ? const Color(0xFF111827) : const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(10),
        border: Border(left: BorderSide(color: isEarned ? color : const Color(0xFF1E293B), width: 3)),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: color.withOpacity(isEarned ? 0.2 : 0.05),
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Text(isEarned ? '🏅' : '🔒', style: TextStyle(fontSize: isEarned ? 20 : 16)),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(ach['title'] as String, style: TextStyle(color: isEarned ? const Color(0xFFF8FAFC) : const Color(0xFF64748B), fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(4), border: Border.all(color: color.withOpacity(0.3))),
              child: Text(ach['rarity'] as String, style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w700)),
            ),
          ]),
          const SizedBox(height: 2),
          Text(ach['desc'] as String, style: TextStyle(color: const Color(0xFF94A3B8).withOpacity(isEarned ? 1 : 0.5), fontSize: 12)),
          if (isEarned && ach['source'] != null) ...[
            const SizedBox(height: 4),
            Text('📍 ${ach['source']} • ${ach['date']}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 10)),
          ],
        ])),
        Text('⭐ ${ach['xp']}', style: TextStyle(color: isEarned ? const Color(0xFFF59E0B) : const Color(0xFF475569), fontWeight: FontWeight.w600, fontSize: 12)),
      ]),
    );
  }

  Widget _buildMissionsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: _missions.map((m) {
        final progress = (m['current'] as int) / (m['target'] as int);
        final isDone = m['done'] as bool;
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF111827),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF1E293B)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Row(children: [
                Text(m['title'] as String, style: const TextStyle(color: Color(0xFFF8FAFC), fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: m['type'] == 'DAILY' ? const Color(0xFFFACC15).withOpacity(0.15) : const Color(0xFF3B82F6).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(m['type'] as String, style: TextStyle(color: m['type'] == 'DAILY' ? const Color(0xFFFACC15) : const Color(0xFF3B82F6), fontSize: 9, fontWeight: FontWeight.w700)),
                ),
              ]),
              if (isDone) const Icon(Icons.check_circle, color: Color(0xFF10B981), size: 20),
            ]),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress.clamp(0.0, 1.0),
                backgroundColor: const Color(0xFF1E293B),
                valueColor: AlwaysStoppedAnimation(isDone ? const Color(0xFF10B981) : const Color(0xFF6366F1)),
                minHeight: 6,
              ),
            ),
            const SizedBox(height: 4),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('${m['current']}/${m['target']}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
              Text('⭐ ${m['xp']} XP', style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 11, fontWeight: FontWeight.w600)),
            ]),
          ]),
        );
      }).toList(),
    );
  }

  Widget _buildStreaksTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: _streaks.map((s) {
        final progress = (s['current'] as int) / (s['nextMilestone'] as int);
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [const Color(0xFF111827), const Color(0xFF0F172A)]),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF1E293B)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(s['title'] as String, style: const TextStyle(color: Color(0xFFF8FAFC), fontWeight: FontWeight.w600, fontSize: 15)),
              Text('🔥 ${s['current']}', style: const TextStyle(color: Color(0xFFF59E0B), fontWeight: FontWeight.w700, fontSize: 18)),
            ]),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress.clamp(0.0, 1.0),
                backgroundColor: const Color(0xFF1E293B),
                valueColor: const AlwaysStoppedAnimation(Color(0xFFF59E0B)),
                minHeight: 8,
              ),
            ),
            const SizedBox(height: 6),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('Next milestone: ${s['nextMilestone']} days', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
              Text('Best: ${s['longest']} • +${s['xpPerDay']} XP/day', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
            ]),
          ]),
        );
      }).toList(),
    );
  }

  Widget _buildStatColumn(String value, String label) {
    return Column(children: [
      Text(value, style: const TextStyle(color: Color(0xFFF8FAFC), fontWeight: FontWeight.w700, fontSize: 20)),
      Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
    ]);
  }
}
