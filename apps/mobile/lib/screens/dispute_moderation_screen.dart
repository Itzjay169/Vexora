import 'package:flutter/material.dart';
import '../theme/vexora_theme.dart';

/// Phase 23: Dispute Adjudication, Moderation & Sanctions Screen
/// Blueprint Ref: Sections 11, 19, 26, 39 (Phase 5)
///
/// Features:
/// - Case ID, Settlement Freeze banner & SLA countdown
/// - Evidence viewer with SHA-256 seal integrity
/// - Moderator Ruling breakdown citing official Policy Clause
/// - 48-hour Appeal window countdown and submission workflow
/// - Sanction Ladder indicators
class DisputeModerationScreen extends StatefulWidget {
  final Map<String, dynamic>? initialDispute;

  const DisputeModerationScreen({super.key, this.initialDispute});

  @override
  State<DisputeModerationScreen> createState() => _DisputeModerationScreenState();
}

class _DisputeModerationScreenState extends State<DisputeModerationScreen> {
  // Mock Dispute Case State
  String _caseId = 'DSP-20261015-8E4B';
  String _matchTitle = 'Match #4 — BGMI Ignition Cup Semi-Finals';
  String _status = 'UNDER_REVIEW'; // OPEN, UNDER_REVIEW, RESOLVED_UPHELD, DISMISSED
  String _reason = 'WRONG_SCORE';
  String _description = 'Opponent entered 4 kills instead of 2. Final scoreboard screenshot proves our squad eliminated them at placement #3.';
  bool _settlementFrozen = true;
  String _slaRemaining = '18 hours 24 mins';
  String _policyClause = 'Clause 11.3: Evidence Ingress Verification';
  String? _rulingText;
  String? _appealStatus; // NONE, PENDING_APPEAL, APPEAL_UPHELD, APPEAL_REJECTED
  bool _appealWindowActive = true;

