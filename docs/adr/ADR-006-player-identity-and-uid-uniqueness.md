# ADR-006: Player Identity, Profile Visibility & In-Game UID Uniqueness

## Status
Accepted

## Context (Blueprint Section 31, Questions 11, 12, 13 & Section 6)
To prevent smurfing, account sharing, and impersonation, Vexora must tie user identities to game identities while preserving privacy and complying with data minimisation.

## Decision
1. **Mandatory User Fields**:
   - Username (unique alphanumeric).
   - Verified Phone Number or Email (via Firebase Auth).
   - In-game UID + In-game Name (IGN) for each supported game.
2. **In-game UID Uniqueness**:
   - Database constraint: `UNIQUE (game_id, in_game_uid)`.
   - A single in-game account cannot be registered to multiple Vexora accounts simultaneously.
   - Organiser can demand an in-game profile screenshot match if an imposter suspicion arises.
3. **Public vs Private Profile Data**:
   - **Public**: Username, avatar, team history, tournaments played, win rate, podiums, fair-play score, badges.
   - **Private (Zero-Leak)**: Phone number, email address, payment details, KYC documents, device IDs, IP addresses.
4. **Sanction Ladder**:
   - Level 1: Warning (written reprimand on profile).
   - Level 2: Restriction (7-day ban from competitive tournament entry).
   - Level 3: Suspension (30-day account freeze).
   - Level 4: Permanent Ban (identity & UID blacklisted).
   - All sanctions can be appealed once within 7 days.

## Consequences
- Prevents multi-accounting and tournament ban evasion.
- Strictly adheres to data minimisation principles.
