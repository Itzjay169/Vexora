# ADR-001: Tournament Entry & Internal Credit Model

## Status
Accepted

## Context (Blueprint Section 31, Question 1 & 10)
We must define what counts as a tournament entry and what is free vs paid, ensuring legal compliance and financial safety. Operating real-money betting or direct wagering is strictly prohibited. The system must treat the platform currency as a closed-loop internal credit.

## Decision
1. **Free-First Launch Policy**:
   - Vexora v1 launches with 100% free-to-enter tournaments (0 entry fee, cosmetic/platform badge prizes).
   - Only after full jurisdiction-by-jurisdiction legal sign-off are closed-loop entry credits enabled.
2. **Internal Credit Accounting**:
   - Platform credits are strictly closed-loop service tokens used for tournament participation and reward settlements.
   - Balances are never modified in place; all credits flow through an append-only double-entry ledger.
3. **Escrow Requirement**:
   - If an entry fee or prize pool is declared, the funds/credits are placed in an escrow hold state (`HOLD`) at registration.
   - Organiser-funded prize pools must be pre-funded and held in escrow prior to tournament publication.

## Consequences
- Protects the platform against wagering and gaming classifications under Indian state laws and international regulations.
- Provides absolute auditability of every transaction.