  final List<String> _evidenceHashes = [
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    '7d793037a0760186574b0282f2f435e7b1e50774690f45045323a70ff4b1f458',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialDispute != null) {
      _caseId = widget.initialDispute!['case_id'] ?? _caseId;
      _matchTitle = widget.initialDispute!['match_title'] ?? _matchTitle;
      _status = widget.initialDispute!['status'] ?? _status;
      _reason = widget.initialDispute!['reason'] ?? _reason;
      _description = widget.initialDispute!['description'] ?? _description;
      _settlementFrozen = widget.initialDispute!['settlement_frozen'] ?? true;
      _rulingText = widget.initialDispute!['ruling'];
      _appealStatus = widget.initialDispute!['appeal_status'];
    }
  }

  void _showAppealBottomSheet() {
    final appealController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: VexoraColors.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            top: 24,
            left: 20,
            right: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Submit Formal Appeal',
                    style: TextStyle(
                      color: VexoraColors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: VexoraColors.accentBlue.withAlpha(40),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text(
                      '48h Window Active',
                      style: TextStyle(color: VexoraColors.accentBlue, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Provide additional verifiable evidence or clarify policy misapplication. Appeals are reviewed by an independent second moderator (Maker-Checker).',
                style: TextStyle(color: VexoraColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: appealController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Appeal Statement (Min 10 characters)',
                  hintText: 'State why the initial ruling should be reconsidered...',
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: VexoraColors.accentBlue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () {
                    if (appealController.text.trim().length >= 10) {
                      setState(() {
                        _appealStatus = 'PENDING_APPEAL';
                      });
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Appeal submitted for Maker-Checker secondary adjudication.'),
                          backgroundColor: VexoraColors.accentBlue,
                        ),
                      );
                    }
                  },
                  child: const Text('Submit Appeal to Second Reviewer', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: VexoraColors.bgDeep,
      appBar: AppBar(
        title: Text('Case: $_caseId'),
        backgroundColor: VexoraColors.surfaceCard,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.gavel),
            tooltip: 'Sanction Ladder Policy',
            onPressed: () => _showSanctionLadderSheet(context),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_settlementFrozen) _buildSettlementFreezeBanner(),
            const SizedBox(height: 16),
            _buildCaseOverviewCard(),
            const SizedBox(height: 16),
            _buildEvidenceLedgerCard(),
            const SizedBox(height: 16),
            _buildModeratorRulingCard(),
            const SizedBox(height: 16),
            _buildAppealStatusCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildSettlementFreezeBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.red.shade900.withAlpha(60),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red.shade400),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock, color: Colors.redAccent, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'SETTLEMENT FROZEN',
                  style: TextStyle(
                    color: Colors.redAccent,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Automated escrow and prize distributions are locked until this dispute concludes with an auditable ruling.',
                  style: TextStyle(color: Colors.white.withAlpha(220), fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCaseOverviewCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: VexoraColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _matchTitle,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: VexoraColors.textPrimary),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.orange.withAlpha(40),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _status,
                  style: const TextStyle(color: Colors.orange, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildMetricChip('Reason', _reason, VexoraColors.accentBlue),
              const SizedBox(width: 12),
              _buildMetricChip('SLA Timer', _slaRemaining, Colors.amber),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _description,
            style: const TextStyle(color: VexoraColors.textSecondary, fontSize: 13, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricChip(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(50)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildEvidenceLedgerCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: VexoraColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.fingerprint, color: VexoraColors.accentBlue, size: 18),
              SizedBox(width: 8),
              Text(
                'Evidence Ledger (Cryptographic Hashes)',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: VexoraColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ..._evidenceHashes.map(
            (hash) => Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: VexoraColors.bgDeep,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_outline, color: VexoraColors.success, size: 14),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      hash,
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 10, color: VexoraColors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModeratorRulingCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: VexoraColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.balance, color: Colors.purpleAccent, size: 18),
              SizedBox(width: 8),
              Text(
                'Moderator Adjudication & Policy Citation',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: VexoraColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.purple.withAlpha(30),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              'Cited Policy: $_policyClause',
              style: const TextStyle(color: Colors.purpleAccent, fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _rulingText ?? 'Case is currently under active investigation by assigned moderator staff.',
            style: const TextStyle(color: VexoraColors.textSecondary, fontSize: 13, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _buildAppealStatusCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: VexoraColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '48-Hour Appeal Status',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: VexoraColors.textPrimary),
              ),
              if (_appealStatus != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.teal.withAlpha(40),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _appealStatus!,
                    style: const TextStyle(color: Colors.tealAccent, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Both sides have 48 hours to appeal initial rulings. The original moderator cannot rule on the appeal (Maker-Checker invariant).',
            style: TextStyle(color: VexoraColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 14),
          if (_appealStatus == null && _appealWindowActive)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.rate_review, size: 16),
                label: const Text('Lodge Appeal (Maker-Checker)'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: VexoraColors.accentBlue,
                  side: const BorderSide(color: VexoraColors.accentBlue),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: _showAppealBottomSheet,
              ),
            )
          else if (_appealStatus == 'PENDING_APPEAL')
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.teal.withAlpha(20),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.hourglass_top, color: Colors.tealAccent, size: 16),
                  SizedBox(width: 8),
                  Text('Appeal is under secondary Maker-Checker review.', style: TextStyle(color: Colors.tealAccent, fontSize: 12)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  void _showSanctionLadderSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: VexoraColors.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text(
                'Vexora Sanction Ladder Policy',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: VexoraColors.textPrimary),
              ),
              SizedBox(height: 12),
              Text(
                '1. WARNING: Official recorded notice on profile for minor infractions (e.g. late check-in).\n'
                '2. RESTRICTION: In-game chat mute, hosting freeze, or temporary tournament entry block.\n'
                '3. SUSPENSION: Time-boxed account lockout (3 to 30 days) with complete tournament forfeiture.\n'
                '4. PERMANENT BAN: Permanent platform ban for confirmed hardware cheats, match-fixing, or fraud.\n\n'
                'Every sanction must cite an official policy clause and actor ID in the tamper-evident audit journal.',
                style: TextStyle(fontSize: 13, color: VexoraColors.textSecondary, height: 1.5),
              ),
            ],
          ),
        );
      },
    );
  }
}
