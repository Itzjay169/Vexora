-- ============================================================================
-- Vexora Esports Tournament Platform — DDL Migration 017
-- Version: 017_ratings_reputation_and_security_centre
-- Description: Phase 24 — Post-tournament organiser ratings with sample size,
--              3-dimensional scoring, verified reviews, review dispute appeals,
--              blocked IPs, login security, and Security Centre v1.
-- ============================================================================

-- ─── 1. Organiser Ratings Table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organiser_ratings (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id           UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    organiser_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    communication_score     SMALLINT NOT NULL CHECK (communication_score BETWEEN 1 AND 5),
    schedule_score          SMALLINT NOT NULL CHECK (schedule_score BETWEEN 1 AND 5),
    result_score            SMALLINT NOT NULL CHECK (result_score BETWEEN 1 AND 5),
    overall_score           NUMERIC(3, 2) NOT NULL CHECK (overall_score >= 1.0 AND overall_score <= 5.0),
    review_text             TEXT CHECK (review_text IS NULL OR length(review_text) <= 1000),
    is_verified_participant BOOLEAN NOT NULL DEFAULT true,
    moderation_status       VARCHAR(20) NOT NULL DEFAULT 'VISIBLE'
                            CHECK (moderation_status IN ('VISIBLE', 'FLAGGED', 'REMOVED')),
    flag_reason             TEXT,
    flagged_by              UUID REFERENCES users(id),
    flagged_at              TIMESTAMPTZ,
    moderated_by            UUID REFERENCES users(id),
    moderated_at            TIMESTAMPTZ,
    moderation_notes        TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tournament_participant_rating UNIQUE (tournament_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_organiser_ratings_organiser ON organiser_ratings(organiser_id);
CREATE INDEX IF NOT EXISTS idx_organiser_ratings_tournament ON organiser_ratings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_organiser_ratings_status ON organiser_ratings(moderation_status);

-- Organiser cannot delete negative reviews themselves trigger
CREATE OR REPLACE FUNCTION prevent_organiser_rating_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Organisers and players cannot delete ratings. Use moderation dispute workflow.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_organiser_rating_deletion ON organiser_ratings;
CREATE TRIGGER trg_prevent_organiser_rating_deletion
    BEFORE DELETE ON organiser_ratings
    FOR EACH ROW
    EXECUTE FUNCTION prevent_organiser_rating_deletion();

-- ─── 2. Organiser Rating Appeals Table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS organiser_rating_appeals (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rating_id               UUID NOT NULL REFERENCES organiser_ratings(id) ON DELETE CASCADE,
    organiser_id            UUID NOT NULL REFERENCES users(id),
    grounds                 VARCHAR(50) NOT NULL
                            CHECK (grounds IN ('ABUSIVE_OR_HARASSMENT', 'DEMONSTRABLY_FALSE', 'EXTORTION_OR_SPAM', 'PERSONAL_INFO_DOXXING', 'OTHER')),
    explanation             TEXT NOT NULL CHECK (length(explanation) >= 10),
    evidence_hashes         TEXT[] NOT NULL DEFAULT '{}',
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'UPHELD', 'REJECTED')),
    adjudicated_by          UUID REFERENCES users(id),
    adjudicated_at          TIMESTAMPTZ,
    decision_reason         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rating_appeals_rating ON organiser_rating_appeals(rating_id);
CREATE INDEX IF NOT EXISTS idx_rating_appeals_status ON organiser_rating_appeals(status);

-- ─── 3. Blocked IPs Table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blocked_ips (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address              VARCHAR(45) NOT NULL UNIQUE,
    reason                  TEXT NOT NULL,
    threat_level            VARCHAR(20) NOT NULL DEFAULT 'HIGH'
                            CHECK (threat_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    blocked_by              UUID REFERENCES users(id),
    is_active               BOOLEAN NOT NULL DEFAULT true,
    blocked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ,
    unblocked_at            TIMESTAMPTZ,
    unblocked_by            UUID REFERENCES users(id),
    unblock_reason          TEXT
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON blocked_ips(is_active);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_address ON blocked_ips(ip_address);

-- ─── 4. Login Attempt Enhancements for Security Centre ───────────────────────

ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(100);
ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- ─── 5. Organiser Reputation Summary View ───────────────────────────────────

CREATE OR REPLACE VIEW v_organiser_reputation_summary AS
SELECT
    organiser_id,
    COUNT(*)::INTEGER AS sample_size,
    COUNT(*) FILTER (WHERE is_verified_participant = true)::INTEGER AS verified_reviews_count,
    ROUND(AVG(communication_score)::NUMERIC, 2) AS avg_communication,
    ROUND(AVG(schedule_score)::NUMERIC, 2) AS avg_schedule,
    ROUND(AVG(result_score)::NUMERIC, 2) AS avg_result,
    ROUND(AVG(overall_score)::NUMERIC, 2) AS avg_overall
FROM organiser_ratings
WHERE moderation_status = 'VISIBLE'
GROUP BY organiser_id;

-- ─── 6. Role Permissions ────────────────────────────────────────────────────

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vexora_app_role') THEN
        GRANT SELECT, INSERT, UPDATE ON organiser_ratings TO vexora_app_role;
        GRANT SELECT, INSERT, UPDATE ON organiser_rating_appeals TO vexora_app_role;
        GRANT SELECT, INSERT, UPDATE ON blocked_ips TO vexora_app_role;
        GRANT SELECT ON v_organiser_reputation_summary TO vexora_app_role;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vexora_auditor_role') THEN
        GRANT SELECT ON organiser_ratings TO vexora_auditor_role;
        GRANT SELECT ON organiser_rating_appeals TO vexora_auditor_role;
        GRANT SELECT ON blocked_ips TO vexora_auditor_role;
        GRANT SELECT ON v_organiser_reputation_summary TO vexora_auditor_role;
    END IF;
END$$;
