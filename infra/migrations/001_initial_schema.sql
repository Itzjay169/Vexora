-- ============================================================================
-- Vexora Esports Tournament Platform — Master DDL Migration
-- Version: 001_initial_schema
-- Description: Complete database schema for all 10 phases
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PHASE 1: Foundation — Auth, Users, Sessions, RBAC, Audit
-- ============================================================================

-- Enum types
CREATE TYPE user_role AS ENUM ('PLAYER', 'ORGANISER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'RESTRICTED', 'SUSPENDED', 'BANNED', 'DELETED');
CREATE TYPE session_status AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE organiser_tier AS ENUM ('STARTER', 'VERIFIED', 'PARTNER');
CREATE TYPE kyc_status AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

-- Users table
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(30) NOT NULL UNIQUE,
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(20) UNIQUE,
    display_name    VARCHAR(50),
    avatar_url      TEXT,
    role            user_role NOT NULL DEFAULT 'PLAYER',
    status          user_status NOT NULL DEFAULT 'ACTIVE',
    firebase_uid    VARCHAR(128) UNIQUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    date_of_birth   DATE,
    bio             VARCHAR(500),
    country         VARCHAR(3),  -- ISO 3166-1 alpha-3
    state_region    VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT chk_min_age CHECK (
        date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE - INTERVAL '16 years'
    ),
    CONSTRAINT chk_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);

-- User sessions (JWT refresh token tracking)
CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(128) NOT NULL,
    device_info     JSONB,
    ip_hash         VARCHAR(64),
    status          session_status NOT NULL DEFAULT 'ACTIVE',
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_status ON user_sessions(status);

-- Tamper-evident audit log with hash chain
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    actor_id        UUID REFERENCES users(id),
    actor_role      user_role,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       VARCHAR(100),
    payload         JSONB,
    ip_hash         VARCHAR(64),
    prev_hash       VARCHAR(64) NOT NULL,
    curr_hash       VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Prevent tampering with audit logs
CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: audit_logs rows are immutable. UPDATE and DELETE are forbidden.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_tampering();

CREATE TRIGGER trg_prevent_audit_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_tampering();

-- Audit chain checkpoints (Merkle roots)
CREATE TABLE audit_chain_checkpoints (
    id              SERIAL PRIMARY KEY,
    checkpoint_date DATE NOT NULL UNIQUE,
    merkle_root     VARCHAR(64) NOT NULL,
    signature       TEXT NOT NULL,
    record_count    INTEGER NOT NULL,
    first_log_id    BIGINT NOT NULL,
    last_log_id     BIGINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: Games, Teams, In-Game UIDs
-- ============================================================================

CREATE TYPE game_status AS ENUM ('ACTIVE', 'DEPRECATED', 'COMING_SOON');
CREATE TYPE team_member_role AS ENUM ('CAPTAIN', 'PLAYER', 'SUBSTITUTE');
CREATE TYPE team_invite_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- Games catalog
CREATE TABLE games (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    publisher       VARCHAR(100),
    icon_url        TEXT,
    banner_url      TEXT,
    status          game_status NOT NULL DEFAULT 'ACTIVE',
    max_team_size   INTEGER NOT NULL DEFAULT 4,
    min_team_size   INTEGER NOT NULL DEFAULT 1,
    platforms       TEXT[] NOT NULL DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Versioned scoring schemas per game mode
CREATE TABLE scoring_schemas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id         UUID NOT NULL REFERENCES games(id),
    mode_slug       VARCHAR(50) NOT NULL,
    mode_name       VARCHAR(100) NOT NULL,
    version         VARCHAR(20) NOT NULL,
    formula         JSONB NOT NULL,  -- { placement_points: {1:12,2:9,...}, kill_points: 1, ... }
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_scoring_game_mode_version UNIQUE (game_id, mode_slug, version)
);

-- User in-game identities
CREATE TABLE user_game_ids (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id         UUID NOT NULL REFERENCES games(id),
    in_game_uid     VARCHAR(100) NOT NULL,
    in_game_name    VARCHAR(100),
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_game_uid UNIQUE (game_id, in_game_uid),
    CONSTRAINT uq_user_game UNIQUE (user_id, game_id)
);

-- Teams
CREATE TABLE teams (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(50) NOT NULL,
    tag             VARCHAR(10) NOT NULL,
    game_id         UUID NOT NULL REFERENCES games(id),
    captain_id      UUID NOT NULL REFERENCES users(id),
    logo_url        TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_team_name_game UNIQUE (name, game_id)
);

CREATE TABLE team_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    role            team_member_role NOT NULL DEFAULT 'PLAYER',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at         TIMESTAMPTZ,

    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

CREATE TABLE team_invitations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    inviter_id      UUID NOT NULL REFERENCES users(id),
    invitee_id      UUID NOT NULL REFERENCES users(id),
    status          team_invite_status NOT NULL DEFAULT 'PENDING',
    message         VARCHAR(200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at    TIMESTAMPTZ
);

-- ============================================================================
-- PHASE 3: Tournaments — 11-State Machine, Brackets, Registration
-- ============================================================================

CREATE TYPE tournament_status AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'APPROVED',
    'REGISTRATION_OPEN',
    'REGISTRATION_CLOSED',
    'CHECK_IN_OPEN',
    'IN_PROGRESS',
    'RESULT_PENDING',
    'SETTLING',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE tournament_format AS ENUM (
    'SINGLE_ELIMINATION',
    'DOUBLE_ELIMINATION',
    'ROUND_ROBIN',
    'SWISS',
    'BATTLE_ROYALE_LOBBY'
);

CREATE TYPE registration_status AS ENUM (
    'REGISTERED', 'CHECKED_IN', 'NO_SHOW', 'DISQUALIFIED', 'WITHDRAWN'
);

-- Organiser profiles
CREATE TABLE organiser_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id),
    tier            organiser_tier NOT NULL DEFAULT 'STARTER',
    kyc_status      kyc_status NOT NULL DEFAULT 'NOT_SUBMITTED',
    kyc_document_url TEXT,
    trust_score     NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    total_tournaments INTEGER NOT NULL DEFAULT 0,
    completed_tournaments INTEGER NOT NULL DEFAULT 0,
    cancelled_tournaments INTEGER NOT NULL DEFAULT 0,
    disputed_tournaments INTEGER NOT NULL DEFAULT 0,
    social_links    JSONB DEFAULT '{}',
    business_name   VARCHAR(200),
    business_reg_id VARCHAR(100),
    approved_at     TIMESTAMPTZ,
    approved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_trust_score CHECK (trust_score >= 0 AND trust_score <= 100)
);

