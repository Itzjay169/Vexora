import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/vexora_theme.dart';

/// Phase 13: Teams, Rosters & Transfer Log Mobile Screen
///
/// Implements:
///   - Team list with roles and capacity
///   - Pending invites with accept/decline
///   - Team creation flow
///   - Team detail view with active roster, invite flow, and transfer log
class TeamsScreen extends ConsumerStatefulWidget {
  const TeamsScreen({super.key});

  @override
  ConsumerState<TeamsScreen> createState() => _TeamsScreenState();
}

class _TeamsScreenState extends ConsumerState<TeamsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Mock initial state for UI presentation
  final List<Map<String, dynamic>> _myTeams = [
    {
      'id': 'team_01',
      'name': 'Vexora Elite',
      'tag': 'VEX',
      'game': 'Battlegrounds Mobile India',
      'game_slug': 'bgmi',
      'role': 'OWNER',
      'roster_count': 5,
      'max_roster_size': 6,
      'region': 'IND',
      'transfer_window_open': true,
      'members': [
        {'username': 'JayKing', 'role': 'OWNER', 'jersey': 7, 'joined': '2026-09-01'},
        {'username': 'ShadowStrike', 'role': 'CAPTAIN', 'jersey': 10, 'joined': '2026-09-02'},
        {'username': 'ViperX', 'role': 'PLAYER', 'jersey': 17, 'joined': '2026-09-05'},
        {'username': 'PhantomSniper', 'role': 'PLAYER', 'jersey': 99, 'joined': '2026-09-08'},
        {'username': 'RogueOne', 'role': 'SUBSTITUTE', 'jersey': 23, 'joined': '2026-09-15'},
      ],
      'transfer_log': [
        {'action': 'TEAM_CREATED', 'username': 'JayKing', 'role': 'OWNER', 'date': '2026-09-01'},
        {'action': 'JOINED', 'username': 'ShadowStrike', 'role': 'CAPTAIN', 'date': '2026-09-02'},
        {'action': 'JOINED', 'username': 'ViperX', 'role': 'PLAYER', 'date': '2026-09-05'},
        {'action': 'JOINED', 'username': 'PhantomSniper', 'role': 'PLAYER', 'date': '2026-09-08'},
        {'action': 'JOINED', 'username': 'RogueOne', 'role': 'SUBSTITUTE', 'date': '2026-09-15'},
      ],
    },
  ];

  final List<Map<String, dynamic>> _pendingInvites = [
    {
      'id': 'inv_01',
      'team_name': 'Alpha Squad',
      'team_tag': 'ALPH',
      'game': 'Call of Duty: Mobile',
      'inviter': 'GhostCaptain',
      'role_offered': 'PLAYER',
      'expires_in': '4 days',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
        title: const Text(
          'Competitive Teams',
          style: TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: VexoraColors.primary,
          labelColor: VexoraColors.primary,
          unselectedLabelColor: VexoraColors.textSecondaryDark,
          tabs: [
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.groups_rounded, size: 18),
                  const SizedBox(width: 8),
                  Text('My Teams (${_myTeams.length})'),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.mail_outline_rounded, size: 18),
                  const SizedBox(width: 8),
                  Text('Invites (${_pendingInvites.length})'),
                ],
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: VexoraColors.primary,
        onPressed: _openCreateTeamDialog,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Create Team', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildMyTeamsTab(),
          _buildInvitesTab(),
        ],
      ),
    );
  }

  // ─── My Teams Tab ──────────────────────────────────────────────────────────

  Widget _buildMyTeamsTab() {
    if (_myTeams.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.group_off_rounded, size: 64, color: VexoraColors.textMutedDark),
            const SizedBox(height: 16),
            const Text(
              'No Active Teams',
              style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Create a team or accept an invite to compete together.',
              style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 14),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(backgroundColor: VexoraColors.primary),
              onPressed: _openCreateTeamDialog,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('Create Team', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _myTeams.length,
      itemBuilder: (context, index) {
        final team = _myTeams[index];
        return _buildTeamCard(team);
      },
    );
  }

  Widget _buildTeamCard(Map<String, dynamic> team) {
    return Card(
      color: VexoraColors.surfaceElevatedDark,
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(
        side: const BorderSide(color: VexoraColors.borderDark),
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _openTeamDetailScreen(team),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [VexoraColors.primary, VexoraColors.secondary],
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      team['tag'],
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          team['name'],
                          style: const TextStyle(
                            color: VexoraColors.textPrimaryDark,
                            fontWeight: FontWeight.bold,
                            fontSize: 17,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          team['game'],
                          style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  _buildRoleChip(team['role']),
                ],
              ),
              const Divider(color: VexoraColors.borderDark, height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.people_outline_rounded, size: 16, color: VexoraColors.textMutedDark),
                      const SizedBox(width: 6),
                      Text(
                        'Roster: ${team['roster_count']}/${team['max_roster_size']}',
                        style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 13),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      const Icon(Icons.public_rounded, size: 16, color: VexoraColors.textMutedDark),
                      const SizedBox(width: 6),
                      Text(
                        team['region'] ?? 'Global',
                        style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 13),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: team['transfer_window_open']
                          ? VexoraColors.stateRegistrationOpen.withValues(alpha: 0.15)
                          : VexoraColors.stateDisputed.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      team['transfer_window_open'] ? 'Window Open' : 'Roster Locked',
                      style: TextStyle(
                        color: team['transfer_window_open']
                            ? VexoraColors.stateRegistrationOpen
                            : VexoraColors.stateDisputed,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Invites Tab ───────────────────────────────────────────────────────────

  Widget _buildInvitesTab() {
    if (_pendingInvites.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.mark_email_read_rounded, size: 64, color: VexoraColors.textMutedDark),
            SizedBox(height: 16),
            Text(
              'No Pending Invitations',
              style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Text(
              'When a team captain invites you, it will appear here.',
              style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 14),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _pendingInvites.length,
      itemBuilder: (context, index) {
        final inv = _pendingInvites[index];
        return Card(
          color: VexoraColors.surfaceElevatedDark,
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            side: const BorderSide(color: VexoraColors.borderDark),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '[${inv['team_tag']}] ${inv['team_name']}',
                      style: const TextStyle(
                        color: VexoraColors.textPrimaryDark,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    _buildRoleChip(inv['role_offered']),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Game: ${inv['game']} • Invited by @${inv['inviter']}',
                  style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 13),
                ),
                const SizedBox(height: 4),
                Text(
                  'Expires in ${inv['expires_in']}',
                  style: const TextStyle(color: VexoraColors.statePendingReview, fontSize: 12),
                ),
                const Divider(color: VexoraColors.borderDark, height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: VexoraColors.stateDisputed,
                        side: const BorderSide(color: VexoraColors.stateDisputed),
                      ),
                      onPressed: () {
                        setState(() {
                          _pendingInvites.removeAt(index);
                        });
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Invitation declined')),
                        );
                      },
                      child: const Text('Decline'),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: VexoraColors.stateRegistrationOpen,
                      ),
                      onPressed: () {
                        setState(() {
                          final accepted = _pendingInvites.removeAt(index);
                          _myTeams.add({
                            'id': 'team_accepted_${DateTime.now().millisecondsSinceEpoch}',
                            'name': accepted['team_name'],
                            'tag': accepted['team_tag'],
                            'game': accepted['game'],
                            'game_slug': 'codm',
                            'role': accepted['role_offered'],
                            'roster_count': 4,
                            'max_roster_size': 5,
                            'region': 'IND',
                            'transfer_window_open': true,
                            'members': [
                              {'username': 'GhostCaptain', 'role': 'CAPTAIN', 'jersey': 1, 'joined': '2026-09-01'},
                              {'username': 'CurrentPlayer', 'role': accepted['role_offered'], 'jersey': 9, 'joined': 'Today'},
                            ],
                            'transfer_log': [
                              {'action': 'JOINED', 'username': 'CurrentPlayer', 'role': accepted['role_offered'], 'date': 'Today'},
                            ],
                          });
                        });
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Joined team successfully! Roster updated.')),
                        );
                      },
                      child: const Text('Accept', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // ─── Create Team Dialog ────────────────────────────────────────────────────

  void _openCreateTeamDialog() {
    final formKey = GlobalKey<FormState>();
    final nameCtrl = TextEditingController();
    final tagCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String selectedGame = 'bgmi';
    int maxRoster = 6;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: VexoraColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Create New Team',
                        style: TextStyle(
                          color: VexoraColors.textPrimaryDark,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: VexoraColors.textSecondaryDark),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Per Section 6: Duplicate competitive identities are prohibited. You can only belong to one active team per game title.',
                    style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 12),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: nameCtrl,
                    style: const TextStyle(color: VexoraColors.textPrimaryDark),
                    decoration: const InputDecoration(
                      labelText: 'Team Name (e.g. Vexora Elite)',
                      border: OutlineInputBorder(),
                    ),
                    validator: (val) {
                      if (val == null || val.length < 2) return 'Must be at least 2 characters';
                      if (val.length > 50) return 'Max 50 characters';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: tagCtrl,
                    style: const TextStyle(color: VexoraColors.textPrimaryDark),
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'Team Tag (e.g. VEX, 2-10 letters/numbers)',
                      border: OutlineInputBorder(),
                    ),
                    validator: (val) {
                      if (val == null || val.length < 2) return 'Must be 2-10 uppercase chars';
                      if (!RegExp(r'^[A-Z0-9]+$').hasMatch(val)) return 'Uppercase alphanumeric only';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    // ignore: deprecated_member_use
                    value: selectedGame,
                    dropdownColor: VexoraColors.surfaceElevatedDark,
                    style: const TextStyle(color: VexoraColors.textPrimaryDark),
                    decoration: const InputDecoration(
                      labelText: 'Game Title',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'bgmi', child: Text('Battlegrounds Mobile India')),
                      DropdownMenuItem(value: 'freefire', child: Text('Garena Free Fire MAX')),
                      DropdownMenuItem(value: 'codm', child: Text('Call of Duty: Mobile')),
                    ],
                    onChanged: (val) {
                      if (val != null) setSheetState(() => selectedGame = val);
                    },
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Text(
                        'Max Roster Size:',
                        style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 14),
                      ),
                      const SizedBox(width: 12),
                      ChoiceChip(
                        label: const Text('4'),
                        selected: maxRoster == 4,
                        onSelected: (s) => setSheetState(() => maxRoster = 4),
                      ),
                      const SizedBox(width: 8),
                      ChoiceChip(
                        label: const Text('6'),
                        selected: maxRoster == 6,
                        onSelected: (s) => setSheetState(() => maxRoster = 6),
                      ),
                      const SizedBox(width: 8),
                      ChoiceChip(
                        label: const Text('10'),
                        selected: maxRoster == 10,
                        onSelected: (s) => setSheetState(() => maxRoster = 10),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: descCtrl,
                    maxLines: 2,
                    style: const TextStyle(color: VexoraColors.textPrimaryDark),
                    decoration: const InputDecoration(
                      labelText: 'Bio / Goals (Optional)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: VexoraColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: () {
                        if (formKey.currentState!.validate()) {
                          final newTeam = {
                            'id': 'team_${DateTime.now().millisecondsSinceEpoch}',
                            'name': nameCtrl.text.trim(),
                            'tag': tagCtrl.text.trim().toUpperCase(),
                            'game': selectedGame == 'bgmi'
                                ? 'Battlegrounds Mobile India'
                                : selectedGame == 'freefire'
                                    ? 'Garena Free Fire MAX'
                                    : 'Call of Duty: Mobile',
                            'game_slug': selectedGame,
                            'role': 'OWNER',
                            'roster_count': 1,
                            'max_roster_size': maxRoster,
                            'region': 'IND',
                            'transfer_window_open': true,
                            'members': [
                              {
                                'username': 'You (Owner)',
                                'role': 'OWNER',
                                'jersey': 1,
                                'joined': 'Today',
                              }
                            ],
                            'transfer_log': [
                              {
                                'action': 'TEAM_CREATED',
                                'username': 'You (Owner)',
                                'role': 'OWNER',
                                'date': 'Today',
                              }
                            ],
                          };

                          setState(() {
                            _myTeams.add(newTeam);
                          });

                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Team "${newTeam['name']}" created with you as OWNER!')),
                          );
                        }
                      },
                      child: const Text('Create Team', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ─── Team Detail Screen ────────────────────────────────────────────────────

  void _openTeamDetailScreen(Map<String, dynamic> team) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => _TeamDetailView(
          team: team,
          onTeamUpdated: () => setState(() {}),
        ),
      ),
    );
  }

  Widget _buildRoleChip(String role) {
    Color bg;
    Color fg;

    switch (role) {
      case 'OWNER':
        bg = VexoraColors.primary.withValues(alpha: 0.2);
        fg = VexoraColors.primary;
        break;
      case 'CAPTAIN':
        bg = VexoraColors.secondary.withValues(alpha: 0.2);
        fg = VexoraColors.secondary;
        break;
      case 'MANAGER':
        bg = VexoraColors.accent.withValues(alpha: 0.2);
        fg = VexoraColors.accent;
        break;
      case 'PLAYER':
        bg = VexoraColors.stateRegistrationOpen.withValues(alpha: 0.2);
        fg = VexoraColors.stateRegistrationOpen;
        break;
      case 'SUBSTITUTE':
      default:
        bg = VexoraColors.textMutedDark.withValues(alpha: 0.2);
        fg = VexoraColors.textSecondaryDark;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        role,
        style: TextStyle(color: fg, fontWeight: FontWeight.bold, fontSize: 11),
      ),
    );
  }
}

