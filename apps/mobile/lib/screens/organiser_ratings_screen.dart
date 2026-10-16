import 'package:flutter/material.dart';
import '../theme/vexora_theme.dart';

/// Phase 24: Organiser Ratings, Reputation & Participant Reports Screen
/// Blueprint Ref: Sections 12, 21, 39 (Phase 5), 47
///
/// Features:
/// - Transparent organiser reputation card with sample size & 3-dimensional ratings:
///   * Communication (1-5)
///   * Schedule Adherence (1-5)
///   * Result Handling (1-5)
/// - Verified participant rating list
/// - "Rate This Organiser" submission modal
/// - Review dispute/appeal dialog (Organisers cannot delete reviews directly)
/// - Security Gate guarantee: "Ratings alone never trigger automatic punishment"
class OrganiserRatingsScreen extends StatefulWidget {
  final String organiserId;
  final String organiserName;
  final String? tournamentId;
  final bool isOrganiserViewer;

  const OrganiserRatingsScreen({
    super.key,
    required this.organiserId,
    required this.organiserName,
    this.tournamentId,
    this.isOrganiserViewer = false,
  });

  @override
  State<OrganiserRatingsScreen> createState() => _OrganiserRatingsScreenState();
}

class _OrganiserRatingsScreenState extends State<OrganiserRatingsScreen> {
  // Aggregate Metrics
  double _avgOverall = 4.75;
  double _avgCommunication = 4.80;
  double _avgSchedule = 4.65;
  double _avgResult = 4.80;
  int _sampleSize = 38;
  int _verifiedCount = 38;

