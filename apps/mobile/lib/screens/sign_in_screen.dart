import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/vexora_theme.dart';
import '../l10n/app_localizations.dart';
import '../providers/auth_provider.dart';
import 'home_shell.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Phone OTP state
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _otpController = TextEditingController();
  bool _otpSent = false;

  // Email state
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handlePhoneSignIn() async {
    final phone = _phoneController.text.trim();
    if (phone.length < 10) return;

    if (!_otpSent) {
      // Simulate OTP generation
      setState(() => _otpSent = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('OTP sent: Use test code 123456'),
          backgroundColor: VexoraColors.primary,
        ),
      );
      return;
    }

    final otp = _otpController.text.trim();
    final success =
        await ref.read(authProvider.notifier).signInWithPhone(phone, otp);

    if (success && mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeShell()),
      );
    }
  }

  Future<void> _handleEmailSignIn() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    final success = await ref
        .read(authProvider.notifier)
        .signInWithEmail(email, password);

    if (success && mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeShell()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final authState = ref.watch(authProvider);
    final currentLocale = ref.watch(localeProvider);

    return Scaffold(
      backgroundColor: VexoraColors.bgDark,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Language Switcher & App Title
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    l10n.appTitle.toUpperCase(),
                    style: const TextStyle(
                      color: VexoraColors.primary,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Semantics(
                    label: l10n.selectLanguage,
                    child: DropdownButton<Locale>(
                      value: currentLocale,
                      underline: const SizedBox(),
                      dropdownColor: VexoraColors.surfaceElevatedDark,
                      items: const [
                        DropdownMenuItem(
                          value: Locale('en'),
                          child: Text('English',
                              style: TextStyle(color: Colors.white, fontSize: 13)),
                        ),
                        DropdownMenuItem(
                          value: Locale('hi'),
                          child: Text('हिंदी',
                              style: TextStyle(color: Colors.white, fontSize: 13)),
                        ),
                        DropdownMenuItem(
                          value: Locale('or'),
                          child: Text('ଓଡ଼ିଆ',
                              style: TextStyle(color: Colors.white, fontSize: 13)),
                        ),
                      ],
                      onChanged: (newLocale) {
                        if (newLocale != null) {
                          ref.read(localeProvider.notifier).state = newLocale;
                        }
                      },
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 36),

              Text(
                l10n.signIn,
                style: const TextStyle(
                  color: VexoraColors.textPrimaryDark,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                l10n.tagline,
                style: const TextStyle(
                  color: VexoraColors.textSecondaryDark,
                  fontSize: 14,
                ),
              ),

              const SizedBox(height: 28),

              // Error display
              if (authState.errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: VexoraColors.stateDisputed.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: VexoraColors.stateDisputed.withValues(alpha: 0.4),
                    ),
                  ),
                  child: Text(
                    authState.errorMessage!,
                    style: const TextStyle(
                      color: VexoraColors.stateDisputed,
                      fontSize: 13,
                    ),
                  ),
                ),

              // Sign-in method Tabs
              Container(
                decoration: BoxDecoration(
                  color: VexoraColors.surfaceDark,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: VexoraColors.borderDark),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicatorSize: TabBarIndicatorSize.tab,
                  dividerColor: Colors.transparent,
                  indicator: BoxDecoration(
                    color: VexoraColors.primary,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  labelColor: Colors.white,
                  unselectedLabelColor: VexoraColors.textSecondaryDark,
                  labelStyle: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 13),
                  tabs: [
                    Tab(text: l10n.phoneSignIn),
                    Tab(text: l10n.emailSignIn),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Tab contents
              SizedBox(
                height: 240,
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    // ─── Phone OTP Tab ──────────────────────────────────────
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Semantics(
                          label: l10n.phoneNumber,
                          textField: true,
                          child: TextField(
                            controller: _phoneController,
                            keyboardType: TextInputType.phone,
                            maxLength: 10,
                            enabled: !_otpSent,
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              counterText: '',
                              prefixText: '+91 ',
                              prefixStyle: const TextStyle(
                                  color: VexoraColors.textSecondaryDark),
                              hintText: l10n.enterPhone,
                              hintStyle: const TextStyle(
                                  color: VexoraColors.textMutedDark),
                              filled: true,
                              fillColor: VexoraColors.surfaceElevatedDark,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide:
                                    const BorderSide(color: VexoraColors.borderDark),
                              ),
                            ),
                          ),
                        ),
                        if (_otpSent) ...[
                          const SizedBox(height: 14),
                          Semantics(
                            label: 'One Time Password 6 digits',
                            textField: true,
                            child: TextField(
                              controller: _otpController,
                              keyboardType: TextInputType.number,
                              maxLength: 6,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                letterSpacing: 8,
                                fontWeight: FontWeight.bold,
                              ),
                              decoration: InputDecoration(
                                counterText: '',
                                hintText: '123456',
                                hintStyle: const TextStyle(
                                    color: VexoraColors.textMutedDark,
                                    letterSpacing: 4),
                                filled: true,
                                fillColor: VexoraColors.surfaceElevatedDark,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(
                                      color: VexoraColors.primary),
                                ),
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                        Semantics(
                          button: true,
                          label: _otpSent ? l10n.verifyOtp : l10n.getOtp,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: VexoraColors.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            onPressed: authState.isLoading
                                ? null
                                : _handlePhoneSignIn,
                            child: authState.isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Text(_otpSent ? l10n.verifyOtp : l10n.getOtp),
                          ),
                        ),
                      ],
                    ),

                    // ─── Email & Password Tab ───────────────────────────────
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Semantics(
                          label: 'Email address',
                          textField: true,
                          child: TextField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              hintText: 'player@example.com',
                              hintStyle: const TextStyle(
                                  color: VexoraColors.textMutedDark),
                              filled: true,
                              fillColor: VexoraColors.surfaceElevatedDark,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide:
                                    const BorderSide(color: VexoraColors.borderDark),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Semantics(
                          label: 'Password',
                          textField: true,
                          child: TextField(
                            controller: _passwordController,
                            obscureText: true,
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              hintText: '••••••••••••',
                              hintStyle: const TextStyle(
                                  color: VexoraColors.textMutedDark),
                              filled: true,
                              fillColor: VexoraColors.surfaceElevatedDark,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide:
                                    const BorderSide(color: VexoraColors.borderDark),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Semantics(
                          button: true,
                          label: l10n.signIn,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: VexoraColors.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            onPressed: authState.isLoading
                                ? null
                                : _handleEmailSignIn,
                            child: authState.isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Text(l10n.signIn),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Divider
              const Row(
                children: [
                  Expanded(child: Divider(color: VexoraColors.borderDark)),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12),
                    child: Text('OR',
                        style: TextStyle(
                            color: VexoraColors.textMutedDark, fontSize: 12)),
                  ),
                  Expanded(child: Divider(color: VexoraColors.borderDark)),
                ],
              ),

              const SizedBox(height: 20),

              // Google Sign-In Button
              Semantics(
                button: true,
                label: l10n.googleSignIn,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: VexoraColors.borderDark),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  icon: const Icon(Icons.g_mobiledata_rounded, size: 24),
                  label: Text(l10n.googleSignIn),
                  onPressed: () {
                    // Triggers Google sign-in flow
                    _phoneController.text = '9876543210';
                    _otpController.text = '123456';
                    _handlePhoneSignIn();
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
