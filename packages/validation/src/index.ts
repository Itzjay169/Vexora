import { z } from 'zod';

// ─── Phase 15: Tournament State Machine & Creation Schemas ───────────────────
export const TournamentStatus = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'SCHEDULED',
  'REGISTRATION_OPEN',
  'CHECK_IN',
  'LIVE',
  'RESULT_PENDING',
  'DISPUTED',
  'COMPLETED',
  'SETTLED',
  'ARCHIVED',
]);
export type TournamentStatus = z.infer<typeof TournamentStatus>;

export const TournamentFormat = z.enum([
  'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION',
  'ROUND_ROBIN',
  'SWISS',
  'BATTLE_ROYALE_LOBBY',
  'LEAGUE',
  'CUSTOM',
]);
export type TournamentFormat = z.infer<typeof TournamentFormat>;

export const TournamentCreateSchema = z.object({
  game_id: z.string().uuid(),
  mode_id: z.string().uuid().optional(),
  scoring_schema_id: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  format: TournamentFormat,
  team_size: z.number().int().min(1).max(100).default(1),
  min_participants: z.number().int().min(2).max(256).default(4),
  max_participants: z.number().int().min(2).max(256).default(64),
  start_time: z.string().datetime(),
  registration_open: z.string().datetime().optional(),
  registration_close: z.string().datetime().optional(),
  check_in_open: z.string().datetime().optional(),
  check_in_close: z.string().datetime().optional(),
  rules_text: z.string().max(10000).optional(),
  rule_json: z.record(z.any()).default({}),
  disconnect_policy: z.string().max(2000).optional(),
  evidence_requirements: z.record(z.any()).default({}),
  entry_fee_credits: z.number().min(0).max(0).default(0), // Launch principle: v1 is 100% FREE!
  prize_pool_credits: z.number().min(0).max(0).default(0), // Launch principle: v1 free
  prize_text: z.string().max(500).optional(),
  prize_distribution: z.record(z.any()).optional(),
  region: z.string().max(50).optional(),
  tags: z.array(z.string()).default([]),
  banner_url: z.string().url().optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).default('PUBLIC'),
}).refine(
  data => data.min_participants <= data.max_participants,
  { message: 'min_participants must be <= max_participants', path: ['min_participants'] }
).refine(
  data => {
    if (data.registration_open && data.registration_close) {
      return new Date(data.registration_close) > new Date(data.registration_open);
    }
    return true;
  },
  { message: 'registration_close must be after registration_open', path: ['registration_close'] }
).refine(
  data => {
    if (data.registration_close) {
      return new Date(data.start_time) >= new Date(data.registration_close);
    }
    return true;
  },
  { message: 'start_time must be at or after registration_close', path: ['start_time'] }
).refine(
  data => {
    if (data.check_in_open) {
      return new Date(data.start_time) >= new Date(data.check_in_open);
    }
    return true;
  },
  { message: 'start_time must be at or after check_in_open', path: ['start_time'] }
);

export const TournamentUpdateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  rules_text: z.string().max(10000).optional(),
  min_participants: z.number().int().min(2).max(256).optional(),
  max_participants: z.number().int().min(2).max(256).optional(),
  start_time: z.string().datetime().optional(),
  registration_open: z.string().datetime().optional(),
  registration_close: z.string().datetime().optional(),
  check_in_open: z.string().datetime().optional(),
  check_in_close: z.string().datetime().optional(),
  prize_text: z.string().max(500).optional(),
  prize_distribution: z.record(z.any()).optional(),
  region: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
  banner_url: z.string().url().optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
});

export const TournamentRuleUpdateSchema = z.object({
  rules_text: z.string().max(10000).optional(),
  rule_json: z.record(z.any()).default({}),
  evidence_policy: z.record(z.any()).default({}),
  disconnect_policy: z.string().max(2000).optional(),
  tie_breaker_policy: z.record(z.any()).default({}),
  change_summary: z.string().min(5).max(1000), // Mandatory audit rationale
});

export const TournamentTransitionSchema = z.object({
  new_status: TournamentStatus,
  reason: z.string().max(500).optional(),
});

// ─── Phase 16: Tournament Registration & Discovery Schemas ───────────────────
export const RegistrationStatus = z.enum([
  'CONFIRMED',
  'WAITLISTED',
  'CHECKED_IN',
  'CANCELLED',
  'DISQUALIFIED',
]);
export type RegistrationStatus = z.infer<typeof RegistrationStatus>;

export const ParticipantType = z.enum(['SOLO', 'TEAM']);
export type ParticipantType = z.infer<typeof ParticipantType>;

export const TournamentRegisterSchema = z.object({
  participant_type: ParticipantType.default('SOLO'),
  team_id: z.string().uuid().optional(),
  roster: z.array(z.object({
    user_id: z.string().uuid(),
    in_game_id: z.string().min(2).max(50),
    username: z.string().min(2).max(50).optional(),
    role: z.string().optional(),
  })).optional(),
  in_game_id: z.string().min(2).max(50).optional(),
}).refine(
  data => data.participant_type === 'SOLO' || !!data.team_id,
  { message: 'team_id is required for TEAM participant_type', path: ['team_id'] }
);

export const TournamentCheckInSchema = z.object({
  registration_id: z.string().uuid(),
});

export const TournamentDiscoveryQuerySchema = z.object({
  game_id: z.string().uuid().optional(),
  status: TournamentStatus.optional(),
  format: TournamentFormat.optional(),
  region: z.string().max(50).optional(),
  start_after: z.string().datetime().optional(),
  start_before: z.string().datetime().optional(),
  organiser_id: z.string().uuid().optional(),
  sort_by: z.enum(['start_time', 'created_at', 'title', 'max_participants']).default('start_time'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});


export const MatchResultSubmitSchema = z.object({
  matchId: z.string().uuid(),
  evidenceFileHash: z.string().regex(/^[a-f0-9]{64}$/, 'Must be a valid 64-character SHA-256 hash'),
  placements: z.array(z.object({
    teamOrPlayerId: z.string().uuid(),
    placement: z.number().int().min(1).max(100),
    kills: z.number().int().min(0).max(100),
  })).min(1),
});

export const LegacyDisputeCreateSchema = z.object({
  matchId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
  evidenceFileHash: z.string().regex(/^[a-f0-9]{64}$/, 'Must be a valid 64-character SHA-256 hash'),
});

export const RedeemCodeSchema = z.object({
  code: z.string().regex(/^VEXO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]$/, 'Invalid redeem code format or checksum'),
});

// ─── Phase 11: Game Catalog, Modes & Scoring Schemas ────────────────────────

export const GameCreateSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9_-]+$/, 'Slug must contain only lowercase letters, numbers, underscores, and hyphens'),
  name: z.string().min(2).max(100),
  publisher: z.string().max(100).optional(),
  icon_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
  status: z.enum(['ACTIVE', 'DEPRECATED', 'COMING_SOON']).default('ACTIVE'),
  max_team_size: z.number().int().min(1).max(100).default(4),
  min_team_size: z.number().int().min(1).max(100).default(1),
  platforms: z.array(z.string()).default(['ANDROID', 'IOS']),
  metadata: z.record(z.any()).default({}),
});

export const GameUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  publisher: z.string().max(100).optional(),
  icon_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
  status: z.enum(['ACTIVE', 'DEPRECATED', 'COMING_SOON']).optional(),
  max_team_size: z.number().int().min(1).max(100).optional(),
  min_team_size: z.number().int().min(1).max(100).optional(),
  platforms: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const GameModeCreateSchema = z.object({
  game_id: z.string().uuid().optional(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(2).max(100),
  format: z.enum(['BATTLE_ROYALE', 'SINGLE_ELIMINATION', 'ROUND_ROBIN', 'SWISS', 'LEAGUE']).default('BATTLE_ROYALE'),
  team_size: z.number().int().min(1).max(100).default(4),
  min_team_size: z.number().int().min(1).max(100).default(1),
  max_team_size: z.number().int().min(1).max(100).default(4),
  is_active: z.boolean().default(true),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.any()).default({}),
});

