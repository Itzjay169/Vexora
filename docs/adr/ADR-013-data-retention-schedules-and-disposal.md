# ADR-013: Data Classification, Retention Schedules & Disposal Protocol

## Status
Accepted

## Context (Blueprint Section 31, Question 18; Section 24; Section 48)
Under the Digital Personal Data Protection (DPDP) Act 2023, Information Technology (Intermediary Guidelines) Rules 2021, and the Prevention of Money Laundering Act (PMLA), Vexora must establish strict retention schedules for each class of data, ensuring data is not retained beyond lawful requirements while preserving evidence necessary for regulatory compliance and forensic investigations.

## Decision

### 1. Data Classification and Retention Matrix

| Data Classification | Specific Data Elements | Legal / Operational Justification | Retention Period | Storage Tier & Action at Expiry |
| :--- | :--- | :--- | :--- | :--- |
| **Class A: Account Registration** | Username, email, phone number, linked auth UID | IT Rules 2021 Rule 3(1)(h) mandate for intermediary registration info | Active Account Lifetime + **180 days** post-deletion | Hot DB -> Pseudonymised cold archive for 180 days -> Hard delete |
| **Class B: In-Game Identifiers** | Game UID, In-Game Name (IGN), game stats | Competition history, duplicate account prevention | Active Account Lifetime | Anonymised upon account deletion |
| **Class C: Match Evidence** | Score screenshots, video clips, SHA-256 hashes, referee notes | Dispute adjudication, appeal window, auditability | **12 months** from tournament settlement | Hot S3/MinIO -> 90 days cold storage -> Hard delete from storage |
| **Class D: Chat & Lobby Comms** | Match lobby chat, support ticket messages, reports | Community moderation, harassment investigations | **90 days** active; **180 days** archived | Hot Redis/DB -> Archived for 180 days (IT Rules) -> Automated purge |
| **Class E: Financial & Ledger** | Ledger transactions, escrow entries, payouts, TDS records | Income Tax Act 1961, Section 194BA, PMLA compliance | **5 years** from end of financial year | Immutable DB ledger -> Encrypted annual cold archive |
| **Class F: KYC & Identity Verification** | PAN number, Government ID images, name, date of birth | RBI KYC Master Directions, Prevention of Money Laundering Act | **5 years** post-account closure | AES-256 encrypted at rest; restricted access; purged after 5 years |
| **Class G: System & Audit Logs** | Tamper-evident hash chain, IP access logs, admin audit trail | CERT-In cyber incident guidelines, IT Intermediary compliance | **5 years** | Append-only WORM storage (Write Once Read Many); Merkle checkpoints |

### 2. Automated Disposal Protocol
1. **Daily Scheduled Worker**:
   - An automated background worker executes daily at `02:00 UTC` to scan for expired records based on retention metadata.
2. **Cryptographic Erasure / Hard Delete**:
   - S3/MinIO object deletion requests are issued with version shredding.
   - Database rows marked for deletion have PII fields overwritten with cryptographic nullifiers before hard deletion.
3. **Audit of Erasure**:
   - Every batch deletion job generates a cryptographically signed `DATA_DISPOSAL_REPORT` recorded in the audit log (storing record counts and categories destroyed, without containing deleted PII).

## Consequences
- Full statutory compliance with DPDP Act 2023, IT Rules 2021 Rule 3(1)(h), and CERT-In logging directions.
- Protects user privacy by preventing perpetual data accumulation.
- Ensures clean storage management and predictable infrastructure costs.
