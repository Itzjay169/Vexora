import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/vexora_theme.dart';

/// Phase 19: Result Submission & Evidence Verification Screen
///
/// Features:
///   - 4-point guided evidence capture checklist (scoreboard, kills, room ID, UIDs)
///   - Combatant score entry (placement, kills, assists)
///   - SHA-256 ingress hash verification tag
///   - 15-minute post-match deadline countdown
///   - Dispute hold & settlement freeze alert banner
///   - Opponent maker-checker confirmation vs contest action
///
/// Source of Truth: Vexora Blueprint Sections 4, 11, 39, 47 (PHASE.md)
class ResultSubmissionScreen extends StatefulWidget {
  final String matchId;
  final String tournamentTitle;
  final String gameName;
  final String registrationId;
  final String teamName;
  final bool isReviewingOpponent;
  final Map<String, dynamic>? existingSubmission;

  const ResultSubmissionScreen({
    super.key,
    required this.matchId,
    this.tournamentTitle = 'Vexora Ignition Cup: Knockout Round of 16',
    this.gameName = 'BGMI (Battlegrounds Mobile India)',
    this.registrationId = 'reg-my-team-101',
    this.teamName = 'Team Soul',
    this.isReviewingOpponent = false,
    this.existingSubmission,
  });

  @override
  State<ResultSubmissionScreen> createState() => _ResultSubmissionScreenState();
}

class _ResultSubmissionScreenState extends State<ResultSubmissionScreen> {
  // Checklist State
  bool _scoreboardVisible = true;
  bool _killsBreakdownVisible = true;
  bool _roomIdVisible = true;
  bool _playerUidsMatched = true;

  // Form Fields
  final _placementController = TextEditingController(text: '1');
  final _killsController = TextEditingController(text: '8');
  final _assistsController = TextEditingController(text: '4');
  final _notesController = TextEditingController();
  final _contestReasonController = TextEditingController();

  // Simulated Evidence
  String? _simulatedEvidenceUrl = 'https://storage.vexora.io/evidence/match-101/scoreboard_capture_final.png';
  String _simulatedEvidenceSha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  // 15-Minute Countdown Timer
  late int _remainingSeconds;
  Timer? _countdownTimer;

  bool _isSubmitting = false;
  bool _isSuccess = false;
  String? _statusBanner;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = 15 * 60; // 15-minute deadline
    _startCountdown();

