# Vexora STRIDE Threat Model & Security Architecture (v1 Blueprint)

**Classification**: Confidential / Engineering Reference  
**Security Gate**: Phase 4 Technical Sign-Off  
**References**: Blueprint Sections 18, 19, 47, and OWASP ASVS 4.0 / MASVS  

---

## 1. Threat Modeling Scope & System Boundaries

This document analyzes the primary threat surfaces across the Vexora Esports Tournament Platform:
1. **Authentication & Identity Subsystem** (Client apps, Firebase Auth, JWT issuer, Session store).
2. **Financial Wallet & Double-Entry Ledger** (Credit ledger, reservations, prize escrow, payouts).
3. **Tournament Lifecycle, Results & Scoring Engine** (Match scheduling, room codes, result submissions, scoring schemas, leaderboards).
4. **Desktop Admin & Moderation Console** (RBAC, Maker-Checker authorization queue, break-glass protocol, audit verification).
5. **Edge, Ingress & Infrastructure** (API Gateway, Redis pub/sub, WebSocket server, S3 evidence storage).

---

## 2. In-Depth STRIDE Matrix & Architectural Mitigations

### 2.1 Spoofing (Identity Impersonation)

| Threat ID | Target Asset | Attack Scenario | Impact | Architectural Mitigation & Security Control | Verification Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S-01** | Client API | Attacker crafts synthetic HTTP requests claiming to be an authenticated player. | High | **Firebase ID Token Exchange**: Backend cryptographically verifies Firebase JWT via Admin SDK, extracts UID, and issues short-lived (15 min) Vexora session token. | Automated token verification tests in `auth.service.test.js`. |
| **S-02** | Refresh Token | Leaked refresh token used to generate new access tokens. | High | **Refresh Token Rotation with Family Revocation**: Each refresh invalidates the prior token. If a previously used token is presented, the entire session family is instantly revoked. | `auth-rotation.test.js` simulating reuse. |
| **S-03** | Mobile App | Emulators or rooted devices spoofing device integrity to manipulate match operations. | Medium | **Play Integrity (Android) & App Attest (iOS)**: Backend verifies attestation token on sensitive endpoints (wallet, payouts, tournament join). Signal raises risk score without hard-blocking. | Attestation mock test fixture. |
| **S-04** | Match Results | Player submits screenshots from another match or tournament claiming victory. | High | **In-Game UID Roster Matching & Timestamp Validation**: Uploaded screenshots are inspected against locked roster UIDs. SHA-256 hash calculated at ingress. Opposing captain has 15m dispute window. | Dual-confirmation dispute workflow integration test. |

---

### 2.2 Tampering (Data Modification & Injection)

| Threat ID | Target Asset | Attack Scenario | Impact | Architectural Mitigation & Security Control | Verification Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T-01** | Wallet Balances | Malicious insider or SQL injection directly updates `available_balance` on `wallet_accounts`. | Critical | **Append-Only Double-Entry Ledger**: Balances are calculated by the sum of ledger transactions. Database trigger `TRG_FORBID_UPDATE_DELETE_ON_LEDGER` actively aborts any non-INSERT query. Database constraint enforces `available_balance >= 0`. | Postgres test attempting direct UPDATE on ledger. |
| **T-02** | Audit Logs | Attacker alters or deletes audit rows to erase evidence of unauthorized prize settlement. | Critical | **Cryptographic SHA-256 Hash Chain**: Each audit row contains `prev_hash` and `curr_hash = SHA256(prev_hash + actor + action + payload)`. Daily Merkle roots signed and exported to S3 WORM storage. Any modification triggers a SEV-1 break alert. | `audit-chain.test.js` tampering detection test. |
| **T-03** | Scoring Rules | Organiser modifies points-per-kill formula mid-tournament to favor specific teams. | High | **Immutable Versioned Scoring Schemas**: Scoring formulas are versioned JSON schemas (e.g., `bgmi_br_v1.0.0`). Once tournament state reaches `LIVE`, formula version is immutable and validated by both server and client engines. | Scoring engine mutation tests. |
| **T-04** | Evidence Files | Attacker modifies uploaded screenshot to alter visible kill counts. | High | **Signed S3 URLs & SHA-256 Immutability**: Evidence is uploaded via short-lived PUT URL. Server computes and stores SHA-256 hash upon receipt. Storage bucket enforces Object Lock (WORM). | Evidence hash mismatch rejection test. |

---

### 2.3 Repudiation (Denial of Actions)

