# Emergency Secret Leak & Key Rotation Runbook

**Severity**: SEV-1 (Critical)  
**Target SLA**: Immediate acknowledgment (< 15 mins), rotation completed (< 45 mins)  
**Owners**: Chief Information Security Officer (CISO), Tech Lead, Cloud Admin  

---

## 1. Trigger Conditions
- Secret identified in public GitHub commit, Pastebin, log file, or security scanner alert.
- Unauthorized API requests using backend master keys.

---

## 2. Immediate Containment Checklist
1. **Revoke Exposed Credential Immediately**:
   - Access cloud console / secret manager directly.
2. **Issue New Primary Secret**:
   - Create a cryptographically secure 256-bit entropy token:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Dual-Key Transition Window**:
   - For JWT signing keys, configure `JWT_VERIFY_KEYS=[NEW_KEY, OLD_KEY]` and `JWT_SIGNING_KEY=NEW_KEY` for a 15-minute grace period to prevent mass user logout.
   - For database credentials, use PostgreSQL `ALTER ROLE vexora_app WITH PASSWORD '...'` and update connection string in AWS Secrets Manager / Vault.

---

## 3. Session Revocation
- Invalidate all active refresh tokens in Redis:
  ```bash
  redis-cli FLUSHDB # or selective SADD revoked_session_families:*
  ```
- Force all administrative sessions to re-authenticate with TOTP / WebAuthn passkeys.

---

## 4. Post-Incident Forensics
- Check CloudTrail / access logs for all IP requests using the compromised secret within the exposure window.
- If user data or money tables were touched, invoke the **Data Breach Notification Procedure**.