-- Tournaments
CREATE TABLE tournaments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organiser_id        UUID NOT NULL REFERENCES users(id),
    game_id             UUID NOT NULL REFERENCES games(id),
    scoring_schema_id   UUID NOT NULL REFERENCES scoring_schemas(id),
    title               VARCHAR(200) NOT NULL,
    slug                VARCHAR(200) NOT NULL UNIQUE,
    description         TEXT,
    rules_text          TEXT,
    banner_url          TEXT,
    status              tournament_status NOT NULL DEFAULT 'DRAFT',
    format              tournament_format NOT NULL,
    team_size           INTEGER NOT NULL DEFAULT 1,
    min_participants    INTEGER NOT NULL DEFAULT 4,
    max_participants    INTEGER NOT NULL DEFAULT 64,
    current_participants INTEGER NOT NULL DEFAULT 0,
    entry_fee_credits   NUMERIC(14,2) NOT NULL DEFAULT 0,
    prize_pool_credits  NUMERIC(14,2) NOT NULL DEFAULT 0,
    prize_distribution  JSONB,  -- { "1st": 50, "2nd": 30, "3rd": 20 } percentages
    registration_open   TIMESTAMPTZ,
    registration_close  TIMESTAMPTZ,
    check_in_open       TIMESTAMPTZ,
    check_in_close      TIMESTAMPTZ,
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ,
    is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
    visibility          VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    region              VARCHAR(50),
    tags                TEXT[] DEFAULT '{}',
    metadata            JSONB DEFAULT '{}',
    idempotency_key     VARCHAR(100) UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_participants CHECK (min_participants <= max_participants),
    CONSTRAINT chk_entry_fee CHECK (entry_fee_credits >= 0),
    CONSTRAINT chk_prize_pool CHECK (prize_pool_credits >= 0)
);

CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_game ON tournaments(game_id);
CREATE INDEX idx_tournaments_organiser ON tournaments(organiser_id);
CREATE INDEX idx_tournaments_start ON tournaments(start_time);