export const GameModeUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  format: z.enum(['BATTLE_ROYALE', 'SINGLE_ELIMINATION', 'ROUND_ROBIN', 'SWISS', 'LEAGUE']).optional(),
  team_size: z.number().int().min(1).max(100).optional(),
  min_team_size: z.number().int().min(1).max(100).optional(),
  max_team_size: z.number().int().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export const ScoringFormulaSchema = z.object({
  placement_points: z.record(z.number().int().min(0)).optional(),
  kill_points: z.number().int().min(0).default(1),
  assist_points: z.number().int().min(0).optional(),
  win_points: z.number().int().min(0).optional(),
  loss_points: z.number().int().optional(),
  round_points: z.number().int().min(0).optional(),
  integer_only: z.literal(true).default(true),
});

export const TieBreakerRuleSchema = z.object({
  order: z.number().int().min(1).max(10),
  rule: z.enum([
    'TOTAL_POINTS',
    'TOTAL_PLACEMENT_POINTS',
    'TOTAL_KILL_POINTS',
    'FIRST_PLACE_FINISHES',
    'FINAL_MATCH_PLACEMENT',
    'MATCHES_WON',
    'ROUND_DIFFERENTIAL',
    'SCORE_DIFFERENTIAL',
    'HEAD_TO_HEAD',
  ]),
  description: z.string().max(255).optional(),
});

export const EvidenceRequirementsSchema = z.object({
  screenshot_required: z.boolean().default(true),
  video_required: z.boolean().default(false),
  min_resolution: z.string().default('1280x720'),
  allowed_formats: z.array(z.string()).default(['image/png', 'image/jpeg']),
  required_visible_fields: z.array(z.string()).default([]),
});

export const ScoringSchemaCreateSchema = z.object({
  game_id: z.string().uuid(),
  mode_id: z.string().uuid().optional(),
  mode_slug: z.string().min(2).max(50),
  mode_name: z.string().min(2).max(100),
  version: z.string().min(3).max(50).regex(/^[a-z0-9_.-]+$/, 'Version must be alphanumeric with dots, hyphens, or underscores'),
  formula: ScoringFormulaSchema,
  tie_breakers: z.array(TieBreakerRuleSchema).default([]),
  evidence_requirements: EvidenceRequirementsSchema.optional().default({}),
  is_active: z.boolean().default(true),
});

export const ScoringSchemaNewVersionSchema = z.object({
  new_version: z.string().min(3).max(50).regex(/^[a-z0-9_.-]+$/, 'Version must be alphanumeric with dots, hyphens, or underscores'),
  formula: ScoringFormulaSchema,
  tie_breakers: z.array(TieBreakerRuleSchema).optional(),
  evidence_requirements: EvidenceRequirementsSchema.optional(),
  change_reason: z.string().min(5, 'Mandatory change reason required for audit trail').max(500),
});

export const RuleTemplateCreateSchema = z.object({
  game_id: z.string().uuid(),
  mode_id: z.string().uuid().optional(),
  name: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  rules_text: z.string().min(10).max(10000),
  evidence_requirements: EvidenceRequirementsSchema.default({}),
  tie_breaker_rules: z.array(TieBreakerRuleSchema).default([]),
  is_default: z.boolean().default(false),
});

export const RuleTemplateUpdateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(1000).optional(),
  rules_text: z.string().min(10).max(10000).optional(),
  evidence_requirements: EvidenceRequirementsSchema.optional(),
  tie_breaker_rules: z.array(TieBreakerRuleSchema).optional(),
  is_default: z.boolean().optional(),
});

export const ScoringSimulationInputSchema = z.object({
  formula: ScoringFormulaSchema.optional(),
  game_slug: z.enum(['bgmi', 'freefire', 'codm']).optional(),
  participants: z.array(z.object({
    id: z.string().default(() => Math.random().toString(36).substring(7)),
    name: z.string().min(1).max(100),
    placement: z.number().int().min(1).max(100).optional(),
    kills: z.number().int().min(0).max(100).default(0),
    assists: z.number().int().min(0).default(0),
    is_winner: z.boolean().optional(),
    rounds_won: z.number().int().min(0).optional(),
    rounds_lost: z.number().int().min(0).optional(),
    score: z.number().int().min(0).optional(),
    first_place_finishes: z.number().int().min(0).default(0),
    final_match_placement: z.number().int().min(1).optional(),
  })).min(1),
  tie_breakers: z.array(TieBreakerRuleSchema).optional(),
});

// ─── Phase 12: Player Profiles, In-Game IDs & Secure Uploads ────────────────

export const ProfileUpdateSchema = z.object({
  display_name: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  country: z.string().length(3).regex(/^[A-Z]{3}$/, 'ISO 3166-1 alpha-3 uppercase country code').optional(),
  state_region: z.string().max(100).optional(),
  profile_visibility: z.enum(['PUBLIC', 'PRIVATE', 'FRIENDS_ONLY']).optional(),
  show_stats: z.boolean().optional(),
  show_game_ids: z.boolean().optional(),
  favourite_game_ids: z.array(z.string().uuid()).max(10).optional(),
});

export const InGameIdLinkSchema = z.object({
  game_id: z.string().uuid(),
  in_game_uid: z.string().min(2).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'UID must contain valid alphanumeric characters, hyphens or underscores'),
  in_game_name: z.string().min(1).max(100).optional(),
  proof_upload_id: z.string().uuid().optional(),
});

export const SignedUploadRequestSchema = z.object({
  purpose: z.enum(['AVATAR', 'PROFILE_PROOF', 'MATCH_EVIDENCE', 'KYC_DOCUMENT', 'DISPUTE_EVIDENCE']),
  filename: z.string().min(3).max(255).regex(/^[a-zA-Z0-9_.-]+$/, 'Filename must be safe alphanumeric with standard extension'),
});

// ─── Phase 13: Teams, Rosters & Transfer Log ────────────────────────────────

export const TeamCreateSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-zA-Z0-9\s_-]+$/, 'Team name must be alphanumeric'),
  tag: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/, 'Tag must be uppercase alphanumeric'),
  game_id: z.string().uuid(),
  description: z.string().max(1000).optional(),
  region: z.string().max(50).optional(),
  logo_url: z.string().url().optional(),
  max_roster_size: z.number().int().min(2).max(50).default(10),
  min_roster_size: z.number().int().min(1).max(50).default(1),
  social_links: z.record(z.string().url()).optional(),
});

export const TeamUpdateSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-zA-Z0-9\s_-]+$/).optional(),
  tag: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/).optional(),
  description: z.string().max(1000).optional(),
  region: z.string().max(50).optional(),
  logo_url: z.string().url().optional(),
  max_roster_size: z.number().int().min(2).max(50).optional(),
  min_roster_size: z.number().int().min(1).max(50).optional(),
  social_links: z.record(z.string().url()).optional(),
  transfer_window_open: z.boolean().optional(),
});

export const TeamInviteSchema = z.object({
  invitee_id: z.string().uuid(),
  message: z.string().max(200).optional(),
  role_offered: z.enum(['PLAYER', 'SUBSTITUTE', 'MANAGER']).default('PLAYER'),
});

export const InviteResponseSchema = z.object({
  action: z.enum(['ACCEPTED', 'DECLINED']),
});

export const KickMemberSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().min(3).max(255).optional(),
});

export const RoleChangeSchema = z.object({
  new_role: z.enum(['CAPTAIN', 'MANAGER', 'PLAYER', 'SUBSTITUTE']),
});

