# Architecture Decision Records (ADRs) - Section 31 Traceability Matrix

This directory contains the authoritative Architecture Decision Records for the Vexora Esports Tournament Platform, locking all business, technical, and compliance decisions prior to code execution in accordance with **Phase 1 of PHASE.md** and **Section 31 of the Vexora Complete Project Blueprint**.

| Section 31 Blueprint Question | Relevant ADR Document | Decision Summary |
| :--- | :--- | :--- |
| **Q1: Free vs Paid Entry** | [ADR-001](file:///docs/adr/ADR-001-tournament-entry-and-prize-model.md) | **v1 Public Launch = 100% FREE tournaments only**; closed-loop credits locked behind legal sign-off. |
| **Q2: Launch Games** | [ADR-002](file:///docs/adr/ADR-002-supported-games-and-formats.md), [ADR-015](file:///docs/adr/ADR-015-mathematical-scoring-formulas.md) | BGMI (Battlegrounds Mobile India), Garena Free Fire, Call of Duty Mobile. |
| **Q3: Tournament Formats** | [ADR-002](file:///docs/adr/ADR-002-supported-games-and-formats.md) | Single Elimination, Round-Robin/Swiss qualifiers, Multi-squad Battle Royale lobbies. |
| **Q4: Prize Funding & Lock** | [ADR-003](file:///docs/adr/ADR-003-prize-escrow-and-financial-locking.md) | Organiser must pre-fund 100% of prize pool into Escrow before registration opens; funds locked until settlement. |
| **Q5: Min Participants** | [ADR-003](file:///docs/adr/ADR-003-prize-escrow-and-financial-locking.md) | Auto-cancelled at registration cutoff if minimum not reached; automated full ledger refund. |
| **Q6: Cancellation & Refund** | [ADR-003](file:///docs/adr/ADR-003-prize-escrow-and-financial-locking.md) | Automated instant release/refund; organiser penalty of 15 trust points and hold on escrow deposit. |
| **Q7: Result Finality** | [ADR-004](file:///docs/adr/ADR-004-result-finalisation-and-dispute-timelines.md) | Auto-finalized after 15-minute dual-confirmation window without dispute. |
| **Q8: Dispute Window** | [ADR-004](file:///docs/adr/ADR-004-result-finalisation-and-dispute-timelines.md) | 15 minutes post-result submission; halts payout settlement immediately. |
| **Q9: Changing Official Result** | [ADR-004](file:///docs/adr/ADR-004-result-finalisation-and-dispute-timelines.md) | Only designated Moderator/Admin via audited `ADJUSTMENT` action; no silent changes permitted. |
| **Q10: Organiser Verification** | [ADR-005](file:///docs/adr/ADR-005-organiser-verification-tiers.md) | 3-Tier System: Tier 1 Starter (Free only, 32 cap), Tier 2 Verified (KYC/Portfolio, 128 cap), Tier 3 Partner (Business/20+ events). |
| **Q11: Internal Credit Model** | [ADR-001](file:///docs/adr/ADR-001-tournament-entry-and-prize-model.md), [ADR-007](file:///docs/adr/ADR-007-internal-credit-double-entry-ledger.md) | Strictly closed-loop tokens; double-entry ledger (`SUM(amount)=0`); no direct balance mutations. |
| **Q12: Mandatory vs Optional Data**| [ADR-006](file:///docs/adr/ADR-006-player-identity-and-uid-uniqueness.md) | Mandatory: Username, verified Phone/Email, in-game UID/IGN. Optional: bio, social links, avatar. |
| **Q13: Public Profile Data** | [ADR-006](file:///docs/adr/ADR-006-player-identity-and-uid-uniqueness.md) | Public: username, badges, win rates, fair play score. Private (Zero-Leak): email, phone, KYC, IP, devices. |
| **Q14: Sanctions & Appeals** | [ADR-011](file:///docs/adr/ADR-011-sanctions-ladder-and-appeals-process.md) | 4-Tier Ladder (Warning, 7-Day Restriction, 30-Day Suspension, Permanent Ban); 7-day appeal SLA 72 hrs. |
| **Q15: Exact Scoring Formulas** | [ADR-015](file:///docs/adr/ADR-015-mathematical-scoring-formulas.md) | Deterministic points tables, kill multipliers, and multi-stage tiebreakers for BGMI, Free Fire, CODM. |
| **Q16: Minimum Age & Minors** | [ADR-009](file:///docs/adr/ADR-009-india-dpdp-compliance-and-minors.md) | Minimum age 16. Ages 16-17 require verifiable parental consent and are restricted to free tournaments. |
| **Q17: Geographic Eligibility** | [ADR-012](file:///docs/adr/ADR-012-geographic-eligibility-and-state-gaming-compliance.md) | v1 Free launch open pan-India. Paid features excluded in AP, Telangana, Assam, Odisha, Nagaland, Sikkim, TN. |
| **Q18: Data Retention Periods** | [ADR-013](file:///docs/adr/ADR-013-data-retention-schedules-and-disposal.md) | Registration info: 180 days post-deletion; Evidence: 12 months; Financial: 5 years; Audit: 5 years. |
| **Q19: Grievance Officer & SLA**| [ADR-014](file:///docs/adr/ADR-014-grievance-redressal-mechanism-and-officer.md) | Resident Grievance Officer (`grievance@vexora.gg`, Bengaluru); Ack < 24h; Resolution < 15 days (SLA: 72h). |
| **Technical: Code Lifecycle** | [ADR-008](file:///docs/adr/ADR-008-cryptographic-redeem-codes.md) | Luhn/Mod-36 checksum, HMAC-SHA256 at rest, one-time idempotent redemption. |
| **Technical: Tamper-Evident Logs**| [ADR-010](file:///docs/adr/ADR-010-tamper-evident-audit-hash-chain.md) | Cryptographic hash-chaining (`prev_hash` + `curr_hash`), daily Ed25519-signed Merkle checkpoints. |
