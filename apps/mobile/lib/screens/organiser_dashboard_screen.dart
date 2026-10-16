import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/vexora_theme.dart';
import 'bracket_screen.dart';
import 'tournament_wizard_screen.dart';
import 'organiser_verification_screen.dart';

/// Phase 18: Organiser Operations & Tournament Dashboard Screen
///
/// Features:
///   - Operational Tournament Hub (participants, check-in rate, match status)
///   - 5-Point Match-Day Checklist (Section 43)
///   - Tournament Announcements Channel (Pinned & Broadcasts)
///   - Tournament Incident Log (Late start, Disconnects, Cheating suspicions)
///   - Seamless linkage to Bracket/Match engine & Tournament Wizard
class OrganiserDashboardScreen extends ConsumerStatefulWidget {
  final String? initialTournamentId;

  const OrganiserDashboardScreen({super.key, this.initialTournamentId});

  @override
  ConsumerState<OrganiserDashboardScreen> createState() => _OrganiserDashboardScreenState();
}

class _OrganiserDashboardScreenState extends ConsumerState<OrganiserDashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Selected tournament state
  int _selectedTournamentIndex = 0;

  // Mock tournaments list for organiser
  final List<Map<String, dynamic>> _tournaments = [
    {
      'id': 't-tourn-001',
      'title': 'BGMI Battle Royale Ignition Cup',
      'game': 'BGMI',
      'status': 'REGISTRATION_OPEN',
      'format': 'BATTLE_ROYALE_LOBBY',
      'confirmed': 42,
      'checked_in': 38,
      'capacity': 64,
      'waitlisted': 5,
      'rules_version': 2,
      'start_time': 'Today, 18:00 IST',
    },
    {
      'id': 't-tourn-002',
      'title': 'Free Fire MAX Weekly Clash',
      'game': 'Free Fire MAX',
      'status': 'LIVE',
      'format': 'SINGLE_ELIMINATION',
      'confirmed': 16,
      'checked_in': 16,
      'capacity': 16,
      'waitlisted': 0,
      'rules_version': 1,
      'start_time': 'Live Now',
    },
    {
      'id': 't-tourn-003',
      'title': 'CODM SnD Masters Qualifier',
      'game': 'CODM',
      'status': 'PENDING_REVIEW',
      'format': 'SINGLE_ELIMINATION',
      'confirmed': 0,
      'checked_in': 0,
      'capacity': 32,
      'waitlisted': 0,
      'rules_version': 1,
      'start_time': 'Pending Admin Approval',
    },
  ];

  // 5 Canonical matchday checklist items (Section 43)
  final List<Map<String, dynamic>> _checklistItems = [
    {
      'key': 'LOBBY_CREATED',
      'title': 'In-Game Custom Room / Lobby Created',
      'subtitle': 'Verify server room settings, spectator slots, and game mode.',
      'completed': true,
      'completed_at': '17:15 IST',
    },
    {
      'key': 'ROOM_DETAILS_RELEASED',
      'title': 'Room ID & Password Released on Schedule',
      'subtitle': 'Protected credentials auto-released only to checked-in players.',
      'completed': true,
      'completed_at': '17:45 IST',
    },
    {
      'key': 'CHECK_IN_VERIFIED',
      'title': 'Participant Check-in & Roster Locked',
      'subtitle': 'No roster changes allowed after tournament check-in window.',
      'completed': false,
      'completed_at': null,
    },
    {
      'key': 'EVIDENCE_COLLECTED',
      'title': 'Match Screenshots & Evidence Collected',
      'subtitle': 'SHA-256 tamper-evident ingress hashing on all scoreboard media.',
      'completed': false,
      'completed_at': null,
    },
    {
      'key': 'RESULT_SUBMITTED',
      'title': 'Official Match Results Recorded & Signed',
      'subtitle': 'Calculate leaderboard standings with deterministic integer scoring.',
      'completed': false,
      'completed_at': null,
    },
  ];

  // Tournament Announcements
  final List<Map<String, dynamic>> _announcements = [
    {
      'id': 'ann-1',
      'title': 'Lobby Room Credentials Release at 17:45 IST',
      'content': 'All checked-in players please ensure you have downloaded the Miramar update before lobby entry.',
      'is_pinned': true,
      'time': '10 mins ago',
    },
    {
      'id': 'ann-2',
      'title': 'Reminder: Ping under 80ms required',
      'content': 'Unstable network disconnects will follow the published Section 5 disconnect policy.',
      'is_pinned': false,
      'time': '1 hour ago',
    },
  ];

  // Incident Logs
  final List<Map<String, dynamic>> _incidents = [
    {
      'id': 'inc-1',
      'type': 'DISCONNECT',
      'severity': 'MEDIUM',
      'description': 'Team Hydra Player 3 encountered ISP disconnection during warmup lobby.',
      'status': 'RESOLVED',
      'resolution': 'Allowed 3-minute lobby restart per disconnect policy clause 4.2.',
      'time': '25 mins ago',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'DRAFT':
        return VexoraColors.stateDraft;
      case 'PENDING_REVIEW':
        return VexoraColors.statePendingReview;
      case 'SCHEDULED':
        return VexoraColors.stateScheduled;
      case 'REGISTRATION_OPEN':
        return VexoraColors.stateRegistrationOpen;
      case 'CHECK_IN':
        return VexoraColors.stateCheckIn;
      case 'LIVE':
        return VexoraColors.stateLive;
      case 'COMPLETED':
        return VexoraColors.stateCompleted;
      default:
        return VexoraColors.secondary;
    }
  }

  Color _getSeverityColor(String severity) {
    switch (severity) {
      case 'CRITICAL':
        return VexoraColors.stateDisputed;
      case 'HIGH':
        return VexoraColors.stateResultPending;
      case 'MEDIUM':
        return VexoraColors.statePendingReview;
      case 'LOW':
      default:
        return VexoraColors.textMutedDark;
    }
  }

  void _showNewAnnouncementDialog() {
    final titleController = TextEditingController();
    final contentController = TextEditingController();
    bool isPinned = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: VexoraColors.surfaceElevatedDark,
          title: const Text(
            'Broadcast Announcement',
            style: TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleController,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Announcement Title',
                    labelStyle: TextStyle(color: VexoraColors.textSecondaryDark),
                    hintText: 'e.g. Lobby delayed by 5 mins',
                    hintStyle: TextStyle(color: Colors.white38),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: contentController,
                  maxLines: 3,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Content',
                    labelStyle: TextStyle(color: VexoraColors.textSecondaryDark),
                    hintText: 'Message visible to all participants...',
                    hintStyle: TextStyle(color: Colors.white38),
                  ),
                ),
                const SizedBox(height: 12),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Pin to top of channel', style: TextStyle(color: Colors.white, fontSize: 14)),
                  value: isPinned,
                  activeColor: VexoraColors.secondary,
                  onChanged: (val) => setDialogState(() => isPinned = val ?? false),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Colors.white60)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: VexoraColors.secondary),
              onPressed: () {
                if (titleController.text.trim().isNotEmpty && contentController.text.trim().isNotEmpty) {
                  setState(() {
                    _announcements.insert(0, {
                      'id': 'ann-${DateTime.now().millisecondsSinceEpoch}',
                      'title': titleController.text.trim(),
                      'content': contentController.text.trim(),
                      'is_pinned': isPinned,
                      'time': 'Just now',
                    });
                  });
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Announcement broadcasted to participants')),
                  );
                }
              },
              child: const Text('Broadcast', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  void _showLogIncidentDialog() {
    String incidentType = 'LATE_START';
    String severity = 'LOW';
    final descController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: VexoraColors.surfaceElevatedDark,
          title: const Text(
            'Log Tournament Incident',
            style: TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Incident Type', style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12)),
                DropdownButton<String>(
                  value: incidentType,
                  dropdownColor: VexoraColors.surfaceElevatedDark,
                  isExpanded: true,
                  style: const TextStyle(color: Colors.white),
                  items: const [
                    DropdownMenuItem(value: 'LATE_START', child: Text('Late Start')),
                    DropdownMenuItem(value: 'DISCONNECT', child: Text('Player Disconnection')),
                    DropdownMenuItem(value: 'RULE_CLARIFICATION', child: Text('Rule Clarification')),
                    DropdownMenuItem(value: 'SUSPECTED_CHEATING', child: Text('Suspected Cheating')),
                    DropdownMenuItem(value: 'LOBBY_ISSUE', child: Text('Lobby / Room Code Issue')),
                    DropdownMenuItem(value: 'NO_SHOW', child: Text('Team No-Show')),
                    DropdownMenuItem(value: 'OTHER', child: Text('Other Issue')),
                  ],
                  onChanged: (val) => setDialogState(() => incidentType = val ?? 'OTHER'),
                ),
                const SizedBox(height: 12),
                const Text('Severity', style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12)),
                DropdownButton<String>(
                  value: severity,
                  dropdownColor: VexoraColors.surfaceElevatedDark,
                  isExpanded: true,
                  style: const TextStyle(color: Colors.white),
                  items: const [
                    DropdownMenuItem(value: 'LOW', child: Text('Low - Informational')),
                    DropdownMenuItem(value: 'MEDIUM', child: Text('Medium - Gameplay Delay')),
                    DropdownMenuItem(value: 'HIGH', child: Text('High - Dispute Potential')),
                    DropdownMenuItem(value: 'CRITICAL', child: Text('Critical - Match Cancellation')),
                  ],
                  onChanged: (val) => setDialogState(() => severity = val ?? 'LOW'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descController,
                  maxLines: 3,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Incident Description',
                    labelStyle: TextStyle(color: VexoraColors.textSecondaryDark),
                    hintText: 'Describe what occurred and teams affected...',
                    hintStyle: TextStyle(color: Colors.white38),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Colors.white60)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: VexoraColors.stateDisputed),
              onPressed: () {
                if (descController.text.trim().isNotEmpty) {
                  setState(() {
                    _incidents.insert(0, {
                      'id': 'inc-${DateTime.now().millisecondsSinceEpoch}',
                      'type': incidentType,
                      'severity': severity,
                      'description': descController.text.trim(),
                      'status': 'LOGGED',
                      'resolution': null,
                      'time': 'Just now',
                    });
                  });
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Incident logged into tournament record')),
                  );
                }
              },
              child: const Text('Log Incident', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentTourn = _tournaments[_selectedTournamentIndex];
    final statusColor = _getStatusColor(currentTourn['status']);

    return Scaffold(
      backgroundColor: VexoraColors.bgDark,
      body: SafeArea(
        child: NestedScrollView(
          headerSliverBuilder: (context, innerBoxIsScrolled) => [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header with Title and Create Button
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Organiser Operations',
                              style: TextStyle(
                                color: VexoraColors.textPrimaryDark,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Tournament Control Center & Matchday Ops',
                              style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 13),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: VexoraColors.secondary,
                                side: const BorderSide(color: VexoraColors.secondary),
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              icon: const Icon(Icons.verified, size: 16),
                              label: const Text('Tier & KYC', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const OrganiserVerificationScreen()),
                                );
                              },
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: VexoraColors.secondary,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              icon: const Icon(Icons.add, size: 18),
                              label: const Text('New', style: TextStyle(fontWeight: FontWeight.bold)),
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const TournamentWizardScreen()),
                                );
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Tournament Selector Horizontal Scroll
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: List.generate(_tournaments.length, (idx) {
                          final item = _tournaments[idx];
                          final isSelected = idx == _selectedTournamentIndex;
                          final color = _getStatusColor(item['status']);
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: FilterChip(
                              selected: isSelected,
                              label: Text('${item['game']} • ${item['title']}'),
                              labelStyle: TextStyle(
                                color: isSelected ? Colors.white : VexoraColors.textSecondaryDark,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                fontSize: 12,
                              ),
                              backgroundColor: VexoraColors.surfaceDark,
                              selectedColor: VexoraColors.secondary.withValues(alpha: 0.3),
                              side: BorderSide(
                                color: isSelected ? VexoraColors.secondary : VexoraColors.borderDark,
                              ),
                              avatar: Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                              ),
                              onSelected: (_) => setState(() => _selectedTournamentIndex = idx),
                            ),
                          );
                        }),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Active Tournament Status Banner Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: VexoraColors.surfaceElevatedDark,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: VexoraColors.borderDark),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  currentTourn['title'],
                                  style: const TextStyle(
                                    color: VexoraColors.textPrimaryDark,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: statusColor.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: statusColor.withValues(alpha: 0.5)),
                                ),
                                child: Text(
                                  currentTourn['status'],
                                  style: TextStyle(
                                    color: statusColor,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.sports_esports_outlined, size: 14, color: VexoraColors.accent),
                              const SizedBox(width: 4),
                              Text(
                                '${currentTourn['game']} • ${currentTourn['format']}',
                                style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12),
                              ),
                              const SizedBox(width: 12),
                              const Icon(Icons.rule_rounded, size: 14, color: VexoraColors.secondary),
                              const SizedBox(width: 4),
                              Text(
                                'Rules v${currentTourn['rules_version']}',
                                style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Operational Metrics Row
                          Row(
                            children: [
                              _MetricTile(
                                label: 'Confirmed',
                                value: '${currentTourn['confirmed']}/${currentTourn['capacity']}',
                                icon: Icons.group_outlined,
                                color: VexoraColors.primary,
                              ),
                              const SizedBox(width: 8),
                              _MetricTile(
                                label: 'Checked In',
                                value: '${currentTourn['checked_in']}',
                                icon: Icons.how_to_reg_outlined,
                                color: VexoraColors.success,
                              ),
                              const SizedBox(width: 8),
                              _MetricTile(
                                label: 'Waitlist',
                                value: '${currentTourn['waitlisted']}',
                                icon: Icons.hourglass_top_outlined,
                                color: VexoraColors.statePendingReview,
                              ),
                              const SizedBox(width: 8),
                              _MetricTile(
                                label: 'Incidents',
                                value: '${_incidents.length}',
                                icon: Icons.report_problem_outlined,
                                color: _incidents.isNotEmpty ? VexoraColors.stateDisputed : VexoraColors.textMutedDark,
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),

                          // Quick Bracket Engine Action Button
                          OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: VexoraColors.secondary,
                              side: const BorderSide(color: VexoraColors.secondary),
                              minimumSize: const Size.fromHeight(40),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            icon: const Icon(Icons.account_tree_outlined, size: 18),
                            label: const Text('Open Bracket & Match Engine'),
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => BracketScreen(
                                    tournamentId: currentTourn['id'],
                                    tournamentTitle: currentTourn['title'],
                                    format: currentTourn['format'] ?? 'KNOCKOUT',
                                  ),
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverPersistentHeader(
              pinned: true,
              delegate: _TabBarHeaderDelegate(
                TabBar(
                  controller: _tabController,
                  indicatorColor: VexoraColors.secondary,
                  labelColor: VexoraColors.secondary,
                  unselectedLabelColor: VexoraColors.textSecondaryDark,
                  labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  tabs: const [
                    Tab(icon: Icon(Icons.checklist_rounded, size: 18), text: 'Checklist'),
                    Tab(icon: Icon(Icons.campaign_outlined, size: 18), text: 'Announce'),
                    Tab(icon: Icon(Icons.warning_amber_rounded, size: 18), text: 'Incidents'),
                    Tab(icon: Icon(Icons.people_alt_outlined, size: 18), text: 'Roster'),
                  ],
                ),
              ),
            ),
          ],
          body: TabBarView(
            controller: _tabController,
            children: [
              // TAB 1: Match-Day Checklist (Section 43)
              _buildChecklistTab(),

              // TAB 2: Announcements Channel
              _buildAnnouncementsTab(),

              // TAB 3: Incident Log
              _buildIncidentsTab(),

              // TAB 4: Participant Roster & Check-In
              _buildRosterTab(currentTourn),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChecklistTab() {
    final completedCount = _checklistItems.where((i) => i['completed'] == true).length;
    final total = _checklistItems.length;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Match-Day Protocol (Section 43)',
              style: TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 15),
            ),
            Text(
              '$completedCount of $total Complete',
              style: const TextStyle(color: VexoraColors.secondary, fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ],
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(
          value: total > 0 ? completedCount / total : 0,
          backgroundColor: VexoraColors.surfaceDark,
          color: VexoraColors.secondary,
          borderRadius: BorderRadius.circular(4),
          minHeight: 6,
        ),
        const SizedBox(height: 16),
        ...List.generate(_checklistItems.length, (idx) {
          final item = _checklistItems[idx];
          final isDone = item['completed'] == true;
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              color: VexoraColors.surfaceElevatedDark,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isDone ? VexoraColors.secondary.withValues(alpha: 0.4) : VexoraColors.borderDark,
              ),
            ),
            child: CheckboxListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              value: isDone,
              activeColor: VexoraColors.secondary,
              checkColor: Colors.white,
              title: Text(
                item['title'],
                style: TextStyle(
                  color: isDone ? Colors.white : VexoraColors.textPrimaryDark,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  decoration: isDone ? TextDecoration.lineThrough : null,
                  decorationColor: Colors.white54,
                ),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  Text(item['subtitle'], style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12)),
                  if (item['completed_at'] != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Completed at: ${item['completed_at']}',
                      style: const TextStyle(color: VexoraColors.secondary, fontSize: 11, fontStyle: FontStyle.italic),
                    ),
                  ],
                ],
              ),
              onChanged: (val) {
                setState(() {
                  _checklistItems[idx]['completed'] = val ?? false;
                  _checklistItems[idx]['completed_at'] = val == true ? 'Just now' : null;
                });
              },
            ),
          );
        }),
      ],
    );
  }

  Widget _buildAnnouncementsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Participant Announcements',
              style: TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 15),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: VexoraColors.secondary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              icon: const Icon(Icons.campaign, size: 16),
              label: const Text('Broadcast'),
              onPressed: _showNewAnnouncementDialog,
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_announcements.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text(
                'No announcements yet. Broadcast details to participants.',
                style: TextStyle(color: VexoraColors.textSecondaryDark),
              ),
            ),
          )
        else
          ..._announcements.map((ann) {
            final isPinned = ann['is_pinned'] == true;
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceElevatedDark,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isPinned ? VexoraColors.accent.withValues(alpha: 0.6) : VexoraColors.borderDark,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (isPinned)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: VexoraColors.accent.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.push_pin, size: 11, color: VexoraColors.accent),
                              SizedBox(width: 4),
                              Text('PINNED', style: TextStyle(color: VexoraColors.accent, fontSize: 10, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      Text(ann['time'], style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 11)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    ann['title'],
                    style: const TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Text(ann['content'], style: const TextStyle(color: Colors.white70, fontSize: 13)),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildIncidentsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Tournament Incident Log',
              style: TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 15),
            ),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: VexoraColors.stateDisputed,
                side: const BorderSide(color: VexoraColors.stateDisputed),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              icon: const Icon(Icons.add_alert_outlined, size: 16),
              label: const Text('Log Incident'),
              onPressed: _showLogIncidentDialog,
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_incidents.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text(
                'Zero active incidents. Tournament operating normally.',
                style: TextStyle(color: VexoraColors.textSecondaryDark),
              ),
            ),
          )
        else
          ..._incidents.map((inc) {
            final sevColor = _getSeverityColor(inc['severity']);
            final isResolved = inc['status'] == 'RESOLVED';
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceElevatedDark,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: sevColor.withValues(alpha: 0.5)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: sevColor.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              inc['type'],
                              style: TextStyle(color: sevColor, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text('Severity: ${inc['severity']}', style: TextStyle(color: sevColor, fontSize: 11)),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: isResolved ? VexoraColors.success.withValues(alpha: 0.2) : VexoraColors.statePendingReview.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          inc['status'],
                          style: TextStyle(
                            color: isResolved ? VexoraColors.success : VexoraColors.statePendingReview,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(inc['description'], style: const TextStyle(color: Colors.white, fontSize: 13)),
                  if (inc['resolution'] != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: VexoraColors.surfaceDark,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.check_circle_outline, size: 14, color: VexoraColors.success),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Resolution: ${inc['resolution']}',
                              style: const TextStyle(color: Colors.white70, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildRosterTab(Map<String, dynamic> tourn) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Participant Roster',
              style: TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 15),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: VexoraColors.surfaceDark,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text('Roster Locked at Check-In', style: TextStyle(color: VexoraColors.accent, fontSize: 11)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Roster entries
        ...List.generate(4, (i) {
          final isCheckedIn = i < 3;
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: VexoraColors.surfaceElevatedDark,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: VexoraColors.borderDark),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: VexoraColors.secondary.withValues(alpha: 0.2),
                      child: Text('T${i + 1}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Squad Omega #${i + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                        const SizedBox(height: 2),
                        Text('Slot #${i + 1} • In-Game UID Verified', style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 11)),
                      ],
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isCheckedIn ? VexoraColors.success.withValues(alpha: 0.15) : VexoraColors.statePendingReview.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    isCheckedIn ? 'CHECKED IN' : 'CONFIRMED',
                    style: TextStyle(
                      color: isCheckedIn ? VexoraColors.success : VexoraColors.statePendingReview,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _MetricTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: VexoraColors.surfaceDark,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: VexoraColors.borderDark),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 10), maxLines: 1),
          ],
        ),
      ),
    );
  }
}

class _TabBarHeaderDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;

  _TabBarHeaderDelegate(this.tabBar);

  @override
  double get minExtent => tabBar.preferredSize.height;

  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: VexoraColors.bgDark,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_TabBarHeaderDelegate oldDelegate) => false;
}