export const OwnershipTransferSchema = z.object({
  new_owner_id: z.string().uuid(),
});

export const TeamBlockSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().max(255).optional(),
});

// ─── Phase 14: Seasons & Search Schemas ─────────────────────────────────────

export const SeasonCreateSchema = z.object({
  game_id: z.string().uuid(),
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric with hyphens or underscores'),
  season_number: z.number().int().min(1).default(1),
  description: z.string().max(2000).optional(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  banner_url: z.string().url().optional(),
  rules_config: z.record(z.any()).default({}),
}).refine(
  (data) => new Date(data.end_at) > new Date(data.start_at),
  { message: 'end_at must be strictly after start_at', path: ['end_at'] }
);

export const SeasonUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
  banner_url: z.string().url().optional(),
  rules_config: z.record(z.any()).optional(),
  status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
}).refine(
  (data) => {
    if (data.start_at && data.end_at) {
      return new Date(data.end_at) > new Date(data.start_at);
    }
    return true;
  },
  { message: 'end_at must be strictly after start_at', path: ['end_at'] }
);

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(['ALL', 'GAMES', 'TEAMS', 'PLAYERS', 'TOURNAMENTS', 'SEASONS']).default('ALL'),
  game_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sort: z.enum(['RELEVANCE', 'NEWEST', 'NAME']).default('RELEVANCE'),
});

// ─── Phase 17: Bracket & Match Engine Schemas ────────────────────────────────

export const MatchStatus = z.enum([
  'SCHEDULED',
  'LOBBY_READY',
  'LIVE',
  'RESULT_SUBMITTED',
  'CONFIRMED',
  'DISPUTED',
  'FINAL',
  'CANCELLED',
]);
export type MatchStatus = z.infer<typeof MatchStatus>;

export const BracketType = z.enum([
  'KNOCKOUT',
  'DOUBLE_ELIMINATION',
  'ROUND_ROBIN',
  'LEAGUE',
  'BATTLE_ROYALE_LOBBY',
  'CUSTOM',
]);
export type BracketType = z.infer<typeof BracketType>;

export const SeedingMethod = z.enum(['STANDARD', 'RANDOM', 'MANUAL']);
export type SeedingMethod = z.infer<typeof SeedingMethod>;

export const SeedEntrySchema = z.object({
  registration_id: z.string().uuid(),
  seed: z.number().int().min(1),
});

export const BracketGenerateSchema = z.object({
  bracket_type: BracketType.default('KNOCKOUT'),
  seeding_method: SeedingMethod.default('STANDARD'),
  seeds: z.array(SeedEntrySchema).optional(),
  lobby_size: z.number().int().min(2).max(100).default(16),
  matches_per_lobby: z.number().int().min(1).max(20).default(1),
  third_place_match: z.boolean().default(false),
});

export const MatchRoomUpdateSchema = z.object({
  room_id: z.string().min(1).max(100),
  room_password: z.string().max(100).optional().nullable(),
  room_release_time: z.string().datetime(),
});

export const MatchTransitionSchema = z.object({
  new_status: MatchStatus,
  reason: z.string().max(500).optional(),
});

export const MatchParticipantScoreSchema = z.object({
  registration_id: z.string().uuid(),
  placement: z.number().int().min(1).max(100).optional(),
  kills: z.number().int().min(0).max(100).default(0),
  deaths: z.number().int().min(0).max(100).default(0),
  assists: z.number().int().min(0).max(100).default(0),
  raw_score: z.record(z.any()).optional().default({}),
  calculated_points: z.number().min(0).optional(),
  is_winner: z.boolean().optional(),
});

export const MatchResultSubmitDetailedSchema = z.object({
  participants: z.array(MatchParticipantScoreSchema).min(1),
  evidence_file_url: z.string().url().optional(),
  evidence_sha256: z.string().regex(/^[a-f0-9]{64}$/, 'Must be a 64-character SHA-256 hash').optional(),
  notes: z.string().max(1000).optional(),
});

// ─── Phase 18: Organiser Dashboard, Incidents & Admin Review Schemas ────────

export const IncidentType = z.enum([
  'LATE_START',
  'DISCONNECT',
  'RULE_CLARIFICATION',
  'SUSPECTED_CHEATING',
  'LOBBY_ISSUE',
  'NO_SHOW',
  'ROSTER_CONFLICT',
  'OTHER',
]);
export type IncidentType = z.infer<typeof IncidentType>;

export const IncidentSeverity = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type IncidentSeverity = z.infer<typeof IncidentSeverity>;

