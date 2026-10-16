import 'package:flutter/material.dart';

/// Vexora — Privacy, Compliance & Localisation Screen
///
/// Phase 35: Privacy, Compliance, Localisation & Accessibility
///
/// Key Capabilities:
/// - Granular revocable consent management (DPDP Act 2023)
/// - Minor safeguard & guardian consent status (DPDP Act Sec 9)
/// - Data Subject Rights (DSR): Export Data & Delete Account (Right to Erasure)
///   with explicit statutory notice that financial ledgers are retained 5 years (PMLA).
/// - Localisation switcher (English, Hindi, Odia)
/// - WCAG 2.1 AA Accessibility: Semantics, high contrast, large touch targets
/// - Statutory Grievance Redressal Officer contact (IT Rules 2021)
class PrivacyComplianceScreen extends StatefulWidget {
  const PrivacyComplianceScreen({super.key});

  @override
  State<PrivacyComplianceScreen> createState() => _PrivacyComplianceScreenState();
}

class _PrivacyComplianceScreenState extends State<PrivacyComplianceScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Selected language locale
  String _selectedLocale = 'en';

  // Accessibility flags
  bool _highContrast = false;

  // Consent states
  bool _analyticsConsent = true;
  bool _marketingPushConsent = false;
  bool _marketingEmailConsent = false;
  bool _locationApproximateConsent = false;
  bool _matchTelemetryConsent = true; // Required for anti-cheat & fair play
  bool _profilingRecsConsent = true;

  // Guardian consent state
  final bool _isMinor = false;
  final String _guardianStatus = 'VERIFIED'; // 'PENDING' | 'VERIFIED' | 'NOT_REQUIRED'

  // Localisation dictionary
  final Map<String, Map<String, String>> _localizedStrings = {
    'en': {
      'title': 'Privacy & Compliance',
      'consentsTab': 'Consents',
      'rightsTab': 'My Rights',
      'guardianTab': 'Guardian',
      'grievanceTab': 'Grievance',
      'granularConsentTitle': 'Granular Data Consents',
      'granularConsentDesc': 'You can grant or revoke optional data processing permissions at any time per the DPDP Act 2023.',
      'exportBtn': 'Download Personal Data Archive',
      'deleteBtn': 'Request Account Deletion (Erasure)',
      'retentionWarning': 'Statutory Notice: While personal identity is scrubbed immediately, financial ledger records are retained for 5 years per statutory anti-money laundering and tax laws.',
      'grievanceOfficer': 'Resident Grievance Officer',
      'grievanceName': 'Priyadarshini Mohanty',
      'grievanceCity': 'Bhubaneswar, Odisha, India',
    },
    'hi': {
      'title': 'गोपनीयता और अनुपालन',
      'consentsTab': 'सहमति',
      'rightsTab': 'मेरे अधिकार',
      'guardianTab': 'अभिभावक',
      'grievanceTab': 'शिकायत',
      'granularConsentTitle': 'विस्तृत डेटा सहमति',
      'granularConsentDesc': 'आप DPDP अधिनियम 2023 के तहत कभी भी वैकल्पिक डेटा अनुमतियां दे या वापस ले सकते हैं।',
      'exportBtn': 'व्यक्तिगत डेटा डाउनलोड करें',
      'deleteBtn': 'खाता हटाने का अनुरोध (मिटाना)',
      'retentionWarning': 'कानूनी सूचना: व्यक्तिगत पहचान तुरंत हटा दी जाएगी, लेकिन वित्तीय रिकॉर्ड कानूनों के अनुसार 5 वर्षों तक रखे जाएंगे।',
      'grievanceOfficer': 'निवासी शिकायत अधिकारी',
      'grievanceName': 'प्रियदर्शिनी मोहंती',
      'grievanceCity': 'भुवनेश्वर, ओडिशा, भारत',
    },
    'or': {
      'title': 'ଗୋପନୀୟତା ଓ ଅନୁପାଳନ',
      'consentsTab': 'ସମ୍ମତି',
      'rightsTab': 'ମୋର ଅଧିକାର',
      'guardianTab': 'ଅଭିଭାବକ',
      'grievanceTab': 'ଅଭିଯୋଗ',
      'granularConsentTitle': 'ବ୍ୟକ୍ତିଗତ ତଥ୍ୟ ସମ୍ମତି',
      'granularConsentDesc': 'DPDP ଆଇନ ୨୦୨୩ ଅନୁଯାୟୀ ଆପଣ ଯେକୌଣସି ସମୟରେ ତଥ୍ୟ ଅନୁମତି ପରିବର୍ତ୍ତନ କରିପାରିବେ।',
      'exportBtn': 'ମୋର ତଥ୍ୟ ଡାଉନଲୋଡ୍ କରନ୍ତୁ',
      'deleteBtn': 'ଖାତା ବିଲୋପ ଅନୁରୋଧ (ଡିଲିଟ୍)',
      'retentionWarning': 'ଆଇନଗତ ସୂଚନା: ବ୍ୟକ୍ତିଗତ ପରିଚୟ ତୁରନ୍ତ ହଟାଯିବ, କିନ୍ତୁ ଆର୍ଥିକ ରେକର୍ଡ ୫ ବର୍ଷ ପର୍ଯ୍ୟନ୍ତ ସଂରକ୍ଷିତ ରହିବ।',
      'grievanceOfficer': 'ଅଭିଯୋଗ ନିବାରଣ ଅଧିକାରୀ',
      'grievanceName': 'ପ୍ରିୟଦର୍ଶିନୀ ମହାନ୍ତି',
      'grievanceCity': 'ଭୁବନେଶ୍ୱର, ଓଡ଼ିଶା, ଭାରତ',
    },
  };

  String _t(String key) {
    return _localizedStrings[_selectedLocale]?[key] ?? _localizedStrings['en']![key]!;
  }

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

  void _showDeleteConfirmation() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.redAccent),
            SizedBox(width: 8),
            Text(
              'Confirm Erasure Request',
              style: TextStyle(color: Colors.white, fontSize: 18),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Your profile identity, avatar, contact details, and sessions will be scrubbed and pseudonymised.',
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.withOpacity(0.4)),
              ),
              child: Text(
                _t('retentionWarning'),
                style: const TextStyle(color: Colors.amber, fontSize: 12),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Account erasure request submitted under DPDP Act 2023.'),
                  backgroundColor: Colors.redAccent,
                ),
              );
            },
            child: const Text('Confirm Erasure', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bgColor = _highContrast ? Colors.black : const Color(0xFF0B0F19);
    final cardColor = _highContrast ? const Color(0xFF121212) : const Color(0xFF111827);
    final borderColor = _highContrast ? Colors.white38 : const Color(0xFF1E293B);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        title: Semantics(
          header: true,
          label: _t('title'),
          child: Text(
            _t('title'),
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: Colors.white),
          ),
        ),
        actions: [
          // Language selector
          Semantics(
            label: 'Change Language',
            hint: 'Switches between English, Hindi, and Odia',
            child: PopupMenuButton<String>(
              icon: const Icon(Icons.language, color: Colors.blueAccent),
              onSelected: (loc) => setState(() => _selectedLocale = loc),
              itemBuilder: (ctx) => const [
                PopupMenuItem(value: 'en', child: Text('English (EN)')),
                PopupMenuItem(value: 'hi', child: Text('हिन्दी (Hindi)')),
                PopupMenuItem(value: 'or', child: Text('ଓଡ଼ିଆ (Odia)')),
              ],
            ),
          ),
          // High contrast toggle
          Semantics(
            label: 'Toggle High Contrast Mode',
            child: IconButton(
              icon: Icon(
                _highContrast ? Icons.contrast : Icons.brightness_medium,
                color: _highContrast ? Colors.amber : Colors.white70,
              ),
              onPressed: () => setState(() => _highContrast = !_highContrast),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.blueAccent,
          labelColor: Colors.blueAccent,
          unselectedLabelColor: Colors.white60,
          tabs: [
            Tab(text: _t('consentsTab')),
            Tab(text: _t('rightsTab')),
            Tab(text: _t('guardianTab')),
            Tab(text: _t('grievanceTab')),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildConsentsTab(cardColor, borderColor),
          _buildRightsTab(cardColor, borderColor),
          _buildGuardianTab(cardColor, borderColor),
          _buildGrievanceTab(cardColor, borderColor),
        ],
      ),
    );
  }

  // ─── TAB 1: GRANULAR REVOCABLE CONSENTS ─────────────────────────────────────
  Widget _buildConsentsTab(Color cardColor, Color borderColor) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Semantics(
          container: true,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cardColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: borderColor),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _t('granularConsentTitle'),
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Text(
                  _t('granularConsentDesc'),
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _buildConsentSwitch(
          title: 'Tournament Match Telemetry',
          subtitle: 'Required for anti-cheat verification and official score calculation.',
          value: _matchTelemetryConsent,
          isRequired: true,
          onChanged: null,
          cardColor: cardColor,
          borderColor: borderColor,
        ),
        _buildConsentSwitch(
          title: 'Analytics & Performance',
          subtitle: 'Anonymous crash and usage reporting to improve platform stability.',
          value: _analyticsConsent,
          isRequired: false,
          onChanged: (val) => setState(() => _analyticsConsent = val),
          cardColor: cardColor,
          borderColor: borderColor,
        ),
        _buildConsentSwitch(
          title: 'Promotional Push Notifications',
          subtitle: 'Receive alerts regarding upcoming prize pools and special tournaments.',
          value: _marketingPushConsent,
          isRequired: false,
          onChanged: (val) => setState(() => _marketingPushConsent = val),
          cardColor: cardColor,
          borderColor: borderColor,
        ),
        _buildConsentSwitch(
          title: 'Marketing & Newsletter Emails',
          subtitle: 'Occasional digests on national esports news and leaderboard standings.',
          value: _marketingEmailConsent,
          isRequired: false,
          onChanged: (val) => setState(() => _marketingEmailConsent = val),
          cardColor: cardColor,
          borderColor: borderColor,
        ),
        _buildConsentSwitch(
          title: 'Approximate Location (Region)',
          subtitle: 'Used solely to recommend regional tournaments and nearby ping servers.',
          value: _locationApproximateConsent,
          isRequired: false,
          onChanged: (val) => setState(() => _locationApproximateConsent = val),
          cardColor: cardColor,
          borderColor: borderColor,
        ),
        _buildConsentSwitch(
          title: 'Personalised Tournament Recommendations',
          subtitle: 'Tailors discovery feeds based on your favorite game titles and rank.',
          value: _profilingRecsConsent,
          isRequired: false,
          onChanged: (val) => setState(() => _profilingRecsConsent = val),
          cardColor: cardColor,
          borderColor: borderColor,
        ),
      ],
    );
  }

  Widget _buildConsentSwitch({
    required String title,
    required String subtitle,
    required bool value,
    required bool isRequired,
    required ValueChanged<bool>? onChanged,
    required Color cardColor,
    required Color borderColor,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: Semantics(
        label: '$title. $subtitle. Status: ${value ? "Granted" : "Revoked"}',
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                      if (isRequired) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.blueAccent.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'Required',
                            style: TextStyle(color: Colors.blueAccent, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(color: Colors.white60, fontSize: 12),
                  ),
                ],
              ),
            ),
            Switch(
              value: value,
              onChanged: onChanged,
              activeColor: Colors.blueAccent,
            ),
          ],
        ),
      ),
    );
  }

  // ─── TAB 2: DATA SUBJECT RIGHTS (DSR) ──────────────────────────────────────
  Widget _buildRightsTab(Color cardColor, Color borderColor) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1B4B),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF4338CA)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.shield_outlined, color: Color(0xFF818CF8)),
                  SizedBox(width: 8),
                  Text(
                    'DPDP Act 2023 Statutory Rights',
                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                _t('retentionWarning'),
                style: const TextStyle(color: Color(0xFFC7D2FE), fontSize: 13),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Data Portability (Export)',
                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              const Text(
                'Download an encrypted, machine-readable JSON archive of all your tournament records, team rosters, and support tickets.',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 12),
              Semantics(
                button: true,
                label: _t('exportBtn'),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF059669)),
                    icon: const Icon(Icons.download, color: Colors.white),
                    label: Text(_t('exportBtn'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Your personal data archive is preparing. Ready in ~60 seconds.'),
                          backgroundColor: Color(0xFF059669),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Right to Erasure (Account Deletion)',
                style: TextStyle(color: Colors.redAccent, fontSize: 15, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              const Text(
                'Permanently scrub your username, email, phone number, and avatar from live services. Historical match stats are pseudonymised.',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 12),
              Semantics(
                button: true,
                label: _t('deleteBtn'),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.redAccent,
                      side: const BorderSide(color: Colors.redAccent),
                    ),
                    icon: const Icon(Icons.delete_forever, color: Colors.redAccent),
                    label: Text(_t('deleteBtn'), style: const TextStyle(fontWeight: FontWeight.bold)),
                    onPressed: _showDeleteConfirmation,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── TAB 3: GUARDIAN CONSENT (DPDP ACT SEC 9) ──────────────────────────────
  Widget _buildGuardianTab(Color cardColor, Color borderColor) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.family_restroom, color: Colors.blueAccent),
                  SizedBox(width: 8),
                  Text(
                    'Minor Safeguards (Age Gate: 16-17)',
                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Per DPDP Act 2023 Section 9, esports participants under the age of 18 require verifiable parental or lawful guardian consent. Accounts for minors are locked to 100% free tournaments only.',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Guardian Verification Status:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _guardianStatus == 'VERIFIED' ? const Color(0xFF065F46) : const Color(0xFF78350F),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _guardianStatus == 'VERIFIED' ? 'VERIFIED' : 'PENDING',
                      style: TextStyle(
                        color: _guardianStatus == 'VERIFIED' ? const Color(0xFF6EE7B7) : const Color(0xFFFDE68A),
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── TAB 4: STATUTORY GRIEVANCE REDRESSAL (IT RULES 2021) ─────────────────
  Widget _buildGrievanceTab(Color cardColor, Color borderColor) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _t('grievanceOfficer'),
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              _buildGrievanceRow('Officer Name:', _t('grievanceName')),
              _buildGrievanceRow('Designation:', 'Resident Grievance Officer & DPO'),
              _buildGrievanceRow('Jurisdiction:', _t('grievanceCity')),
              _buildGrievanceRow('Official Email:', 'grievance-officer@vexora.gg'),
              _buildGrievanceRow('Emergency SLA:', '24 hours (Rule 3(2)(b))'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGrievanceRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(color: Colors.white60, fontSize: 13)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