-- Tournament registrations
CREATE TABLE tournament_registrations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id       UUID NOT NULL REFERENCES tournaments(id),
    user_id             UUID REFERENCES users(id),
    team_id             UUID REFERENCES teams(id),
    status              registration_status NOT NULL DEFAULT 'REGISTERED',
    seed                INTEGER,
    checked_in_at       TIMESTAMPTZ,
    entry_tx_id         UUID,  -- Reference to ledger transaction
    idempotency_key     VARCHAR(100) UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_participant CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE INDEX idx_registrations_tournament ON tournament_registrations(tournament_id);

-- Bracket / Match tree
CREATE TABLE brackets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id       UUID NOT NULL REFERENCES tournaments(id),
    round_number        INTEGER NOT NULL,
    match_number        INTEGER NOT NULL,
    participant_a_id    UUID,  -- registration id
    participant_b_id    UUID,
    winner_id           UUID,
    next_bracket_id     UUID REFERENCES brackets(id),
    lobby_group         INTEGER,  -- For battle royale grouping
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_bracket_position UNIQUE (tournament_id, round_number, match_number)
);

-- ============================================================================
-- PHASE 4: Matches, Results, Evidence, Scoring, Leaderboards
-- ============================================================================

CREATE TYPE match_status AS ENUM (
    'SCHEDULED', 'LOBBY_CREATED', 'IN_PROGRESS', 'RESULT_PENDING',
    'RESULT_CONFIRMED', 'DISPUTED', 'FINAL', 'CANCELLED', 'FORFEIT'
);

CREATE TABLE matches (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id       UUID NOT NULL REFERENCES tournaments(id),
    bracket_id          UUID REFERENCES brackets(id),
    round_number        INTEGER NOT NULL,
    match_number        INTEGER NOT NULL,
    status              match_status NOT NULL DEFAULT 'SCHEDULED',
    room_id             VARCHAR(100),
    room_password       VARCHAR(100),
    scheduled_at        TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    ended_at            TIMESTAMPTZ,
    result_submitted_by UUID REFERENCES users(id),
    result_confirmed_by UUID REFERENCES users(id),
    confirmation_deadline TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_status ON matches(status);

-- Match participants (individual or team scores per match)
CREATE TABLE match_participants (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    registration_id     UUID NOT NULL REFERENCES tournament_registrations(id),
    placement           INTEGER,
    kills               INTEGER DEFAULT 0,
    deaths              INTEGER DEFAULT 0,
    assists             INTEGER DEFAULT 0,
    raw_score           JSONB DEFAULT '{}',
    calculated_points   NUMERIC(10,2) DEFAULT 0,
    is_winner           BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_match_participant UNIQUE (match_id, registration_id)
);

-- Evidence files with SHA-256 integrity hashing
CREATE TABLE evidence_files (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id            UUID NOT NULL REFERENCES matches(id),
    uploaded_by         UUID NOT NULL REFERENCES users(id),
    file_url            TEXT NOT NULL,
    file_type           VARCHAR(10) NOT NULL,
    file_size_bytes     INTEGER NOT NULL,
    sha256_hash         VARCHAR(64) NOT NULL,
    description         VARCHAR(200),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_file_type CHECK (file_type IN ('JPEG', 'PNG', 'MP4', 'WEBP')),
    CONSTRAINT chk_file_size CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760)
);

CREATE INDEX idx_evidence_match ON evidence_files(match_id);

-- Leaderboard snapshots
CREATE TABLE leaderboards (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id       UUID NOT NULL REFERENCES tournaments(id),
    registration_id     UUID NOT NULL REFERENCES tournament_registrations(id),
    total_points        NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_kills         INTEGER NOT NULL DEFAULT 0,
    total_deaths        INTEGER NOT NULL DEFAULT 0,
    matches_played      INTEGER NOT NULL DEFAULT 0,
    matches_won         INTEGER NOT NULL DEFAULT 0,
    rank                INTEGER,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_leaderboard_entry UNIQUE (tournament_id, registration_id)
);

-- ============================================================================
-- PHASE 5: Trust & Safety — Reports, Disputes, Sanctions
-- ============================================================================

CREATE TYPE report_status AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');
CREATE TYPE report_category AS ENUM (
    'CHEATING', 'HARASSMENT', 'IMPERSONATION', 'MATCH_FIXING',
    'RESULT_FRAUD', 'INAPPROPRIATE_CONTENT', 'OTHER'
);
CREATE TYPE dispute_status AS ENUM (
    'OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED',
    'RESOLVED_UPHELD', 'RESOLVED_OVERTURNED', 'DISMISSED'
);
CREATE TYPE sanction_type AS ENUM ('WARNING', 'RESTRICTION', 'SUSPENSION', 'BAN');