export const IncidentStatus = z.enum(['LOGGED', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED']);
export type IncidentStatus = z.infer<typeof IncidentStatus>;

export const ChecklistItemKey = z.enum([
  'LOBBY_CREATED',
  'ROOM_DETAILS_RELEASED',
  'CHECK_IN_VERIFIED',
  'EVIDENCE_COLLECTED',
  'RESULT_SUBMITTED',
]);
export type ChecklistItemKey = z.infer<typeof ChecklistItemKey>;

export const TournamentAnnouncementCreateSchema = z.object({
  title: z.string().min(2).max(255),
  content: z.string().min(2).max(5000),
  is_pinned: z.boolean().default(false),
});
export type TournamentAnnouncementCreateInput = z.infer<typeof TournamentAnnouncementCreateSchema>;

export const TournamentAnnouncementUpdateSchema = z.object({
  title: z.string().min(2).max(255).optional(),
  content: z.string().min(2).max(5000).optional(),
  is_pinned: z.boolean().optional(),
  moderation_status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export const TournamentIncidentCreateSchema = z.object({
  match_id: z.string().uuid().optional().nullable(),
  incident_type: IncidentType,
  severity: IncidentSeverity.default('LOW'),
  description: z.string().min(5).max(3000),
});
export type TournamentIncidentCreateInput = z.infer<typeof TournamentIncidentCreateSchema>;

export const TournamentIncidentResolveSchema = z.object({
  resolution: z.string().min(5).max(3000),
  status: z.enum(['RESOLVED', 'CLOSED']).default('RESOLVED'),
});

export const MatchdayChecklistUpdateSchema = z.object({
  item_key: ChecklistItemKey,
  is_completed: z.boolean(),
  notes: z.string().max(1000).optional().nullable(),
});
export type MatchdayChecklistUpdateInput = z.infer<typeof MatchdayChecklistUpdateSchema>;

export const TournamentAdminReviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().min(5).max(1000),
});
export type TournamentAdminReviewInput = z.infer<typeof TournamentAdminReviewSchema>;

// ─── Phase 19: Result Submission, Evidence & Dispute Stubs Schemas ─────────

export const ResultConfirmationStatus = z.enum([
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'DISPUTED',
  'ADJUDICATED',
  'REJECTED',
]);
export type ResultConfirmationStatus = z.infer<typeof ResultConfirmationStatus>;

export const CombatantScoreSchema = z.object({
  registration_id: z.string().uuid(),
  placement: z.number().int().min(1).max(256).optional(),
  kills: z.number().int().min(0).max(200).default(0),
  deaths: z.number().int().min(0).max(200).default(0),
  assists: z.number().int().min(0).max(200).default(0),
  calculated_points: z.number().int().min(0).optional(),
  is_winner: z.boolean().optional(),
  raw_score: z.record(z.any()).default({}),
});
export type CombatantScore = z.infer<typeof CombatantScoreSchema>;

export const MatchResultSubmissionSchema = z.object({
  match_id: z.string().uuid(),
  participants: z.array(CombatantScoreSchema).min(1),
  evidence_file_url: z.string().url().optional(),
  evidence_sha256: z.string().regex(/^[a-f0-9]{64}$/, 'Must be a 64-character SHA-256 hash').optional(),
  notes: z.string().max(1000).optional(),
  checklist_completed: z.boolean().default(true),
});
export type MatchResultSubmissionInput = z.infer<typeof MatchResultSubmissionSchema>;

export const MatchResultConfirmationSchema = z.object({
  submission_id: z.string().uuid(),
  action: z.enum(['CONFIRM', 'CONTEST']),
  contest_reason: z.string().min(5).max(1000).optional(),
  counter_participants: z.array(CombatantScoreSchema).optional(),
  counter_evidence_sha256: z.string().regex(/^[a-f0-9]{64}$/, 'Must be a 64-character SHA-256 hash').optional(),
}).refine(
  data => data.action !== 'CONTEST' || (Boolean(data.contest_reason) && data.contest_reason!.trim().length >= 5),
  { message: 'contest_reason is required (minimum 5 characters) when action is CONTEST', path: ['contest_reason'] }
);
export type MatchResultConfirmationInput = z.infer<typeof MatchResultConfirmationSchema>;

export const MatchResultAdjudicationSchema = z.object({
  final_scores: z.array(CombatantScoreSchema).min(1),
  adjudication_reason: z.string().min(5).max(1000),
  winner_registration_id: z.string().uuid().optional(),
});
export type MatchResultAdjudicationInput = z.infer<typeof MatchResultAdjudicationSchema>;

export const ResultReplayChecklistSchema = z.object({
  final_scoreboard_visible: z.boolean(),
  kills_breakdown_visible: z.boolean(),
  room_id_visible: z.boolean(),
  player_uids_matched: z.boolean(),
});
export type ResultReplayChecklist = z.infer<typeof ResultReplayChecklistSchema>;

// ─── Phase 20: Scoring Engine, Leaderboards & Snapshots Schemas ────────────

export const LeaderboardTimeframe = z.enum(['ALL', 'SEASON', 'MONTHLY', 'WEEKLY']);
export type LeaderboardTimeframe = z.infer<typeof LeaderboardTimeframe>;

export const LeaderboardSnapshotType = z.enum(['DAILY', 'WEEKLY', 'SEASON_END', 'POST_MATCH']);
export type LeaderboardSnapshotType = z.infer<typeof LeaderboardSnapshotType>;

export const LeaderboardQuerySchema = z.object({
  game: z.string().min(2).max(50).optional(),
  game_id: z.string().uuid().optional(),
  season_id: z.string().uuid().optional(),
  timeframe: LeaderboardTimeframe.default('SEASON'),
  participant_type: z.enum(['USER', 'TEAM']).default('USER'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type LeaderboardQueryInput = z.infer<typeof LeaderboardQuerySchema>;

export const ProcessMatchResultSchema = z.object({
  match_id: z.string().uuid(),
  season_id: z.string().uuid().optional(),
  force_recalculate: z.boolean().default(false),
});
export type ProcessMatchResultInput = z.infer<typeof ProcessMatchResultSchema>;

export const LeaderboardSnapshotCreateSchema = z.object({
  game_id: z.string().uuid(),
  season_id: z.string().uuid().optional().nullable(),
  snapshot_type: LeaderboardSnapshotType,
  notes: z.string().max(500).optional(),
});
export type LeaderboardSnapshotCreateInput = z.infer<typeof LeaderboardSnapshotCreateSchema>;

// ─── Phase 21: Player Dashboard & Result Verification Schemas ───────────────

export const PlayerDashboardQuerySchema = z.object({
  username: z.string().min(3).max(30).optional(),
  game_id: z.string().uuid().optional(),
});
export type PlayerDashboardQueryInput = z.infer<typeof PlayerDashboardQuerySchema>;

export const ResultVerificationQuerySchema = z.object({
  match_id: z.string().uuid(),
});
export type ResultVerificationQueryInput = z.infer<typeof ResultVerificationQuerySchema>;

// ─── Phase 22: Organiser Verification & Tiers Schemas ───────────────────────

export const OrganiserTierEnum = z.enum(['STARTER', 'VERIFIED', 'PARTNER']);
export type OrganiserTier = z.infer<typeof OrganiserTierEnum>;

export const OrganiserKYCStatusEnum = z.enum([
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'RESUBMISSION_REQUESTED',
]);
export type OrganiserKYCStatus = z.infer<typeof OrganiserKYCStatusEnum>;

export const OrganiserIDDocumentTypeEnum = z.enum([
  'PASSPORT',
  'NATIONAL_ID',
  'DRIVING_LICENSE',
  'BUSINESS_REG',
]);
export type OrganiserIDDocumentType = z.infer<typeof OrganiserIDDocumentTypeEnum>;

export const OrganiserApplicationCreateSchema = z.object({
  business_name: z.string().min(2).max(200),
  contact_email: z.string().email(),
  contact_phone: z.string().min(7).max(25),
  country: z.string().min(2).max(3),
  id_document_type: OrganiserIDDocumentTypeEnum,
  id_document_number: z.string().min(3).max(50),
  id_document_front_s3_key: z.string().min(5),
  id_document_front_hash: z.string().length(64).regex(/^[a-f0-9]{64}$/i, 'Must be valid 64-character SHA-256 hex string'),
  id_document_back_s3_key: z.string().min(5).optional(),
  id_document_back_hash: z.string().length(64).regex(/^[a-f0-9]{64}$/i, 'Must be valid 64-character SHA-256 hex string').optional(),
  tax_id: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  social_links: z.record(z.string()).default({}),
});
export type OrganiserApplicationCreateInput = z.infer<typeof OrganiserApplicationCreateSchema>;

export const OrganiserReviewDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_RESUBMISSION']),
  rejection_reason: z.string().max(500).optional(),
  reviewer_notes: z.string().max(1000).optional(),
  target_tier: OrganiserTierEnum.default('VERIFIED'),
}).refine(
  (data) => (data.decision !== 'REJECT' || !!data.rejection_reason),
  { message: 'Rejection reason is required when rejecting an application', path: ['rejection_reason'] }
);
export type OrganiserReviewDecisionInput = z.infer<typeof OrganiserReviewDecisionSchema>;

export const OrganiserTierUpdateSchema = z.object({
  tier: OrganiserTierEnum,
  reason: z.string().min(5).max(500),
});
export type OrganiserTierUpdateInput = z.infer<typeof OrganiserTierUpdateSchema>;

export const OrganiserPublishingHoldSchema = z.object({
  action: z.enum(['HOLD', 'RELEASE']),
  reason: z.string().min(5).max(500),
});
export type OrganiserPublishingHoldInput = z.infer<typeof OrganiserPublishingHoldSchema>;

export const KYCAccessQuerySchema = z.object({
  reason: z.string().min(5).max(500),
});
export type KYCAccessQueryInput = z.infer<typeof KYCAccessQuerySchema>;

// ─── Phase 23: Reports, Disputes, Moderation & Sanctions Schemas ───────────

export const ReportTargetTypeEnum = z.enum([
  'PLAYER',
  'TEAM',
  'ORGANISER',
  'MATCH_RESULT',
  'CHAT_MESSAGE',
]);
export type ReportTargetType = z.infer<typeof ReportTargetTypeEnum>;

export const ReportCategoryEnum = z.enum([
  'CHEATING',
  'HARASSMENT',
  'IMPERSONATION',
  'MATCH_FIXING',
  'RESULT_FRAUD',
  'INAPPROPRIATE_CONTENT',
  'OTHER',
]);
export type ReportCategory = z.infer<typeof ReportCategoryEnum>;

export const ReportCreateSchema = z.object({
  target_type: ReportTargetTypeEnum.default('PLAYER'),
  target_id: z.string().uuid(),
  category: ReportCategoryEnum,
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  policy_clause: z.string().max(100).optional(),
  evidence_hashes: z.array(z.string().length(64)).max(10).optional().default([]),
  evidence_urls: z.array(z.string().url()).max(10).optional().default([]),
});
export type ReportCreateInput = z.infer<typeof ReportCreateSchema>;

export const DisputeReasonEnum = z.enum([
  'WRONG_SCORE',
  'CHEATING',
  'NO_SHOW',
  'TECHNICAL_ISSUE',
  'UNAUTHORIZED_SUBSTITUTE',
  'DISCONNECT_EXPLOIT',
  'OTHER',
]);
export type DisputeReason = z.infer<typeof DisputeReasonEnum>;

export const DisputeCreateSchema = z.object({
  match_id: z.string().uuid(),
  reason: DisputeReasonEnum,
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  evidence_hashes: z.array(z.string().length(64)).max(10).optional().default([]),
  evidence_urls: z.array(z.string().url()).max(10).optional().default([]),
});
export type DisputeCreateInput = z.infer<typeof DisputeCreateSchema>;

export const DisputeRulingSchema = z.object({
  ruling_type: z.enum(['UPHELD', 'OVERTURNED', 'SPLIT', 'DISMISSED']),
  ruling_reason: z.string().min(10, 'Ruling reason must be at least 10 characters').max(2000),
  policy_clause: z.string().min(3, 'Policy clause must be cited').max(100),
  corrective_action: z.enum(['CORRECT_SCORE', 'REPLAY_MATCH', 'FORFEIT_VIOLATOR', 'NONE']).default('NONE'),
  sanction: z.object({
    user_id: z.string().uuid(),
    sanction_type: z.enum(['WARNING', 'RESTRICTION', 'SUSPENSION', 'BAN']),
    reason: z.string().min(10).max(1000),
    duration_days: z.number().int().min(1).max(365).optional(),
  }).optional(),
});
export type DisputeRulingInput = z.infer<typeof DisputeRulingSchema>;

export const DisputeAppealSchema = z.object({
  appeal_text: z.string().min(10, 'Appeal statement must be at least 10 characters').max(2000),
  evidence_hashes: z.array(z.string().length(64)).max(10).optional().default([]),
});
export type DisputeAppealInput = z.infer<typeof DisputeAppealSchema>;

export const AppealDecisionSchema = z.object({
  decision: z.enum(['APPEAL_UPHELD', 'APPEAL_REJECTED']),
  reason: z.string().min(10, 'Appeal decision justification must be at least 10 characters').max(2000),
  policy_clause: z.string().min(3, 'Policy clause must be cited').max(100),
});
export type AppealDecisionInput = z.infer<typeof AppealDecisionSchema>;

export const SanctionTypeEnum = z.enum(['WARNING', 'RESTRICTION', 'SUSPENSION', 'BAN']);
export type SanctionType = z.infer<typeof SanctionTypeEnum>;

export const SanctionCreateSchema = z.object({
  user_id: z.string().uuid(),
  sanction_type: SanctionTypeEnum,
  reason: z.string().min(10, 'Sanction reason must be at least 10 characters').max(2000),
  policy_clause: z.string().min(3, 'Policy clause must be cited').max(100),
  duration_days: z.number().int().min(1).max(365).optional(),
});
export type SanctionCreateInput = z.infer<typeof SanctionCreateSchema>;

export const RiskSignalCreateSchema = z.object({
  target_type: z.enum(['USER', 'MATCH', 'TEAM', 'ORGANISER']),
  target_id: z.string().uuid(),
  signal_type: z.string().min(3).max(60),
  confidence_score: z.number().min(0).max(1).default(0.5),
  risk_weight: z.number().int().min(1).max(100).default(10),
  payload: z.record(z.any()).default({}),
});
export type RiskSignalCreateInput = z.infer<typeof RiskSignalCreateSchema>;

// ─── Phase 24: Ratings, Reputation & Security Centre v1 Schemas ───────────

export const OrganiserRatingCreateSchema = z.object({
  communication_score: z.number().int().min(1).max(5),
  schedule_score: z.number().int().min(1).max(5),
  result_score: z.number().int().min(1).max(5),
  review_text: z.string().max(1000).optional().nullable(),
});
export type OrganiserRatingCreateInput = z.infer<typeof OrganiserRatingCreateSchema>;

export const OrganiserRatingAppealSchema = z.object({
  grounds: z.enum([
    'ABUSIVE_OR_HARASSMENT',
    'DEMONSTRABLY_FALSE',
    'EXTORTION_OR_SPAM',
    'PERSONAL_INFO_DOXXING',
    'OTHER',
  ]),
  explanation: z.string().min(10, 'Explanation must be at least 10 characters').max(2000),
  evidence_hashes: z.array(z.string().length(64)).max(10).optional().default([]),
});
export type OrganiserRatingAppealInput = z.infer<typeof OrganiserRatingAppealSchema>;

export const OrganiserRatingAppealAdjudicateSchema = z.object({
  decision: z.enum(['UPHELD', 'REJECTED']),
  reason: z.string().min(10, 'Decision justification must be at least 10 characters').max(2000),
});
export type OrganiserRatingAppealAdjudicateInput = z.infer<typeof OrganiserRatingAppealAdjudicateSchema>;

export const OrganiserParticipantReportSchema = z.object({
  participant_id: z.string().uuid(),
  category: z.enum([
    'NO_SHOW',
    'TOXIC_BEHAVIOR',
    'LOBBY_DISRUPTION',
    'SUSPECTED_CHEATING',
    'UNAUTHORIZED_RINGER',
    'OTHER',
  ]),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(2000),
  evidence_hashes: z.array(z.string().length(64)).max(10).optional().default([]),
});
export type OrganiserParticipantReportInput = z.infer<typeof OrganiserParticipantReportSchema>;

export const BlockedIpCreateSchema = z.object({
  ip_address: z.string().ip({ message: 'Must be a valid IPv4 or IPv6 address' }),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
  threat_level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  duration_hours: z.number().int().min(1).max(8760).optional(), // Up to 1 year
});
export type BlockedIpCreateInput = z.infer<typeof BlockedIpCreateSchema>;

export const BreakGlassRequestSchema = z.object({
  reason: z.string().min(10, 'Emergency reason must be at least 10 characters').max(1000),
  elevated_permissions: z.array(z.string()).min(1, 'Must request at least one permission'),
  duration_hours: z.number().int().min(1).max(24).default(1),
});
export type BreakGlassRequestInput = z.infer<typeof BreakGlassRequestSchema>;

export const BreakGlassDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'DENY']),
  justification: z.string().min(10, 'Justification must be at least 10 characters').max(1000),
});
export type BreakGlassDecisionInput = z.infer<typeof BreakGlassDecisionSchema>;

