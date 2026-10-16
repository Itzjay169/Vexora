-- ============================================================================
-- Vexora Esports Tournament Platform — DDL Migration 018
-- Version: 018_double_entry_ledger_and_wallet
-- Description: Phase 25 — Double-Entry Ledger & Wallet Service
--              System accounts, append-only triggers, non-negative checks,
--              Maker-Checker adjustment requests, and balance consistency.
-- ============================================================================

-- ─── 1. Ensure System Accounts Exist ─────────────────────────────────────────

-- Create a fixed System User for system-level ledger accounts if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = '00000000-0000-0000-0000-000000000001') THEN
        INSERT INTO users (id, username, email, role, status)
        VALUES ('00000000-0000-0000-0000-000000000001', 'system_vexora', 'system@vexora.internal', 'SUPER_ADMIN', 'ACTIVE');
    END IF;
END$$;

-- Ensure system wallet accounts exist
DO $$
BEGIN
    -- Platform Revenue Account
    IF NOT EXISTS (SELECT 1 FROM wallet_accounts WHERE account_type = 'PLATFORM_REVENUE') THEN
        INSERT INTO wallet_accounts (id, owner_id, account_type, available_balance, held_balance, currency, is_active)
        VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'PLATFORM_REVENUE', 10000000.00, 0.00, 'VXC', true);
    END IF;

    -- Platform Escrow Account
    IF NOT EXISTS (SELECT 1 FROM wallet_accounts WHERE account_type = 'PLATFORM_ESCROW') THEN
        INSERT INTO wallet_accounts (id, owner_id, account_type, available_balance, held_balance, currency, is_active)
        VALUES ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'PLATFORM_ESCROW', 0.00, 0.00, 'VXC', true);
    END IF;

    -- Organiser Escrow Account
    IF NOT EXISTS (SELECT 1 FROM wallet_accounts WHERE account_type = 'ORGANISER_ESCROW') THEN
        INSERT INTO wallet_accounts (id, owner_id, account_type, available_balance, held_balance, currency, is_active)
        VALUES ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'ORGANISER_ESCROW', 0.00, 0.00, 'VXC', true);
    END IF;
END$$;

-- ─── 2. Wallet Adjustments Table (Maker-Checker Dual Approval) ────────────────

CREATE TABLE IF NOT EXISTS wallet_adjustments (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id               UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
    amount                  NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    direction               VARCHAR(10) NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    reason                  TEXT NOT NULL CHECK (length(reason) >= 10),
    requested_by            UUID NOT NULL REFERENCES users(id),
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL'
                            CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    second_approver_id      UUID REFERENCES users(id),
    second_approved_at      TIMESTAMPTZ,
    decision_reason         TEXT,
    ledger_transaction_id   UUID REFERENCES ledger_transactions(id),

    -- Maker-checker invariant: Approver cannot be the requester
    CONSTRAINT chk_adjustment_maker_checker
        CHECK (second_approver_id IS NULL OR second_approver_id != requested_by)
);

CREATE INDEX IF NOT EXISTS idx_wallet_adjustments_wallet ON wallet_adjustments(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_adjustments_status ON wallet_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_wallet_adjustments_requester ON wallet_adjustments(requested_by);

-- ─── 3. Append-Only Trigger on Ledger Transactions ──────────────────────────

CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: ledger_transactions is strictly append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_mutation ON ledger_transactions;
CREATE TRIGGER trg_prevent_ledger_mutation
    BEFORE UPDATE OR DELETE ON ledger_transactions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_ledger_mutation();

-- ─── 4. Balance Consistency Validation Function ─────────────────────────────

CREATE OR REPLACE FUNCTION verify_double_entry_balance(p_wallet_id UUID)
RETURNS TABLE (
    stored_available NUMERIC(14,2),
    stored_held NUMERIC(14,2),
    calculated_credits NUMERIC(14,2),
    calculated_debits NUMERIC(14,2),
    calculated_net NUMERIC(14,2),
    is_balanced BOOLEAN
) AS $$
DECLARE
    v_stored_avail NUMERIC(14,2);
    v_stored_held NUMERIC(14,2);
    v_credits NUMERIC(14,2);
    v_debits NUMERIC(14,2);
    v_net NUMERIC(14,2);
BEGIN
    SELECT available_balance, held_balance INTO v_stored_avail, v_stored_held
    FROM wallet_accounts WHERE id = p_wallet_id;

    SELECT COALESCE(SUM(amount), 0.00) INTO v_credits
    FROM ledger_transactions WHERE credit_account_id = p_wallet_id;

    SELECT COALESCE(SUM(amount), 0.00) INTO v_debits
    FROM ledger_transactions WHERE debit_account_id = p_wallet_id;

    v_net := v_credits - v_debits;

    RETURN QUERY SELECT
        v_stored_avail,
        v_stored_held,
        v_credits,
        v_debits,
        v_net,
        (v_stored_avail + v_stored_held) = v_net;
END;
$$ LANGUAGE plpgsql;

-- ─── 5. Role Permissions ────────────────────────────────────────────────────

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vexora_app_role') THEN
        GRANT SELECT, INSERT, UPDATE ON wallet_accounts TO vexora_app_role;
        GRANT SELECT, INSERT ON ledger_transactions TO vexora_app_role;
        GRANT SELECT, INSERT, UPDATE ON wallet_adjustments TO vexora_app_role;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vexora_auditor_role') THEN
        GRANT SELECT ON wallet_accounts TO vexora_auditor_role;
        GRANT SELECT ON ledger_transactions TO vexora_auditor_role;
        GRANT SELECT ON wallet_adjustments TO vexora_auditor_role;
    END IF;
END$$;
