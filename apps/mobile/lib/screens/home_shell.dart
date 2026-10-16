import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/vexora_theme.dart';
import '../l10n/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../config/flavour.dart';
import 'profile_screen.dart';
import 'search_screen.dart';
import 'tournament_discovery_screen.dart';
import 'organiser_dashboard_screen.dart';
import 'tournament_wizard_screen.dart';
import 'result_submission_screen.dart';
import 'leaderboard_screen.dart';
import 'organiser_ratings_screen.dart';
import 'wallet_screen.dart';

/// Main Mobile Application Shell
/// Adapts dynamically to AppFlavour:
///   - Player Flavour: Home (Explore/Lobby), Tournaments, My Matches, Profile
///   - Organiser Flavour: Dashboard, Create Tournament, Verify/Disputes, Profile
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final currentFlavour = ref.watch(flavourProvider);
    final isPlayer = currentFlavour == AppFlavour.player;
    final isOrganiser = currentFlavour == AppFlavour.organiser;

    final List<Widget> pages = isPlayer
        ? [
            _PlayerHomeScreen(onExploreTournaments: () => setState(() => _currentIndex = 1)),
            const TournamentDiscoveryScreen(),
            const _PlayerMatchesScreen(),
            const ProfileScreen(),
          ]
        : [
            const OrganiserDashboardScreen(),
            const _OrganiserCreateScreen(),
            const _OrganiserResultsScreen(),
            const ProfileScreen(),
          ];

    final List<BottomNavigationBarItem> navItems = isPlayer
        ? const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home_rounded),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.emoji_events_outlined),
              activeIcon: Icon(Icons.emoji_events_rounded),
              label: 'Tournaments',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.sports_esports_outlined),
              activeIcon: Icon(Icons.sports_esports_rounded),
              label: 'Matches',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline_rounded),
              activeIcon: Icon(Icons.person_rounded),
              label: 'Profile',
            ),
          ]
        : const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard_rounded),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.add_circle_outline_rounded),
              activeIcon: Icon(Icons.add_circle_rounded),
              label: 'Create',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.verified_outlined),
              activeIcon: Icon(Icons.verified_rounded),
              label: 'Verify',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline_rounded),
              activeIcon: Icon(Icons.person_rounded),
              label: 'Profile',
            ),
          ];

    return Scaffold(
      backgroundColor: VexoraColors.bgDark,
      appBar: AppBar(
        backgroundColor: VexoraColors.surfaceDark,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isOrganiser ? VexoraColors.secondary : VexoraColors.primary,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'VEXORA',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: (isOrganiser ? VexoraColors.secondary : VexoraColors.primary).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: (isOrganiser ? VexoraColors.secondary : VexoraColors.primary).withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                isOrganiser ? 'ORGANISER' : 'PLAYER',
                style: TextStyle(
                  color: isOrganiser ? VexoraColors.secondary : VexoraColors.primary,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              ),
            ),
          ],
        ),
        actions: [
          // Language selector button
          PopupMenuButton<String>(
            icon: const Icon(Icons.language_rounded, color: VexoraColors.textSecondaryDark),
            tooltip: l10n.selectLanguage,
            color: VexoraColors.surfaceElevatedDark,
            onSelected: (code) {
              ref.read(localeProvider.notifier).state = Locale(code);
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'en',
                child: Text('English (EN)', style: TextStyle(color: VexoraColors.textPrimaryDark)),
              ),
              const PopupMenuItem(
                value: 'hi',
                child: Text('हिंदी (Hindi)', style: TextStyle(color: VexoraColors.textPrimaryDark)),
              ),
              const PopupMenuItem(
                value: 'or',
                child: Text('ଓଡ଼ିଆ (Odia)', style: TextStyle(color: VexoraColors.textPrimaryDark)),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.leaderboard_rounded, color: VexoraColors.textSecondaryDark),
            tooltip: 'Leaderboards',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const LeaderboardScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.star_rate_rounded, color: VexoraColors.textSecondaryDark),
            tooltip: 'Reputation & Ratings',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => OrganiserRatingsScreen(
                    organiserId: 'org-default-01',
                    organiserName: 'Apex Esports Org',
                    isOrganiserViewer: isOrganiser,
                  ),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined, color: VexoraColors.textSecondaryDark),
            tooltip: 'Wallet & Ledger',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const WalletScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.search_rounded, color: VexoraColors.textSecondaryDark),
            tooltip: 'Search',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SearchScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded, color: VexoraColors.textSecondaryDark),
            tooltip: 'Notifications',
            onPressed: () {},
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex < pages.length ? _currentIndex : 0,
        children: pages,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(color: VexoraColors.borderDark, width: 1),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex < navItems.length ? _currentIndex : 0,
          onTap: (index) => setState(() => _currentIndex = index),
          type: BottomNavigationBarType.fixed,
          backgroundColor: VexoraColors.surfaceDark,
          selectedItemColor: isPlayer ? VexoraColors.primary : VexoraColors.secondary,
          unselectedItemColor: VexoraColors.textMutedDark,
          selectedFontSize: 12,
          unselectedFontSize: 11,
          items: navItems,
        ),
      ),
    );
  }
}

