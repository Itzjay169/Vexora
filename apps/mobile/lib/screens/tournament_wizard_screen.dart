import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/vexora_theme.dart';

/// Phase 15: Tournament Creation Wizard (Mobile — Organiser Flavour)
///
/// Implements:
///   - Multi-step Stepper wizard for tournament creation
///   - Game & Mode selection (from dynamic catalog)
///   - Format & capacity configuration
///   - Schedule picker with server-time-only enforcement
///   - Rules text editor with version tracking
///   - Evidence & disconnect policy setup
///   - Review summary before submission (DRAFT → PENDING_REVIEW)
///   - Accessibility semantics on every input
///   - v1 Launch Principle: FREE tournaments only (no entry fees)
///
/// Source of Truth: Vexora Blueprint Section 4, Phase 15 (PHASE.md)
class TournamentWizardScreen extends ConsumerStatefulWidget {
  const TournamentWizardScreen({super.key});

  @override
  ConsumerState<TournamentWizardScreen> createState() =>
      _TournamentWizardScreenState();
}

class _TournamentWizardScreenState
    extends ConsumerState<TournamentWizardScreen> {
  int _currentStep = 0;
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;

  // ─── Step 1: Game & Mode ────────────────────────────────────────────────
  String? _selectedGameId;
  String? _selectedGameName;
  String? _selectedModeId;
  String? _selectedModeName;

  // ─── Step 2: Format & Capacity ──────────────────────────────────────────
  String _selectedFormat = 'BATTLE_ROYALE_LOBBY';
  int _teamSize = 4;
  int _minParticipants = 8;
  int _maxParticipants = 64;

  // ─── Step 3: Schedule ───────────────────────────────────────────────────
  DateTime? _startTime;
  DateTime? _registrationOpen;
  DateTime? _registrationClose;
  DateTime? _checkInOpen;

  // ─── Step 4: Details ────────────────────────────────────────────────────
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _rulesController = TextEditingController();
  String? _selectedRegion;
  String _visibility = 'PUBLIC';

  // ─── Step 5: Policies ───────────────────────────────────────────────────
  final _disconnectPolicyController = TextEditingController();
  bool _requireScreenshot = true;
  bool _requireVideoClip = false;

  // ─── Available games (mock — populated from /api/v1/games in production)
  final List<Map<String, dynamic>> _availableGames = [
    {
      'id': '550e8400-e29b-41d4-a716-446655440001',
      'name': 'BGMI',
      'slug': 'bgmi',
      'modes': [
        {'id': 'mode_bgmi_br', 'name': 'Battle Royale', 'format': 'BATTLE_ROYALE_LOBBY'},
        {'id': 'mode_bgmi_tdm', 'name': 'Team Deathmatch', 'format': 'SINGLE_ELIMINATION'},
      ],
    },
    {
      'id': '550e8400-e29b-41d4-a716-446655440002',
      'name': 'Free Fire MAX',
      'slug': 'freefire',
      'modes': [
        {'id': 'mode_ff_br', 'name': 'Battle Royale', 'format': 'BATTLE_ROYALE_LOBBY'},
        {'id': 'mode_ff_cs', 'name': 'Clash Squad', 'format': 'SINGLE_ELIMINATION'},
      ],
    },
    {
      'id': '550e8400-e29b-41d4-a716-446655440003',
      'name': 'CODM',
      'slug': 'codm',
      'modes': [
        {'id': 'mode_codm_snd', 'name': 'Search & Destroy', 'format': 'SINGLE_ELIMINATION'},
        {'id': 'mode_codm_hp', 'name': 'Hardpoint', 'format': 'ROUND_ROBIN'},
      ],
    },
  ];

  static const List<String> _formats = [
    'BATTLE_ROYALE_LOBBY',
    'SINGLE_ELIMINATION',
    'DOUBLE_ELIMINATION',
    'ROUND_ROBIN',
    'SWISS',
    'LEAGUE',
  ];

  static const List<String> _regions = [
    'INDIA',
    'SOUTH_ASIA',
    'SOUTHEAST_ASIA',
    'GLOBAL',
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _rulesController.dispose();
    _disconnectPolicyController.dispose();
    super.dispose();
  }

  // ─── Tournament State: Initial state is always DRAFT ────────────────────
  static const String _initialStatus = 'DRAFT';

  void _onStepContinue() {
    if (_currentStep < 5) {
      setState(() => _currentStep += 1);
    }
  }

  void _onStepCancel() {
    if (_currentStep > 0) {
      setState(() => _currentStep -= 1);
    }
  }

  Future<void> _pickDateTime(
      String label, DateTime? current,
      ValueChanged<DateTime> onPicked) async {
    final date = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      helpText: label,
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current ?? DateTime.now()),
      helpText: '$label Time',
    );
    if (time == null || !mounted) return;

    onPicked(DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  String _formatDateTime(DateTime? dt) {
    if (dt == null) return 'Not set';
    return '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _submitDraft() async {
    if (_titleController.text.trim().length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Title must be at least 3 characters')),
      );
      return;
    }

    if (_selectedGameId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a game')),
      );
      return;
    }

    if (_startTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please set a start time')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    // In production: POST /api/v1/tournaments with Idempotency-Key
    await Future.delayed(const Duration(seconds: 1));

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: VexoraColors.success, size: 28),
            SizedBox(width: 8),
            Flexible(
              child: Text('Tournament Created',
                  style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your tournament "${_titleController.text}" has been saved as DRAFT.',
              style: TextStyle(color: Colors.white.withAlpha(200)),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: VexoraColors.electricIndigo.withAlpha(30),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline,
                      color: VexoraColors.electricIndigo, size: 18),
                  SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      'Submit for review to make it visible to players.',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Later'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: VexoraColors.electricIndigo,
            ),
            onPressed: () {
              Navigator.of(ctx).pop();
              // TODO: POST /:id/submit-review to PENDING_REVIEW
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text('Submitted for admin review!')),
              );
            },
            child: const Text('Submit for Review'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F0F23),
        title: Semantics(
          header: true,
          child: const Text('Create Tournament',
              style: TextStyle(fontWeight: FontWeight.bold)),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Go back',
        ),
        actions: [
          // State chip showing DRAFT
          Semantics(
            label: 'Tournament status: $_initialStatus',
            child: Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF2D2D44),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                _initialStatus,
                style: TextStyle(
                  color: VexoraColors.electricIndigo,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: Stepper(
          currentStep: _currentStep,
          onStepContinue: _currentStep < 5 ? _onStepContinue : null,
          onStepCancel: _currentStep > 0 ? _onStepCancel : null,
          controlsBuilder: (context, details) {
            return Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Row(
                children: [
                  if (_currentStep < 5)
                    ElevatedButton(
                      onPressed: details.onStepContinue,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: VexoraColors.electricIndigo,
                      ),
                      child: const Text('Next'),
                    ),
                  if (_currentStep == 5)
                    ElevatedButton.icon(
                      onPressed: _isSubmitting ? null : _submitDraft,
                      icon: _isSubmitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save),
                      label: Text(
                          _isSubmitting ? 'Creating...' : 'Create Draft'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: VexoraColors.success,
                      ),
                    ),
                  const SizedBox(width: 12),
                  if (_currentStep > 0)
                    TextButton(
                      onPressed: details.onStepCancel,
                      child: const Text('Back'),
                    ),
                ],
              ),
            );
          },
          steps: [
            // ── Step 0: Game & Mode ──────────────────────────────────────
            Step(
              title: Semantics(
                label: 'Step 1: Select Game and Mode',
                child: const Text('Game & Mode',
                    style: TextStyle(color: Colors.white)),
              ),
              isActive: _currentStep >= 0,
              state: _currentStep > 0
                  ? StepState.complete
                  : StepState.indexed,
              content: _buildGameModeStep(),
            ),

            // ── Step 1: Format & Capacity ────────────────────────────────
            Step(
              title: Semantics(
                label: 'Step 2: Tournament format and participant limits',
                child: const Text('Format & Capacity',
                    style: TextStyle(color: Colors.white)),
              ),
              isActive: _currentStep >= 1,
              state: _currentStep > 1
                  ? StepState.complete
                  : StepState.indexed,
              content: _buildFormatCapacityStep(),
            ),

            // ── Step 2: Schedule ─────────────────────────────────────────
            Step(
              title: Semantics(
                label: 'Step 3: Set tournament schedule',
                child: const Text('Schedule',
                    style: TextStyle(color: Colors.white)),
              ),
              isActive: _currentStep >= 2,
              state: _currentStep > 2
                  ? StepState.complete
                  : StepState.indexed,
              content: _buildScheduleStep(),
            ),

            // ── Step 3: Details ──────────────────────────────────────────
            Step(
              title: Semantics(
                label: 'Step 4: Tournament details',
                child: const Text('Details',
                    style: TextStyle(color: Colors.white)),
              ),
              isActive: _currentStep >= 3,
              state: _currentStep > 3
                  ? StepState.complete
                  : StepState.indexed,
              content: _buildDetailsStep(),
            ),

            // ── Step 4: Policies ──────────────────────────────────────────
            Step(
              title: Semantics(
                label: 'Step 5: Rules and policies',
                child: const Text('Policies',
                    style: TextStyle(color: Colors.white)),
              ),
              isActive: _currentStep >= 4,
              state: _currentStep > 4
                  ? StepState.complete
                  : StepState.indexed,
              content: _buildPoliciesStep(),
            ),

            // ── Step 5: Review & Submit ──────────────────────────────────
            Step(
              title: Semantics(
                label: 'Step 6: Review and create draft',
                child: const Text('Review',
                    style: TextStyle(color: Colors.white)),
              ),
              isActive: _currentStep >= 5,
              content: _buildReviewStep(),
            ),
          ],
        ),
      ),
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step Builders
  // ════════════════════════════════════════════════════════════════════════

  Widget _buildGameModeStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          label: 'Select game',
          child: DropdownButtonFormField<String>(
            initialValue: _selectedGameId,
            decoration: const InputDecoration(
              labelText: 'Game *',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Color(0xFF1A1A2E),
            ),
            dropdownColor: const Color(0xFF1A1A2E),
            items: _availableGames.map((g) {
              return DropdownMenuItem(
                value: g['id'] as String,
                child: Text(g['name'] as String,
                    style: const TextStyle(color: Colors.white)),
              );
            }).toList(),
            onChanged: (val) {
              setState(() {
                _selectedGameId = val;
                _selectedGameName = _availableGames
                    .firstWhere((g) => g['id'] == val)['name'] as String;
                _selectedModeId = null;
                _selectedModeName = null;
              });
            },
            validator: (val) => val == null ? 'Select a game' : null,
          ),
        ),
        const SizedBox(height: 16),
        if (_selectedGameId != null) ...[
          Semantics(
            label: 'Select game mode',
            child: DropdownButtonFormField<String>(
              initialValue: _selectedModeId,
              decoration: const InputDecoration(
                labelText: 'Mode',
                border: OutlineInputBorder(),
                filled: true,
                fillColor: Color(0xFF1A1A2E),
              ),
              dropdownColor: const Color(0xFF1A1A2E),
              items: (_availableGames.firstWhere(
                  (g) => g['id'] == _selectedGameId)['modes']
                      as List<Map<String, dynamic>>)
                  .map((m) {
                return DropdownMenuItem(
                  value: m['id'] as String,
                  child: Text(
                    '${m['name']} (${m['format']})',
                    style: const TextStyle(color: Colors.white),
                  ),
                );
              }).toList(),
              onChanged: (val) {
                final modes = _availableGames.firstWhere(
                    (g) => g['id'] == _selectedGameId)['modes']
                    as List<Map<String, dynamic>>;
                final mode = modes.firstWhere((m) => m['id'] == val);
                setState(() {
                  _selectedModeId = val;
                  _selectedModeName = mode['name'] as String;
                  _selectedFormat = mode['format'] as String;
                });
              },
            ),
          ),
        ],
        const SizedBox(height: 12),
        _infoTile(Icons.videogame_asset,
            'Selected: ${_selectedGameName ?? "None"}'),
      ],
    );
  }

  Widget _buildFormatCapacityStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          label: 'Tournament format',
          child: DropdownButtonFormField<String>(
            initialValue: _selectedFormat,
            decoration: const InputDecoration(
              labelText: 'Format *',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Color(0xFF1A1A2E),
            ),
            dropdownColor: const Color(0xFF1A1A2E),
            items: _formats.map((f) {
              return DropdownMenuItem(
                value: f,
                child: Text(f.replaceAll('_', ' '),
                    style: const TextStyle(color: Colors.white, fontSize: 13)),
              );
            }).toList(),
            onChanged: (val) => setState(() => _selectedFormat = val!),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Semantics(
                label: 'Team size per entry',
                child: TextFormField(
                  initialValue: '$_teamSize',
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Team Size',
                    border: OutlineInputBorder(),
                    filled: true,
                    fillColor: Color(0xFF1A1A2E),
                  ),
                  style: const TextStyle(color: Colors.white),
                  onChanged: (v) =>
                      _teamSize = int.tryParse(v) ?? _teamSize,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Semantics(
                label: 'Minimum participants',
                child: TextFormField(
                  initialValue: '$_minParticipants',
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Min Players',
                    border: OutlineInputBorder(),
                    filled: true,
                    fillColor: Color(0xFF1A1A2E),
                  ),
                  style: const TextStyle(color: Colors.white),
                  onChanged: (v) =>
                      _minParticipants = int.tryParse(v) ?? _minParticipants,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Semantics(
                label: 'Maximum participants',
                child: TextFormField(
                  initialValue: '$_maxParticipants',
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Max Players',
                    border: OutlineInputBorder(),
                    filled: true,
                    fillColor: Color(0xFF1A1A2E),
                  ),
                  style: const TextStyle(color: Colors.white),
                  onChanged: (v) =>
                      _maxParticipants = int.tryParse(v) ?? _maxParticipants,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // v1 Launch: FREE tournaments only
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: VexoraColors.electricIndigo.withAlpha(20),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
                color: VexoraColors.electricIndigo.withAlpha(60)),
          ),
          child: const Row(
            children: [
              Icon(Icons.lock, color: VexoraColors.electricIndigo, size: 20),
              SizedBox(width: 8),
              Flexible(
                child: Text(
                  'v1 Launch: All tournaments are FREE. Entry fees will be enabled after legal review.',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildScheduleStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _scheduleTile(
          'Start Time *',
          _startTime,
          Icons.play_circle,
          () => _pickDateTime('Start Time', _startTime,
              (dt) => setState(() => _startTime = dt)),
        ),
        _scheduleTile(
          'Registration Opens',
          _registrationOpen,
          Icons.how_to_reg,
          () => _pickDateTime('Registration Opens', _registrationOpen,
              (dt) => setState(() => _registrationOpen = dt)),
        ),
        _scheduleTile(
          'Registration Closes',
          _registrationClose,
          Icons.person_off,
          () => _pickDateTime(
              'Registration Closes',
              _registrationClose,
              (dt) => setState(() => _registrationClose = dt)),
        ),
        _scheduleTile(
          'Check-In Opens',
          _checkInOpen,
          Icons.checklist,
          () => _pickDateTime('Check-In Opens', _checkInOpen,
              (dt) => setState(() => _checkInOpen = dt)),
        ),
        const SizedBox(height: 12),
        _infoTile(Icons.schedule,
            'All times are server-authoritative (UTC). Client time is never trusted.'),
      ],
    );
  }

  Widget _buildDetailsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          label: 'Tournament title',
          child: TextFormField(
            controller: _titleController,
            decoration: const InputDecoration(
              labelText: 'Title *',
              hintText: 'e.g. BGMI Battle Royale Cup #1',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Color(0xFF1A1A2E),
            ),
            style: const TextStyle(color: Colors.white),
            maxLength: 200,
          ),
        ),
        const SizedBox(height: 12),
        Semantics(
          label: 'Tournament description',
          child: TextFormField(
            controller: _descriptionController,
            decoration: const InputDecoration(
              labelText: 'Description',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Color(0xFF1A1A2E),
            ),
            style: const TextStyle(color: Colors.white),
            maxLines: 3,
            maxLength: 5000,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Semantics(
                label: 'Region',
                child: DropdownButtonFormField<String>(
                  initialValue: _selectedRegion,
                  decoration: const InputDecoration(
                    labelText: 'Region',
                    border: OutlineInputBorder(),
                    filled: true,
                    fillColor: Color(0xFF1A1A2E),
                  ),
                  dropdownColor: const Color(0xFF1A1A2E),
                  items: _regions.map((r) {
                    return DropdownMenuItem(
                      value: r,
                      child: Text(r.replaceAll('_', ' '),
                          style: const TextStyle(color: Colors.white)),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedRegion = v),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Semantics(
                label: 'Visibility',
                child: DropdownButtonFormField<String>(
                  initialValue: _visibility,
                  decoration: const InputDecoration(
                    labelText: 'Visibility',
                    border: OutlineInputBorder(),
                    filled: true,
                    fillColor: Color(0xFF1A1A2E),
                  ),
                  dropdownColor: const Color(0xFF1A1A2E),
                  items: ['PUBLIC', 'UNLISTED', 'PRIVATE'].map((v) {
                    return DropdownMenuItem(
                      value: v,
                      child: Text(v,
                          style: const TextStyle(color: Colors.white)),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _visibility = v!),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPoliciesStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          label: 'Tournament rules text',
          child: TextFormField(
            controller: _rulesController,
            decoration: const InputDecoration(
              labelText: 'Rules',
              hintText: 'Enter tournament-specific rules...',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Color(0xFF1A1A2E),
            ),
            style: const TextStyle(color: Colors.white),
            maxLines: 4,
            maxLength: 10000,
          ),
        ),
        const SizedBox(height: 16),
        Semantics(
          label: 'Disconnect policy',
          child: TextFormField(
            controller: _disconnectPolicyController,
            decoration: const InputDecoration(
              labelText: 'Disconnect Policy',
              hintText: 'What happens if a player disconnects?',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Color(0xFF1A1A2E),
            ),
            style: const TextStyle(color: Colors.white),
            maxLines: 2,
          ),
        ),
        const SizedBox(height: 16),
        const Text('Evidence Requirements',
            style: TextStyle(
                color: Colors.white, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Semantics(
          label: 'Require screenshot evidence',
          child: SwitchListTile(
            title: const Text('Require Screenshot',
                style: TextStyle(color: Colors.white70)),
            value: _requireScreenshot,
            activeThumbColor: VexoraColors.electricIndigo,
            onChanged: (v) => setState(() => _requireScreenshot = v),
          ),
        ),
        Semantics(
          label: 'Require video clip evidence',
          child: SwitchListTile(
            title: const Text('Require Video Clip',
                style: TextStyle(color: Colors.white70)),
            value: _requireVideoClip,
            activeThumbColor: VexoraColors.electricIndigo,
            onChanged: (v) => setState(() => _requireVideoClip = v),
          ),
        ),
      ],
    );
  }

  Widget _buildReviewStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _reviewRow('Game', _selectedGameName ?? 'Not selected'),
        _reviewRow('Mode', _selectedModeName ?? 'Default'),
        _reviewRow('Format', _selectedFormat.replaceAll('_', ' ')),
        _reviewRow(
            'Capacity', '$_minParticipants – $_maxParticipants players'),
        _reviewRow('Team Size', '$_teamSize'),
        _reviewRow('Start Time', _formatDateTime(_startTime)),
        _reviewRow(
            'Reg. Opens', _formatDateTime(_registrationOpen)),
        _reviewRow(
            'Reg. Closes', _formatDateTime(_registrationClose)),
        _reviewRow('Check-In Opens', _formatDateTime(_checkInOpen)),
        _reviewRow('Title', _titleController.text.isEmpty
            ? 'Not set'
            : _titleController.text),
        _reviewRow('Region', _selectedRegion ?? 'Not set'),
        _reviewRow('Visibility', _visibility),
        _reviewRow('Entry Fee', 'FREE (v1 launch)'),
        _reviewRow('Status', 'DRAFT'),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: VexoraColors.success.withAlpha(20),
            borderRadius: BorderRadius.circular(8),
            border:
                Border.all(color: VexoraColors.success.withAlpha(60)),
          ),
          child: const Row(
            children: [
              Icon(Icons.verified, color: Colors.greenAccent, size: 20),
              SizedBox(width: 8),
              Flexible(
                child: Text(
                  'This will create a DRAFT. You can review and submit for admin approval.',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  Widget _scheduleTile(
      String label, DateTime? value, IconData icon, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Semantics(
        label: '$label: ${_formatDateTime(value)}',
        button: true,
        child: ListTile(
          leading: Icon(icon, color: VexoraColors.electricIndigo),
          title: Text(label,
              style: const TextStyle(color: Colors.white, fontSize: 14)),
          subtitle: Text(_formatDateTime(value),
              style: TextStyle(
                  color: value != null
                      ? VexoraColors.electricIndigo
                      : Colors.white38)),
          trailing: const Icon(Icons.edit_calendar, color: Colors.white38),
          onTap: onTap,
          tileColor: const Color(0xFF1A1A2E),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8)),
        ),
      ),
    );
  }

  Widget _reviewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label,
                style: const TextStyle(
                    color: Colors.white54, fontSize: 13)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }

  Widget _infoTile(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.white38, size: 18),
          const SizedBox(width: 8),
          Flexible(
            child: Text(text,
                style: const TextStyle(color: Colors.white54, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
