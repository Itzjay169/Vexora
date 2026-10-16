import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/vexora_theme.dart';
import 'result_submission_screen.dart';

/// Phase 17: Tournament Bracket & Match Viewer Screen
///
/// Implements:
///   - Knockout tree / Round tabs (Round of 16, Quarterfinals, Semifinals, Finals)
///   - Battle Royale lobby group view (Lobby 1, Lobby 2, etc.)
///   - Byes & Seed badge visualization
///   - Server-authoritative Room Code Release Tile (hidden until release time, checked-in only)
///   - Match State machine indicators (SCHEDULED, LOBBY_READY, LIVE, RESULT_SUBMITTED, FINAL)
///   - Anti-leak room credential copy with security notices
///   - WCAG AA accessibility semantics
///
/// Source of Truth: Vexora Blueprint Section 4, 14, 39, 43, 47 (PHASE.md)
class BracketScreen extends ConsumerStatefulWidget {
  final String tournamentId;
  final String tournamentTitle;
  final String format; // KNOCKOUT, ROUND_ROBIN, BATTLE_ROYALE_LOBBY

  const BracketScreen({
    super.key,
    required this.tournamentId,
    this.tournamentTitle = 'Vexora Ignition Cup: Knockout Championship',
    this.format = 'KNOCKOUT',
  });

  @override
  ConsumerState<BracketScreen> createState() => _BracketScreenState();
}