// ─── PLAYER VIEWS ─────────────────────────────────────────────────────────────

class _PlayerHomeScreen extends StatelessWidget {
  final VoidCallback onExploreTournaments;
  const _PlayerHomeScreen({required this.onExploreTournaments});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Guaranteed Trust Banner (Section 13 & 39: F2P Launch)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E1B4B), Color(0xFF311042)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: VexoraColors.primary.withValues(alpha: 0.4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.verified_user_rounded, color: VexoraColors.accent, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'ZERO PLATFORM COMMISSION • F2P LAUNCH',
                      style: TextStyle(
                        color: VexoraColors.accent,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.1,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  'Compete with Guaranteed Transparency',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Deterministic SHA-256 scoring, anti-smurf matchmaking, and automated prize disbursement escrow.',
                  style: TextStyle(
                    color: VexoraColors.textSecondaryDark,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 14),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: VexoraColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: onExploreTournaments,
                  child: const Text('Browse Tournaments'),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Active Games Selector
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Supported Games',
                style: TextStyle(
                  color: VexoraColors.textPrimaryDark,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                '3 Games Active',
                style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Row(
            children: [
              Expanded(child: _GameCard(name: 'BGMI', sub: 'Battle Royale', color: Color(0xFFF97316))),
              SizedBox(width: 10),
              Expanded(child: _GameCard(name: 'Free Fire', sub: 'MAX Squads', color: Color(0xFFEF4444))),
              SizedBox(width: 10),
              Expanded(child: _GameCard(name: 'CODM', sub: 'Multiplayer', color: Color(0xFF06B6D4))),
            ],
          ),

          const SizedBox(height: 24),

          // Live / Upcoming Tournaments Quick Peek
          const Text(
            'Featured Competitions',
            style: TextStyle(
              color: VexoraColors.textPrimaryDark,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          const _TournamentPreviewCard(
            title: 'Vexora Ignition Cup: Season 1',
            game: 'BGMI Squad',
            prizePool: '₹25,000 Pool',
            entryFee: 'FREE (₹0)',
            slots: '64/100 Teams',
            status: 'REGISTRATION_OPEN',
          ),
          const SizedBox(height: 10),
          const _TournamentPreviewCard(
            title: 'Apex Clash: Free Fire Solo Blitz',
            game: 'Free Fire MAX',
            prizePool: '₹10,000 Pool',
            entryFee: 'FREE (₹0)',
            slots: '48/48 (Full)',
            status: 'CHECK_IN',
          ),
        ],
      ),
    );
  }
}

