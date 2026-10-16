import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import '../theme/vexora_theme.dart';

/// Phase 22: Organiser Verification & Tiers Screen
/// Blueprint Ref: Sections 10, 39 (Phase 5)
///
/// Features:
/// - Organiser Tier badge & capabilities (Starter, Verified, Partner)
/// - Public trust indicators (Completed vs Cancelled vs Disputed counts, Trust Score)
/// - Step-by-step KYC Application wizard with SHA-256 document hashing
/// - Publishing hold status and dispute rate safeguards
class OrganiserVerificationScreen extends StatefulWidget {
  final Map<String, dynamic>? initialProfile;

  const OrganiserVerificationScreen({super.key, this.initialProfile});

  @override
  State<OrganiserVerificationScreen> createState() => _OrganiserVerificationScreenState();
}

class _OrganiserVerificationScreenState extends State<OrganiserVerificationScreen> {
  int _currentStep = 0;

  // Organiser State
  String _tier = 'STARTER';
  String _kycStatus = 'NOT_SUBMITTED';
  double _trustScore = 98.5;
  int _completedTournaments = 14;
  int _cancelledTournaments = 1;
  int _disputedTournaments = 0;
  double _disputeRate = 0.0;
  bool _publishingHeld = false;

  // Form Fields
  final _businessNameController = TextEditingController(text: 'Apex Esports Org');
  final _contactEmailController = TextEditingController(text: 'host@apex-esports.gg');
  final _contactPhoneController = TextEditingController(text: '+91 98765 43210');
  final _countryController = TextEditingController(text: 'IND');
  final _idNumberController = TextEditingController(text: 'DOC-98214-X');
  final _taxIdController = TextEditingController(text: 'GSTIN29ABCDE1234F1Z5');
  String _documentType = 'NATIONAL_ID';

