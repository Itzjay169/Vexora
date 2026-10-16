# ADR-011: Sanctions Ladder, Fair Play Enforcement & Appeals Workflow

## Status
Accepted

## Context (Blueprint Section 31, Question 14; Section 11; Section 19)
Esports competitions are vulnerable to cheating, токсичность, match-fixing, smurfing, and organiser manipulation. A platform cannot maintain trust without a clear, published, progressive sanctions ladder and a fair, timely appeals process that prevents arbitrary or retaliatory bans.

## Decision

### 1. Progressive Sanctions Ladder
Vexora enforces a graduated 4-tier sanction model:

| Level | Sanction Type | Trigger / Infraction Examples | Duration | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1** | **Formal Warning** | Minor chat toxicity, delay in lobby join (<5 mins), minor profile violation | Permanent record | Displayed on profile to moderators only; no feature restriction. |
| **Level 2** | **Competitive Restriction** | Repeated lobby failure, unsportsmanlike conduct, unconfirmed match disputes | 7 Days | Barred from joining or creating tournaments; wallet withdrawals frozen for review. |
| **Level 3** | **Account Suspension** | Collusion, intentional throwing, lobby crash attempts, multi-accounting / smurfing | 30 Days | Complete login freeze; active tournament registrations forfeited without refund; team roster spot locked. |
| **Level 4** | **Permanent Termination & Blacklist** | Confirmed aim-bot/wall-hack, memory modification, DDoS, payment fraud, forged KYC, bribery | Permanent | Account terminated; linked in-game UIDs permanently blacklisted; device fingerprint & phone hashed and blacklisted; forfeit of any platform rewards. |

### 2. Fair-Play Investigation Protocol
- Sanctions cannot be issued without tangible evidence (screenshot hash, video recording timestamp, server log correlation, or game anti-cheat signal).
- Automated systems may place a provisional hold (max 4 hours), but final Level 3 and Level 4 sanctions require human moderator review.
- Organisers can report infractions with evidence, but CANNOT directly ban player accounts from the platform; only authorized Vexora moderators can execute platform sanctions.

### 3. Transparent Appeals Workflow
1. **Filing an Appeal**:
   - A sanctioned user can file exactly **one** formal appeal per sanction within **7 calendar days** of notification.
   - The appeal must be submitted through the in-app support/appeal portal with new counter-evidence (e.g. uncut screen recording, uncropped screenshots).
2. **Reviewing Authority**:
   - Appeals are assigned to a Senior Moderator who was **not** involved in the original sanction decision (conflict-of-interest prevention).
3. **Response Timeline**:
   - SLA for appeal determination: **72 hours** from submission.
4. **Outcomes**:
   - **Upheld**: Sanction remains in effect; user notified with high-level reason (without disclosing proprietary anti-cheat heuristics).
   - **Overturned**: Sanction expunged from user's public record; Trust/Fair-Play score restored; any wrongfully forfeited entry holds reimbursed.
   - **Modified**: Sanction reduced (e.g., Level 3 reduced to Level 2 based on mitigating evidence).
5. **Finality**:
   - The determination of the Appeals Desk is final and binding within the platform.

## Consequences
- Protects players from unfair, arbitrary organiser decisions.
- Provides a transparent, legally defensible, documented record of disciplinary actions.
- Reduces toxic behavior while maintaining procedural fairness.
