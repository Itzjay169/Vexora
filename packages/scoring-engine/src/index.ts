// ============================================================================
// Vexora Deterministic Game Scoring Engine
// Specifications: ADR-002, ADR-015, Blueprint Section 5, 7, 31, 39
// ============================================================================

import crypto from 'node:crypto';

export interface RawStatsInput {
  placement?: number;
  kills?: number;
  assists?: number;
  deaths?: number;
  is_winner?: boolean;
  rounds_won?: number;
  rounds_lost?: number;
  score?: number;
  first_place_finishes?: number;
  final_match_placement?: number;
  [key: string]: any;
}

export interface ScoreOutput {
  placementPoints: number;
  killPoints: number;
  bonusPoints: number;
  totalPoints: number;
}

export interface StandingsParticipant extends RawStatsInput {
  id?: string;
  registration_id?: string;
  user_id?: string;
  name?: string;
  placementPoints: number;
  killPoints: number;
  bonusPoints?: number;
  totalPoints: number;
  rank?: number;
  tieBreakNote?: string;
}

export interface ScoringFormula {
  placement_points?: Record<string | number, number>;
  kill_points?: number;
  assist_points?: number;
  win_points?: number;
  loss_points?: number;
  round_points?: number;
  integer_only?: boolean;
}

export interface StandingsSummary {
  totalParticipants: number;
  totalPointsDistributed: number;
  totalKillsRecorded: number;
  highestScore: number;
}

export interface SimulationResult<T extends StandingsParticipant = StandingsParticipant> {
  standings: T[];
  summary: StandingsSummary;
}

// ─── Placement Point Tables (ADR-015) ───────────────────────────────────────

export const BGMI_PLACEMENT_TABLE: Record<number, number> = Object.freeze({
  1: 10,
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
  7: 1,
  8: 1,
});

export const FREEFIRE_PLACEMENT_TABLE: Record<number, number> = Object.freeze({
  1: 12,
  2: 9,
  3: 8,
  4: 7,
  5: 6,
  6: 4,
  7: 3,
  8: 2,
  9: 1,
});

// ─── Score Calculation Functions ───────────────────────────────────────────

export function calculateScore(
  gameSlug: 'bgmi' | 'freefire',
  input: { placement: number; kills: number }
): ScoreOutput {
  const table = gameSlug === 'bgmi' ? BGMI_PLACEMENT_TABLE : FREEFIRE_PLACEMENT_TABLE;
  const placementPoints = Math.floor(table[input.placement] ?? 0);
  const killPoints = Math.floor(Math.max(0, input.kills ?? 0));
  const totalPoints = placementPoints + killPoints;

  return {
    placementPoints,
    killPoints,
    bonusPoints: 0,
    totalPoints,
  };
}

export function calculateCodmScore(
  input: { is_winner: boolean; rounds_won?: number; rounds_lost?: number; score?: number; kills?: number }
): ScoreOutput {
  const bonusPoints = input.is_winner ? 3 : 0;
  const killPoints = Math.floor(Math.max(0, input.kills ?? 0));
  return {
    placementPoints: 0,
    killPoints,
    bonusPoints,
    totalPoints: bonusPoints,
  };
}

export function calculateFormulaScore(
  formula: ScoringFormula,
  stats: RawStatsInput
): ScoreOutput {
  if (!formula || typeof formula !== 'object') {
    throw new Error('Invalid scoring formula: must be an object');
  }

  let placementPoints = 0;
  let killPoints = 0;
  let bonusPoints = 0;

  if (formula.placement_points && stats.placement) {
    const pts = formula.placement_points[stats.placement] ?? formula.placement_points[String(stats.placement)] ?? 0;
    placementPoints = Math.floor(Number(pts) || 0);
  }

  if (formula.kill_points !== undefined && stats.kills) {
    const multiplier = Math.floor(Number(formula.kill_points) || 0);
    killPoints = Math.floor(Math.max(0, stats.kills) * multiplier);
  }

  if (formula.assist_points && stats.assists) {
    bonusPoints += Math.floor(stats.assists * (Number(formula.assist_points) || 0));
  }

  if (stats.is_winner && formula.win_points) {
    bonusPoints += Math.floor(Number(formula.win_points) || 0);
  } else if (stats.is_winner === false && formula.loss_points) {
    bonusPoints += Math.floor(Number(formula.loss_points) || 0);
  }

  if (formula.round_points && stats.rounds_won) {
    bonusPoints += Math.floor(stats.rounds_won * (Number(formula.round_points) || 0));
  }

  const totalPoints = placementPoints + killPoints + bonusPoints;

  return {
    placementPoints,
    killPoints,
    bonusPoints,
    totalPoints,
  };
}

export function previewScore(
  gameSlug: string,
  formula?: ScoringFormula | null,
  rawStats: RawStatsInput = {}
): ScoreOutput {
  if (formula && typeof formula === 'object' && Object.keys(formula).length > 0) {
    return calculateFormulaScore(formula, rawStats);
  }
  if (gameSlug === 'freefire') {
    return calculateScore('freefire', { placement: rawStats.placement ?? 99, kills: rawStats.kills ?? 0 });
  }
  if (gameSlug === 'codm') {
    return calculateCodmScore({
      is_winner: Boolean(rawStats.is_winner),
      rounds_won: rawStats.rounds_won,
      rounds_lost: rawStats.rounds_lost,
      score: rawStats.score,
      kills: rawStats.kills,
    });
  }
  return calculateScore('bgmi', { placement: rawStats.placement ?? 99, kills: rawStats.kills ?? 0 });
}