| Threat ID | Target Asset | Attack Scenario | Impact | Architectural Mitigation & Security Control | Verification Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R-01** | Tournament Cancel | Organiser collects entries, cancels event, and claims platform error. | High | **Escrow Pre-Funding & Comprehensive Audit Logs**: Organiser-funded prizes are locked in escrow prior to `REGISTRATION_OPEN`. Cancellations trigger automatic ledger `RELEASE`/`REFUND` transactions to all entrants. Every step is signed and audit-logged. | Tournament cancellation refund lifecycle test. |
| **R-02** | Result Disputes | Winning team denies agreeing to match result after losing on tie-breaker. | Medium | **Dual-Signature Result Acknowledgment**: Both captains submit or explicitly confirm match results. Confirmation window expiration defaults to auto-finalization with explicit timeout record. | Dispute timeout auto-adjudication test. |
| **R-03** | Payout Approvals | Admin approves cashout to fraudulent UPI ID and denies authorizing it. | High | **Maker-Checker Dual Approval**: Creator of payout cannot be the approver (`maker_id != checker_id`). Both actions recorded with IP hash, device fingerprint, and timestamp in tamper-evident audit logs. | Maker-checker self-approval rejection test. |

---

### 2.4 Information Disclosure (Data Leakage)

| Threat ID | Target Asset | Attack Scenario | Impact | Architectural Mitigation & Security Control | Verification Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **I-01** | Player Profiles | Public API exposes player phone numbers, real names, or precise GPS location. | High | **Zero-Leak Public DTOs**: Strict serialization schemas (Zod). Player profiles expose only display username, avatar, in-game UID, and competitive statistics. Phone and email are isolated to private `/users/me`. | API response schema fuzzing & property tests. |
| **I-02** | Room Passwords | Opponent team intercepts room code before lobby start to access unauthorized slots. | Medium | **JIT Room Code Release**: Room credentials released only to checked-in roster players via authorized WebSocket rooms 15 minutes before start. Android app enforces `FLAG_SECURE` to block screenshots. | WebSocket channel authorization tests. |
| **I-03** | KYC Documents | Moderator views government identity documents uploaded by organizers. | High | **Encrypted Document Isolation**: KYC docs stored in dedicated KMS-encrypted bucket (`vexora-kyc-secure`) accessible only by compliance officers with logged purpose, never ordinary moderators. | S3 IAM policy tests and RLS tests. |

---

### 2.5 Denial of Service (System Availability)

| Threat ID | Target Asset | Attack Scenario | Impact | Architectural Mitigation & Security Control | Verification Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **D-01** | Registration Surge | Scripted bot swarms last-second registration slot to exhaust capacity or crash database. | High | **Database Row-Level Locks & Redis Rate Limits**: `SELECT ... FOR UPDATE` ensures exact capacity match. Redis sliding-window rate limiter throttles excessive requests per IP/device. Loser is safely waitlisted. | 100-concurrent registration spike test. |
| **D-02** | Real-Time Events | Bot connects 10,000 idle WebSocket connections to exhaust server sockets. | High | **WebSocket Short-Lived Token & Heartbeat**: Connections require valid authenticated JWT. Heartbeat timeout (30s) drops zombie connections. Redis pub/sub fans out events across stateless backend instances. | WebSocket load spike simulation test. |
| **D-03** | OTP Flooding | Attacker requests SMS OTP repeatedly to deplete company SMS credits. | Medium | **Multi-Tier Throttling**: Strict limits per phone (3/hr), per IP (10/hr), and device fingerprint. Cloudflare Turnstile / App Check enforced on OTP requests. | OTP rate limit boundary test. |

---

### 2.6 Elevation of Privilege (Access Control Bypasses)

| Threat ID | Target Asset | Attack Scenario | Impact | Architectural Mitigation & Security Control | Verification Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **E-01** | Admin Portal | Player manipulates JWT payload or path to invoke `/admin/*` endpoints. | Critical | **Two-Layer Authorization**: 1) NestJS/Express route guard verifies `SUPER_ADMIN` role claim signed by backend; 2) PostgreSQL Row-Level Security (RLS) restricts database queries by `current_user_role()`. | E2E penetration test: player token accessing admin endpoints receives 403. |
| **E-02** | Multi-Tenant IDOR | Organiser A attempts to modify or delete tournaments owned by Organiser B. | High | **Resource-Level Tenant Ownership Check**: Repository queries always scope by `WHERE id = :id AND organiser_id = :currentUserId`. IDOR tests pass in CI. | Cross-tenant update rejection test. |
| **E-03** | Break-Glass Abuse | Admin uses emergency root access without authorization. | High | **Time-Boxed Emergency Break-Glass**: Break-glass generates an immediate high-priority SEV-1 alert, records all executed commands, and automatically expires in 60 minutes. | Break-glass expiration integration test. |

---

## 3. Security Acceptance Sign-Off Checklist

- [x] Double-entry ledger invariants verified by automated unit tests.
- [x] Tamper-evident audit log hash chain design approved.
- [x] Zero-leak DTO whitelist defined in OpenAPI spec.
- [x] Maker-Checker requirement verified for all payout and balance adjustments.
- [x] STRIDE threat model committed to source repository.
