# Compromised Admin Account Runbook

**Severity**: SEV-1 (Critical)  
**Target SLA**: Isolation < 10 mins  
**Owners**: Security Lead, Super Admin  

---

## 1. Trigger Conditions
- Suspicious administrative logins from impossible traveling geo-locations or VPN endpoints.
- Unauthorized Maker-Checker approvals or ledger adjustment proposals.
- Reports of phishing or credential dumping involving internal staff.

---

## 2. Immediate Quarantine
1. **Disable Admin Account**:
   ```sql
   UPDATE users
   SET is_active = FALSE,
       status = 'BANNED',
       banned_at = NOW(),
       ban_reason = 'COMPROMISED_CREDENTIAL_SECURITY_HOLD'
   WHERE id = '<compromised_user_id>';
   ```
2. **Terminate All Active Sessions**:
   ```sql
   DELETE FROM user_sessions WHERE user_id = '<compromised_user_id>';
   ```
   - Evict session tokens from Redis cache.
3. **Revoke RBAC Roles**:
   ```sql
   DELETE FROM user_roles WHERE user_id = '<compromised_user_id>';
   ```

---

## 3. Maker-Checker Rollback & Transaction Freeze
1. Review all pending or recently approved Maker-Checker requests involving the compromised account:
   ```sql
   SELECT * FROM maker_checker_requests
   WHERE (initiator_id = '<compromised_user_id>' OR approver_id = '<compromised_user_id>')
     AND status IN ('PENDING', 'APPROVED')
     AND created_at > NOW() - INTERVAL '24 hours';
   ```
2. Freeze all payout executions and cancel pending adjustments initiated by the actor.

---

## 4. Audit Chain Verification
- Traverse the SHA-256 audit log chain starting 48 hours prior to the incident to identify all mutated entities, exported CSVs, or user balance modifications.