  // Review list state
  final List<Map<String, dynamic>> _reviews = [
    {
      'id': 'rev-001',
      'participant_username': 'ShadowSniper',
      'tournament_name': 'BGMI Pro Invitational S3',
      'overall_score': 5.0,
      'communication_score': 5,
      'schedule_score': 5,
      'result_score': 5,
      'review_text':
          'Flawless tournament execution. Room credentials were shared 15 mins prior, zero delays, and scores were finalised within 10 minutes of match end.',
      'is_verified_participant': true,
      'moderation_status': 'VISIBLE',
      'created_at': '2026-10-14 18:30',
    },
    {
      'id': 'rev-002',
      'participant_username': 'GhostRider_99',
      'tournament_name': 'Free Fire MAX Masters Cup',
      'overall_score': 4.67,
      'communication_score': 5,
      'schedule_score': 4,
      'result_score': 5,
      'review_text':
          'Slight 5 minute delay for lobby 2 check-ins, but great communication in the Discord lobby. Points table was accurate and screenshot evidence was verified.',
      'is_verified_participant': true,
      'moderation_status': 'VISIBLE',
      'created_at': '2026-10-12 14:15',
    },
    {
      'id': 'rev-003',
      'participant_username': 'ViperStrike',
      'tournament_name': 'BGMI Weekly Scrims #12',
      'overall_score': 4.33,
      'communication_score': 4,
      'schedule_score': 4,
      'result_score': 5,
      'review_text':
          'Good overall handling. Bracket updates were smooth and result discrepancies were addressed promptly.',
      'is_verified_participant': true,
      'moderation_status': 'VISIBLE',
      'created_at': '2026-10-10 20:45',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: VexoraColors.backgroundDark,
      appBar: AppBar(
        title: Text(
          'Reputation & Ratings',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: VexoraColors.cardDark,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.shield_outlined, color: VexoraColors.primaryGold),
            tooltip: 'Security Gate Policy',
            onPressed: _showPolicyDialog,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildReputationSummaryCard(),
            const SizedBox(height: 16),
            _buildActionButtons(),
            const SizedBox(height: 24),
            _buildSectionHeader(),
            const SizedBox(height: 12),
            _buildReviewList(),
          ],
        ),
      ),
    );
  }

  Widget _buildReputationSummaryCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: VexoraColors.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: VexoraColors.borderDark),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.organiserName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: VexoraColors.primaryCyan.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: VexoraColors.primaryCyan.withOpacity(0.4)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.verified, size: 12, color: VexoraColors.primaryCyan),
                              const SizedBox(width: 4),
                              Text(
                                'Sample Size: $_sampleSize',
                                style: const TextStyle(
                                  color: VexoraColors.primaryCyan,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '$_verifiedCount verified reviews',
                          style: TextStyle(color: Colors.grey.shade400, fontSize: 11),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      VexoraColors.primaryGold.withOpacity(0.2),
                      VexoraColors.primaryGold.withOpacity(0.05),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: VexoraColors.primaryGold),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.star, color: VexoraColors.primaryGold, size: 20),
                        const SizedBox(width: 4),
                        Text(
                          _avgOverall.toStringAsFixed(2),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const Text(
                      'out of 5.0',
                      style: TextStyle(color: Colors.grey, fontSize: 10),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(color: VexoraColors.borderDark, height: 28),
          const Text(
            'Operational Dimensions (Section 21)',
            style: TextStyle(
              color: Colors.grey,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          _buildScoreDimensionBar(
            'Communication & Support',
            _avgCommunication,
            Icons.chat_bubble_outline,
            VexoraColors.primaryCyan,
          ),
          const SizedBox(height: 10),
          _buildScoreDimensionBar(
            'Schedule Adherence & Timeliness',
            _avgSchedule,
            Icons.schedule,
            VexoraColors.primaryGold,
          ),
          const SizedBox(height: 10),
          _buildScoreDimensionBar(
            'Result Handling & Fairness',
            _avgResult,
            Icons.military_tech_outlined,
            Colors.greenAccent,
          ),
        ],
      ),
    );
  }

  Widget _buildScoreDimensionBar(
    String title,
    double score,
    IconData icon,
    Color accentColor,
  ) {
    final percent = (score / 5.0).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(icon, size: 14, color: accentColor),
                const SizedBox(width: 6),
                Text(
                  title,
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ],
            ),
            Text(
              '${score.toStringAsFixed(2)} / 5.0',
              style: TextStyle(
                color: accentColor,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: percent,
            minHeight: 6,
            backgroundColor: Colors.white.withOpacity(0.08),
            valueColor: AlwaysStoppedAnimation<Color>(accentColor),
          ),
        ),
      ],
    );
  }

  Widget _buildActionButtons() {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: _showRateOrganiserSheet,
            style: ElevatedButton.styleFrom(
              backgroundColor: VexoraColors.primaryGold,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.rate_review_outlined, size: 18),
            label: const Text(
              'Rate Organiser',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ),
        if (widget.isOrganiserViewer) ...[
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _showReportParticipantSheet,
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.redAccent,
                side: const BorderSide(color: Colors.redAccent),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.report_problem_outlined, size: 18),
              label: const Text(
                'Report Conduct',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildSectionHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'Verified Participant Reviews',
          style: TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          '${_reviews.length} shown',
          style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildReviewList() {
    if (_reviews.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 30),
          child: Column(
            children: [
              Icon(Icons.rate_review_outlined, size: 40, color: Colors.grey.shade600),
              const SizedBox(height: 8),
              const Text(
                'No reviews submitted yet.',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _reviews.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final rev = _reviews[index];
        final isFlagged = rev['moderation_status'] == 'FLAGGED';

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: VexoraColors.cardDark,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isFlagged ? Colors.orangeAccent.withOpacity(0.5) : VexoraColors.borderDark,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: VexoraColors.primaryCyan.withOpacity(0.2),
                        child: Text(
                          (rev['participant_username'] as String)[0].toUpperCase(),
                          style: const TextStyle(
                            color: VexoraColors.primaryCyan,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                rev['participant_username'],
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                              if (rev['is_verified_participant'] == true) ...[
                                const SizedBox(width: 4),
                                const Icon(Icons.verified, size: 12, color: VexoraColors.primaryCyan),
                              ],
                            ],
                          ),
                          Text(
                            rev['tournament_name'],
                            style: TextStyle(color: Colors.grey.shade400, fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      const Icon(Icons.star, color: VexoraColors.primaryGold, size: 16),
                      const SizedBox(width: 3),
                      Text(
                        (rev['overall_score'] as double).toStringAsFixed(2),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  _buildSubScoreBadge('Comm: ${rev['communication_score']}/5'),
                  _buildSubScoreBadge('Sched: ${rev['schedule_score']}/5'),
                  _buildSubScoreBadge('Result: ${rev['result_score']}/5'),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                rev['review_text'],
                style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    rev['created_at'],
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                  ),
                  if (widget.isOrganiserViewer)
                    TextButton.icon(
                      onPressed: isFlagged ? null : () => _showAppealReviewDialog(rev),
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        visualDensity: VisualDensity.compact,
                        foregroundColor: Colors.orangeAccent,
                      ),
                      icon: Icon(
                        isFlagged ? Icons.hourglass_top : Icons.flag_outlined,
                        size: 13,
                      ),
                      label: Text(
                        isFlagged ? 'Appeal Pending' : 'Appeal Review',
                        style: const TextStyle(fontSize: 11),
                      ),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSubScoreBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.06),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: const TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.w500),
      ),
    );
  }

  void _showRateOrganiserSheet() {
    double commScore = 5;
    double schedScore = 5;
    double resultScore = 5;
    final textController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: VexoraColors.cardDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final overall = ((commScore + schedScore + resultScore) / 3.0);

            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Rate Organiser Performance',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.grey),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const Text(
                    'Rate on clearly defined operational factors (Section 21). Ratings are tamper-evident and verified.',
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                  const SizedBox(height: 16),
                  _buildSlider(
                    'Communication & Support',
                    commScore,
                    (val) => setSheetState(() => commScore = val),
                  ),
                  _buildSlider(
                    'Schedule Adherence',
                    schedScore,
                    (val) => setSheetState(() => schedScore = val),
                  ),
                  _buildSlider(
                    'Result Handling & Accuracy',
                    resultScore,
                    (val) => setSheetState(() => resultScore = val),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Computed Overall Score:',
                        style: TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                      Text(
                        '${overall.toStringAsFixed(2)} / 5.0',
                        style: const TextStyle(
                          color: VexoraColors.primaryGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: textController,
                    maxLines: 3,
                    maxLength: 1000,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Share constructive details about your experience...',
                      hintStyle: TextStyle(color: Colors.grey.shade600),
                      filled: true,
                      fillColor: VexoraColors.backgroundDark,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: VexoraColors.borderDark),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: VexoraColors.primaryGold,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () {
                        setState(() {
                          _reviews.insert(0, {
                            'id': 'rev-${DateTime.now().millisecondsSinceEpoch}',
                            'participant_username': 'CurrentPlayer',
                            'tournament_name': 'Recent Tournament',
                            'overall_score': double.parse(overall.toStringAsFixed(2)),
                            'communication_score': commScore.toInt(),
                            'schedule_score': schedScore.toInt(),
                            'result_score': resultScore.toInt(),
                            'review_text': textController.text.trim().isEmpty
                                ? 'No written comment provided.'
                                : textController.text.trim(),
                            'is_verified_participant': true,
                            'moderation_status': 'VISIBLE',
                            'created_at': 'Just now',
                          });
                          _sampleSize += 1;
                          _verifiedCount += 1;
                        });
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Rating submitted successfully. Thank you for your feedback!'),
                            backgroundColor: Colors.green,
                          ),
                        );
                      },
                      child: const Text('Submit Rating', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSlider(String title, double value, ValueChanged<double> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: const TextStyle(color: Colors.white, fontSize: 13)),
            Text('${value.toInt()} / 5', style: const TextStyle(color: VexoraColors.primaryGold, fontWeight: FontWeight.bold)),
          ],
        ),
        Slider(
          value: value,
          min: 1,
          max: 5,
          divisions: 4,
          activeColor: VexoraColors.primaryGold,
          inactiveColor: Colors.white12,
          onChanged: onChanged,
        ),
      ],
    );
  }

  void _showAppealReviewDialog(Map<String, dynamic> review) {
    String selectedGrounds = 'DEMONSTRABLY_FALSE';
    final explanationController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: VexoraColors.cardDark,
              title: const Text(
                'Appeal / Flag Review',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Organisers cannot delete reviews. A formal dispute will be submitted to the Moderation Queue for review.',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                    const SizedBox(height: 14),
                    const Text('Grounds for Appeal:', style: TextStyle(color: Colors.white70, fontSize: 12)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedGrounds,
                      dropdownColor: VexoraColors.cardDark,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: VexoraColors.backgroundDark,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'DEMONSTRABLY_FALSE', child: Text('Demonstrably False Claims')),
                        DropdownMenuItem(value: 'ABUSIVE_OR_HARASSMENT', child: Text('Abusive / Harassing Language')),
                        DropdownMenuItem(value: 'PERSONAL_INFO_DOXXING', child: Text('Personal Info / Doxxing')),
                        DropdownMenuItem(value: 'EXTORTION_OR_SPAM', child: Text('Extortion or Coordinated Spam')),
                      ],
                      onChanged: (val) => setDialogState(() => selectedGrounds = val!),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: explanationController,
                      maxLines: 3,
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                      decoration: InputDecoration(
                        hintText: 'Explain why this review violates policy...',
                        hintStyle: TextStyle(color: Colors.grey.shade600),
                        filled: true,
                        fillColor: VexoraColors.backgroundDark,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orangeAccent,
                    foregroundColor: Colors.black,
                  ),
                  onPressed: () {
                    setState(() {
                      review['moderation_status'] = 'FLAGGED';
                    });
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Review appeal filed. A moderator will review this claim within 24 hours.'),
                        backgroundColor: Colors.orange,
                      ),
                    );
                  },
                  child: const Text('Submit Appeal'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showReportParticipantSheet() {
    String category = 'NO_SHOW';
    final participantIdController = TextEditingController(text: 'PlayerUID-4401');
    final reasonController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: VexoraColors.cardDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Report Participant Conduct',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              const Text(
                'Organisers can report unsportsmanlike behaviour or cheating to the moderation team.',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: participantIdController,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  labelText: 'Participant UID / Tag',
                  labelStyle: const TextStyle(color: Colors.grey),
                  filled: true,
                  fillColor: VexoraColors.backgroundDark,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: category,
                dropdownColor: VexoraColors.cardDark,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  labelText: 'Conduct Category',
                  labelStyle: const TextStyle(color: Colors.grey),
                  filled: true,
                  fillColor: VexoraColors.backgroundDark,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                items: const [
                  DropdownMenuItem(value: 'NO_SHOW', child: Text('No-Show / Abandonment')),
                  DropdownMenuItem(value: 'TOXIC_BEHAVIOR', child: Text('Toxic / Abusive Chat')),
                  DropdownMenuItem(value: 'LOBBY_DISRUPTION', child: Text('Lobby Disruption / Code Leaking')),
                  DropdownMenuItem(value: 'SUSPECTED_CHEATING', child: Text('Suspected Cheating / Exploiting')),
                  DropdownMenuItem(value: 'UNAUTHORIZED_RINGER', child: Text('Unauthorized Substitute / Ringer')),
                ],
                onChanged: (val) => category = val!,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: reasonController,
                maxLines: 2,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Describe the incident with match timestamps...',
                  hintStyle: TextStyle(color: Colors.grey.shade600),
                  filled: true,
                  fillColor: VexoraColors.backgroundDark,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.redAccent,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Participant conduct report submitted for moderator investigation.'),
                        backgroundColor: Colors.redAccent,
                      ),
                    );
                  },
                  child: const Text('Submit Report', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showPolicyDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: VexoraColors.cardDark,
        title: const Row(
          children: [
            Icon(Icons.shield_outlined, color: VexoraColors.primaryGold),
            SizedBox(width: 8),
            Text('Security Gate & Policy', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '1. Ratings Alone Never Punish:',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
            ),
            Text(
              'A low rating score alone will never trigger automatic account suspension or tier demotion. Human moderation investigation is required.',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
            SizedBox(height: 10),
            Text(
              '2. Verified Reviews Only:',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
            ),
            Text(
              'Only participants who actively registered and played in a completed tournament can submit ratings.',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
            SizedBox(height: 10),
            Text(
              '3. Anti-Tamper Review Ledger:',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
            ),
            Text(
              'Organisers cannot delete negative reviews. Abusive or false reviews must be appealed through formal moderator adjudication.',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Understood', style: TextStyle(color: VexoraColors.primaryGold)),
          ),
        ],
      ),
    );
  }
}