CREATE TABLE reports (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id         UUID NOT NULL REFERENCES users(id),
    reported_user_id    UUID REFERENCES users(id),
    reported_team_id    UUID REFERENCES teams(id),
    tournament_id       UUID REFERENCES tournaments(id),
    match_id            UUID REFERENCES matches(id),
    category            report_category NOT NULL,
    description         TEXT NOT NULL,
    evidence_ids        UUID[] DEFAULT '{}',
    status              report_status NOT NULL DEFAULT 'OPEN',
    assigned_moderator  UUID REFERENCES users(id),
    resolution_notes    TEXT,
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE disputes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id            UUID NOT NULL REFERENCES matches(id),
    raised_by           UUID NOT NULL REFERENCES users(id),
    status              dispute_status NOT NULL DEFAULT 'OPEN',
    reason              TEXT NOT NULL,
    counter_evidence_ids UUID[] DEFAULT '{}',
    assigned_moderator  UUID REFERENCES users(id),
    ruling              TEXT,
    ruling_by           UUID REFERENCES users(id),
    sla_deadline        TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sanctions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    sanction_type       sanction_type NOT NULL,
    reason              TEXT NOT NULL,
    related_report_id   UUID REFERENCES reports(id),
    related_dispute_id  UUID REFERENCES disputes(id),
    issued_by           UUID NOT NULL REFERENCES users(id),
    starts_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    appeal_text         TEXT,
    appeal_status       VARCHAR(20) DEFAULT 'NONE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sanctions_user ON sanctions(user_id);

-- ============================================================================
-- PHASE 6: Wallet, Double-Entry Ledger, Redeem Codes, Escrow
-- ============================================================================

CREATE TYPE wallet_account_type AS ENUM (
    'USER', 'ORGANISER_ESCROW', 'PLATFORM_REVENUE', 'PLATFORM_ESCROW'
);
CREATE TYPE ledger_entry_type AS ENUM (
    'CREDIT_PURCHASE', 'ENTRY_FEE_HOLD', 'ENTRY_FEE_RELEASE',
    'PRIZE_AWARD', 'REFUND', 'ADJUSTMENT', 'REDEEM_CODE',
    'PAYOUT_REQUEST', 'PAYOUT_COMPLETED', 'PLATFORM_FEE',
    'ESCROW_LOCK', 'ESCROW_RELEASE'
);
CREATE TYPE redeem_code_status AS ENUM (
    'CREATED', 'ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED', 'BLOCKED'
);
CREATE TYPE payout_status AS ENUM (
    'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED'
);

-- Wallet accounts
CREATE TABLE wallet_accounts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id            UUID REFERENCES users(id),
    account_type        wallet_account_type NOT NULL,
    available_balance   NUMERIC(14,2) NOT NULL DEFAULT 0,
    held_balance        NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency            VARCHAR(3) NOT NULL DEFAULT 'VXC',  -- Vexora Credits
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_available_balance CHECK (available_balance >= 0),
    CONSTRAINT chk_held_balance CHECK (held_balance >= 0)
);

CREATE INDEX idx_wallet_owner ON wallet_accounts(owner_id);

-- Append-only double-entry ledger
CREATE TABLE ledger_transactions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key     VARCHAR(200) UNIQUE,
    entry_type          ledger_entry_type NOT NULL,
    debit_account_id    UUID NOT NULL REFERENCES wallet_accounts(id),
    credit_account_id   UUID NOT NULL REFERENCES wallet_accounts(id),
    amount              NUMERIC(14,2) NOT NULL,
    description         TEXT,
    reference_type      VARCHAR(50),
    reference_id        UUID,
    initiated_by        UUID REFERENCES users(id),
    approved_by         UUID REFERENCES users(id),
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_different_accounts CHECK (debit_account_id != credit_account_id)
);

CREATE INDEX idx_ledger_debit ON ledger_transactions(debit_account_id);
CREATE INDEX idx_ledger_credit ON ledger_transactions(credit_account_id);
CREATE INDEX idx_ledger_reference ON ledger_transactions(reference_type, reference_id);
CREATE INDEX idx_ledger_created ON ledger_transactions(created_at);

-- Prevent modification of ledger entries
CREATE OR REPLACE FUNCTION prevent_ledger_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: ledger_transactions are immutable. UPDATE and DELETE are forbidden.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_ledger_update
    BEFORE UPDATE ON ledger_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_tampering();