// ─── Phase 25: Double-Entry Ledger & Wallet Service Schemas ───────────────

export const WalletHoldSchema = z.object({
  tournament_id: z.string().uuid(),
  amount: z.number().positive('Hold amount must be positive'),
});
export type WalletHoldInput = z.infer<typeof WalletHoldSchema>;

export const WalletReleaseSchema = z.object({
  tournament_id: z.string().uuid(),
  amount: z.number().positive('Release amount must be positive'),
  reason: z.string().min(5).max(500),
});
export type WalletReleaseInput = z.infer<typeof WalletReleaseSchema>;

export const WalletRewardSchema = z.object({
  tournament_id: z.string().uuid(),
  recipient_user_id: z.string().uuid(),
  amount: z.number().positive('Prize amount must be positive'),
  description: z.string().min(5).max(500),
});
export type WalletRewardInput = z.infer<typeof WalletRewardSchema>;

export const WalletAdjustmentRequestSchema = z.object({
  wallet_id: z.string().uuid(),
  amount: z.number().positive('Adjustment amount must be positive'),
  direction: z.enum(['CREDIT', 'DEBIT']),
  reason: z.string().min(10, 'Adjustment reason must be at least 10 characters').max(1000),
});
export type WalletAdjustmentRequestInput = z.infer<typeof WalletAdjustmentRequestSchema>;

export const WalletAdjustmentAdjudicateSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  justification: z.string().min(10, 'Decision justification must be at least 10 characters').max(1000),
});
export type WalletAdjustmentAdjudicateInput = z.infer<typeof WalletAdjustmentAdjudicateSchema>;

// ─── Phase 26: Redeem Codes Schemas ─────────────────────────────────────────

export const CreateRedeemBatchSchema = z.object({
  batch_name: z.string().min(3, 'Batch name must be at least 3 characters').max(100),
  denomination: z.number().positive('Denomination must be positive'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(10000, 'Batch size cannot exceed 10,000'),
  max_uses_per_code: z.number().int().min(1).default(1),
  expires_at: z.string().datetime(),
}).refine(
  (data) => new Date(data.expires_at) > new Date(),
  { message: 'Expiration date must be in the future', path: ['expires_at'] }
);
export type CreateRedeemBatchInput = z.infer<typeof CreateRedeemBatchSchema>;

export const ApproveRedeemBatchSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  rejection_reason: z.string().min(5, 'Rejection reason must be at least 5 characters').max(500).optional(),
}).refine(
  (data) => data.decision !== 'REJECT' || (data.rejection_reason && data.rejection_reason.length >= 5),
  { message: 'Rejection reason is required when rejecting a batch', path: ['rejection_reason'] }
);
export type ApproveRedeemBatchInput = z.infer<typeof ApproveRedeemBatchSchema>;

export const RedeemCodeInputSchema = z.object({
  code: z.string().min(8, 'Code too short').max(32, 'Code too long'),
});
export type RedeemCodeInput = z.infer<typeof RedeemCodeInputSchema>;

export const ExportRedeemBatchSchema = z.object({
  watermark: z.string().max(100).optional(),
});
export type ExportRedeemBatchInput = z.infer<typeof ExportRedeemBatchSchema>;

export const BlockRedeemCodeSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
});
export type BlockRedeemCodeInput = z.infer<typeof BlockRedeemCodeSchema>;

// ─── Phase 27: Payments, Prize Escrow & Paid Tournament Flow Schemas ─────────

export const PaymentProviderEnum = z.enum(['RAZORPAY', 'CASHFREE']);
export type PaymentProvider = z.infer<typeof PaymentProviderEnum>;

export const PaymentPurposeEnum = z.enum(['DEPOSIT', 'TOURNAMENT_ENTRY', 'PRIZE_ESCROW']);
export type PaymentPurpose = z.infer<typeof PaymentPurposeEnum>;

export const CreatePaymentOrderSchema = z.object({
  provider: PaymentProviderEnum.default('RAZORPAY'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  purpose: PaymentPurposeEnum.default('DEPOSIT'),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
});
export type CreatePaymentOrderInput = z.infer<typeof CreatePaymentOrderSchema>;

export const ProcessRefundSchema = z.object({
  amount: z.number().positive('Refund amount must be positive').optional(),
  reason: z.string().min(5, 'Refund reason must be at least 5 characters').max(500),
});
export type ProcessRefundInput = z.infer<typeof ProcessRefundSchema>;

export const LockPrizeEscrowSchema = z.object({
  tournamentId: z.string().uuid(),
  escrowAmount: z.number().positive('Escrow amount must be positive'),
});
export type LockPrizeEscrowInput = z.infer<typeof LockPrizeEscrowSchema>;

export const SettlePrizeEscrowSchema = z.object({
  notes: z.string().max(500).optional(),
});
export type SettlePrizeEscrowInput = z.infer<typeof SettlePrizeEscrowSchema>;

export const ProcessEntryPaymentSchema = z.object({
  tournamentId: z.string().uuid(),
  registrationId: z.string().uuid(),
  entryFee: z.number().positive('Entry fee must be positive'),
});
export type ProcessEntryPaymentInput = z.infer<typeof ProcessEntryPaymentSchema>;

export const RefundEntryFeeSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
});
export type RefundEntryFeeInput = z.infer<typeof RefundEntryFeeSchema>;

export const RegionalConfigUpdateSchema = z.object({
  regionCode: z.string().min(2).max(20),
  countryCode: z.string().min(2).max(10).default('IN'),
  killSwitchOn: z.boolean().optional(),
  killSwitchReason: z.string().max(500).optional(),
  maxEntryFee: z.number().min(0).optional(),
  maxPrizePool: z.number().min(0).optional(),
  allowedProviders: z.array(PaymentProviderEnum).optional(),
});
export type RegionalConfigUpdateInput = z.infer<typeof RegionalConfigUpdateSchema>;

// ─── Phase 28: Payouts, Reconciliation & Financial Reports Schemas ─────────

export const DestinationTypeEnum = z.enum(['UPI', 'BANK_ACCOUNT']);
export type DestinationType = z.infer<typeof DestinationTypeEnum>;

export const AddPayoutDestinationSchema = z.object({
  destinationType: DestinationTypeEnum,
  upiId: z.string().includes('@', { message: 'UPI ID must contain @' }).optional(),
  bankAccountNumber: z.string().min(8, 'Bank account number must be at least 8 digits').optional(),
  bankIfsc: z.string().length(11, 'IFSC code must be exactly 11 characters').optional(),
  accountHolderName: z.string().min(2, 'Account holder name must be at least 2 characters').max(100),
}).refine(
  (data) => {
    if (data.destinationType === 'UPI') return Boolean(data.upiId);
    if (data.destinationType === 'BANK_ACCOUNT') return Boolean(data.bankAccountNumber && data.bankIfsc);
    return false;
  },
  { message: 'Destination details must match selected type (UPI ID or Bank Account + IFSC)', path: ['destinationType'] }
);
export type AddPayoutDestinationInput = z.infer<typeof AddPayoutDestinationSchema>;

export const RequestPayoutSchema = z.object({
  destinationId: z.string().uuid(),
  amount: z.number().positive('Payout amount must be greater than 0'),
});
export type RequestPayoutInput = z.infer<typeof RequestPayoutSchema>;

export const ApprovePayoutSchema = z.object({
  notes: z.string().max(500).optional(),
});
export type ApprovePayoutInput = z.infer<typeof ApprovePayoutSchema>;

export const SecondaryApprovePayoutSchema = z.object({
  stepUpAuthVerified: z.boolean().refine((val) => val === true, {
    message: 'Step-up authentication must be verified for high-value payout approval',
  }),
  notes: z.string().max(500).optional(),
});
export type SecondaryApprovePayoutInput = z.infer<typeof SecondaryApprovePayoutSchema>;

export const RejectPayoutSchema = z.object({
  reason: z.string().min(5, 'Rejection reason must be at least 5 characters').max(500),
});
export type RejectPayoutInput = z.infer<typeof RejectPayoutSchema>;

export const MarkPayoutPaidSchema = z.object({
  bankUtr: z.string().min(6, 'Bank UTR must be at least 6 characters').max(50),
  provider: z.enum(['RAZORPAYX', 'CASHFREE', 'BANK_NEFT_IMPS', 'MANUAL_WIRE']).default('BANK_NEFT_IMPS'),
  providerPayoutId: z.string().max(100).optional(),
});
export type MarkPayoutPaidInput = z.infer<typeof MarkPayoutPaidSchema>;

export const RunReconciliationSchema = z.object({
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD').optional(),
});
export type RunReconciliationInput = z.infer<typeof RunReconciliationSchema>;

export const ResolveDiscrepancySchema = z.object({
  resolutionNotes: z.string().min(10, 'Resolution notes must be at least 10 characters').max(1000),
});
export type ResolveDiscrepancyInput = z.infer<typeof ResolveDiscrepancySchema>;

