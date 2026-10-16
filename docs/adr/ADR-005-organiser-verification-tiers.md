# ADR-005: Organiser Verification Tiers & Trust Architecture

## Status
Accepted

## Context (Blueprint Section 31, Question 10 & Section 10)
Organisers carry substantial responsibility for match conduct, room management, and player trust. We must establish transparent tiers and prevent unvetted entities from running high-stakes tournaments.

## Decision
1. **Three Organiser Tiers**:
   - **Tier 1 - Starter**:
     - Automatically granted on email + phone verification.
     - Can only host **FREE** tournaments (no entry fee, cosmetic/platform points prizes).
     - Capacity capped at 32 players / 8 teams.
   - **Tier 2 - Verified**:
     - Requires submitted identity proof (Government ID/KYC), past tournament portfolio, social channels, and signed Code of Conduct.
     - Reviewed and approved by Admin via the Admin Dashboard.
     - Can host tournaments with entry credits and prize pools up to 128 players / 32 teams.
   - **Tier 3 - Partner**:
     - Requires formal business registration, background verification, and a proven track record (>95% completion rate, <2% dispute rate across 20+ tournaments).
     - Custom branding, sponsored banners, unlimited capacity, priority SLA, co-organiser delegations.
2. **Transparent Trust Score**:
   - Score calculated as: `Trust = Base(100) - (DisputeRate * 20) - (CancellationRate * 30) + (CompletedTournaments * 2)`. Max 100.
   - Visible to all players before joining.
   - If trust score falls below 65, an automatic publishing hold is triggered.

## Consequences
- Organisers earn trust progressively.
- Fraudsters cannot spin up accounts to run paid scams.
