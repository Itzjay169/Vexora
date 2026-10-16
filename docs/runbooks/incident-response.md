# Vexora Security & Incident Response Runbook

## Severity Levels & Response SLAs
- **SEV-1 (Critical)**: Active financial loss, ledger invariant breach (`SUM(amount) != 0`), database compromise, audit hash chain broken, widespread outage during major tournament.
  - **SLA**: Immediate acknowledgment (<15 mins), incident team assembled (<30 mins).
- **SEV-2 (High)**: Match adjudication system down, SMS OTP delivery outage, WebSocket connection drops.
  - **SLA**: Acknowledgment < 1 hour, resolution < 4 hours.
- **SEV-3 (Medium)**: Non-critical UI defect, delayed analytics snapshot, isolated user reporting issue.
  - **SLA**: Acknowledgment < 4 hours, resolution < 24 hours.

## Emergency Kill-Switches
1. **Financial Freezing**:
   - Setting `GLOBAL_FINANCIAL_KILLSWITCH=true` in environment immediately rejects all credit debits and payout processing while leaving user profiles read-only.
2. **Dispute Auto-Freeze**:
   - Any tournament with an unresolved SEV-1 dispute automatically halts prize distribution via database lock on `tournaments.settlement_status`.
3. **Audit Chain Verification Script**:
   - `npm run verify:audit-chain` traverses the cryptographic hash links from the genesis block to verify tamper integrity.