export const ExportFinancialReportSchema = z.object({
  reportType: z.enum(['DAILY_RECONCILIATION', 'MONTHLY_SUMMARY', 'TAX_GST_REPORT', 'ESCROW_LIABILITY', 'AUDIT_LEDGER']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  customWatermark: z.string().max(100).optional(),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be at or after start date', path: ['endDate'] }
);
export type ExportFinancialReportInput = z.infer<typeof ExportFinancialReportSchema>;

// ─── Phase 29: Real-Time Gateway & WebSocket Schemas ───────────────────────

export const RealtimeChannelAuthorizeSchema = z.object({
  channel: z.string().min(3, 'Channel must be at least 3 characters').max(100),
});
export type RealtimeChannelAuthorizeInput = z.infer<typeof RealtimeChannelAuthorizeSchema>;

export const RealtimeReplayRequestSchema = z.object({
  channel: z.string().min(3).max(100),
  lastSequence: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(500).default(100),
});
export type RealtimeReplayRequestInput = z.infer<typeof RealtimeReplayRequestSchema>;

export const RealtimeBroadcastSchema = z.object({
  channel: z.string().min(3).max(100),
  eventType: z.string().min(3).max(100),
  payload: z.record(z.any()).default({}),
});
export type RealtimeBroadcastInput = z.infer<typeof RealtimeBroadcastSchema>;

// ─── Phase 30: Push Notifications, Inbox & Announcements Schemas ────────────

export const NotificationCategory = z.enum([
  'SECURITY', 'TOURNAMENT', 'MATCH', 'DISPUTE',
  'WALLET', 'ANNOUNCEMENT', 'SOCIAL', 'SYSTEM',
]);
export type NotificationCategory = z.infer<typeof NotificationCategory>;

export const DeliveryStatus = z.enum([
  'PENDING', 'DISPATCHED', 'DELIVERED', 'FAILED', 'DEAD_LETTER',
]);
export type DeliveryStatus = z.infer<typeof DeliveryStatus>;

export const AnnouncementChannel = z.enum(['PUBLIC', 'TOURNAMENT', 'ORGANISER']);
export type AnnouncementChannel = z.infer<typeof AnnouncementChannel>;

export const AnnouncementModerationStatus = z.enum(['PENDING', 'APPROVED', 'FLAGGED', 'REJECTED']);
export type AnnouncementModerationStatus = z.infer<typeof AnnouncementModerationStatus>;

export const BannerSeverity = z.enum(['INFO', 'WARNING', 'CRITICAL', 'MAINTENANCE']);
export type BannerSeverity = z.infer<typeof BannerSeverity>;

/** User notification preferences update schema */
export const NotificationPreferencesUpdateSchema = z.object({
  push_enabled: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').nullable().optional(),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').nullable().optional(),
  quiet_hours_tz: z.string().max(50).optional(),
}).refine(
  (data) => {
    // If quiet hours start is set, end must also be set (and vice versa)
    if ((data.quiet_hours_start && !data.quiet_hours_end) ||
        (!data.quiet_hours_start && data.quiet_hours_end)) {
      return false;
    }
    return true;
  },
  { message: 'Both quiet_hours_start and quiet_hours_end must be set together', path: ['quiet_hours_end'] }
);
export type NotificationPreferencesUpdateInput = z.infer<typeof NotificationPreferencesUpdateSchema>;

/** Admin send notification schema */
export const AdminSendNotificationSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  category: NotificationCategory.default('SYSTEM'),
  title: z.string().min(1, 'Title is required').max(500),
  body: z.string().min(1, 'Body is required').max(5000),
  deepLink: z.string().max(1000).optional(),
  deepLinkWeb: z.string().max(1000).optional(),
  metadata: z.record(z.any()).default({}),
});
export type AdminSendNotificationInput = z.infer<typeof AdminSendNotificationSchema>;

/** Create announcement schema */
export const CreateAnnouncementSchema = z.object({
  channel: AnnouncementChannel.default('PUBLIC'),
  targetTournamentId: z.string().uuid().nullable().optional(),
  title: z.string().min(3, 'Title must be at least 3 characters').max(500),
  body: z.string().min(10, 'Body must be at least 10 characters').max(10000),
  richContent: z.record(z.any()).default({}),
  isPinned: z.boolean().default(false),
  expiresAt: z.string().datetime().nullable().optional(),
}).refine(
  (data) => {
    if (data.channel === 'TOURNAMENT' && !data.targetTournamentId) {
      return false;
    }
    return true;
  },
  { message: 'Tournament channel announcements require a targetTournamentId', path: ['targetTournamentId'] }
);
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;

/** Moderate announcement schema */
export const ModerateAnnouncementSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'FLAG']),
  reason: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => {
    if (data.action === 'REJECT' && (!data.reason || data.reason.length < 5)) {
      return false;
    }
    return true;
  },
  { message: 'Rejection reason must be at least 5 characters', path: ['reason'] }
);
export type ModerateAnnouncementInput = z.infer<typeof ModerateAnnouncementSchema>;

/** System banner create/update schema */
export const SystemBannerSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(300),
  message: z.string().min(5, 'Message must be at least 5 characters').max(2000),
  severity: BannerSeverity.default('INFO'),
  isDismissible: z.boolean().default(true),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  targetPlatforms: z.array(z.enum(['WEB', 'MOBILE', 'ADMIN'])).default(['WEB', 'MOBILE', 'ADMIN']),
});
export type SystemBannerInput = z.infer<typeof SystemBannerSchema>;

// ─── Phase 31: Analytics & Dashboards Schemas ───────────────────────────────

export const AnalyticsMetricCategory = z.enum(['PLATFORM', 'PLAYER', 'ORGANISER', 'GAME']);
export type AnalyticsMetricCategory = z.infer<typeof AnalyticsMetricCategory>;

export const AnalyticsExportType = z.enum(['PLAYER_STATS', 'ORGANISER_STATS', 'PLATFORM_DAILY', 'GAME_POPULARITY']);
export type AnalyticsExportType = z.infer<typeof AnalyticsExportType>;

export const AnalyticsExportFormat = z.enum(['CSV', 'PDF', 'JSON']);
export type AnalyticsExportFormat = z.infer<typeof AnalyticsExportFormat>;

export const MaterialisedViewName = z.enum([
  'mv_player_stats', 'mv_organiser_stats', 'mv_platform_daily_stats', 'mv_game_popularity',
]);
export type MaterialisedViewName = z.infer<typeof MaterialisedViewName>;

/** Analytics export request schema */
export const AnalyticsExportRequestSchema = z.object({
  reportName: z.string().min(3, 'Report name must be at least 3 characters').max(200),
  exportType: AnalyticsExportType,
  format: AnalyticsExportFormat.default('CSV'),
  filters: z.record(z.any()).default({}),
});
export type AnalyticsExportRequestInput = z.infer<typeof AnalyticsExportRequestSchema>;

/** Analytics date range query schema */
export const AnalyticsDateRangeSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export type AnalyticsDateRangeInput = z.infer<typeof AnalyticsDateRangeSchema>;

/** Materialised view refresh request schema */
export const ViewRefreshRequestSchema = z.object({
  viewName: MaterialisedViewName,
});
export type ViewRefreshRequestInput = z.infer<typeof ViewRefreshRequestSchema>;

// ─── Phase 32: Achievements, Gamification & Retention Schemas ───────────────

