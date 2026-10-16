# Vexora Dispute & Appeal Policy

> [!WARNING]
> **DRAFT ONLY - PENDING FORMAL LEGAL REVIEW BY QUALIFIED COUNSEL PRIOR TO PRODUCTION DEPLOYMENT.**  
> Jurisdiction: Republic of India (Information Technology Act 2000, IT Rules 2021/2023 Amendments, DPDP Act 2023).

---

## 1. Scope & Purpose
This Dispute & Appeal Policy establishes the procedures by which participants, team captains, and tournament organisers on the Vexora Esports Tournament Platform can raise, contest, and resolve disputes concerning match results, rule violations, scoring anomalies, and disciplinary sanctions.

## 2. Match Result Disputes
### 2.1 The 15-Minute Confirmation Window
- Upon conclusion of a match, the winning party or host organiser submits the match outcome along with required screenshot evidence.
- A 15-minute countdown timer begins immediately upon submission.
- The opposing participant or team captain must either:
  1. **Confirm the result**: Instantly advances match state to `FINAL`.
  2. **Contest the result (Raise Dispute)**: Halts automatic progression, marks match state as `DISPUTED`, and immediately freezes all related prize/credit settlements.

### 2.2 Evidence Submission Requirements
- Every dispute must be supported by verifiable digital evidence uploaded directly to the platform:
  - Full, uncropped in-game score screen screenshots displaying player names, UIDs, kill counts, and match placement.
  - Video recordings (or unlisted streaming link timestamps) for claims involving hacking, aim-botting, macro usage, or match throwing.
- All uploaded evidence is cryptographically fingerprinted using SHA-256 upon receipt. Tampered, edited, or cropped screenshots will result in immediate rejection of the claim and may trigger disciplinary action.

### 2.3 Moderator Adjudication & SLA
- Disputed matches enter the Vexora Adjudication Queue with a maximum 2-hour response Service Level Agreement (SLA).
- An assigned Moderator inspects the SHA-256 evidence, compares both submissions, verifies in-game player UIDs against registered roster IDs, and issues a binding ruling:
  - **Verdict A (Confirmed)**: Original result upheld.
  - **Verdict B (Overruled)**: Result adjusted based on validated counter-evidence.
  - **Verdict C (Void / Rematch)**: In cases of proven third-party server outage or lobby crash, a rematch is ordered under identical lobby settings.
- All moderator determinations are permanently logged to the tamper-evident audit ledger.

---

## 3. Disciplinary Sanction Appeals
### 3.1 Right to Appeal
- Any user subject to a **Level 2 (Restriction)**, **Level 3 (Suspension)**, or **Level 4 (Permanent Ban)** sanction has the right to submit one (1) formal appeal within **7 calendar days** of the notification of the sanction.
- Level 1 Formal Warnings are recorded on the internal moderation log and are not subject to formal appeal.

### 3.2 Appeal Procedure
1. The user must submit an appeal ticket via the in-app Support Portal under category `Sanction Appeal`.
2. The user must provide a detailed factual explanation and tangible exculpatory evidence.
3. The appeal is assigned to an Independent Appeals Officer who was not a party to the initial investigation or sanction.
4. The Appeals Desk will render a written decision within **72 hours** of receiving the appeal.

### 3.3 Appeal Outcomes
- **Upheld**: Sanction remains unchanged.
- **Overturned**: Sanction is removed; public Trust and Fair-Play scores are restored; any held entry credits are released.
- **Mitigated**: Penalty severity or duration is reduced based on newly demonstrated extenuating circumstances.
- The determination of the Appeals Desk is final and non-negotiable within the platform.

---

## 4. Financial Protections During Disputes
- During any active match or tournament dispute, all credit payouts, prize distributions, and organiser settlement releases tied to that tournament are automatically locked in the Escrow Account.
- No funds or credits will be released until the dispute ticket is closed with an approved, signed resolution.