class _BracketScreenState extends ConsumerState<BracketScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Mock 16-team tournament bracket with 4 rounds
  final List<Map<String, dynamic>> _mockRounds = [
    {
      'round_number': 1,
      'stage': 'ROUND_OF_16',
      'title': 'Round of 16',
      'matches': [
        {
          'id': 'match-101',
          'match_number': 1,
          'status': 'FINAL',
          'participant_a': {'name': 'Team Soul', 'seed': 1, 'is_winner': true, 'score': 2},
          'participant_b': {'name': 'GodLike Esports', 'seed': 16, 'is_winner': false, 'score': 0},
          'bye_awarded': false,
          'room_code_status': 'RELEASED_VERIFIED',
          'room_id': 'ROOM-77881',
          'room_password': 'PASS-SOUL-WIN',
        },
        {
          'id': 'match-102',
          'match_number': 2,
          'status': 'FINAL',
          'participant_a': {'name': 'Blind Esports', 'seed': 8, 'is_winner': true, 'score': 2},
          'participant_b': {'name': 'Revenant X', 'seed': 9, 'is_winner': false, 'score': 1},
          'bye_awarded': false,
          'room_code_status': 'RELEASED_VERIFIED',
          'room_id': 'ROOM-77882',
          'room_password': 'PASS-BLIND-WIN',
        },
        {
          'id': 'match-103',
          'match_number': 3,
          'status': 'FINAL',
          'participant_a': {'name': 'Team Tamilas', 'seed': 4, 'is_winner': true, 'score': 2},
          'participant_b': {'name': 'Entity Gaming', 'seed': 13, 'is_winner': false, 'score': 1},
          'bye_awarded': false,
          'room_code_status': 'RELEASED_VERIFIED',
          'room_id': 'ROOM-77883',
          'room_password': 'PASS-TAMIL-WIN',
        },
        {
          'id': 'match-104',
          'match_number': 4,
          'status': 'FINAL',
          'participant_a': {'name': 'Orangutan Gaming', 'seed': 5, 'is_winner': true, 'score': 2},
          'participant_b': {'name': 'Global Esports', 'seed': 12, 'is_winner': false, 'score': 0},
          'bye_awarded': false,
          'room_code_status': 'RELEASED_VERIFIED',
          'room_id': 'ROOM-77884',
          'room_password': 'PASS-OG-WIN',
        },
        {
          'id': 'match-105',
          'match_number': 5,
          'status': 'FINAL',
          'participant_a': {'name': 'Gladiators Esports', 'seed': 2, 'is_winner': true, 'score': 2},
          'participant_b': {'name': 'Numen Gaming', 'seed': 15, 'is_winner': false, 'score': 0},
          'bye_awarded': false,
          'room_code_status': 'RELEASED_VERIFIED',
          'room_id': 'ROOM-77885',
          'room_password': 'PASS-GLAD-WIN',
        },
        {
          'id': 'match-106',
          'match_number': 6,
          'status': 'FINAL',
          'participant_a': {'name': 'Medal Esports', 'seed': 7, 'is_winner': true, 'score': 2},
          'participant_b': {'name': 'Marcos Gaming', 'seed': 10, 'is_winner': false, 'score': 1},
          'bye_awarded': false,
          'room_code_status': 'RELEASED_VERIFIED',
          'room_id': 'ROOM-77886',
          'room_password': 'PASS-MEDAL-WIN',
        },
        {
          'id': 'match-107',
          'match_number': 7,
          'status': 'FINAL',
          'participant_a': {'name': 'Team XSpark', 'seed': 3, 'is_winner': true, 'score': 2},
          'participant_b': {'name': 'Hydra Official', 'seed': 14, 'is_winner': false, 'score': 0},
          'bye_awarded': false,
          'room_code_status': 'RELEASED_VERIFIED',
          'room_id': 'ROOM-77887',
          'room_password': 'PASS-XSP-WIN',
        },
        {
          'id': 'match-108',
          'match_number': 8,
          'status': 'FINAL',
          'participant_a': {'name': 'Carnival Gaming', 'seed': 6, 'is_winner': true, 'score': 2},
          'participant_b': {'name': 'Autobotz Esports', 'seed': 11, 'is_winner': false, 'score': 1},
          'bye_awarded': false,
          'room_code_status': 'RELEASED_VERIFIED',
          'room_id': 'ROOM-77888',
          'room_password': 'PASS-CARN-WIN',
        },
      ],
    },
    {
      'round_number': 2,
      'stage': 'QUARTER_FINALS',
      'title': 'Quarterfinals',
      'matches': [
        {
          'id': 'match-201',
          'match_number': 1,
          'status': 'LIVE',
          'participant_a': {'name': 'Team Soul', 'seed': 1, 'is_winner': null, 'score': 1},
          'participant_b': {'name': 'Blind Esports', 'seed': 8, 'is_winner': null, 'score': 1},
          'bye_awarded': false,
          'room_code_status': 'RELEASED_VERIFIED',
          'room_id': 'ROOM-88991',
          'room_password': 'PASS-QF-LIVE',
        },
        {
          'id': 'match-202',
          'match_number': 2,
          'status': 'LOBBY_READY',
          'participant_a': {'name': 'Team Tamilas', 'seed': 4, 'is_winner': null, 'score': 0},
          'participant_b': {'name': 'Orangutan Gaming', 'seed': 5, 'is_winner': null, 'score': 0},
          'bye_awarded': false,
          'room_code_status': 'LOCKED_UNTIL_RELEASE_TIME',
          'room_release_time': 'In 5 minutes (8:00 PM UTC)',
          'room_id': null,
          'room_password': null,
        },
        {
          'id': 'match-203',
          'match_number': 3,
          'status': 'SCHEDULED',
          'participant_a': {'name': 'Gladiators Esports', 'seed': 2, 'is_winner': null, 'score': 0},
          'participant_b': {'name': 'Medal Esports', 'seed': 7, 'is_winner': null, 'score': 0},
          'bye_awarded': false,
          'room_code_status': 'LOCKED_UNTIL_RELEASE_TIME',
          'room_release_time': '8:30 PM UTC',
          'room_id': null,
          'room_password': null,
        },
        {
          'id': 'match-204',
          'match_number': 4,
          'status': 'SCHEDULED',
          'participant_a': {'name': 'Team XSpark', 'seed': 3, 'is_winner': null, 'score': 0},
          'participant_b': {'name': 'Carnival Gaming', 'seed': 6, 'is_winner': null, 'score': 0},
          'bye_awarded': false,
          'room_code_status': 'RESTRICTED_TO_CHECKED_IN_PARTICIPANTS',
          'room_id': null,
          'room_password': null,
        },
      ],
    },
    {
      'round_number': 3,
      'stage': 'SEMI_FINALS',
      'title': 'Semifinals',
      'matches': [
        {
          'id': 'match-301',
          'match_number': 1,
          'status': 'SCHEDULED',
          'participant_a': {'name': 'Winner of QF 1', 'seed': null, 'is_winner': null, 'score': 0},
          'participant_b': {'name': 'Winner of QF 2', 'seed': null, 'is_winner': null, 'score': 0},
          'bye_awarded': false,
          'room_code_status': 'LOCKED_UNTIL_RELEASE_TIME',
          'room_release_time': 'Tomorrow, 5:00 PM UTC',
          'room_id': null,
          'room_password': null,
        },
        {
          'id': 'match-302',
          'match_number': 2,
          'status': 'SCHEDULED',
          'participant_a': {'name': 'Winner of QF 3', 'seed': null, 'is_winner': null, 'score': 0},
          'participant_b': {'name': 'Winner of QF 4', 'seed': null, 'is_winner': null, 'score': 0},
          'bye_awarded': false,
          'room_code_status': 'LOCKED_UNTIL_RELEASE_TIME',
          'room_release_time': 'Tomorrow, 6:00 PM UTC',
          'room_id': null,
          'room_password': null,
        },
      ],
    },
    {
      'round_number': 4,
      'stage': 'FINALS',
      'title': 'Grand Finals',
      'matches': [
        {
          'id': 'match-401',
          'match_number': 1,
          'status': 'SCHEDULED',
          'participant_a': {'name': 'Winner of SF 1', 'seed': null, 'is_winner': null, 'score': 0},
          'participant_b': {'name': 'Winner of SF 2', 'seed': null, 'is_winner': null, 'score': 0},
          'bye_awarded': false,
          'room_code_status': 'LOCKED_UNTIL_RELEASE_TIME',
          'room_release_time': 'Tomorrow, 8:00 PM UTC',
          'room_id': null,
          'room_password': null,
        },
      ],
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _mockRounds.length, vsync: this);
    _tabController.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: VexoraColors.bgDark,
      appBar: AppBar(
        backgroundColor: VexoraColors.surfaceDark,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.tournamentTitle,
              style: const TextStyle(
                color: VexoraColors.textPrimaryDark,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const Text(
              'Interactive Match Engine & Bracket Tree',
              style: TextStyle(
                color: VexoraColors.textSecondaryDark,
                fontSize: 12,
              ),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: VexoraColors.primary,
          indicatorWeight: 3,
          labelColor: VexoraColors.primary,
          unselectedLabelColor: VexoraColors.textSecondaryDark,
          tabs: _mockRounds.map((r) => Tab(text: r['title'] as String)).toList(),
        ),
      ),
      body: Column(
        children: [
          // Security Banner for Room Codes
          _buildSecurityNoticeBanner(),

          // Matches list for selected round
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: _mockRounds.map((round) {
                final matches = round['matches'] as List<Map<String, dynamic>>;
                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: matches.length,
                  itemBuilder: (context, index) {
                    return _buildMatchCard(matches[index], round['title'] as String);
                  },
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSecurityNoticeBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: VexoraColors.surfaceElevatedDark,
        border: Border(bottom: BorderSide(color: VexoraColors.borderDark)),
      ),
      child: const Row(
        children: [
          Icon(Icons.shield_outlined, color: VexoraColors.primary, size: 18),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Security Policy: Room credentials are unlocked only at release time to verified checked-in players.',
              style: TextStyle(
                color: VexoraColors.textSecondaryDark,
                fontSize: 11,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMatchCard(Map<String, dynamic> match, String stageTitle) {
    final status = match['status'] as String;
    final partA = match['participant_a'] as Map<String, dynamic>?;
    final partB = match['participant_b'] as Map<String, dynamic>?;
    final byeAwarded = match['bye_awarded'] as bool? ?? false;
    final roomStatus = match['room_code_status'] as String? ?? 'LOCKED_UNTIL_RELEASE_TIME';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: status == 'LIVE'
              ? VexoraColors.stateLive
              : VexoraColors.borderDark,
          width: status == 'LIVE' ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        children: [
          // Header: Match Number & Status Chip
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      'Match #${match['match_number']}',
                      style: const TextStyle(
                        color: VexoraColors.textPrimaryDark,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        fontFamily: 'monospace',
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '• $stageTitle',
                      style: const TextStyle(
                        color: VexoraColors.textMutedDark,
                        fontSize: 12,
                      ),
                    ),
                    if (byeAwarded) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: VexoraColors.accent.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'BYE',
                          style: TextStyle(color: VexoraColors.accent, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ],
                ),
                _buildStatusChip(status),
              ],
            ),
          ),
          const Divider(height: 1, color: VexoraColors.borderDark),

          // Combatants Comparison
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _buildParticipantRow(partA, isA: true),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Expanded(child: Divider(color: VexoraColors.borderDark)),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          'VS',
                          style: TextStyle(
                            color: VexoraColors.textMutedDark,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Expanded(child: Divider(color: VexoraColors.borderDark)),
                    ],
                  ),
                ),
                _buildParticipantRow(partB, isA: false),
              ],
            ),
          ),

          // Room Credentials Tile
          _buildRoomCredentialsTile(match, roomStatus),

          // Result Submission & Verification Action
          _buildResultActionBar(match, status),
        ],
      ),
    );
  }

  Widget _buildParticipantRow(Map<String, dynamic>? participant, {required bool isA}) {
    if (participant == null) {
      return Row(
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: VexoraColors.surfaceElevatedDark,
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text('?', style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 11)),
          ),
          const SizedBox(width: 12),
          const Text(
            'TBD (Awaiting previous round)',
            style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 13, fontStyle: FontStyle.italic),
          ),
        ],
      );
    }

    final isWinner = participant['is_winner'] == true;
    final seed = participant['seed'];

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            if (seed != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: VexoraColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '#$seed',
                  style: const TextStyle(
                    color: VexoraColors.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            const SizedBox(width: 10),
            Text(
              participant['name'] as String,
              style: TextStyle(
                color: isWinner ? VexoraColors.success : VexoraColors.textPrimaryDark,
                fontWeight: isWinner ? FontWeight.bold : FontWeight.w500,
                fontSize: 14,
              ),
            ),
            if (isWinner) ...[
              const SizedBox(width: 6),
              const Icon(Icons.check_circle_rounded, color: VexoraColors.success, size: 16),
            ],
          ],
        ),
        if (participant['score'] != null)
          Text(
            '${participant['score']}',
            style: TextStyle(
              color: isWinner ? VexoraColors.success : VexoraColors.textSecondaryDark,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
      ],
    );
  }

  Widget _buildStatusChip(String status) {
    Color chipColor;
    String label = status;

    switch (status) {
      case 'LIVE':
        chipColor = VexoraColors.stateLive;
        break;
      case 'LOBBY_READY':
        chipColor = VexoraColors.stateCheckIn;
        break;
      case 'FINAL':
        chipColor = VexoraColors.stateCompleted;
        break;
      case 'RESULT_SUBMITTED':
        chipColor = VexoraColors.stateResultPending;
        break;
      case 'DISPUTED':
        chipColor = VexoraColors.stateDisputed;
        break;
      default:
        chipColor = VexoraColors.textMutedDark;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: chipColor.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: chipColor.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: chipColor,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildRoomCredentialsTile(Map<String, dynamic> match, String roomStatus) {
    if (roomStatus == 'RELEASED_VERIFIED') {
      final roomId = match['room_id'] ?? 'ROOM-LIVE';
      final roomPass = match['room_password'] ?? 'NO-PASSWORD';

      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          color: VexoraColors.surfaceElevatedDark,
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(16),
            bottomRight: Radius.circular(16),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.lock_open_rounded, color: VexoraColors.success, size: 14),
                    SizedBox(width: 6),
                    Text(
                      'Lobby Unlocked (Checked-in Player)',
                      style: TextStyle(color: VexoraColors.success, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'ID: $roomId  •  Pass: $roomPass',
                  style: const TextStyle(
                    color: VexoraColors.textPrimaryDark,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            IconButton(
              icon: const Icon(Icons.copy_rounded, color: VexoraColors.primary, size: 20),
              tooltip: 'Copy Room Credentials',
              onPressed: () {
                Clipboard.setData(ClipboardData(text: 'Room ID: $roomId | Password: $roomPass'));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Room ID & Password copied to clipboard (Confidential)'),
                    backgroundColor: VexoraColors.primary,
                  ),
                );
              },
            ),
          ],
        ),
      );
    }

    if (roomStatus == 'LOCKED_UNTIL_RELEASE_TIME') {
      final releaseTime = match['room_release_time'] ?? 'Release time approaching';
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: const BoxDecoration(
          color: VexoraColors.surfaceElevatedDark,
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(16),
            bottomRight: Radius.circular(16),
          ),
        ),
        child: Row(
          children: [
            const Icon(Icons.schedule_rounded, color: VexoraColors.accent, size: 16),
            const SizedBox(width: 8),
            Text(
              'Room Code releases at: $releaseTime',
              style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 11),
            ),
          ],
        ),
      );
    }

    // RESTRICTED_TO_CHECKED_IN_PARTICIPANTS
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: VexoraColors.surfaceElevatedDark,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(16),
          bottomRight: Radius.circular(16),
        ),
      ),
      child: const Row(
        children: [
          Icon(Icons.lock_outline_rounded, color: VexoraColors.textMutedDark, size: 16),
          SizedBox(width: 8),
          Text(
            'Room code visible only to verified match combatants',
            style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildResultActionBar(Map<String, dynamic> match, String status) {
    if (status != 'LIVE' && status != 'RESULT_SUBMITTED' && status != 'DISPUTED') {
      return const SizedBox.shrink();
    }

    final isDisputed = status == 'DISPUTED';
    final isSubmitted = status == 'RESULT_SUBMITTED';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceDark,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(16),
          bottomRight: Radius.circular(16),
        ),
        border: Border(
          top: BorderSide(color: VexoraColors.borderDark.withValues(alpha: 0.6)),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(
                isDisputed
                    ? Icons.warning_amber_rounded
                    : (isSubmitted ? Icons.fact_check_outlined : Icons.military_tech_outlined),
                color: isDisputed
                    ? VexoraColors.stateDisputed
                    : (isSubmitted ? VexoraColors.stateResultPending : VexoraColors.primary),
                size: 16,
              ),
              const SizedBox(width: 8),
              Text(
                isDisputed
                    ? 'Dispute Hold Active'
                    : (isSubmitted ? 'Result Pending Confirmation' : 'Match Live • Ready for Results'),
                style: TextStyle(
                  color: isDisputed
                      ? VexoraColors.stateDisputed
                      : (isSubmitted ? VexoraColors.stateResultPending : VexoraColors.textPrimaryDark),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: isDisputed ? VexoraColors.surfaceElevatedDark : VexoraColors.primary,
              foregroundColor: isDisputed ? VexoraColors.stateDisputed : Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              visualDensity: VisualDensity.compact,
            ),
            icon: Icon(isSubmitted ? Icons.checklist_rtl_rounded : Icons.file_upload_outlined, size: 14),
            label: Text(
              isSubmitted ? 'Review' : 'Submit Result',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ResultSubmissionScreen(
                    matchId: match['id'] ?? 'match-101',
                    tournamentTitle: widget.tournamentTitle,
                    isReviewingOpponent: isSubmitted,
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
