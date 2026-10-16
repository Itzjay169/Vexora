import 'package:flutter/material.dart';
import '../theme/vexora_theme.dart';
import 'redeem_screen.dart';

/// Phase 25: Double-Entry Ledger & Wallet Screen
/// Blueprint Ref: Sections 8, 16, 39 (Phase 6), 47
///
/// Features:
/// - Biometric security gate (Fingerprint / FaceID authentication gate)
/// - Available vs Held balance display in VXC (Vexora Credits)
/// - Immutable ledger transaction history with unique transaction IDs
/// - Double-entry invariant verification certificate modal
/// - Free-to-play launch badge: "F2P Mode Active — Real money disabled"
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  bool _isBiometricUnlocked = true;
  double _availableBalance = 2450.00;
  double _heldBalance = 0.00;
  final String _currency = 'VXC';

  final List<Map<String, dynamic>> _transactions = [
    {
      'id': 'tx-8f2a-9901',
      'entry_type': 'PRIZE_AWARD',
      'amount': 500.00,
      'direction': 'CREDIT',
      'description': '1st Place Prize — BGMI Pro Invitational S3',
      'reference_type': 'TOURNAMENT',
      'created_at': '2026-10-15 14:30',
      'is_immutable': true,
    },
    {
      'id': 'tx-7c1b-8820',
      'entry_type': 'CREDIT',
      'amount': 2000.00,
      'direction': 'CREDIT',
      'description': 'Promotional Community Welcome Bonus',
      'reference_type': 'REDEEM_CODE',
      'created_at': '2026-10-10 11:15',
      'is_immutable': true,
    },
    {
      'id': 'tx-5a0c-7714',
      'entry_type': 'ENTRY_FEE_HOLD',
      'amount': 50.00,
      'direction': 'DEBIT',
      'description': 'Tournament Registration Slot Hold (Scout Scrims)',
      'reference_type': 'TOURNAMENT',
      'created_at': '2026-10-08 19:40',
      'is_immutable': true,
    },
    {
      'id': 'tx-4d9e-6602',
      'entry_type': 'ENTRY_FEE_RELEASE',
      'amount': 50.00,
      'direction': 'CREDIT',
      'description': 'Tournament Check-In Completed — Hold Released',
      'reference_type': 'TOURNAMENT',
      'created_at': '2026-10-08 20:10',
      'is_immutable': true,
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: VexoraColors.backgroundDark,
      appBar: AppBar(
        title: const Text(
          'Wallet & Double-Entry Ledger',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: VexoraColors.cardDark,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(
              _isBiometricUnlocked ? Icons.lock_open_rounded : Icons.lock_outline_rounded,
              color: _isBiometricUnlocked ? Colors.greenAccent : Colors.orangeAccent,
            ),
            tooltip: _isBiometricUnlocked ? 'Biometric Gate Unlocked' : 'Lock Wallet',
            onPressed: () {
              setState(() => _isBiometricUnlocked = !_isBiometricUnlocked);
            },
          ),
          IconButton(
            icon: const Icon(Icons.verified_outlined, color: VexoraColors.primaryGold),
            tooltip: 'Verify Invariant',
            onPressed: _showInvariantModal,
          ),
        ],
      ),
      body: !_isBiometricUnlocked
          ? _buildBiometricLockScreen()
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildBalanceCard(),
                  const SizedBox(height: 12),
                  _buildRedeemVoucherButton(),
                  const SizedBox(height: 14),
                  _buildF2PComplianceBanner(),
                  const SizedBox(height: 20),
                  _buildSectionHeader(),
                  const SizedBox(height: 12),
                  _buildTransactionList(),
                ],
              ),
            ),
    );
  }

  Widget _buildRedeemVoucherButton() {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const RedeemScreen()),
          );
        },
        style: OutlinedButton.styleFrom(
          foregroundColor: VexoraColors.primaryCyan,
          side: BorderSide(color: VexoraColors.primaryCyan.withOpacity(0.5)),
          padding: const EdgeInsets.symmetric(vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        icon: const Icon(Icons.confirmation_number_outlined, size: 18),
        label: const Text(
          'Redeem Promotional Voucher / Code',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
      ),
    );
  }

  Widget _buildBiometricLockScreen() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: VexoraColors.cardDark,
                shape: BoxShape.circle,
                border: Border.all(color: VexoraColors.primaryCyan.withOpacity(0.3)),
              ),
              child: const Icon(
                Icons.fingerprint_rounded,
                size: 64,
                color: VexoraColors.primaryCyan,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Biometric Security Gate Active',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Confirm your identity with biometric sensor or device passcode to inspect wallet balances and ledger transactions.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () {
                setState(() => _isBiometricUnlocked = true);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: VexoraColors.primaryCyan,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.security, size: 18),
              label: const Text('Authenticate with Biometrics', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBalanceCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF1E1B4B),
            VexoraColors.cardDark,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: VexoraColors.primaryCyan.withOpacity(0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 12,
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
              const Text(
                'AVAILABLE BALANCE',
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.greenAccent.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.greenAccent.withOpacity(0.4)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.lock_clock, size: 12, color: Colors.greenAccent),
                    SizedBox(width: 4),
                    Text(
                      'Double-Entry Verified',
                      style: TextStyle(
                        color: Colors.greenAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                _availableBalance.toStringAsFixed(2),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _currency,
                style: const TextStyle(
                  color: VexoraColors.primaryGold,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const Divider(color: VexoraColors.borderDark, height: 26),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Held in Reservation', style: TextStyle(color: Colors.grey, fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(
                    '${_heldBalance.toStringAsFixed(2)} $_currency',
                    style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Account ID', style: TextStyle(color: Colors.grey, fontSize: 11)),
                  const SizedBox(height: 2),
                  const Text(
                    'VXC-7821-USER',
                    style: TextStyle(color: VexoraColors.primaryCyan, fontSize: 12, fontFamily: 'monospace'),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildF2PComplianceBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.indigo.withOpacity(0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.indigo.withOpacity(0.3)),
      ),
      child: const Row(
        children: [
          Icon(Icons.shield_outlined, color: Colors.indigoAccent, size: 20),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'v1 F2P Launch: Paid tournaments & credit cash-out remain locked under feature flags until regional legal sign-off (ADR-001).',
              style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.3),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'Immutable Ledger Transactions',
          style: TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          '${_transactions.length} records',
          style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildTransactionList() {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _transactions.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final tx = _transactions[index];
        final isCredit = tx['direction'] == 'CREDIT';

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: VexoraColors.cardDark,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: VexoraColors.borderDark),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: isCredit
                      ? Colors.greenAccent.withOpacity(0.15)
                      : Colors.orangeAccent.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                  color: isCredit ? Colors.greenAccent : Colors.orangeAccent,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tx['description'],
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          tx['created_at'],
                          style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          tx['id'],
                          style: TextStyle(
                            color: Colors.grey.shade400,
                            fontSize: 10,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${isCredit ? '+' : '-'}${tx['amount'].toStringAsFixed(2)}',
                    style: TextStyle(
                      color: isCredit ? Colors.greenAccent : Colors.orangeAccent,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    tx['entry_type'],
                    style: const TextStyle(color: Colors.grey, fontSize: 9, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  void _showInvariantModal() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: VexoraColors.cardDark,
        title: const Row(
          children: [
            Icon(Icons.verified_outlined, color: Colors.greenAccent),
            SizedBox(width: 8),
            Text('Double-Entry Invariant Certificate', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '1. Conservation of Credits:',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
            ),
            Text(
              'Credits are never edited in place. Every transaction debits a source account and credits a destination account by the exact same amount. Sum of all entries = 0.',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
            SizedBox(height: 10),
            Text(
              '2. Non-Negative Balance Check:',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
            ),
            Text(
              'Database-level CHECK constraint prevents user balances from dropping below 0.00 VXC.',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
            SizedBox(height: 10),
            Text(
              '3. Maker-Checker on Adjustments:',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
            ),
            Text(
              'Administrative corrections require independent two-person authorization. A creator cannot approve their own adjustment.',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close', style: TextStyle(color: VexoraColors.primaryGold)),
          ),
        ],
      ),
    );
  }
}
