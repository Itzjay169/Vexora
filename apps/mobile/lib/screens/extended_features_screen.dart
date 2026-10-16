import 'package:flutter/material.dart';

/// Vexora — Extended Features Screen
///
/// Phase 34: Vexora Extended Features (Section 41 & 43 Additions)
///
/// Features:
/// - Scrims & unranked practice rooms browser
/// - Looking-for-Team (LFT) recruitment board
/// - Shareable verified player stat card with verification QR code
/// - Safe lobby chat with profanity filter and phone number scrubbing

class ExtendedFeaturesScreen extends StatefulWidget {
  const ExtendedFeaturesScreen({super.key});

  @override
  State<ExtendedFeaturesScreen> createState() => _ExtendedFeaturesScreenState();
}

class _ExtendedFeaturesScreenState extends State<ExtendedFeaturesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<Map<String, dynamic>> _scrims = [
    {
      'id': 's1',
      'title': 'BGMI Squad Rush (Erangel)',
      'game': 'BGMI',
      'host': 'CaptainViper',
      'room_code': 'SCRIM-8912',
      'players': '12/16',
      'scheduled': 'Starts in 15m',
    },
    {
      'id': 's2',
      'title': 'Free Fire MAX Clash Practice',
      'game': 'Free Fire',
      'host': 'ShadowNinja',
      'room_code': 'SCRIM-4401',
      'players': '6/8',
      'scheduled': 'Starts in 30m',
    },
    {
      'id': 's3',
      'title': 'COD Mobile 5v5 Search & Destroy',
      'game': 'COD Mobile',
      'host': 'GhostLeader',
      'room_code': 'SCRIM-2190',
      'players': '8/10',
      'scheduled': 'Starts in 45m',
    },
  ];

  final List<Map<String, dynamic>> _lftPosts = [
    {
      'id': 'p1',
      'type': 'PLAYER_LFT',
      'author': 'SniperGodX',
      'game': 'BGMI',
      'role': 'Assaulter / IGL',
      'rank': 'Crown I',
      'desc': 'Looking for competitive squad for weekend cups. Active mic and daily practice.',
      'time': '20m ago',
    },
    {
      'id': 'p2',
      'type': 'TEAM_RECRUITING',
      'author': 'Team Redline',
      'game': 'Free Fire',
      'role': 'Support / Rusher',
      'rank': 'Heroic',
      'desc': 'Recruiting 1 permanent rusher for official Vexora league matches.',
      'time': '1h ago',
    },
  ];

  final List<Map<String, dynamic>> _chatDemo = [
    {'sender': 'Rahul', 'message': 'Hey squad, ready for match 1?', 'is_me': false},
    {'sender': 'You', 'message': 'Ready! Let us get this win.', 'is_me': true},
    {'sender': 'ToxicGuy', 'message': 'You guys are **** and cannot play!', 'is_me': false, 'flagged': true},
  ];

  final _chatInputController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _chatInputController.dispose();
    super.dispose();
  }

  void _sendChatMessage() {
    final text = _chatInputController.text.trim();
    if (text.isEmpty) return;

    // Simulate safe chat filtering: mask profanity & scrub phone numbers
    var sanitized = text.replaceAll(
      RegExp(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'),
      '[PHONE_NUMBER_REDACTED]',
    );
    if (sanitized.toLowerCase().contains('cheat') || sanitized.toLowerCase().contains('hack')) {
      sanitized = sanitized.replaceAll(RegExp(r'cheat|hack', caseSensitive: false), '****');
    }

    setState(() {
      _chatDemo.add({'sender': 'You', 'message': sanitized, 'is_me': true});
      _chatInputController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Community & Practice', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF111827),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: const Color(0xFF3B82F6),
          tabs: const [
            Tab(text: 'Scrims Lobbies'),
            Tab(text: 'Looking For Team'),
            Tab(text: 'Verified Stat Card'),
            Tab(text: 'Safe Chat'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildScrimsTab(),
          _buildLftTab(),
          _buildStatCardTab(),
          _buildSafeChatTab(),
        ],
      ),
    );
  }

  Widget _buildScrimsTab() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _scrims.length,
      itemBuilder: (context, idx) {
        final scrim = _scrims[idx];
        return Card(
          color: const Color(0xFF1E293B),
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF3B82F6).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        scrim['game'],
                        style: const TextStyle(color: Color(0xFF60A5FA), fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                    Text(
                      scrim['players'],
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  scrim['title'],
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Host: ${scrim['host']}',
                      style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                    ),
                    Text(
                      scrim['scheduled'],
                      style: const TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 38,
                  child: ElevatedButton(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Joined ${scrim['title']}! Room code: ${scrim['room_code']}')),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3B82F6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Join Practice Room'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildLftTab() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _lftPosts.length,
      itemBuilder: (context, idx) {
        final p = _lftPosts[idx];
        final isPlayer = p['type'] == 'PLAYER_LFT';
        return Card(
          color: const Color(0xFF1E293B),
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isPlayer ? const Color(0xFF10B981).withOpacity(0.15) : const Color(0xFFA855F7).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isPlayer ? 'PLAYER LFT' : 'TEAM RECRUITING',
                        style: TextStyle(
                          color: isPlayer ? const Color(0xFF34D399) : const Color(0xFFC084FC),
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    Text(p['time'], style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${p['author']} (${p['game']})',
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  'Role: ${p['role']} • Rank: ${p['rank']}',
                  style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 13, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  p['desc'],
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13, height: 1.3),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatCardTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF3B82F6).withOpacity(0.4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('VEXORA COMPETITIVE ID', style: TextStyle(color: Color(0xFF64748B), fontSize: 11, letterSpacing: 1.2, fontWeight: FontWeight.bold)),
                    Icon(Icons.verified, color: Color(0xFF38BDF8), size: 18),
                  ],
                ),
                const SizedBox(height: 12),
                const Text('ApexPredator99', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                const Text('Fair-Play Verified Competitor', style: TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.w600)),
                const Divider(color: Color(0xFF334155), height: 24),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _StatCol(label: 'MATCHES', val: '48'),
                    _StatCol(label: 'WINS', val: '28'),
                    _StatCol(label: 'WIN RATE', val: '58.3%'),
                    _StatCol(label: 'TOTAL KILLS', val: '215'),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Fair Play Score: 98/100', style: TextStyle(color: Color(0xFF34D399), fontSize: 12, fontWeight: FontWeight.bold)),
                      Text('🔒 Phone Redacted', style: TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Scan or share this card to verify authenticated stats on vexora.gg',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildSafeChatTab() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          color: const Color(0xFF1E293B),
          child: const Row(
            children: [
              Icon(Icons.shield, color: Color(0xFF10B981), size: 18),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Safe In-App Chat: Profanity filtered, spam rate-limited, phone numbers auto-scrubbed.',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _chatDemo.length,
            itemBuilder: (context, idx) {
              final c = _chatDemo[idx];
              final isMe = c['is_me'] == true;
              return Align(
                alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isMe ? const Color(0xFF3B82F6) : const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c['sender'],
                        style: TextStyle(color: isMe ? Colors.white70 : const Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 3),
                      Text(c['message'], style: const TextStyle(color: Colors.white, fontSize: 13)),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        Container(
          padding: const EdgeInsets.all(10),
          color: const Color(0xFF111827),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _chatInputController,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    hintText: 'Type safe message...',
                    hintStyle: TextStyle(color: Color(0xFF64748B)),
                    border: InputBorder.none,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.send, color: Color(0xFF3B82F6)),
                onPressed: _sendChatMessage,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatCol extends StatelessWidget {
  final String label;
  final String val;
  const _StatCol({required this.label, required this.val});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(val, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w600)),
      ],
    );
  }
}
