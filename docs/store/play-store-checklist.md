# Vexora — Google Play Store Submission Checklist
# Phase 38: Store Preparation & Release Candidate

**App ID:** `com.vexora.vexora_mobile`
**Version:** 1.0.0+1
**Target SDK:** 34 (Android 14)
**Min SDK:** 21 (Android 5.0 Lollipop)
**Date:** 2026-10-19

---

## 1. Privacy & Data Safety Form

| Data Category | Collected | Shared | Required | Purpose |
|---|---|---|---|---|
| Name | ✅ | ❌ | ✅ Required | Account creation |
| Email address | ✅ | ❌ | ✅ Required | Account creation, notifications |
| Phone number | ✅ | ❌ | ✅ Required | OTP verification (Firebase Auth) |
| User IDs | ✅ | ❌ | ✅ Required | Platform identity (pseudonymised) |
| Device ID | ✅ | ❌ | Optional | Fraud detection (hashed + rotating salt) |
| Location | ❌ | ❌ | Optional | NOT collected in v1 |
| Purchase history | ✅ | ❌ | ✅ Required | Tournament entry fees, wallet ledger |
| Payment info | ❌ | ❌ | — | Handled by Razorpay/Cashfree (not stored raw) |
| App interactions | ✅ | ❌ | Optional | Analytics (consent-gated, no PII in event names) |
| Crash logs | ✅ | ❌ | Optional | Firebase Crashlytics |
| Diagnostics | ✅ | ❌ | Optional | Performance monitoring |

### Data Safety Form Answers (Google Play Console)
- **Is all of the user data collected by your app encrypted in transit?** YES — TLS 1.3 enforced.
- **Do you provide a way for users to request that their data is deleted?** YES — In-app account deletion at `Settings → Privacy → Delete Account`. Data Subject Request workflow with 30-day SLA.
- **Do you collect data that is required vs optional?** YES — Clearly labelled per DPDP Act 2023 consent forms.

---

## 2. Permissions Review

| Permission | AndroidManifest | Justification | Play Policy |
|---|---|---|---|
| `INTERNET` | ✅ Required | API communication | Essential |
| `POST_NOTIFICATIONS` | ✅ Requested at runtime | FCM push notifications | Prompt with rationale |
| `USE_BIOMETRIC` | ✅ Requested at runtime | Wallet/payout authorization gate | Prompt before first use |
| `USE_FINGERPRINT` | ✅ Requested at runtime | Fallback biometric | Prompt before first use |
| `CAMERA` | ✅ Requested at runtime | Match evidence screenshots | Prompt at submission screen only |
| `READ_EXTERNAL_STORAGE` | ✅ Android ≤12 only | Evidence upload | Prompt at evidence screen |
| `READ_MEDIA_IMAGES` | ✅ Android 13+ only | Photo picker for evidence | Prompt at evidence screen |
| `VIBRATE` | ✅ Normal | Match start vibration | No prompt |
| `RECEIVE_BOOT_COMPLETED` | ✅ Normal | FCM alarm manager | No prompt |
| `FOREGROUND_SERVICE` | ❌ NOT used | — | — |
| `ACCESS_FINE_LOCATION` | ❌ NOT used | Location not collected in v1 | — |
| `READ_CONTACTS` | ❌ NOT used | — | — |

**Dangerous Permissions Justification Document:** All runtime permissions are accompanied by in-context rationale dialogs before the system prompt. Camera used exclusively for evidence upload; biometric used exclusively for wallet authorization. No background collection.

---

## 3. Age Rating

**Questionnaire Answers (Play Console → Rating):**

| Category | Answer |
|---|---|
| Violence | Mild — tournament results, competitive gaming |
| Sexual content | None |
| Profanity | None — in-app chat has profanity filter (Phase 34) |
| Gambling/gambling-like content | No — tournaments are skill-based competitions per Indian law |
| User-generated content | Yes — match result screenshots, profile avatars |
| UGC moderation | Yes — Phase 23 moderation system active |
| Location sharing | No |
| In-app purchases | Yes — tournament entry fees (FREE only at launch) |
| Digital goods | No — no loot boxes, no cosmetics for purchase in v1 |

**Expected Rating:** Everyone (E) / 3+ (PEGI)

---

## 4. App Store Assets Checklist

### Screenshots Required
| Screen Size | Count | Status |
|---|---|---|
| Phone (1080×1920 or 1080×2400) | 4–8 | ☐ Pending Fastlane upload |
| 7-inch tablet | 4–8 | ☐ Optional for v1 |
| 10-inch tablet | 4–8 | ☐ Optional for v1 |

### Screenshot Content Plan (Vexora Flow)
1. Tournament Discovery Feed (`tournament_discovery_screen.dart`)
2. Live Bracket & Leaderboard (`bracket_screen.dart` / `leaderboard_screen.dart`)
3. Wallet & Prize Transparency (`wallet_screen.dart` / `payment_escrow_screen.dart`)
4. Player Profile & Achievements (`player_dashboard_screen.dart` / `achievements_screen.dart`)
5. Result Submission with Evidence (`result_submission_screen.dart`)
6. Organiser Dashboard (`organiser_dashboard_screen.dart`)

