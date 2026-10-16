# ADR-010: Tamper-Evident Hash-Chained Audit Logs & Merkle Checkpoints

## Status
Accepted

## Context (Blueprint Section 16, Section 47)
Standard database audit logs can be manipulated if a database administrator account is compromised. Vexora requires a tamper-evident cryptographic chain to guarantee forensic immutability for all financial, moderation, and result adjudication events.

## Decision
1. **Cryptographic Hash Chaining**:
   - Each record in `audit_logs` includes:
     - `prev_hash`: The SHA-256 hash of the immediately preceding audit record.
     - `curr_hash`: `SHA-256(prev_hash + id + actor_id + action + entity + payload_json + created_at)`.
   - The initial seed record uses a predetermined constant genesis hash.
2. **Database Trigger Guard**:
   - An immutable trigger `PREVENT_AUDIT_LOG_TAMPERING` aborts any `UPDATE` or `DELETE` statement against `audit_logs`.
3. **Periodic Merkle Checkpoints**:
   - Every 24 hours, a scheduled background worker aggregates daily audit log hashes into a Merkle Tree.
   - The Merkle Root is signed using an Ed25519 key and stored in `audit_chain_checkpoints` and published to an external S3-locked append-only bucket.
4. **Automated Chain Verification Job**:
   - A daily automated job traverses the chain from the previous checkpoint to the tip.
   - If any `curr_hash` does not match the recalculated value or the chain is broken, an immediate SEV1 security alert is emitted.

## Consequences
- Any unauthorized modification or row deletion produces an immediate verifiable discrepancy.
- Provides cryptographic admissibility for legal and regulatory audits.