// ─── Team Detail View ────────────────────────────────────────────────────────

class _TeamDetailView extends StatefulWidget {
  final Map<String, dynamic> team;
  final VoidCallback onTeamUpdated;

  const _TeamDetailView({
    required this.team,
    required this.onTeamUpdated,
  });

  @override
  State<_TeamDetailView> createState() => _TeamDetailViewState();
}

class _TeamDetailViewState extends State<_TeamDetailView> with SingleTickerProviderStateMixin {
  late TabController _detailTabController;

  @override
  void initState() {
    super.initState();
    _detailTabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _detailTabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final team = widget.team;
    final isOwnerOrCaptain = ['OWNER', 'CAPTAIN', 'MANAGER'].contains(team['role']);

    return Scaffold(
      backgroundColor: VexoraColors.bgDark,
      appBar: AppBar(
        backgroundColor: VexoraColors.surfaceDark,
        title: Text('[${team['tag']}] ${team['name']}'),
        bottom: TabBar(
          controller: _detailTabController,
          indicatorColor: VexoraColors.primary,
          labelColor: VexoraColors.primary,
          unselectedLabelColor: VexoraColors.textSecondaryDark,
          tabs: const [
            Tab(text: 'Roster & Members'),
            Tab(text: 'Transfer Log'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _detailTabController,
        children: [
          _buildRosterTab(isOwnerOrCaptain),
          _buildTransferLogTab(),
        ],
      ),
    );
  }

  Widget _buildRosterTab(bool canManage) {
    final team = widget.team;
    final members = (team['members'] as List<dynamic>?) ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Roster stats card
        Card(
          color: VexoraColors.surfaceElevatedDark,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildRosterStat('Roster', '${members.length}/${team['max_roster_size']}'),
                _buildRosterStat('Game', team['game_slug']?.toUpperCase() ?? 'BGMI'),
                _buildRosterStat('Region', team['region'] ?? 'IND'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Action button for management
        if (canManage) ...[
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: VexoraColors.primary,
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
            onPressed: _openInvitePlayerDialog,
            icon: const Icon(Icons.person_add_rounded, color: Colors.white),
            label: const Text('Invite Player to Roster', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(height: 16),
        ],

        const Text(
          'Active Lineup',
          style: TextStyle(
            color: VexoraColors.textPrimaryDark,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 8),

        ...members.map((m) => Card(
              color: VexoraColors.surfaceElevatedDark,
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: VexoraColors.surfaceHighlightDark,
                  child: Text(
                    '#${m['jersey'] ?? '-'}',
                    style: const TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold),
                  ),
                ),
                title: Text(
                  m['username'] ?? 'Player',
                  style: const TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  'Joined ${m['joined'] ?? 'Recently'}',
                  style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12),
                ),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: VexoraColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    m['role'] ?? 'PLAYER',
                    style: const TextStyle(color: VexoraColors.primary, fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                ),
              ),
            )),
      ],
    );
  }

  Widget _buildTransferLogTab() {
    final transferLog = (widget.team['transfer_log'] as List<dynamic>?) ?? [];

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: transferLog.length,
      itemBuilder: (context, index) {
        final entry = transferLog[index];
        return Card(
          color: VexoraColors.surfaceElevatedDark,
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: Icon(
              entry['action'] == 'TEAM_CREATED'
                  ? Icons.flag_rounded
                  : entry['action'] == 'JOINED'
                      ? Icons.person_add_alt_1_rounded
                      : Icons.swap_horiz_rounded,
              color: VexoraColors.primary,
            ),
            title: Text(
              '${entry['username']} — ${entry['action']}',
              style: const TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.w600, fontSize: 14),
            ),
            subtitle: Text(
              'Role: ${entry['role']} • ${entry['date']}',
              style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12),
            ),
            trailing: const Icon(Icons.verified_outlined, size: 16, color: VexoraColors.trustHashTick),
          ),
        );
      },
    );
  }

  Widget _buildRosterStat(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12)),
      ],
    );
  }

  void _openInvitePlayerDialog() {
    final usernameCtrl = TextEditingController();
    String roleOffered = 'PLAYER';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: VexoraColors.surfaceDark,
          title: const Text('Invite Player', style: TextStyle(color: VexoraColors.textPrimaryDark)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Consent-based: The player must explicitly accept the invitation before being added to the active roster.',
                style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 12),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: usernameCtrl,
                style: const TextStyle(color: VexoraColors.textPrimaryDark),
                decoration: const InputDecoration(
                  labelText: 'Player Username or ID',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                // ignore: deprecated_member_use
                value: roleOffered,
                dropdownColor: VexoraColors.surfaceElevatedDark,
                style: const TextStyle(color: VexoraColors.textPrimaryDark),
                decoration: const InputDecoration(labelText: 'Role Offered', border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'PLAYER', child: Text('PLAYER')),
                  DropdownMenuItem(value: 'SUBSTITUTE', child: Text('SUBSTITUTE')),
                  DropdownMenuItem(value: 'MANAGER', child: Text('MANAGER')),
                ],
                onChanged: (val) {
                  if (val != null) setDialogState(() => roleOffered = val);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: VexoraColors.textSecondaryDark)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: VexoraColors.primary),
              onPressed: () {
                final username = usernameCtrl.text.trim();
                if (username.isNotEmpty) {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Invitation sent to @$username as $roleOffered')),
                  );
                }
              },
              child: const Text('Send Invite', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}