### Feature Graphic
- 1024×500px banner: Dark esports aesthetic with Vexora branding
- Status: ☐ Pending design asset

### App Icon
- 512×512px, no rounded corners (Play adds them)
- Status: ☐ Uses current app_icon from pubspec assets

---

## 5. In-App Account Deletion

**Path:** `Settings → Privacy Centre → Delete My Account`

**Implementation:** `privacy_compliance_screen.dart` — Section "Account Erasure"
- User must confirm with password or OTP re-authentication.
- 30-day grace period window (account soft-deleted, re-activation possible).
- After 30 days: PII erased, ledger pseudonymised (financial records retained per PMLA 5 years).
- Deep link: `vexora://privacy/delete-account`
- API endpoint: `DELETE /api/v1/compliance/data-subject-requests` (type: `ERASURE`)

**Google Policy:** Compliant with [Play Policy on Account Deletion](https://support.google.com/googleplay/android-developer/answer/13327111).

---

## 6. Store Listing Content

### Title
`Vexora — Esports Tournaments`

### Short Description (80 chars)
`Join, compete & win in verified esports tournaments. Safe. Fair. Transparent.`

### Full Description (4000 chars limit)
```
🏆 VEXORA ESPORTS TOURNAMENTS

Compete in verified, fair esports tournaments on India's most transparent platform.

■ FOR PLAYERS
• Discover and join tournaments for BGMI, Free Fire, Call of Duty Mobile, and more
• Real-time live brackets, match schedules, and leaderboards
• Submit match results with screenshot evidence — results locked after verification
• Dispute unfair results with independent moderation within 72 hours
• Win prizes direct to your verified wallet — transparent prize escrow shown before registration
• Earn achievement badges for participation, fair play, and performance
• Track your tournament history, ratings, and stat cards

■ FOR ORGANISERS
• Create and manage tournaments with flexible formats (Single Elimination, Double Elimination, Round Robin, Swiss, Battle Royale)
• Automated bracket generation, check-in, and result collection
• Prize escrow locked before registration opens — no rug pulls
• Co-organisers, referees, and bulk result entry
• Post-tournament analytics and payout management

■ TRUST & SAFETY FIRST
• All prize money is pre-funded in escrow before registration opens (not after)
• Independent dispute resolution for contested results
• Fair-play pledge system with transparent scoring
• Report/mute/block and profanity filtering in all chat
• Moderated platform — verified organisers only

■ PRIVACY & COMPLIANCE
• DPDP Act 2023 compliant — granular consent, data export, account deletion
• No phone numbers shared with other users
• In-app grievance officer contact (IT Rules 2021)

■ LAUNCH OFFER
Starting with FREE tournaments only — join and compete at no cost.

Built in India, for Indian esports.
```

### Contact Email
`support@vexora.in`

### Privacy Policy URL
`https://vexora.in/legal/privacy`

### Terms of Service URL
`https://vexora.in/legal/terms`

---

## 7. Content Rating Review Notes

**For Google Review Team:**
- The app is a skill-based competitive gaming tournament platform.
- All real-money features are behind feature flags — **disabled at launch**.
- Launch version: FREE tournaments only. No gambling, no loot boxes, no pay-to-win.
- User-generated content (result screenshots) is moderated by our moderation team within 72 hours.
- Chat is filtered and rate-limited. Users can block/mute/report.
- This is not a social platform. UGC is limited to tournament contexts only.

---

## 8. Kill-Switch Verification (Remote Config)

| Flag | Default at Launch | Verified |
|---|---|---|
| `real_money_wallet_enabled` | FALSE | ☐ |
| `paid_tournament_enabled` | FALSE | ☐ |
| `wallet_withdrawals_enabled` | FALSE | ☐ |
| `organiser_registration_enabled` | TRUE | ☐ |
| `tournament_registration_enabled` | TRUE | ☐ |
| `publishing_enabled` | TRUE | ☐ |

All flags must be verified in Firebase Remote Config staging before RC tag.

---

## 9. Pre-Submission Security Gate

- [ ] Two-person approval for wallet/payment modules in release commit
- [ ] Signing key stored in secure keystore (not in repository)
- [ ] `google-services.json` uses production Firebase project values
- [ ] App Check enforced in production (`firebase_app_check`)
- [ ] Certificate pinning configured with rotation plan
- [ ] ProGuard/R8 obfuscation enabled for release builds
- [ ] No debug logs in release build (`kReleaseMode` guards)
- [ ] No hardcoded API keys or secrets in APK (verified by pre-commit scan)
- [ ] Play Integrity API configured
- [ ] Minimum SDK 21, Target SDK 34

---

## 10. Exit Criteria

- [ ] Data safety form complete and submitted to Play Console
- [ ] All permissions justified in manifest and runtime rationale dialogs verified
- [ ] Age rating questionnaire complete — rating received
- [ ] Store listing assets uploaded (icon, screenshots, feature graphic)
- [ ] Account deletion flow tested end-to-end
- [ ] Kill-switch flags verified in Remote Config
- [ ] Security gate sign-off from two engineers (wallet + auth modules)
- [ ] RC build produced and passes full E2E on staging
