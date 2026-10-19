# Vexora Esports — Least-Privilege Access & Database IAM Audit
**Standard:** ISO/IEC 27001 A.9 & CIS PostgreSQL Benchmark  
**Phase:** Phase 36: Security Hardening & Penetration Testing  
**Audit Scope:** Database Roles, API Permissions, Admin Console RBAC, Cloud Storage Credentials  
**Status:** SIGNED & VERIFIED  

---

## 1. Database Role Segregation (PostgreSQL)

To prevent privilege escalation and ensure no single service compromise grants superuser powers, database access is partitioned into discrete, least-privilege roles:

| Database Role | Privileges | Scope & Restrictions |
| :--- | :--- | :--- |
| `vexora_app` | `SELECT, INSERT, UPDATE` on application tables | **No DDL privileges**. `UPDATE/DELETE` triggers forbid mutating `audit_logs` and `wallet_ledger`. |
| `vexora_readonly` | `SELECT` only on analytics & public tables | Read-only access used for MCP read queries and reporting replicas. |
| `vexora_migrator` | `CREATE, ALTER, DROP` in transaction migrations | Used exclusively during CI/CD migration pipeline (`infra/migrations/`). Never used for runtime traffic. |
| `vexora_audit` | `SELECT, INSERT` on audit tables only | Append-only privileges. Cannot delete or truncate audit chains. |

---

## 2. API IAM & Role Boundary Matrix

| User Role | Can Register / Play? | Can Create Tournament? | Can Approve Payouts? | Can Access `/api/v1/admin/*`? |
| :--- | :---: | :---: | :---: | :---: |
| **PLAYER** | YES | NO | NO | NO (Blocked with 403) |
| **ORGANISER** | YES | YES (Own events only) | NO | NO (Blocked with 403) |
| **MODERATOR** | YES | YES | NO | Partial (Disputes & evidence review) |
| **FINANCE_ADMIN**| NO | NO | YES (Maker-Checker enforced) | YES (Ledger & reconciliation only) |
| **SUPER_ADMIN** | NO | NO | YES (Secondary dual approver) | YES (All modules with mandatory MFA) |
| **AUDITOR** | NO | NO | NO (Read-only) | YES (Audit log viewer only) |

---

## 3. High-Impact Action Safeguards

1. **Maker-Checker Payout Invariant:**
   - Any payout approval requires that `approver_id != requester_id`.
   - Payouts ≥ ₹10,000 mandate two distinct administrative approvers (`primary_approver_id != secondary_approver_id`) with step-up MFA.
2. **Break-Glass Emergency Access:**
   - Emergency elevations generate immediate SEV-1 audit alerts, record IP/device context, and automatically revoke after 60 minutes.
3. **No Direct Production Database Access:**
   - Developers, AI assistants, and MCP servers connect solely to DEV/STAGING in read-only mode (`VEXORA_DEV_RO_DATABASE_URL`). Production database is network-isolated within a private VPC.

---

## 4. Auditor Sign-Off & Attestation

```
Audit Review: Vexora Security Hardening & IAM Principle of Least Privilege
Assessment Date: October 2026
Conclusion: All role boundaries, database permissions, and financial controls conform to least-privilege mandates.
Attested By: Vexora Platform Security Architecture & Audit Lead
```