CREATE TRIGGER trg_prevent_ledger_delete
    BEFORE DELETE ON ledger_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_tampering();

-- HMAC-hashed redeem codes
CREATE TABLE redeem_codes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_hash           VARCHAR(64) NOT NULL UNIQUE,
    value_credits       NUMERIC(14,2) NOT NULL,
    status              redeem_code_status NOT NULL DEFAULT 'CREATED',
    batch_id            VARCHAR(50),
    max_uses            INTEGER NOT NULL DEFAULT 1,
    current_uses        INTEGER NOT NULL DEFAULT 0,
    expires_at          TIMESTAMPTZ,
    redeemed_by         UUID REFERENCES users(id),
    redeemed_at         TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_value CHECK (value_credits > 0),
    CONSTRAINT chk_uses CHECK (current_uses <= max_uses)
);

-- Payout requests with maker-checker
CREATE TABLE payout_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    amount              NUMERIC(14,2) NOT NULL,
    payout_method       VARCHAR(50) NOT NULL,
    payout_details      JSONB NOT NULL,
    status              payout_status NOT NULL DEFAULT 'PENDING_APPROVAL',
    maker_id            UUID REFERENCES users(id),
    checker_id          UUID REFERENCES users(id),
    rejection_reason    TEXT,
    processed_at        TIMESTAMPTZ,
    ledger_tx_id        UUID REFERENCES ledger_transactions(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_payout_amount CHECK (amount > 0)
);

-- ============================================================================
-- PHASE 7: Notifications
-- ============================================================================

CREATE TYPE notification_channel AS ENUM ('IN_APP', 'PUSH', 'EMAIL', 'SMS');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'READ', 'FAILED');

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    channel             notification_channel NOT NULL DEFAULT 'IN_APP',
    title               VARCHAR(200) NOT NULL,
    body                TEXT NOT NULL,
    action_url          TEXT,
    status              notification_status NOT NULL DEFAULT 'PENDING',
    read_at             TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, status);

-- FCM device tokens
CREATE TABLE device_tokens (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token               TEXT NOT NULL,
    platform            VARCHAR(20) NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PHASE 8: Achievements & Support Tickets
-- ============================================================================

CREATE TABLE achievements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug                VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    icon_url            TEXT,
    category            VARCHAR(50) NOT NULL,
    criteria            JSONB NOT NULL,
    points              INTEGER NOT NULL DEFAULT 10,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_achievements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    achievement_id      UUID NOT NULL REFERENCES achievements(id),
    earned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata            JSONB DEFAULT '{}',

    CONSTRAINT uq_user_achievement UNIQUE (user_id, achievement_id)
);

CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');
CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE support_tickets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    subject             VARCHAR(200) NOT NULL,
    description         TEXT NOT NULL,
    category            VARCHAR(50) NOT NULL,
    priority            ticket_priority NOT NULL DEFAULT 'MEDIUM',
    status              ticket_status NOT NULL DEFAULT 'OPEN',
    assigned_to         UUID REFERENCES users(id),
    sla_response_by     TIMESTAMPTZ,
    sla_resolve_by      TIMESTAMPTZ,
    first_responded_at  TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ticket_messages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id           UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id           UUID NOT NULL REFERENCES users(id),
    message             TEXT NOT NULL,
    is_internal         BOOLEAN NOT NULL DEFAULT FALSE,
    attachments         JSONB DEFAULT '[]',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PHASE 9: Risk & Webhooks
-- ============================================================================

CREATE TABLE risk_signals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES users(id),
    signal_type         VARCHAR(50) NOT NULL,
    severity            VARCHAR(20) NOT NULL DEFAULT 'LOW',
    details             JSONB NOT NULL,
    is_resolved         BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by         UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider            VARCHAR(50) NOT NULL,
    event_type          VARCHAR(100) NOT NULL,
    payload             JSONB NOT NULL,
    signature           TEXT,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    processed           BOOLEAN NOT NULL DEFAULT FALSE,
    idempotency_key     VARCHAR(200) UNIQUE,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at        TIMESTAMPTZ
);

CREATE INDEX idx_webhook_provider ON webhook_events(provider);
CREATE INDEX idx_webhook_processed ON webhook_events(processed);

-- ============================================================================
-- Global updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tournaments_updated_at BEFORE UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_disputes_updated_at BEFORE UPDATE ON disputes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_wallet_updated_at BEFORE UPDATE ON wallet_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_organiser_profiles_updated_at BEFORE UPDATE ON organiser_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
