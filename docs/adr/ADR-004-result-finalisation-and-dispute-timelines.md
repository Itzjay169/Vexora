# ADR-004: Result Finalisation, Evidence Hashing & Dispute Timelines

## Status
Accepted

## Context (Blueprint Section 31, Questions 7, 8 & 9)
Esports matches regularly suffer from conflicting claims (e.g., both teams claim victory or dispute kill counts). We must define strict cryptographic evidence standards, response deadlines, and dispute escalation paths.

## Decision
1. **Evidence Standard**:
   - Every submitted match result requires mandatory screenshot evidence of the in-game post-match score screen.
   - On upload, the backend computes the SHA-256 hash of the evidence file, stores the hash in `evidence_files` and in the append-only `audit_logs`.
   - File uploads are validated by magic byte header (JPEG/PNG/MP4 only, max 10MB) and EXIF metadata is stripped.
2. **Dual-Confirmation & Timelines**:
   - The match winner or organiser submits result `R`. The status becomes `RESULT_PENDING`.
   - The opposing party has a 15-minute confirmation window to either confirm or counter-submit with counter-evidence.
   - If no dispute is raised within 15 minutes, `R` is automatically marked `FINAL` and sent to the scoring engine.
3. **Dispute Workflow**:
   - If conflicting results are submitted or a dispute is explicitly opened, the match moves to `DISPUTED`.
   - Tournament prize settlement is instantly **frozen**.
   - A dispute case is assigned to the Moderator Queue with an automated 2-hour SLA.
   - Only a designated Moderator or Admin can resolve a dispute by entering an audited ruling with linked evidence references.
   - Official results can NEVER be changed silently. Any post-final correction requires an `ADJUSTMENT` audit record with dual-operator approval.

## Consequences
- Fast-path for undisputed matches (15 minutes).
- Complete evidence trail and frozen payouts for contentious matches.