class _PlayerMatchesScreen extends StatelessWidget {
  const _PlayerMatchesScreen();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'My Match Schedule',
          style: TextStyle(
            color: VexoraColors.textPrimaryDark,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Your active registrations, lobby credentials, and result submissions.',
          style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 13),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: VexoraColors.surfaceElevatedDark,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: VexoraColors.primary.withValues(alpha: 0.4)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: VexoraColors.stateCheckIn.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'CHECK-IN OPEN',
                      style: TextStyle(
                        color: VexoraColors.stateCheckIn,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const Text(
                    'Match #101-B',
                    style: TextStyle(
                      color: VexoraColors.textMutedDark,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                'Vexora Ignition Cup: Round of 32',
                style: TextStyle(
                  color: VexoraColors.textPrimaryDark,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Game: BGMI (Erangel) • Starts in: 25 mins',
                style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 13),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: VexoraColors.surfaceDark,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: VexoraColors.borderDark),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Lobby Credentials', style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12)),
                    Text('Unlocked at T-10m', style: TextStyle(color: VexoraColors.accent, fontSize: 12, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: VexoraColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.upload_file_outlined, size: 16),
                  label: const Text('Submit Match Result & Evidence', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const ResultSubmissionScreen(
                          matchId: 'match-101-b',
                          tournamentTitle: 'Vexora Ignition Cup: Round of 32',
                          gameName: 'BGMI (Battlegrounds Mobile India)',
                          registrationId: 'reg-my-team-101',
                          teamName: 'Team Soul',
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ─── ORGANISER VIEWS ──────────────────────────────────────────────────────────


class _OrganiserCreateScreen extends StatelessWidget {
  const _OrganiserCreateScreen();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.add_circle_outline_rounded, size: 48, color: VexoraColors.secondary),
            const SizedBox(height: 16),
            const Text(
              'Create Tournament',
              style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Deploy single-elimination or Swiss bracket tournaments with deterministic rulesets.',
              textAlign: TextAlign.center,
              style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 13),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: VexoraColors.secondary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const TournamentWizardScreen()),
                );
              },
              child: const Text('Start Tournament Wizard'),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrganiserResultsScreen extends StatelessWidget {
  const _OrganiserResultsScreen();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Disputes & Results Queue',
          style: TextStyle(
            color: VexoraColors.textPrimaryDark,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Review OCR/API scoreboard evidence, player disputes, and hash seals.',
          style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 13),
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: VexoraColors.surfaceElevatedDark,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: VexoraColors.stateDisputed.withValues(alpha: 0.4)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Dispute #DSP-992', style: TextStyle(color: VexoraColors.stateDisputed, fontWeight: FontWeight.bold)),
                  Text('T-12m ago', style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 12)),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Kill score discrepancy reported in BGMI Match #4',
                style: TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 14, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: VexoraColors.surfaceHighlightDark),
                onPressed: () {},
                child: const Text('Inspect Evidence Screenshots'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────

class _GameCard extends StatelessWidget {
  final String name;
  final String sub;
  final Color color;

  const _GameCard({required this.name, required this.sub, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceElevatedDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: VexoraColors.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(height: 8),
          Text(name, style: const TextStyle(color: VexoraColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 2),
          Text(sub, style: const TextStyle(color: VexoraColors.textMutedDark, fontSize: 10)),
        ],
      ),
    );
  }
}

class _TournamentPreviewCard extends StatelessWidget {
  final String title;
  final String game;
  final String prizePool;
  final String entryFee;
  final String slots;
  final String status;

  const _TournamentPreviewCard({
    required this.title,
    required this.game,
    required this.prizePool,
    required this.entryFee,
    required this.slots,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
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
              Text(game, style: const TextStyle(color: VexoraColors.accent, fontSize: 12, fontWeight: FontWeight.w600)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: VexoraColors.stateRegistrationOpen.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  status,
                  style: const TextStyle(color: VexoraColors.stateRegistrationOpen, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 15, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(prizePool, style: const TextStyle(color: VexoraColors.trustHashTick, fontWeight: FontWeight.bold, fontSize: 13)),
              Text(entryFee, style: const TextStyle(color: VexoraColors.primary, fontWeight: FontWeight.bold, fontSize: 13)),
              Text(slots, style: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }
}
