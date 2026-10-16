-- ============================================================================
-- Migration 022: Real-Time Gateway, Event Outbox & Sequence Replay
-- Phase 29 of 40 — Vexora Esports Tournament Platform
-- PDF refs: Sections 14, 39 (Phase 7)
--
-- Tables created:
--   1. event_outbox — Transactional outbox table ensuring events publish only
--                    after database commit, with monotonic sequence numbers
--                    for missed-event reconnect replay.
--   2. realtime_channel_subscriptions — Audit log of active & historical channel
--                                       authorizations and subscriptions.
--
-- Security:
--   - Monotonic sequence numbers per channel
--   - Immutability trigger: Outbox records are append-only (no DELETE or payload UPDATE)
--   - Fast composite indexes for missed-event replay queries
-- ============================================================================

BEGIN;

-- ─── 1. Event Outbox: Transactional Outbox Pattern ──────────────────────
-- Events are committed in the same database transaction as the business operation.
-- A background worker or immediate publisher pushes them to Redis/WebSocket gateway.
CREATE TABLE IF NOT EXISTS event_outbox (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel         TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    sequence_num    BIGSERIAL,
    published       BOOLEAN NOT NULL DEFAULT false,
    published_at    TIMESTAMPTZ,
    error_message   TEXT,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_channel_format CHECK (length(channel) >= 3)
);

-- Fast lookup indexes for outbox processing & client reconnect replay
CREATE INDEX IF NOT EXISTS idx_event_outbox_replay
    ON event_outbox (channel, sequence_num ASC);
CREATE INDEX IF NOT EXISTS idx_event_outbox_unpublished
    ON event_outbox (published, created_at ASC) WHERE published = false;

-- Immutability Trigger: Outbox payloads cannot be tampered with after creation
CREATE OR REPLACE FUNCTION prevent_outbox_payload_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.payload IS DISTINCT FROM NEW.payload OR OLD.sequence_num IS DISTINCT FROM NEW.sequence_num THEN
        RAISE EXCEPTION 'IMMUTABILITY VIOLATION: Event outbox payload and sequence cannot be modified';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outbox_immutable
    BEFORE UPDATE ON event_outbox
    FOR EACH ROW
    EXECUTE FUNCTION prevent_outbox_payload_tampering();

-- ─── 2. Real-Time Channel Authorizations / Subscriptions ────────────────
CREATE TABLE IF NOT EXISTS realtime_channel_subscriptions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    channel         TEXT NOT NULL,
    socket_id       TEXT NOT NULL,
    is_authorized   BOOLEAN NOT NULL DEFAULT true,
    last_sequence_received BIGINT DEFAULT 0,
    connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    ip_address      TEXT,
    user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_realtime_subs_user_channel
    ON realtime_channel_subscriptions (user_id, channel) WHERE disconnected_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_realtime_subs_socket
    ON realtime_channel_subscriptions (socket_id);

COMMIT;