export const AchievementRarity = z.enum(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']);
export type AchievementRarity = z.infer<typeof AchievementRarity>;

export const AchievementCategory = z.enum([
  'PARTICIPATION', 'FAIR_PLAY', 'SKILL', 'COMMUNITY', 'MILESTONE', 'SEASONAL',
]);
export type AchievementCategory = z.infer<typeof AchievementCategory>;

export const MissionType = z.enum(['DAILY', 'WEEKLY', 'SEASONAL', 'PERMANENT']);
export type MissionType = z.infer<typeof MissionType>;

export const CosmeticType = z.enum(['TITLE', 'PROFILE_FRAME', 'BADGE_BORDER', 'NAME_COLOR']);
export type CosmeticType = z.infer<typeof CosmeticType>;

/** Self-exclusion settings update schema */
export const SelfExclusionSettingsSchema = z.object({
  dailyPlayLimitMinutes: z.number().int().min(15).max(1440).nullable().optional(),
  weeklyPlayLimitMinutes: z.number().int().min(60).max(10080).nullable().optional(),
  cooldownMinutes: z.number().int().min(5).max(1440).nullable().optional(),
  selfExcludedUntil: z.string().datetime().nullable().optional(),
  ageVerified: z.boolean().optional(),
});
export type SelfExclusionSettingsInput = z.infer<typeof SelfExclusionSettingsSchema>;

/** Achievement create schema (admin) */
export const AchievementCreateSchema = z.object({
  slug: z.string().min(3).max(100).regex(/^[a-z0-9_]+$/, 'Must be lowercase with underscores'),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(1000),
  category: AchievementCategory.default('PARTICIPATION'),
  rarity: AchievementRarity.default('COMMON'),
  xpReward: z.number().int().min(0).max(10000).default(0),
  criteriaType: z.string().min(3).max(100),
  criteriaValue: z.number().int().min(1).default(1),
  isPayToWin: z.literal(false).default(false),
});
export type AchievementCreateInput = z.infer<typeof AchievementCreateSchema>;

// ─── Phase 33: Support Desk & Ticketing Schemas ──────────────────────────────

export const TicketCategory = z.enum([
  'ACCOUNT',
  'TOURNAMENT',
  'MATCH',
  'PAYMENT',
  'WALLET',
  'PAYOUT',
  'SAFETY',
  'ORGANISER',
]);
export type TicketCategory = z.infer<typeof TicketCategory>;

export const TicketPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT']);
export type TicketPriority = z.infer<typeof TicketPriority>;

export const TicketStatus = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_USER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
]);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const EscalationDepartment = z.enum(['FINANCE', 'MODERATION', 'LEGAL', 'SUPER_ADMIN']);
export type EscalationDepartment = z.infer<typeof EscalationDepartment>;

export const CreateTicketSchema = z.object({
  category: TicketCategory,
  subject: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  priority: TicketPriority.default('MEDIUM'),
  relatedEntityType: z.enum(['TOURNAMENT', 'MATCH', 'PAYMENT', 'PAYOUT', 'USER', 'ORGANISER']).optional(),
  relatedEntityId: z.string().uuid().optional(),
  attachments: z.array(z.string().url()).max(5).default([]),
});
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;

export const TicketReplySchema = z.object({
  message: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
  attachments: z.array(z.string().url()).max(5).default([]),
  cannedReplyId: z.string().uuid().optional(),
});
export type TicketReplyInput = z.infer<typeof TicketReplySchema>;

export const TicketEscalateSchema = z.object({
  escalateTo: EscalationDepartment,
  reason: z.string().min(5).max(1000),
  priority: TicketPriority.optional(),
});
export type TicketEscalateInput = z.infer<typeof TicketEscalateSchema>;

export const CannedReplySchema = z.object({
  category: TicketCategory,
  title: z.string().min(3).max(150),
  shortcutCode: z.string().min(2).max(50).regex(/^[a-z0-9-_]+$/, 'Must be lowercase alphanumeric, dash, or underscore'),
  body: z.string().min(5).max(5000),
  isActive: z.boolean().default(true),
});
export type CannedReplyInput = z.infer<typeof CannedReplySchema>;

export const CsatSurveySchema = z.object({
  rating: z.number().int().min(1).max(5),
  satisfied: z.boolean(),
  feedback: z.string().max(1000).optional(),
});
export type CsatSurveyInput = z.infer<typeof CsatSurveySchema>;

export const TicketAssignSchema = z.object({
  assignedTo: z.string().uuid(),
  notes: z.string().max(500).optional(),
});
export type TicketAssignInput = z.infer<typeof TicketAssignSchema>;

export const TicketStatusUpdateSchema = z.object({
  status: TicketStatus,
  resolutionNotes: z.string().max(2000).optional(),
});
export type TicketStatusUpdateInput = z.infer<typeof TicketStatusUpdateSchema>;

// ─── Phase 34: Vexora Extended Features Schemas (Section 41 & 43) ────────────

export const ScrimCreateSchema = z.object({
  title: z.string().min(3).max(150),
  game_id: z.string().uuid(),
  max_players: z.number().int().min(2).max(100).default(16),
  scheduled_at: z.string().datetime().optional(),
  rules_notes: z.string().max(1000).optional(),
});
export type ScrimCreateInput = z.infer<typeof ScrimCreateSchema>;

export const LftPostType = z.enum(['PLAYER_LFT', 'TEAM_RECRUITING']);
export type LftPostType = z.infer<typeof LftPostType>;

export const LftPostCreateSchema = z.object({
  post_type: LftPostType,
  game_id: z.string().uuid(),
  preferred_role: z.string().min(2).max(50),
  rank_tier: z.string().max(50).optional(),
  description: z.string().min(10).max(1000),
  in_game_uid: z.string().max(100).optional(),
  team_id: z.string().uuid().optional(),
});
export type LftPostCreateInput = z.infer<typeof LftPostCreateSchema>;

export const FollowTargetType = z.enum(['ORGANISER', 'TEAM', 'GAME']);
export type FollowTargetType = z.infer<typeof FollowTargetType>;

export const UserFollowSchema = z.object({
  target_type: FollowTargetType,
  target_id: z.string().uuid(),
});
export type UserFollowInput = z.infer<typeof UserFollowSchema>;

export const TournamentTemplateCreateSchema = z.object({
  template_name: z.string().min(3).max(150),
  game_id: z.string().uuid(),
  format: z.string().min(2).max(50),
  team_size: z.number().int().min(1).max(100).default(1),
  rule_json: z.record(z.any()).default({}),
  scoring_schema_id: z.string().uuid().optional(),
  evidence_rules: z.record(z.any()).default({}),
});
export type TournamentTemplateCreateInput = z.infer<typeof TournamentTemplateCreateSchema>;

export const TournamentStaffRole = z.enum(['CO_ORGANISER', 'REFEREE', 'CASTER', 'SCOREKEEPER']);
export type TournamentStaffRole = z.infer<typeof TournamentStaffRole>;

export const TournamentStaffAssignSchema = z.object({
  user_id: z.string().uuid(),
  staff_role: TournamentStaffRole,
  permissions: z.record(z.boolean()).default({ can_verify_results: true, can_manage_lobby: true }),
});
export type TournamentStaffAssignInput = z.infer<typeof TournamentStaffAssignSchema>;

export const SponsorBannerCreateSchema = z.object({
  sponsor_name: z.string().min(2).max(150),
  banner_url: z.string().url(),
  redirect_url: z.string().url().optional(),
});
export type SponsorBannerCreateInput = z.infer<typeof SponsorBannerCreateSchema>;

export const ReferralClaimSchema = z.object({
  referral_code: z.string().min(4).max(50),
});
export type ReferralClaimInput = z.infer<typeof ReferralClaimSchema>;

export const SafeChatMessageSchema = z.object({
  channel_type: z.enum(['TOURNAMENT_LOBBY', 'SCRIM_LOBBY', 'MATCH_ROOM']),
  channel_id: z.string().uuid(),
  message: z.string().min(1).max(500),
});
export type SafeChatMessageInput = z.infer<typeof SafeChatMessageSchema>;

export const FairPlayPledgeSchema = z.object({
  pledge_version: z.string().min(2).max(20).default('v1.0'),
});
export type FairPlayPledgeInput = z.infer<typeof FairPlayPledgeSchema>;




