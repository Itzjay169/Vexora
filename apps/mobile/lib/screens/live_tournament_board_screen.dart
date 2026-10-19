import 'package:flutter/material.dart';

/// Phase 29: Live Tournament Board & Real-Time Gateway Screen
/// Blueprint Ref: Sections 14, 39 (Phase 7)
///
/// Features:
/// - Real-time WebSocket connection state pill (Connected / Reconnecting / Degraded)
/// - Sequence number counter and missed-event replay tracker
/// - Live tournament standings table with kills, placement, and alive/eliminated pills
/// - Auto-reconnect with sequence replay simulation
/// - Section 14 match action ticker
class LiveTournamentBoardScreen extends StatefulWidget {
  final String tournamentId;
  final String tournamentTitle;

  const LiveTournamentBoardScreen({
    super.key,
    this.tournamentId = 'trn-7701',
    this.tournamentTitle = 'BGMI Summer Cup 2026 — Finals',
  });

  @override
  State<LiveTournamentBoardScreen> createState() => _LiveTournamentBoardScreenState();
}

class _LiveTournamentBoardScreenState extends State<LiveTournamentBoardScreen> {
  String _connectionStatus = 'CONNECTED'; // 'CONNECTED', 'RECONNECTING', 'DEGRADED'
  int _currentSequence = 8426;

  final List<Map<String, dynamic>> _standings = [
    {
      'rank': 1,
      'team': 'Team Soul',
      'kills': 18,
      'placement': 15,
      'total': 33,
      'is_alive': true,
    },
    {
      'rank': 2,
      'team': 'GodLike Esports',
      'kills': 14,
      'placement': 12,
      'total': 26,
      'is_alive': true,
    },
    {
      'rank': 3,
      'team': 'Reckoning Esports',
      'kills': 9,
      'placement': 10,
      'total': 19,
      'is_alive': true,
    },
    {
      'rank': 4,
      'team': 'Blind Esports',
      'kills': 8,
      'placement': 8,
      'total': 16,
      'is_alive': false,
    },
    {
      'rank': 5,
      'team': 'Entity Gaming',
      'kills': 5,
      'placement': 6,
      'total': 11,
      'is_alive': false,
    },
  ];

  final List<Map<String, dynamic>> _liveTicker = [
    {'seq': 8426, 'text': 'Zone 6 shrink complete. 2 squads remain.', 'time': 'Just now'},
    {'seq': 8425, 'text': 'Team Soul eliminated Blind Esports.', 'time': '1m ago'},
    {'seq': 8424, 'text': 'Lobby 4 Match 3 results verified by referee.', 'time': '3m ago'},
  ];

  void _simulateFlakyNetwork() async {
    setState(() => _connectionStatus = 'RECONNECTING');

    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;

    setState(() => _connectionStatus = 'DEGRADED');

    await Future.delayed(const Duration(milliseconds: 2000));
    if (!mounted) return;

    setState(() {
      _connectionStatus = 'CONNECTED';
      _currentSequence += 2;
      _liveTicker.insert(0, {
        'seq': _currentSequence,
        'text': 'Reconnected. 2 missed events replayed seamlessly.',
        'time': 'Just now',
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0F),
      appBar: AppBar(
        backgroundColor: const Color(0xFF13141F),
        elevation: 0,
        title: Text(
          widget.tournamentTitle,
          style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.wifi_tethering, color: Color(0xFF00FF87)),
            tooltip: 'Simulate Network Flake',
            onPressed: _simulateFlakyNetwork,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status & Sequence Ribbon
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF13141F),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _connectionStatus == 'CONNECTED'
                      ? const Color(0xFF00FF87).withOpacity(0.3)
                      : Colors.amber.withOpacity(0.3),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _connectionStatus == 'CONNECTED' ? const Color(0xFF00FF87) : Colors.amber,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _connectionStatus == 'CONNECTED'
                            ? 'LIVE GATEWAY'
                            : _connectionStatus == 'RECONNECTING'
                            ? 'RECONNECTING...'
                            : 'DEGRADED MODE',
                        style: TextStyle(
                          color: _connectionStatus == 'CONNECTED' ? const Color(0xFF00FF87) : Colors.amber,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    'Sequence #$_currentSequence',
                    style: const TextStyle(
                      color: Colors.cyanAccent,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            if (_connectionStatus == 'DEGRADED') ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.withOpacity(0.3)),
                ),
                child: const Text(
                  'Degraded fallback: Operating in read-only polling mode while network reconnects.',
                  style: TextStyle(color: Colors.amber, fontSize: 11),
                ),
              ),
            ],

            const SizedBox(height: 20),

            // Live Standings Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Live Leaderboard',
                  style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                ),
                Text(
                  'Channel: tournament:${widget.tournamentId}',
                  style: TextStyle(color: Colors.grey[500], fontSize: 10, fontFamily: 'monospace'),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Standings List
            ..._standings.map((team) {
              final isTop3 = team['rank'] <= 3;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF13141F),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isTop3 ? const Color(0xFF00FF87).withOpacity(0.25) : const Color(0xFF2A2B3D),
                  ),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 24,
                      child: Text(
                        '#${team['rank']}',
                        style: TextStyle(
                          color: isTop3 ? const Color(0xFF00FF87) : Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            team['team'],
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                          Text(
                            'Kills: ${team['kills']} • Place Pts: ${team['placement']}',
                            style: TextStyle(color: Colors.grey[400], fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: team['is_alive']
                            ? const Color(0xFF00FF87).withOpacity(0.15)
                            : Colors.grey.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        team['is_alive'] ? 'ALIVE' : 'ELIMINATED',
                        style: TextStyle(
                          color: team['is_alive'] ? const Color(0xFF00FF87) : Colors.grey,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '${team['total']} pts',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              );
            }),

            const SizedBox(height: 20),

            // Live Match Action Feed
            const Text(
              'Section 14 Live Event Feed',
              style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),

            ..._liveTicker.map((item) => Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF0A0A0F),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF2A2B3D)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Seq #${item['seq']}',
                          style: const TextStyle(color: Colors.cyanAccent, fontSize: 9, fontFamily: 'monospace'),
                        ),
                        const SizedBox(height: 2),
                        Text(item['text'], style: const TextStyle(color: Colors.white, fontSize: 11)),
                      ],
                    ),
                  ),
                  Text(item['time'], style: TextStyle(color: Colors.grey[500], fontSize: 10)),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }
}
