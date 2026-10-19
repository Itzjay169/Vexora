-- ============================================================================
-- Phase 37: PostgreSQL Table Partitioning Strategy
-- Blueprint Ref: Section 49 (Performance & Scalability: Partitioning for large tables)
-- System of Record: ledger_entries, audit_logs, notifications
-- ============================================================================

-- 1. Declarative Monthly Range Partitioning for Ledger Entries
-- High-throughput financial records partitioned by UTC month
CREATE TABLE IF NOT EXISTS ledger_entries_partitioned (
    id UUID NOT NULL,
    transaction_id UUID NOT NULL,
    account_id UUID NOT NULL,
    entry_type VARCHAR(32) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    balance_after NUMERIC(14, 2) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partitions for 2026/2027
CREATE TABLE IF NOT EXISTS ledger_entries_2026_q4 PARTITION OF ledger_entries_partitioned
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS ledger_entries_2027_q1 PARTITION OF ledger_entries_partitioned
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');

CREATE INDEX IF NOT EXISTS idx_lep_account_created ON ledger_entries_partitioned (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lep_tx ON ledger_entries_partitioned (transaction_id);

-- 2. Declarative Range Partitioning for Tamper-Evident Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
    id UUID NOT NULL,
    actor_id UUID,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128),
    prev_hash VARCHAR(64) NOT NULL,
    curr_hash VARCHAR(64) NOT NULL,
    ip_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS audit_logs_2026_q4 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS audit_logs_2027_q1 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');

CREATE INDEX IF NOT EXISTS idx_alp_action_created ON audit_logs_partitioned (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alp_actor ON audit_logs_partitioned (actor_id);

-- 3. Declarative Range Partitioning for In-App Notifications
CREATE TABLE IF NOT EXISTS notifications_partitioned (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(32) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS notifications_2026_q4 PARTITION OF notifications_partitioned
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS notifications_2027_q1 PARTITION OF notifications_partitioned
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');

CREATE INDEX IF NOT EXISTS idx_notifp_user_read ON notifications_partitioned (user_id, is_read, created_at DESC);
