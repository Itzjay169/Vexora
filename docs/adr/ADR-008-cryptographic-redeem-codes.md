# ADR-008: Cryptographic Redeem Code Lifecycle & HMAC Checksum

## Status
Accepted

## Context (Blueprint Section 8 & Section 19)
Redeem codes are high-value targets for brute-force guessing, database leak exploitation, and operator theft.

## Decision
1. **High-Entropy Generation with Luhn Checksum**:
   - Codes are 16 alphanumeric characters formatted as `VEXO-XXXX-XXXX-XXXX-C`.
   - The final character `C` is a mathematical Luhn/Mod-36 checksum of the preceding characters.
   - If a user mistypes a single character, client and server reject the code immediately before any DB lookup, preventing timing attacks and database load.
2. **Keyed Hashing at Rest**:
   - Plaintext codes are never stored in the database.
   - Only `HMAC_SHA256(code, REDEEM_CODE_HMAC_SECRET)` is stored in `redeem_codes`.
   - Even if the database is leaked, attackers cannot reverse the hashes to redeem codes.
3. **Strict Rate Limiting & Lifecycle**:
   - Rate limit: 5 failed redemption attempts per IP/user per hour -> 24-hour lockout.
   - States: `CREATED -> ACTIVE -> REDEEMED / EXPIRED / CANCELLED / BLOCKED`.
   - Redemptions are idempotent; calling redeem twice returns status `ALREADY_REDEEMED` without altering balances.
   - Batch export is watermarked with the exporting admin ID, encrypted, and audit-logged.

## Consequences
- Brute-force attacks are mathematically futile.
- Zero plaintext credential leakage risk from database dumps.
