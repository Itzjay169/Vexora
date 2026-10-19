# Database Failover & Replication Runbook

**Severity**: SEV-1 (Critical)  
**Target RTO**: < 30 minutes  
**Target RPO**: < 5 minutes (Synchronous WAL streaming)  
**Owners**: Lead DevOps Engineer, Database Administrator, Incident Commander  

---

## 1. Trigger Conditions
- PostgreSQL Primary node stops responding to health checks (`SELECT 1` fails for > 45 seconds).
- Unrecoverable disk/hardware failure or network partition on the primary host.
- PgBouncer reports `server_login_retry` exhaustion.

---

## 2. Immediate Triage & Split-Brain Prevention
1. **Fencing Primary Host**:
   - Issue STONITH / terminate the dead primary instance or revoke its network access immediately to prevent split-brain writes.
   ```bash
   aws rds failover-db-cluster --db-cluster-identifier vexora-prod-pg
   ```
2. **Promoting Hot Standby Replica**:
   - If using Patroni / native streaming:
   ```bash
   pg_ctl promote -D /var/lib/postgresql/data
   ```
3. **Verify Read-Write Capability**:
   ```sql
   SELECT pg_is_in_recovery(); -- Must return FALSE
   ```

---

## 3. Rerouting Connection Pools via PgBouncer
1. Update `pgbouncer.ini` database connection string to point to the newly promoted primary IP:
   ```ini
   [databases]
   vexora_prod = host=new-postgres-primary port=5432 dbname=vexora_prod
   ```
2. Issue graceful reload without dropping client TCP connections:
   ```bash
   pgbouncer -R /etc/pgbouncer/pgbouncer.ini
   ```

---

## 4. Post-Failover Integrity Verification
1. **Verify Double-Entry Ledger Invariant**:
   ```sql
   SELECT SUM(amount) AS net_sum FROM ledger_entries;
   -- INVARIANT: Must be 0.00
   ```
2. **Verify Audit Chain Continuity**:
   ```bash
   npm run test:security
   ```
3. **Notify Stakeholders**: Update the public status page (`/status`) and close incident ticket.