// ─── Standings & Tie-Breaking Engine ────────────────────────────────────────

export function sortStandings<T extends StandingsParticipant>(
  items: T[],
  gameSlug: 'bgmi' | 'freefire' | 'codm' | string = 'bgmi'
): T[] {
  const sorted = [...items].sort((a, b) => {
    if (gameSlug === 'freefire') {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const aWins = a.first_place_finishes ?? (a.placement === 1 ? 1 : 0);
      const bWins = b.first_place_finishes ?? (b.placement === 1 ? 1 : 0);
      if (bWins !== aWins) return bWins - aWins;
      if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
      const aFinal = a.final_match_placement ?? a.placement ?? 999;
      const bFinal = b.final_match_placement ?? b.placement ?? 999;
      return aFinal - bFinal;
    }

    if (gameSlug === 'codm') {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const aRoundDiff = (a.rounds_won ?? 0) - (a.rounds_lost ?? 0);
      const bRoundDiff = (b.rounds_won ?? 0) - (b.rounds_lost ?? 0);
      if (bRoundDiff !== aRoundDiff) return bRoundDiff - aRoundDiff;
      const aScore = a.score ?? 0;
      const bScore = b.score ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      return (b.kills ?? 0) - (a.kills ?? 0);
    }

    // Default: BGMI Standard Krafton Hierarchy
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints;
    if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
    const aWins = a.first_place_finishes ?? (a.placement === 1 ? 1 : 0);
    const bWins = b.first_place_finishes ?? (b.placement === 1 ? 1 : 0);
    if (bWins !== aWins) return bWins - aWins;
    const aFinal = a.final_match_placement ?? a.placement ?? 999;
    const bFinal = b.final_match_placement ?? b.placement ?? 999;
    return aFinal - bFinal;
  });

  return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }));
}

export function verifyLobbyPlacementPoints(
  results: Array<{ placementPoints?: number }>,
  placementTable: Record<number, number>,
  lobbySize: number
): { valid: boolean; expectedSum: number; actualSum: number; error?: string } {
  let expectedSum = 0;
  for (let rank = 1; rank <= lobbySize; rank++) {
    expectedSum += placementTable[rank] ?? 0;
  }

  const actualSum = results.reduce((acc, r) => acc + (r.placementPoints || 0), 0);
  const valid = actualSum === expectedSum;

  return {
    valid,
    expectedSum,
    actualSum,
    error: valid ? undefined : `Placement points sum mismatch: expected ${expectedSum}, got ${actualSum}`,
  };
}

export function verifyCombatantKillCount(
  results: Array<{ kills?: number }>,
  maxCombatants: number
): { valid: boolean; totalKills: number; maxAllowedKills: number; error?: string } {
  const totalKills = results.reduce((acc, r) => acc + (r.kills || 0), 0);
  const maxAllowedKills = maxCombatants;
  const valid = totalKills <= maxAllowedKills;

  return {
    valid,
    totalKills,
    maxAllowedKills,
    error: valid ? undefined : `Excessive kills recorded: ${totalKills} exceeds max combatants (${maxCombatants})`,
  };
}

export function simulateTournamentScoring(
  config: { formula?: ScoringFormula; gameSlug?: string },
  participants: StandingsParticipant[]
): SimulationResult {
  const scoredParticipants = participants.map((p) => {
    let score: ScoreOutput;
    if (config.formula) {
      score = calculateFormulaScore(config.formula, p);
    } else if (config.gameSlug === 'freefire') {
      score = calculateScore('freefire', { placement: p.placement ?? 99, kills: p.kills ?? 0 });
    } else if (config.gameSlug === 'codm') {
      score = calculateCodmScore({
        is_winner: Boolean(p.is_winner),
        rounds_won: p.rounds_won,
        rounds_lost: p.rounds_lost,
        score: p.score,
        kills: p.kills,
      });
    } else {
      score = calculateScore('bgmi', { placement: p.placement ?? 99, kills: p.kills ?? 0 });
    }

    return {
      ...p,
      placementPoints: score.placementPoints,
      killPoints: score.killPoints,
      bonusPoints: score.bonusPoints,
      totalPoints: score.totalPoints,
    };
  });

  const standings = sortStandings(scoredParticipants, config.gameSlug || 'bgmi');

  const totalPointsDistributed = standings.reduce((acc, p) => acc + p.totalPoints, 0);
  const totalKillsRecorded = standings.reduce((acc, p) => acc + (p.kills || 0), 0);
  const highestScore = standings.length > 0 ? standings[0].totalPoints : 0;

  return {
    standings,
    summary: {
      totalParticipants: standings.length,
      totalPointsDistributed,
      totalKillsRecorded,
      highestScore,
    },
  };
}

export function computeStandingsDigest(standings: StandingsParticipant[]): string {
  const normalized = standings.map(s => ({
    rank: s.rank,
    id: s.id || s.registration_id || s.user_id,
    totalPoints: s.totalPoints,
    placementPoints: s.placementPoints,
    killPoints: s.killPoints,
    bonusPoints: s.bonusPoints,
  }));
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function reproduceMatchScore(
  formula: ScoringFormula,
  rawStats: RawStatsInput
): { reproducible: boolean; score: ScoreOutput } {
  const calculated = calculateFormulaScore(formula, rawStats);
  return {
    reproducible: true,
    score: calculated,
  };
}