  // Evidence state
  String? _documentHash;
  String? _documentFileName;
  bool _isUploading = false;
  bool _isSubmitted = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialProfile != null) {
      _tier = widget.initialProfile!['tier'] ?? 'STARTER';
      _kycStatus = widget.initialProfile!['kyc_status'] ?? 'NOT_SUBMITTED';
      _trustScore = (widget.initialProfile!['trust_score'] ?? 98.5).toDouble();
      _completedTournaments = widget.initialProfile!['completed_tournaments'] ?? 14;
      _cancelledTournaments = widget.initialProfile!['cancelled_tournaments'] ?? 1;
      _disputedTournaments = widget.initialProfile!['disputed_tournaments'] ?? 0;
      _disputeRate = (widget.initialProfile!['dispute_rate'] ?? 0.0).toDouble();
      _publishingHeld = widget.initialProfile!['publishing_held'] ?? false;
    }
  }

  @override
  void dispose() {
    _businessNameController.dispose();
    _contactEmailController.dispose();
    _contactPhoneController.dispose();
    _countryController.dispose();
    _idNumberController.dispose();
    _taxIdController.dispose();
    super.dispose();
  }

  void _simulateDocumentCapture() {
    setState(() => _isUploading = true);
    Future.delayed(const Duration(milliseconds: 600), () {
      if (!mounted) return;
      final rawSeed = '${_businessNameController.text}-${DateTime.now().millisecondsSinceEpoch}';
      final digest = sha256.convert(utf8.encode(rawSeed)).toString();
      setState(() {
        _isUploading = false;
        _documentFileName = 'government_id_front_${DateTime.now().millisecondsSinceEpoch}.jpg';
        _documentHash = digest;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Document captured. SHA-256: ${digest.substring(0, 16)}...'),
          backgroundColor: VexoraColors.success,
        ),
      );
    });
  }

  void _submitApplication() {
    if (_documentHash == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please capture and hash your ID document first.'),
          backgroundColor: VexoraColors.error,
        ),
      );
      return;
    }

    setState(() {
      _isSubmitted = true;
      _kycStatus = 'PENDING';
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Verification application submitted for Admin Maker-Checker review.'),
        backgroundColor: VexoraColors.accentBlue,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: VexoraColors.bgDeep,
      appBar: AppBar(
        title: const Text('Organiser Verification & Tiers'),
        backgroundColor: VexoraColors.surfaceCard,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.security),
            tooltip: 'Trust & Safety Policies',
            onPressed: () => _showTrustPolicySheet(context),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildTierStatusCard(),
            const SizedBox(height: 16),
            _buildPublicTrustIndicatorsCard(),
            const SizedBox(height: 16),
            _buildTierCapabilitiesComparison(),
            const SizedBox(height: 24),
            Text(
              'KYC Verification Application',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: VexoraColors.textPrimary,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Only verified organisers can host public tournaments with expanded capacity.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: VexoraColors.textSecondary,
                  ),
            ),
            const SizedBox(height: 16),
            _buildApplicationWizard(),
          ],
        ),
      ),
    );
  }

  Widget _buildTierStatusCard() {
    final isVerified = _tier == 'VERIFIED' || _tier == 'PARTNER';
    final tierColor = _tier == 'PARTNER'
        ? Colors.amber
        : (_tier == 'VERIFIED' ? VexoraColors.accentBlue : Colors.grey);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tierColor.withAlpha(70)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: tierColor.withAlpha(30),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isVerified ? Icons.verified_user : Icons.shield_outlined,
              color: tierColor,
              size: 36,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '$_tier TIER',
                      style: TextStyle(
                        color: tierColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: _getStatusColor(_kycStatus).withAlpha(40),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        _kycStatus,
                        style: TextStyle(
                          color: _getStatusColor(_kycStatus),
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  _publishingHeld
                      ? '⚠️ Publishing Held: Dispute resolution review required'
                      : (isVerified
                          ? 'Verified Organiser: Full public hosting permissions enabled'
                          : 'Starter Tier: Capped at 32 players & 1 active event'),
                  style: TextStyle(
                    color: _publishingHeld ? VexoraColors.error : VexoraColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPublicTrustIndicatorsCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: VexoraColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: VexoraColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.between,
            children: [
              Text(
                'Public Trust Indicators',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: VexoraColors.textPrimary,
                    ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: VexoraColors.success.withAlpha(30),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Trust Score: ${_trustScore.toStringAsFixed(1)} / 100',
                  style: const TextStyle(
                    color: VexoraColors.success,
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildTrustMetric('Completed', '$_completedTournaments', VexoraColors.accentBlue),
              _buildTrustMetric('Cancelled', '$_cancelledTournaments', Colors.orange),
              _buildTrustMetric('Disputed', '$_disputedTournaments', VexoraColors.error),
              _buildTrustMetric(
                'Dispute Rate',
                '${(_disputeRate * 100).toStringAsFixed(1)}%',
                _disputeRate > 0.05 ? VexoraColors.error : VexoraColors.success,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Note: Trust indicators are publicly verifiable. Private KYC documents are strictly isolated in encrypted storage.',
            style: TextStyle(color: VexoraColors.textSecondary.withAlpha(180), fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildTrustMetric(String label, String value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: VexoraColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTierCapabilitiesComparison() {
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
          Text(
            'Tier Capabilities Matrix (Section 10)',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: VexoraColors.textPrimary,
                ),
          ),
          const SizedBox(height: 12),
          _buildTierRow('Starter (Current)', 'Free only', '32 Players', '1 Active Event', false),
          const Divider(color: VexoraColors.border),
          _buildTierRow('Verified (Target)', 'Free + Promoted', '256 Players', '5 Active Events', true),
          const Divider(color: VexoraColors.border),
          _buildTierRow('Partner Tier', 'Full Platform Priority', '2048 Players', '20 Active Events', false),
        ],
      ),
    );
  }

  Widget _buildTierRow(String tier, String feeModel, String cap, String concurrent, bool highlight) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      decoration: highlight
          ? BoxDecoration(
              color: VexoraColors.accentBlue.withAlpha(20),
              borderRadius: BorderRadius.circular(8),
            )
          : null,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            tier,
            style: TextStyle(
              fontWeight: highlight ? FontWeight.bold : FontWeight.w500,
              color: highlight ? VexoraColors.accentBlue : VexoraColors.textPrimary,
              fontSize: 13,
            ),
          ),
          Text(
            '$cap • $concurrent',
            style: const TextStyle(color: VexoraColors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildApplicationWizard() {
    if (_isSubmitted) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: VexoraColors.surfaceCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: VexoraColors.success),
        ),
        child: Column(
          children: [
            const Icon(Icons.check_circle_outline, color: VexoraColors.success, size: 48),
            const SizedBox(height: 12),
            const Text(
              'Application Submitted Successfully',
              style: TextStyle(color: VexoraColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 8),
            const Text(
              'Your business details and cryptographically hashed identity documents have been queued for administrative Maker-Checker review.',
              textAlign: TextAlign.center,
              style: TextStyle(color: VexoraColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            if (_documentHash != null)
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: VexoraColors.bgDeep,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Front Doc Hash: ${_documentHash!}',
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: VexoraColors.accentBlue),
                ),
              ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: VexoraColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: VexoraColors.border),
      ),
      child: Stepper(
        physics: const ClampingScrollPhysics(),
        currentStep: _currentStep,
        onStepContinue: () {
          if (_currentStep < 2) {
            setState(() => _currentStep += 1);
          } else {
            _submitApplication();
          }
        },
        onStepCancel: () {
          if (_currentStep > 0) {
            setState(() => _currentStep -= 1);
          }
        },
        controlsBuilder: (context, details) {
          return Padding(
            padding: const EdgeInsets.only(top: 16.0),
            child: Row(
              children: [
                ElevatedButton(
                  onPressed: details.onStepContinue,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: VexoraColors.accentBlue,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(_currentStep == 2 ? 'Submit Application' : 'Next Step'),
                ),
                if (_currentStep > 0) ...[
                  const SizedBox(width: 12),
                  TextButton(
                    onPressed: details.onStepCancel,
                    child: const Text('Back'),
                  ),
                ],
              ],
            ),
          );
        },
        steps: [
          Step(
            title: const Text('Legal & Business Entity'),
            isActive: _currentStep >= 0,
            content: Column(
              children: [
                TextField(
                  controller: _businessNameController,
                  decoration: const InputDecoration(labelText: 'Business / Organisation Name'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _contactEmailController,
                  decoration: const InputDecoration(labelText: 'Official Contact Email'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _contactPhoneController,
                  decoration: const InputDecoration(labelText: 'Contact Phone (Field-Level Encrypted)'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _countryController,
                  decoration: const InputDecoration(labelText: 'Country Code (e.g. IND, USA)'),
                ),
              ],
            ),
          ),
          Step(
            title: const Text('Document & ID Registration'),
            isActive: _currentStep >= 1,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DropdownButtonFormField<String>(
                  value: _documentType,
                  decoration: const InputDecoration(labelText: 'Identity Document Type'),
                  items: const [
                    DropdownMenuItem(value: 'NATIONAL_ID', child: Text('National ID / Aadhaar')),
                    DropdownMenuItem(value: 'PASSPORT', child: Text('Passport')),
                    DropdownMenuItem(value: 'DRIVING_LICENSE', child: Text('Driving License')),
                    DropdownMenuItem(value: 'BUSINESS_REG', child: Text('Certificate of Incorporation')),
                  ],
                  onChanged: (v) => setState(() => _documentType = v ?? 'NATIONAL_ID'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _idNumberController,
                  decoration: const InputDecoration(labelText: 'Document Number (Field-Level Encrypted)'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _taxIdController,
                  decoration: const InputDecoration(labelText: 'Tax Registration ID (Optional)'),
                ),
              ],
            ),
          ),
          Step(
            title: const Text('Document Seal & Hashing'),
            isActive: _currentStep >= 2,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Evidence Ingress Requirement (ADR-004): Uploaded documents are hashed with SHA-256 upon ingress. The raw document is stored in an encrypted isolated bucket.',
                  style: TextStyle(fontSize: 12, color: VexoraColors.textSecondary),
                ),
                const SizedBox(height: 12),
                if (_documentHash != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: VexoraColors.bgDeep,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: VexoraColors.success),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.check_circle, color: VexoraColors.success, size: 16),
                            const SizedBox(width: 6),
                            Text(
                              _documentFileName ?? 'document.jpg',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'SHA-256 Seal:\n$_documentHash',
                          style: const TextStyle(fontFamily: 'monospace', fontSize: 10, color: VexoraColors.accentBlue),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                ElevatedButton.icon(
                  onPressed: _isUploading ? null : _simulateDocumentCapture,
                  icon: _isUploading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.camera_alt),
                  label: Text(_documentHash == null ? 'Capture & Hash Document' : 'Recapture Document'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: VexoraColors.surfaceCard,
                    foregroundColor: VexoraColors.textPrimary,
                    side: const BorderSide(color: VexoraColors.border),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'APPROVED':
        return VexoraColors.success;
      case 'PENDING':
      case 'IN_REVIEW':
        return Colors.orange;
      case 'REJECTED':
        return VexoraColors.error;
      default:
        return VexoraColors.textSecondary;
    }
  }

  void _showTrustPolicySheet(BuildContext context) {
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
                'Trust & Safety Policy Guidelines',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: VexoraColors.textPrimary),
              ),
              SizedBox(height: 12),
              Text(
                '1. Zero Private KYC Leakage: Your legal identity and contact details are never exposed to players or other organisers.\n'
                '2. Role-Based KYC Access: Platform moderators cannot see KYC documents. Access is restricted to Compliance and Super Admins with audited business justifications.\n'
                '3. Automated Holds: Any organiser whose dispute rate exceeds 5.0% or whose trust score falls below 70.0 is automatically placed on publishing hold.\n'
                '4. Immutable Audit: Every tier change and publishing hold transition is recorded with actor ID, timestamp, and client IP in the tamper-evident audit journal.',
                style: TextStyle(fontSize: 13, color: VexoraColors.textSecondary, height: 1.5),
              ),
            ],
          ),
        );
      },
    );
  }
}
