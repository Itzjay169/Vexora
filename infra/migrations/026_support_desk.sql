-- ============================================================================
-- Vexora Esports Tournament Platform
-- Phase 33: Support Desk & Ticketing System
-- Migration 026: support_tickets enhancements, ticket_events, canned_replies,
--                ticket_csat_surveys, sla_breach_alerts
-- ============================================================================

-- 1. Create sequence for human-readable ticket numbers
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START WITH 10001;

-- 2. Enhance existing support_tickets table with Phase 33 fields
DO $$
BEGIN
    -- Ticket Number (e.g. VEX-TK-10001)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'ticket_number') THEN
        ALTER TABLE support_tickets ADD COLUMN ticket_number VARCHAR(30) UNIQUE;
    END IF;

    -- SLA tracking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'sla_first_response_due_at') THEN
        ALTER TABLE support_tickets ADD COLUMN sla_first_response_due_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'sla_resolution_due_at') THEN
        ALTER TABLE support_tickets ADD COLUMN sla_resolution_due_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'sla_first_response_breached') THEN
        ALTER TABLE support_tickets ADD COLUMN sla_first_response_breached BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'sla_resolution_breached') THEN
        ALTER TABLE support_tickets ADD COLUMN sla_resolution_breached BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    -- Escalation tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'escalated_to') THEN
        ALTER TABLE support_tickets ADD COLUMN escalated_to VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'escalated_at') THEN
        ALTER TABLE support_tickets ADD COLUMN escalated_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'escalated_reason') THEN
        ALTER TABLE support_tickets ADD COLUMN escalated_reason TEXT;
    END IF;

    -- Related entity links (e.g. TOURNAMENT, MATCH, PAYMENT)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'related_entity_type') THEN
        ALTER TABLE support_tickets ADD COLUMN related_entity_type VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'related_entity_id') THEN
        ALTER TABLE support_tickets ADD COLUMN related_entity_id UUID;
    END IF;

    -- Close timestamp & tags
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'closed_at') THEN
        ALTER TABLE support_tickets ADD COLUMN closed_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'tags') THEN
        ALTER TABLE support_tickets ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Backfill ticket numbers for existing rows if any
UPDATE support_tickets
SET ticket_number = 'VEX-TK-' || nextval('support_ticket_seq')
WHERE ticket_number IS NULL;

ALTER TABLE support_tickets ALTER COLUMN ticket_number SET NOT NULL;

-- 3. Audit History: ticket_events
CREATE TABLE IF NOT EXISTS ticket_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id           UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    actor_id            UUID REFERENCES users(id),
    actor_role          VARCHAR(50) NOT NULL,
    event_type          VARCHAR(50) NOT NULL,
    old_state           JSONB,
    new_state           JSONB,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_id ON ticket_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_events_created_at ON ticket_events(created_at);

