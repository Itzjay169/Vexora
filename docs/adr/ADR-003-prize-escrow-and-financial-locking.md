# ADR-003: Prize Escrow, Cancellation & Refund Rules

## Status
Accepted

## Context (Blueprint Section 31, Questions 4, 5 & 6)
Players must be guaranteed that tournament prizes exist and will be distributed, while organisers must be protected against malicious claims. We need clear, automated rules for cancellations and prize locks.

## Decision
1. **Prize Escrow Lock**:
   - For any tournament promising platform credits or prizes, the total prize pool amount must be deposited into the platform Escrow Account before status can transition to `REGISTRATION_OPEN`.
   - The funds are locked and can only be released upon approved tournament settlement or full refund on cancellation.
2. **Minimum Participant Rule**:
   - Every tournament specifies `min_participants` and `registration_close_time`.
   - If `min_participants` is not reached at `registration_close_time`, the tournament automatically transitions to `CANCELLED`.
   - The backend immediately executes a batch automated `RELEASE/REFUND` ledger transaction for all registered participants. No manual organizer intervention required.
3. **Organiser Cancellation**:
   - If an organiser attempts cancellation after registration has begun, all entry holds are immediately refunded to players.
   - The organiser's escrowed deposit is held for 48 hours for administrative review.
   - The organiser's Trust Score is penalised by 15 points.

## Consequences
- Eliminates "exit scams" where an organiser collects entries and disappears.
- Automated refund engine prevents user funds from being trapped indefinitely.
