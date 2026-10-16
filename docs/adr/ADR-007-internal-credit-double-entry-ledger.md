# ADR-007: Double-Entry Ledger & Zero-Sum Invariant

## Status
Accepted

## Context (Blueprint Section 31, Question 10 & Section 8)
Financial balances must never be stored as mutable floats or overwritten directly. If an admin or bug edits a balance, auditability is destroyed. A strict financial ledger is necessary.

## Decision
1. **Append-Only Double-Entry Architecture**:
   - `ledger_transactions` table with DB trigger `FORBID_UPDATE_DELETE_ON_LEDGER` that raises an exception if `UPDATE` or `DELETE` is executed.
   - Every movement is represented as two offsetting rows: a DEBIT and a CREDIT between accounts (User Account, Platform Escrow Account, Platform Revenue Account).
   - Invariant: `SUM(amount) = 0` across all paired transaction entries.
2. **Account Balances**:
   - `available_balance` and `held_balance` are maintained in `wallet_accounts` using `NUMERIC(14, 2)` (or integer minor units) with a DB CHECK constraint `available_balance >= 0`.
   - Balances are updated exclusively via atomic database functions inside serializable or row-locked transactions.
3. **Maker-Checker for Administrative Adjustments**:
   - No single administrator can execute an `ADJUSTMENT` transaction or payout approval.
   - Adjustments require a Creator (Maker) and a distinct Approver (Checker) plus a mandatory audit reason.

## Consequences
- Impossible to generate money or phantom credits out of thin air.
- Complete mathematical proof of solvency at any point in time.