    if (widget.isReviewingOpponent && widget.existingSubmission != null) {
      final sub = widget.existingSubmission!;
      _simulatedEvidenceSha256 = sub['evidence_sha256'] ?? _simulatedEvidenceSha256;
      _simulatedEvidenceUrl = sub['evidence_file_url'] ?? _simulatedEvidenceUrl;
    }
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_remainingSeconds > 0) {
        setState(() {
          _remainingSeconds--;
        });
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _placementController.dispose();
    _killsController.dispose();
    _assistsController.dispose();
    _notesController.dispose();
    _contestReasonController.dispose();
    super.dispose();
  }

  String _formatTimer(int totalSeconds) {
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  bool get _isChecklistComplete =>
      _scoreboardVisible && _killsBreakdownVisible && _roomIdVisible && _playerUidsMatched;

  Future<void> _submitResult() async {
    if (!_isChecklistComplete) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please verify all 4 evidence checklist items before submitting.'),
          backgroundColor: VexoraColors.accent,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    await Future.delayed(const Duration(milliseconds: 600));

    if (!mounted) return;
    setState(() {
      _isSubmitting = false;
      _isSuccess = true;
      _statusBanner = 'Result submitted with SHA-256 seal. Waiting for opponent confirmation or 15m auto-finalize.';
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Match Result submitted successfully! Evidence sealed.'),
        backgroundColor: VexoraColors.success,
      ),
    );
  }

  Future<void> _confirmOpponentResult() async {
    setState(() => _isSubmitting = true);
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    setState(() {
      _isSubmitting = false;
      _isSuccess = true;
      _statusBanner = 'Scores verified and confirmed by both parties! Match result finalized.';
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Opponent score confirmed! Match result finalized.'),
        backgroundColor: VexoraColors.success,
      ),
    );
  }

  Future<void> _contestResult() async {
    final reason = _contestReasonController.text.trim();
    if (reason.length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please provide a dispute explanation (at least 5 characters).'),
          backgroundColor: VexoraColors.stateDisputed,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    setState(() {
      _isSubmitting = false;
      _isSuccess = true;
      _statusBanner = 'DISPUTE RAISED: Settlement frozen immediately. Dispute stub #DSP-101 created for tournament referee.';
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Dispute registered. Tournament staff alerted for adjudication.'),
        backgroundColor: VexoraColors.stateDisputed,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isUrgent = _remainingSeconds < 180;

    return Scaffold(
      backgroundColor: VexoraColors.bgDark,
      appBar: AppBar(
        backgroundColor: VexoraColors.surfaceDark,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.isReviewingOpponent ? 'Review Opponent Result' : 'Submit Match Result',
              style: const TextStyle(
                color: VexoraColors.textPrimaryDark,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              'Match ID: ${widget.matchId} • ${widget.gameName}',
              style: const TextStyle(color: VexoraColors.textMutedDark, fontSize: 11),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 15-Minute Countdown Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isUrgent ? VexoraColors.stateDisputed.withValues(alpha: 0.15) : VexoraColors.surfaceElevatedDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isUrgent ? VexoraColors.stateDisputed : VexoraColors.borderDark,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.timer_outlined,
                      color: isUrgent ? VexoraColors.stateDisputed : VexoraColors.accent,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Submission Deadline Window',
                          style: TextStyle(
                            color: VexoraColors.textPrimaryDark,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '15m window before auto-forfeit protocol',
                          style: TextStyle(
                            color: isUrgent ? VexoraColors.stateDisputed : VexoraColors.textMutedDark,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isUrgent ? VexoraColors.stateDisputed : VexoraColors.surfaceDark,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _formatTimer(_remainingSeconds),
                    style: TextStyle(
                      color: isUrgent ? Colors.white : VexoraColors.accent,
                      fontSize: 14,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),

          if (_statusBanner != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _statusBanner!.contains('DISPUTE')
                    ? VexoraColors.stateDisputed.withValues(alpha: 0.15)
                    : VexoraColors.success.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: _statusBanner!.contains('DISPUTE')
                      ? VexoraColors.stateDisputed
                      : VexoraColors.success,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _statusBanner!.contains('DISPUTE') ? Icons.warning_amber_rounded : Icons.check_circle_outline,
                    color: _statusBanner!.contains('DISPUTE') ? VexoraColors.stateDisputed : VexoraColors.success,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _statusBanner!,
                      style: TextStyle(
                        color: _statusBanner!.contains('DISPUTE') ? VexoraColors.stateDisputed : VexoraColors.success,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 16),

          // 4-Point Guided Evidence Capture Checklist
          _buildCard(
            title: 'Evidence Verification Checklist',
            subtitle: 'Ensure all 4 criteria are clearly legible in your uploaded capture.',
            child: Column(
              children: [
                _buildChecklistTile(
                  title: 'Final Match Scoreboard Visible',
                  subtitle: 'Overall rank, placement badges, and team standings',
                  value: _scoreboardVisible,
                  onChanged: (val) => setState(() => _scoreboardVisible = val ?? false),
                ),
                _buildChecklistTile(
                  title: 'Kill & Assist Breakdown Visible',
                  subtitle: 'Individual combatant stats clearly legible',
                  value: _killsBreakdownVisible,
                  onChanged: (val) => setState(() => _killsBreakdownVisible = val ?? false),
                ),
                _buildChecklistTile(
                  title: 'Room Watermark & Match ID Visible',
                  subtitle: 'Prevents recycled or spoofed screenshots from past matches',
                  value: _roomIdVisible,
                  onChanged: (val) => setState(() => _roomIdVisible = val ?? false),
                ),
                _buildChecklistTile(
                  title: 'Player In-Game UIDs Matched',
                  subtitle: 'Cross-checked against verified roster registration',
                  value: _playerUidsMatched,
                  onChanged: (val) => setState(() => _playerUidsMatched = val ?? false),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Score Entry Card
          _buildCard(
            title: 'Combatant Score Entry',
            subtitle: 'Submitting score for ${widget.teamName} (${widget.registrationId})',
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _buildTextField(
                        controller: _placementController,
                        label: 'Placement Rank',
                        prefixIcon: Icons.military_tech_outlined,
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildTextField(
                        controller: _killsController,
                        label: 'Kills',
                        prefixIcon: Icons.gps_fixed_outlined,
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildTextField(
                        controller: _assistsController,
                        label: 'Assists',
                        prefixIcon: Icons.handshake_outlined,
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _buildTextField(
                  controller: _notesController,
                  label: 'Match Remarks / Incidents (Optional)',
                  prefixIcon: Icons.notes_outlined,
                  maxLines: 2,
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Evidence File & SHA-256 Seal Card
          _buildCard(
            title: 'Cryptographic Evidence Ingress',
            subtitle: 'Screenshots are hashed with SHA-256 for tamper-proof storage.',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 120,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: VexoraColors.surfaceDark,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: VexoraColors.borderDark),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.image_outlined, color: VexoraColors.primary, size: 36),
                      const SizedBox(height: 8),
                      Text(
                        _simulatedEvidenceUrl != null ? 'scoreboard_capture_final.png' : 'Tap to select screenshot',
                        style: const TextStyle(
                          color: VexoraColors.textPrimaryDark,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Max 10MB • PNG, JPEG, WEBP',
                        style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: VexoraColors.surfaceDark,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: VexoraColors.borderDark),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.tag_rounded, color: VexoraColors.accent, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'SHA-256 Seal (Ingress Checksum)',
                              style: TextStyle(color: VexoraColors.textMutedDark, fontSize: 10),
                            ),
                            Text(
                              _simulatedEvidenceSha256,
                              style: const TextStyle(
                                color: VexoraColors.textSecondaryDark,
                                fontSize: 11,
                                fontFamily: 'monospace',
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy_rounded, color: VexoraColors.primary, size: 16),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: _simulatedEvidenceSha256));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Evidence SHA-256 hash copied!'),
                              backgroundColor: VexoraColors.primary,
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

          const SizedBox(height: 20),

          // Maker-Checker Decision Section
          if (!widget.isReviewingOpponent) ...[
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: VexoraColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _isSubmitting || _isSuccess ? null : _submitResult,
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text(
                      'Seal & Submit Result',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
            ),
          ] else ...[
            // Opposing team reviewing submission: maker-checker rule
            const Text(
              'Maker-Checker Verification (Opposing Team)',
              style: TextStyle(
                color: VexoraColors.textPrimaryDark,
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Review opponent reported scores. You may confirm agreement or contest with counter-evidence.',
              style: TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12),
            ),
            const SizedBox(height: 12),
            _buildTextField(
              controller: _contestReasonController,
              label: 'Contest Reason (Required only if disputing)',
              prefixIcon: Icons.report_problem_outlined,
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: VexoraColors.stateDisputed,
                      side: const BorderSide(color: VexoraColors.stateDisputed),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: _isSubmitting || _isSuccess ? null : _contestResult,
                    child: const Text('Contest (Hold & Dispute)'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: VexoraColors.success,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: _isSubmitting || _isSuccess ? null : _confirmOpponentResult,
                    child: const Text('Confirm Agreement'),
                  ),
                ),
              ],
            ),
          ],

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildCard({required String title, required String subtitle, required Widget child}) {
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
          Text(title, style: const TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 14, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: VexoraColors.textMutedDark, fontSize: 11)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _buildChecklistTile({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool?> onChanged,
  }) {
    return CheckboxListTile(
      value: value,
      onChanged: onChanged,
      activeColor: VexoraColors.primary,
      contentPadding: EdgeInsets.zero,
      dense: true,
      title: Text(
        title,
        style: const TextStyle(
          color: VexoraColors.textPrimaryDark,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(color: VexoraColors.textMutedDark, fontSize: 11),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData prefixIcon,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      style: const TextStyle(color: VexoraColors.textPrimaryDark, fontSize: 13),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: VexoraColors.textSecondaryDark, fontSize: 12),
        prefixIcon: Icon(prefixIcon, color: VexoraColors.primary, size: 18),
        filled: true,
        fillColor: VexoraColors.surfaceDark,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: VexoraColors.borderDark),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: VexoraColors.borderDark),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: VexoraColors.primary),
        ),
        isDense: true,
      ),
    );
  }
}
