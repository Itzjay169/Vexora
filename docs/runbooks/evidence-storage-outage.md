# Evidence Media Storage Outage Runbook

**Severity**: SEV-2 (High)  
**Target Recovery**: < 2 hours  
**Owners**: DevOps Lead, Storage Administrator  

---

## 1. Trigger Conditions
- MinIO or S3 media storage cluster returns HTTP 503 Service Unavailable or connection timeout.
- Players cannot upload match screenshot evidence or KYC identity verification documents.

---

## 2. Immediate Mitigation & Degraded Mode
1. **Enable Upload Queue Buffer**:
   - Temporarily buffer screenshot metadata locally on the client or cache raw uploads in local encrypted volume buffer until remote S3 bucket responds.
2. **Switch to Backup Bucket / Cross-Region Replica**:
   - Update `STORAGE_S3_ENDPOINT` and `STORAGE_S3_BUCKET` in environment to point to hot standby bucket replica:
   ```bash
   export STORAGE_S3_ENDPOINT="https://s3.ap-south-1.amazonaws.com"
   export STORAGE_S3_BUCKET="vexora-evidence-standby"
   ```
3. **Graceful Dispute Settlement Extension**:
   - Automatically extend the match dispute resolution window by 2 hours for tournaments active during the outage to prevent premature match forfeits due to missing upload confirmation.

---

## 3. Recovery & Reconciliation
- Re-sync buffered files to primary storage once restored.
- Verify SHA-256 hashes of all newly uploaded files against ingress metadata records.
