// Vexora Core Domain Types & Enums

export type UUID = string;

export enum TournamentState {
  DRAFT = 'DRAFT',
  ANNOUNCED = 'ANNOUNCED',
  REGISTRATION_OPEN = 'REGISTRATION_OPEN',
  REGISTRATION_CLOSED = 'REGISTRATION_CLOSED',
  CHECK_IN = 'CHECK_IN',
  SEEDING = 'SEEDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED'
}

export enum OrganiserTier {
  STARTER = 'STARTER',
  VERIFIED = 'VERIFIED',
  PARTNER = 'PARTNER'
}

export enum SanctionLevel {
  LEVEL_1_WARNING = 'LEVEL_1_WARNING',
  LEVEL_2_RESTRICTION = 'LEVEL_2_RESTRICTION',
  LEVEL_3_SUSPENSION = 'LEVEL_3_SUSPENSION',
  LEVEL_4_PERMANENT_BAN = 'LEVEL_4_PERMANENT_BAN'
}

export enum MatchResultState {
  PENDING = 'PENDING',
  RESULT_PENDING = 'RESULT_PENDING',
  CONFIRMED = 'CONFIRMED',
  DISPUTED = 'DISPUTED',
  FINAL = 'FINAL'
}

export interface UserProfile {
  id: UUID;
  username: string;
  avatarUrl?: string;
  fairPlayScore: number;
  createdAt: string;
}

export interface TournamentMetadata {
  id: UUID;
  title: string;
  gameSlug: 'bgmi' | 'freefire' | 'codm';
  format: 'single_elimination' | 'round_robin' | 'battle_royale';
  state: TournamentState;
  minParticipants: number;
  maxParticipants: number;
  entryFeeCredits: number;
  prizePoolCredits: number;
  registrationClosesAt: string;
  startsAt: string;
  scoringSchemaVersion: string;
}

export interface MatchScoreSubmission {
  matchId: UUID;
  submittedByUserId: UUID;
  evidenceFileHash: string; // SHA-256
  placements: Array<{
    teamOrPlayerId: UUID;
    placement: number;
    kills: number;
    calculatedPoints: number;
  }>;
}

export interface LedgerEntry {
  transactionId: UUID;
  fromAccountId: UUID;
  toAccountId: UUID;
  amount: number; // Stored in minor units (e.g. paise)
  currency: 'CREDIT';
  idempotencyKey: string;
  referenceType: 'TOURNAMENT_ENTRY' | 'PRIZE_PAYOUT' | 'ESCROW_HOLD' | 'REFUND';
  referenceId: UUID;
  createdAt: string;
}
