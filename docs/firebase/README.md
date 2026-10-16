# Vexora Firebase Project Setup & Configuration (DEV & PROD)

This document outlines the architecture, configuration parameters, and operational runbook for Firebase services utilized by the Vexora Esports Tournament Platform across Development (`vexora-esports-dev`) and Production (`vexora-esports-prod`) environments.

---

## 1. Projects & Architecture Overview

| Environment | Firebase Project ID | Region | Purpose |
| :--- | :--- | :--- | :--- |
| **Development** | `vexora-esports-dev` | `asia-south1` (Mumbai) | Local development, emulator testing, CI smoke runs, staging QA |
| **Production** | `vexora-esports-prod` | `asia-south1` (Mumbai) | Public releases, live player telemetry, production push delivery |

> **System of Record Boundary**:
> Firebase handles **Identity Verification (Phone OTP, Email, Google)**, **Push Notifications (FCM)**, **App Check / Attestation**, **Remote Config**, and **Crashlytics**.
> **PostgreSQL is the sole System of Record** for all wallet balances, ledger entries, tournament states, match scores, brackets, and audit trails. No financial or competitive state is ever stored in Firebase Firestore or Realtime Database.

---

## 2. Authentication Providers

Enabled authentication methods in both environments:
1. **Phone Number Authentication (SMS OTP)**
   - Primary login mechanism for mobile esports players in India and SEA.
   - Throttling: 5 attempts per IP / device per hour.
   - Whitelisted test phone numbers in DEV: `+91 99999 99999` (Code: `123456`) for local and Playwright test fixtures.
2. **Email / Password**
   - For administrative, moderator, and organiser portal access.
   - Requires email verification before tournament publishing permissions are granted.
3. **Google Sign-In (OAuth 2.0)**
   - Optional quick sign-in for player profile discovery.

---

## 3. Registered Client Applications

| Platform | Application ID | Environment | Notes |
| :--- | :--- | :--- | :--- |
| **Android** | `gg.vexora.app` | DEV / PROD | SHA-256 fingerprints registered for debug and release keystores |
| **iOS** | `gg.vexora.app` | DEV / PROD | APNs authentication key uploaded with team ID and bundle ID |
| **Web Portal** | `vexora-web` | DEV / PROD | Authorized domain: `localhost`, `*.vexora.gg` |
| **Admin Console**| `vexora-admin` | DEV / PROD | Authorized domain: `localhost`, `admin.vexora.gg` |

---

## 4. App Check & Device Attestation

To safeguard backend APIs and Firebase resources from unauthorized bots, scrapers, and scripted abusers:
- **Android**: Play Integrity API provider.
- **iOS**: DeviceCheck / App Attest provider.
- **Web**: reCAPTCHA Enterprise / Cloudflare Turnstile integration.
- **Development & CI**: Debug tokens registered in the Firebase console.
  - Debug Token environment variable: `FIREBASE_APP_CHECK_DEBUG_TOKEN`.
  - Backend validation middleware permits verified debug tokens when `NODE_ENV=development`.

---

## 5. Firebase Cloud Messaging (FCM) Topics & Structure

Standard notification channels:
- `global_announcements`: Platform-wide emergency notices and server maintenance alerts.
- `tournament_{tournament_id}`: Match scheduling, room ID / password release, round progression.
- `team_{team_id}`: Roster invites, transfer approvals, captain notices.
- `user_{user_id}`: Personal security alerts, dispute resolutions, and payout status updates.

*Payload Rule*: Push payloads must NEVER contain sensitive room passwords, wallet balances, or PII. Push messages contain entity IDs, prompting the client application to fetch authenticated details securely over TLS.

---

## 6. Remote Config Default Schema

| Parameter Name | Data Type | Default Value (DEV) | Default Value (PROD) | Description |
| :--- | :--- | :--- | :--- | :--- |
| `flag_real_money_enabled` | Boolean | `false` | `false` | Global kill-switch for paid tournaments and cashouts |
| `flag_maintenance_mode` | Boolean | `false` | `false` | Enforces read-only maintenance banner |
| `min_app_version` | String | `"1.0.0"` | `"1.0.0"` | Minimum supported client build version |
| `max_tournament_capacity` | Number | `128` | `256` | Maximum teams allowed per tournament |
| `dispute_window_minutes` | Number | `15` | `15` | Time window to challenge match results |

---

## 7. Local Development via Firebase Emulators

For rapid offline development, developers can run the Firebase emulator suite configured in `firebase.json`:
```bash
# Start Auth and Firestore emulators locally
npx firebase-tools emulators:start
```
- Auth Emulator: `http://localhost:9099`
- Emulator UI: `http://localhost:4000`
