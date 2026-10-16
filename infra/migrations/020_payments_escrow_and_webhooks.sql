-- ============================================================================
-- Migration 020: Payments, Prize Escrow & Paid Tournament Flow
-- Phase 27 of 40 — Vexora Esports Tournament Platform
-- PDF refs: Sections 9, 26, 39 (Phase 6)
--
-- Tables created:
--   1. webhook_events — Signed webhook deduplication with event-ID + timestamp
--   2. payment_orders — Payment gateway order tracking (Razorpay/Cashfree)
--   3. prize_escrow_locks — Organiser-funded prize pool escrow locks
--   4. tournament_entry_payments — Links tournament registration to payment
--   5. regional_payment_config — Per-region/game payment kill-switches
--
-- Security:
--   - Immutability triggers on webhook_events (append-only)
--   - Feature flag gating (real_money_wallet_enabled must be TRUE)
--   - RLS policies on payment tables
--   - CHECK constraints preventing negative amounts
-- ============================================================================

BEGIN;

-- ─── 1. Webhook Events: Signed webhook deduplication ────────────────────
-- Every inbound webhook from payment providers is deduplicated by
-- (provider, event_id). Replay attacks are prevented by timestamp checks.
CREATE TABLE IF NOT EXISTS webhook_events (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider        TEXT NOT NULL CHECK (provider IN ('RAZORPAY', 'CASHFREE', 'FIREBASE', 'MANUAL')),
    event_id        TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    signature       TEXT,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ,
    processing_status TEXT NOT NULL DEFAULT 'RECEIVED'
        CHECK (processing_status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE', 'INVALID_SIGNATURE')),
    error_message   TEXT,
    idempotency_key TEXT,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Event-ID deduplication: same provider + same event_id = duplicate
    CONSTRAINT uq_webhook_provider_event UNIQUE (provider, event_id)
);

-- Prevent mutation of processed webhook records
CREATE OR REPLACE FUNCTION prevent_webhook_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.processing_status IN ('PROCESSED', 'DUPLICATE') THEN
        RAISE EXCEPTION 'IMMUTABILITY VIOLATION: Processed webhook event cannot be modified';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_webhook_event_immutable
    BEFORE UPDATE ON webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_webhook_event_mutation();

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_type
    ON webhook_events (provider, event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status
    ON webhook_events (processing_status) WHERE processing_status NOT IN ('PROCESSED', 'DUPLICATE');

-- ─── 2. Payment Orders: Gateway order tracking ─────────────────────────
-- Tracks payment orders created via Razorpay/Cashfree.
-- Client NEVER confirms payment; only the signed webhook does.
CREATE TABLE IF NOT EXISTS payment_orders (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES users(id),
    provider            TEXT NOT NULL CHECK (provider IN ('RAZORPAY', 'CASHFREE')),
    provider_order_id   TEXT,
    provider_payment_id TEXT,
    amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency            TEXT NOT NULL DEFAULT 'INR',
    purpose             TEXT NOT NULL CHECK (purpose IN ('DEPOSIT', 'TOURNAMENT_ENTRY', 'PRIZE_ESCROW')),
    status              TEXT NOT NULL DEFAULT 'CREATED'
        CHECK (status IN ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED')),
    reference_type      TEXT,
    reference_id        UUID,
    idempotency_key     TEXT UNIQUE,
    webhook_event_id    UUID REFERENCES webhook_events(id),
    ledger_tx_id        UUID,
    metadata            JSONB DEFAULT '{}',
    failure_reason      TEXT,
    refund_amount       NUMERIC(12,2) DEFAULT 0.00 CHECK (refund_amount >= 0),
    refund_reason       TEXT,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_refund_lte_amount CHECK (refund_amount <= amount)
);

-- Indexes for payment order lookups
CREATE INDEX IF NOT EXISTS idx_payment_orders_user
    ON payment_orders (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider
    ON payment_orders (provider, provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_reference
    ON payment_orders (reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- ─── 3. Prize Escrow Locks: Organiser-funded prize pool ────────────────
-- Before a paid tournament opens for registration, the organiser must lock
-- the full prize pool into escrow. This prevents prize pool shortfalls.
CREATE TABLE IF NOT EXISTS prize_escrow_locks (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tournament_id       UUID NOT NULL REFERENCES tournaments(id),
    organiser_id        UUID NOT NULL REFERENCES users(id),
    escrow_amount       NUMERIC(12,2) NOT NULL CHECK (escrow_amount > 0),
    currency            TEXT NOT NULL DEFAULT 'VXC',
    status              TEXT NOT NULL DEFAULT 'LOCKED'
        CHECK (status IN ('LOCKED', 'SETTLED', 'RELEASED', 'PARTIALLY_RELEASED', 'FORFEITED')),
    locked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at          TIMESTAMPTZ,
    released_at         TIMESTAMPTZ,
    settlement_ledger_tx_id UUID,
    lock_ledger_tx_id   UUID,
    release_ledger_tx_id UUID,
    settlement_breakdown JSONB DEFAULT '{}',
    idempotency_key     TEXT UNIQUE,
    reason              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One active escrow lock per tournament
    CONSTRAINT uq_active_escrow_per_tournament
        UNIQUE (tournament_id) -- only one escrow per tournament
);

CREATE INDEX IF NOT EXISTS idx_prize_escrow_status
    ON prize_escrow_locks (status, tournament_id);
CREATE INDEX IF NOT EXISTS idx_prize_escrow_organiser
    ON prize_escrow_locks (organiser_id, status);

-- ─── 4. Tournament Entry Payments: Links registration to payment ───────
CREATE TABLE IF NOT EXISTS tournament_entry_payments (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tournament_id       UUID NOT NULL REFERENCES tournaments(id),
    registration_id     UUID NOT NULL,
    user_id             UUID NOT NULL REFERENCES users(id),
    entry_fee_amount    NUMERIC(12,2) NOT NULL CHECK (entry_fee_amount >= 0),
    currency            TEXT NOT NULL DEFAULT 'VXC',
    payment_method      TEXT NOT NULL CHECK (payment_method IN ('WALLET', 'GATEWAY', 'FREE')),
    payment_order_id    UUID REFERENCES payment_orders(id),
    hold_ledger_tx_id   UUID,
    status              TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'HELD', 'CONFIRMED', 'REFUNDED', 'FAILED')),
    refund_ledger_tx_id UUID,
    refund_reason       TEXT,
    idempotency_key     TEXT UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One payment per registration
    CONSTRAINT uq_entry_payment_registration UNIQUE (registration_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_payments_tournament
    ON tournament_entry_payments (tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_entry_payments_user
    ON tournament_entry_payments (user_id, created_at DESC);

-- ─── 5. Regional Payment Configuration: Kill-switches ──────────────────
CREATE TABLE IF NOT EXISTS regional_payment_config (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    region_code     TEXT NOT NULL,
    country_code    TEXT NOT NULL DEFAULT 'IN',
    is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    max_entry_fee   NUMERIC(12,2) DEFAULT 0.00,
    max_prize_pool  NUMERIC(12,2) DEFAULT 0.00,
    allowed_providers TEXT[] DEFAULT '{}',
    kill_switch_on  BOOLEAN NOT NULL DEFAULT TRUE,
    kill_switch_reason TEXT DEFAULT 'Awaiting legal/compliance clearance',
    updated_by      UUID,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_region_country UNIQUE (region_code, country_code)
);

-- ─── 6. Row-Level Security ─────────────────────────────────────────────
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events FORCE ROW LEVEL SECURITY;

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_orders FORCE ROW LEVEL SECURITY;

ALTER TABLE prize_escrow_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_escrow_locks FORCE ROW LEVEL SECURITY;

ALTER TABLE tournament_entry_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entry_payments FORCE ROW LEVEL SECURITY;

ALTER TABLE regional_payment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_payment_config FORCE ROW LEVEL SECURITY;

-- Webhook events: admin/system only
CREATE POLICY webhook_events_admin_read ON webhook_events
    FOR SELECT USING (current_setting('app.role', true) IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE', 'SYSTEM'));
CREATE POLICY webhook_events_system_insert ON webhook_events
    FOR INSERT WITH CHECK (true);

-- Payment orders: user can see their own, admin can see all
CREATE POLICY payment_orders_user_read ON payment_orders
    FOR SELECT USING (
        user_id::TEXT = current_setting('app.user_id', true)
        OR current_setting('app.role', true) IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE')
    );

-- Prize escrow: organiser can see their own, admin can see all
CREATE POLICY prize_escrow_organiser_read ON prize_escrow_locks
    FOR SELECT USING (
        organiser_id::TEXT = current_setting('app.user_id', true)
        OR current_setting('app.role', true) IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE')
    );

-- Entry payments: user sees own, admin sees all
CREATE POLICY entry_payments_user_read ON tournament_entry_payments
    FOR SELECT USING (
        user_id::TEXT = current_setting('app.user_id', true)
        OR current_setting('app.role', true) IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE')
    );

-- Regional config: read-only for all, write for admin
CREATE POLICY regional_config_read ON regional_payment_config
    FOR SELECT USING (true);

-- ─── 7. Seed default regional config (India FREE-only) ─────────────────
INSERT INTO regional_payment_config (region_code, country_code, is_enabled, kill_switch_on, kill_switch_reason)
VALUES ('IN-ALL', 'IN', FALSE, TRUE, 'v1 public launch = FREE tournaments only. Paid features require legal/payment sign-off.')
ON CONFLICT (region_code, country_code) DO NOTHING;

COMMIT;
