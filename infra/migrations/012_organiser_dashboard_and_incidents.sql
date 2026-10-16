-- ============================================================================
-- Vexora Database Migration 012: Organiser Dashboard, Incidents & Operations
-- Phase 18: Organiser Dashboard & Admin Tournament Review Queue
-- ============================================================================

-- 1. Create tournament announcements table
CREATE TABLE IF NOT EXISTS tournament_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    organiser_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    moderation_status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_announcement_moderation CHECK (moderation_status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

-- 2. Create tournament incident logs table (Section 43: late start, disconnects, rule clarifications)
CREATE TABLE IF NOT EXISTS tournament_incident_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    reported_by UUID NOT NULL REFERENCES users(id),
    incident_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'LOW',
    description TEXT NOT NULL,
    resolution TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'LOGGED',
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_incident_type CHECK (
        incident_type IN (
            'LATE_START',
            'DISCONNECT',
            'RULE_CLARIFICATION',
            'SUSPECTED_CHEATING',
            'LOBBY_ISSUE',
            'NO_SHOW',
            'ROSTER_CONFLICT',
            'OTHER'
        )
    ),
    CONSTRAINT chk_incident_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_incident_status CHECK (status IN ('LOGGED', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED'))
);

-- 3. Create tournament match-day checklists table (Section 43)
CREATE TABLE IF NOT EXISTS tournament_matchday_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    item_key VARCHAR(100) NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_by UUID REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tourn_checklist_item UNIQUE (tournament_id, item_key),
    CONSTRAINT chk_checklist_item_key CHECK (
        item_key IN (
            'LOBBY_CREATED',
            'ROOM_DETAILS_RELEASED',
            'CHECK_IN_VERIFIED',
            'EVIDENCE_COLLECTED',
            'RESULT_SUBMITTED'
        )
    )
);

-- 4. Indexes for fast operational query performance
CREATE INDEX IF NOT EXISTS idx_announcements_tournament_created
    ON tournament_announcements(tournament_id, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_tournament_status
    ON tournament_incident_logs(tournament_id, status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checklists_tournament_key
    ON tournament_matchday_checklists(tournament_id, item_key);

-- 5. Row-Level Security
ALTER TABLE tournament_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_incident_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matchday_checklists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'announcements_public_read') THEN
        CREATE POLICY announcements_public_read ON tournament_announcements
            FOR SELECT USING (moderation_status = 'APPROVED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'announcements_staff_manage') THEN
        CREATE POLICY announcements_staff_manage ON tournament_announcements
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM tournaments t
                    WHERE t.id = tournament_announcements.tournament_id
                      AND (t.organiser_id = current_setting('vexora.current_user_id', true)::uuid
                           OR current_setting('vexora.current_role', true) IN ('ADMIN', 'SUPER_ADMIN'))
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'incidents_staff_read') THEN
        CREATE POLICY incidents_staff_read ON tournament_incident_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM tournaments t
                    WHERE t.id = tournament_incident_logs.tournament_id
                      AND (t.organiser_id = current_setting('vexora.current_user_id', true)::uuid
                           OR current_setting('vexora.current_role', true) IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'checklists_staff_manage') THEN
        CREATE POLICY checklists_staff_manage ON tournament_matchday_checklists
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM tournaments t
                    WHERE t.id = tournament_matchday_checklists.tournament_id
                      AND (t.organiser_id = current_setting('vexora.current_user_id', true)::uuid
                           OR current_setting('vexora.current_role', true) IN ('ADMIN', 'SUPER_ADMIN'))
                )
            );
    END IF;
END $$;
