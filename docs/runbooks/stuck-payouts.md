# Stuck Payouts & Reconciliation Runbook

**Severity**: SEV-2 (High)  
**Target Resolution**: < 4 hours  
**Owners**: Finance Operations, Backend Engineer, Compliance Officer  

---

## 1. Trigger Conditions
- Payout transaction remains in `PROCESSING` or `PENDING` state for > 6 hours.
- Bank / IMPS / UPI payout gateway reports timeout, ambiguous HTTP 504, or network dropout.
- Daily automated reconciliation report detects unmapped settlement delta.

---

## 2. Investigation Protocol
1. **Query Stuck Payout Batch**:
   ```sql
   SELECT id, user_id, amount, status, payout_mode, gateway_reference, created_at
   FROM payout_requests
   WHERE status = 'PROCESSING' AND created_at < NOW() - INTERVAL '4 hours';
   ```
2. **Bank / Gateway Status Poll**:
   - Query the payment gateway status API using `idempotency_key` and `gateway_reference`.
   - DO NOT re-submit payment without checking terminal gateway status.

---

## 3. Resolution Workflows

### Case A: Gateway Confirmed Success
- Mark payout record `SET status = 'COMPLETED', settled_at = NOW()`.
- Record transaction reference. No ledger adjustment needed (hold was already placed).

### Case B: Gateway Confirmed Failure (Rejection)
- Mark payout record `SET status = 'FAILED', failure_reason = 'BANK_ACCOUNT_INVALID'`.
- Release hold and credit back funds to user account via **Double-Entry Ledger Adjustment**:
  ```json
  {
    "action": "PAYOUT_REFUND",
    "debit_account": "ESCROW_PAYOUT_CLEARING",
    "credit_account": "USER_AVAILABLE_BALANCE",
    "amount": 500.00,
    "reason": "Bank transfer failure recovery"
  }
  ```
- Send user SMS/in-app notification requesting UPI/bank account verification.

### Case C: Indeterminate State (Under Bank Investigation)
- Leave hold active; do not release funds until gateway returns a terminal ACK or NACK.
- Escalate to Payment Partner Relationship Manager with batch reference.
