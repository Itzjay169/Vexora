# Payment Webhook Outage & DLQ Recovery Runbook

**Severity**: SEV-2 (High)  
**Target Recovery**: < 2 hours  
**Owners**: Backend Lead, Payment Operations  

---

## 1. Trigger Conditions
- Inbound payment gateway webhook traffic drops to zero during peak tournament hours.
- Backend reports repeated HTTP 500 errors on `/api/v1/webhooks/razorpay` or `/cashfree`.
- Dead-Letter Queue (DLQ) depth exceeds 50 messages.

---

## 2. Inbound Webhook Dead-Letter Queue Isolation
1. All unprocessable webhook events are captured directly into `webhook_dead_letter_queue` with:
   - Full raw request headers (`X-Razorpay-Signature`, `X-Webhook-Timestamp`)
   - Raw unmodified request body
   - Ingress timestamp and failure error stack
2. **Safety Rule**: Never discard unparsed webhook payloads.

---

## 3. Webhook Replay Procedure
1. Verify the root cause of parsing/signature failure (e.g., secret mismatch or signature clock skew).
2. Deploy fix or adjust replay worker.
3. Trigger idempotent replay worker:
   ```bash
   node backend/src/workers/webhook-replay.js --dlq-batch-size 100
   ```
4. **Idempotency Guarantee**: Because every webhook handler enforces `UNIQUE(event_id)` and records state machine transitions atomically, replaying identical events cannot double-credit accounts or double-confirm entries.

---

## 4. Verification
1. Confirm DLQ depth drops to 0.
2. Cross-verify user balance additions match the sum of successful replayed charges.