-- 4. Canned Replies Repository
CREATE TABLE IF NOT EXISTS canned_replies (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category            VARCHAR(50) NOT NULL,
    title               VARCHAR(150) NOT NULL,
    shortcut_code       VARCHAR(50) NOT NULL UNIQUE,
    body                TEXT NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canned_replies_category ON canned_replies(category);
CREATE INDEX IF NOT EXISTS idx_canned_replies_shortcut ON canned_replies(shortcut_code);

-- 5. CSAT Surveys Table
CREATE TABLE IF NOT EXISTS ticket_csat_surveys (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id           UUID NOT NULL UNIQUE REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    rating              INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    satisfied           BOOLEAN NOT NULL,
    feedback            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_csat_user ON ticket_csat_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_csat_rating ON ticket_csat_surveys(rating);

-- 6. SLA Breach Alerts Table
CREATE TABLE IF NOT EXISTS sla_breach_alerts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id           UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    breach_type         VARCHAR(50) NOT NULL CHECK (breach_type IN ('FIRST_RESPONSE', 'RESOLUTION')),
    category            VARCHAR(50) NOT NULL,
    priority            VARCHAR(50) NOT NULL,
    due_at              TIMESTAMPTZ NOT NULL,
    breached_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alerted_team        VARCHAR(50) NOT NULL,
    acknowledged        BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by     UUID REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_breach_acknowledged ON sla_breach_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_sla_breach_ticket ON sla_breach_alerts(ticket_id);

-- 7. Seed Standard Canned Replies
INSERT INTO canned_replies (category, title, shortcut_code, body)
VALUES
    ('ACCOUNT', 'Account Verification Instructions', 'acc-verify',
     'Hello! To complete your Vexora account verification, navigate to Profile -> Settings -> Verification and follow the steps. Note that Vexora v1 never asks for sensitive financial details for verification.'),
    ('TOURNAMENT', 'Tournament Check-in Protocol', 'tourn-checkin',
     'Tournament check-in opens 15 minutes before scheduled match start. All squad members or solo players must press "Check In" on the tournament screen to lock their lobby slot.'),
    ('MATCH', 'Match Evidence Submission & Dispute', 'match-dispute',
     'Please upload full, uncropped screenshots or video replay evidence showing end-game scores and player UIDs within 15 minutes of match conclusion to allow referees to adjudicate.'),
    ('PAYMENT', 'Payment & Credit Ledger Inquiries', 'pay-reconcile',
     'Thank you for reaching out. Please note that Vexora v1 operates on 100% free tournaments. For non-monetary credit or voucher questions, our automated ledger records all transactions with cryptographic hash audit.'),
    ('WALLET', 'Wallet Balance & Statement Transparency', 'wallet-ledger',
     'You can review every credit movement on your account under Profile -> Wallet -> Statement. Every debit and credit has a unique transaction reference and is recorded on our double-entry ledger.'),
    ('PAYOUT', 'Payout SLA & Processing Guidelines', 'payout-sla',
     'Promotional rewards or event certificates are processed within statutory timelines. Our support team has verified your query and forwarded it to our operations lead for priority review.'),
    ('SAFETY', 'Immediate Safety & Fair Play Escalation', 'safety-emergency',
     'Your safety and dignity on Vexora are our highest priority. This report has been flagged to our 24/7 Safety & Moderation Team with a 1-hour expedited response SLA under our Code of Conduct.'),
    ('ORGANISER', 'Organiser Verification & Tier Promotion', 'org-tier',
     'Organiser applications are evaluated based on community reputation, identity verification, and successful execution of community tournaments. You can track status under the Organiser Portal.')
ON CONFLICT (shortcut_code) DO NOTHING;

-- 8. Row-Level Security for New Tables
ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_csat_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_breach_alerts ENABLE ROW LEVEL SECURITY;

-- ticket_events: visible to ticket owner and staff
DROP POLICY IF EXISTS ticket_events_select ON ticket_events;
CREATE POLICY ticket_events_select ON ticket_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM support_tickets st
            WHERE st.id = ticket_events.ticket_id
              AND (st.user_id::text = current_setting('app.current_user_id', true)
                   OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FINANCE'))
        )
    );

-- canned_replies: readable by all staff, editable by admin
DROP POLICY IF EXISTS canned_replies_select ON canned_replies;
CREATE POLICY canned_replies_select ON canned_replies
    FOR SELECT
    USING (
        current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FINANCE')
    );

-- CSAT surveys: visible to user who submitted and staff
DROP POLICY IF EXISTS csat_select ON ticket_csat_surveys;
CREATE POLICY csat_select ON ticket_csat_surveys
    FOR SELECT
    USING (
        user_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FINANCE')
    );

-- SLA breach alerts: staff only
DROP POLICY IF EXISTS sla_alerts_select ON sla_breach_alerts;
CREATE POLICY sla_alerts_select ON sla_breach_alerts
    FOR SELECT
    USING (
        current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'FINANCE')
    );
