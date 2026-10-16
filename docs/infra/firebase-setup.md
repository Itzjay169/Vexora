# Vexora Firebase Architecture & Provisioning Guide

> **Reference: Blueprint Sections 15, 37, 38 & PHASE.md Phase 3**  
> Firebase is utilized strictly for **Identity**, **Device Attestation**, **Push Notifications**, **Remote Config**, and **Crashlytics**.  
> **SYSTEM OF RECORD INVARIANT:** Firebase NEVER stores financial balances, transaction ledgers, tournament scores, or dispute records.

---

## 1. Multi-Environment Project Configuration

| Setting | DEV Environment | PROD Environment |
| :--- | :--- | :--- |
| **Project ID** | `vexora-esports-dev` | `vexora-esports-prod` |
| **Project Name** | Vexora Esports (Dev) | Vexora Esports (Production) |
| **GCP Region** | `asia-south1` (Mumbai) | `asia-south1` (Mumbai) |
| **Auth Providers** | Phone (Test OTPs enabled), Email/Password, Google OAuth | Phone (SMS Gateway), Email/Password, Google OAuth |
| **Android App ID** | `gg.vexora.app.dev` | `gg.vexora.app` |
| **iOS Bundle ID** | `gg.vexora.ios.dev` | `gg.vexora.ios` |
| **Service Account Access** | Scoped DEV key via `FIREBASE_DEV_CREDENTIALS` | KMS Secret Manager; restricted release pipeline only |

---

## 2. Authentication Configuration
- **Phone Number Authentication**:
  - Primary authentication method for competitive players.
  - Test phone numbers pre-configured in DEV console for automated testing:
    - `+91 99999 11111` -> Code: `123456` (Test Admin)
    - `+91 99999 22222` -> Code: `123456` (Test Organiser)
    - `+91 99999 33333` -> Code: `123456` (Test Player 1)
- **Email Link & Password**:
  - Secondary fallback and desktop admin authentication.
- **Google OAuth**:
  - One-tap sign-in option for rapid mobile onboarding.

---

## 3. App Check & Device Attestation (Zero Trust)
To prevent bot farming, scripted match submissions, and emulator spoofing:
- **Android**: Enforced via **Play Integrity API** (Meets device integrity requirements).
- **iOS**: Enforced via **DeviceCheck** and **App Attest**.
- **Web Portal & Admin**: Enforced via **reCAPTCHA Enterprise**.
- **Local Dev Bypass (Debug Tokens)**:
  - In local development, developers export `FIREBASE_APP_CHECK_DEBUG_TOKEN` to bypass attestation checks.
  - Production App Check is strictly set to **Enforce** mode.

---

## 4. Remote Config Parameter Registry

| Parameter Key | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `enable_real_money` | Boolean | `false` | Global statutory switch. MUST remain false until legal sign-off. |
| `min_app_version` | String | `"1.0.0"` | Minimum supported client version; triggers forced update prompt. |
| `maintenance_mode` | Boolean | `false` | System-wide maintenance lock; displays status banner. |
| `killswitch_states` | JSON Array| `["AP", "TG", "AS", "OR", "NL", "SK", "TN"]` | Indian states where paid features are strictly geoblocked. |
| `dispute_window_minutes` | Number | `15` | Dual-confirmation window duration for match result challenges. |
| `max_starter_tournaments` | Number| `3` | Maximum concurrent free tournaments a Starter organiser can host. |

---

## 5. Firebase Cloud Messaging (FCM) Topics & Channels
- **Notification Topics**:
  - `global_announcements`: Platform-wide tournament releases.
  - `tournament_{id}`: Real-time round updates, room-code releases, and bracket advances.
  - `dispute_{id}`: Moderator pings for urgent adjudication.
- **Android Notification Channels**:
  - `vexora_match_alerts` (Importance: HIGH, Vibration: Enabled)
  - `vexora_security_alerts` (Importance: MAX)
  - `vexora_general_news` (Importance: DEFAULT)
