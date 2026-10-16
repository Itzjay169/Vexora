/**
 * Vexora Esports Tournament Platform - Bracket & Match Engine
 * Phase 17: Bracket Generation, Match Scheduling & Secure Room Code Engine
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 4, 14, 16, 39, 43, 47)
 * Invariant: Canonical 8 Match States (SCHEDULED, LOBBY_READY, LIVE, RESULT_SUBMITTED, CONFIRMED, DISPUTED, FINAL, CANCELLED)
 * Invariant: Standard tournament seeding (Seed 1 vs Seed 16, Seed 2 vs Seed 15, etc.)
 * Invariant: Automatic Bye advancement
 * Invariant: Round-robin complete pairing (Berger algorithm)
 * Invariant: Battle Royale snake-seeded lobby partitioning
 * Invariant: Room code hidden until server release time and released strictly to checked-in players
 * Invariant: Room codes NEVER included in push notification payloads
 */

import crypto from 'crypto';
import { query, withTransaction } from '../common/database.js';
import { AppError } from '../common/errorHandler.js';
import { appendAuditLog, hashIP } from '../common/auditLog.js';

// ─── Canonical 8 Match States (PDF Section 4 & Phase 17) ─────────────────────
export const MATCH_STATES = [
  'SCHEDULED',
  'LOBBY_READY',
  'LIVE',
  'RESULT_SUBMITTED',
  'CONFIRMED',
  'DISPUTED',
  'FINAL',
  'CANCELLED',
];

// ─── Valid Match State Transitions Graph ─────────────────────────────────────
export const VALID_MATCH_TRANSITIONS = {
  SCHEDULED:        ['LOBBY_READY', 'CANCELLED'],
  LOBBY_READY:      ['LIVE', 'SCHEDULED', 'CANCELLED'],
  LIVE:             ['RESULT_SUBMITTED', 'CANCELLED'],
  RESULT_SUBMITTED: ['CONFIRMED', 'DISPUTED', 'CANCELLED'],
  CONFIRMED:        ['FINAL', 'DISPUTED'],
  DISPUTED:         ['FINAL', 'LIVE', 'CANCELLED'], // Final settlement or re-match
  FINAL:            [], // Terminal
  CANCELLED:        [], // Terminal
};

/**
 * Pure transition validator
 */
export function canTransitionMatch(currentStatus, nextStatus) {
  // Support legacy IN_PROGRESS and RESULT_PENDING for backward compatibility
  const normalizedCurrent = currentStatus === 'IN_PROGRESS' ? 'LIVE'
    : currentStatus === 'RESULT_PENDING' ? 'RESULT_SUBMITTED'
    : currentStatus === 'LOBBY_CREATED' ? 'LOBBY_READY'
    : currentStatus;

  const allowed = VALID_MATCH_TRANSITIONS[normalizedCurrent] || [];
  return allowed.includes(nextStatus);
}

// ─── Bracket Helper Algorithms ──────────────────────────────────────────────

/**
 * Generate standard seed pairings for power-of-2 tournament slots
 * E.g. for slots = 16: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
 */
export function getStandardSeedOrder(slots) {
  if (slots <= 1) return [1];
  if (slots === 2) return [1, 2];

  const rounds = Math.log2(slots);
  let list = [1, 2];

  for (let r = 1; r < rounds; r++) {
    const nextList = [];
    const length = list.length * 2 + 1;
    for (const s of list) {
      nextList.push(s);
      nextList.push(length - s);
    }
    list = nextList;
  }
  return list;
}

/**
 * Round name labeler
 */
export function getRoundStageLabel(roundNumber, totalRounds) {
  const roundsRemaining = totalRounds - roundNumber;
  if (roundsRemaining === 0) return 'FINALS';
  if (roundsRemaining === 1) return 'SEMI_FINALS';
  if (roundsRemaining === 2) return 'QUARTER_FINALS';
  if (roundsRemaining === 3) return 'ROUND_OF_16';
  if (roundsRemaining === 4) return 'ROUND_OF_32';
  return `ROUND_${roundNumber}`;
}

// ─── Match & Bracket Service Class ──────────────────────────────────────────
export class MatchBracketService {

  /**
   * Pure Knockout Bracket Generator (Single Elimination)
   * Supports any participant count >= 2, calculates byes and links next_match_id
   */
  static generateKnockoutTree(participants, options = {}) {
    const count = participants.length;
    if (count < 2) {
      throw new AppError('Minimum 2 participants required to generate a bracket', 400, 'INVALID_PARTICIPANT_COUNT');
    }

    // Next power of 2
    const slots = Math.pow(2, Math.ceil(Math.log2(count)));
    const totalRounds = Math.log2(slots);
    const byesCount = slots - count;

    // Sort or assign seeds
    let seeded = [...participants];
    if (options.seeding_method === 'RANDOM') {
      seeded.sort(() => Math.random() - 0.5);
    } else if (options.seeding_method === 'MANUAL' && options.seeds) {
      const seedMap = new Map(options.seeds.map(s => [s.registration_id, s.seed]));
      seeded.sort((a, b) => (seedMap.get(a.id) || 999) - (seedMap.get(b.id) || 999));
    }
    // Tag with 1-indexed seed
    seeded = seeded.map((p, idx) => ({ ...p, seed: p.seed || idx + 1 }));

    // Map into seed order slots
    const seedOrder = getStandardSeedOrder(slots);
    const seedLookup = new Map(seeded.map(p => [p.seed, p]));

    const rounds = [];
    const matchesMap = new Map(); // key: `round-match` -> match

    // 1. Build blank matches for all rounds first
    for (let r = 1; r <= totalRounds; r++) {
      const matchesInRound = slots / Math.pow(2, r);
      const stage = getRoundStageLabel(r, totalRounds);
      const roundMatches = [];

      for (let m = 1; m <= matchesInRound; m++) {
        const matchKey = `${r}-${m}`;
        const matchObj = {
          id: crypto.randomUUID(),
          round_number: r,
          match_number: m,
          bracket_type: 'KNOCKOUT',
          stage,
          status: 'SCHEDULED',
          participant_a: null,
          participant_b: null,
          winner_id: null,
          loser_id: null,
          next_match_key: r < totalRounds ? `${r + 1}-${Math.ceil(m / 2)}` : null,
          next_slot: m % 2 === 1 ? 'A' : 'B',
          bye_awarded: false,
          room_id: null,
          room_password: null,
          room_release_time: null,
        };
        roundMatches.push(matchObj);
        matchesMap.set(matchKey, matchObj);
      }
      rounds.push({ round_number: r, stage, matches: roundMatches });
    }

    // 2. Link next_match_id UUIDs
    for (const round of rounds) {
      for (const match of round.matches) {
        if (match.next_match_key) {
          const nextMatch = matchesMap.get(match.next_match_key);
          if (nextMatch) {
            match.next_match_id = nextMatch.id;
          }
        }
      }
    }

    // 3. Populate Round 1 participants from standard seed order
    const r1Matches = rounds[0].matches;
    for (let m = 0; m < r1Matches.length; m++) {
      const match = r1Matches[m];
      const seedA = seedOrder[m * 2];
      const seedB = seedOrder[m * 2 + 1];

      const partA = seedLookup.get(seedA) || null;
      const partB = seedLookup.get(seedB) || null;

      match.participant_a = partA;
      match.participant_b = partB;

      // Handle Byes
      if (partA && !partB) {
        // Bye for Part A
        match.bye_awarded = true;
        match.status = 'FINAL';
        match.winner_id = partA.id;
        // Propagate winner to next round
        if (match.next_match_key) {
          const nextMatch = matchesMap.get(match.next_match_key);
          if (nextMatch) {
            if (match.next_slot === 'A') nextMatch.participant_a = partA;
            else nextMatch.participant_b = partA;
          }
        }
      } else if (!partA && partB) {
        // Bye for Part B
        match.bye_awarded = true;
        match.status = 'FINAL';
        match.winner_id = partB.id;
        // Propagate winner to next round
        if (match.next_match_key) {
          const nextMatch = matchesMap.get(match.next_match_key);
          if (nextMatch) {
            if (match.next_slot === 'A') nextMatch.participant_a = partB;
            else nextMatch.participant_b = partB;
          }
        }
      }
    }

    return {
      bracket_type: 'KNOCKOUT',
      slots,
      total_rounds: totalRounds,
      byes_count: byesCount,
      rounds,
    };
  }

  /**
   * Round Robin Tournament Schedule (Berger / Circle Algorithm)
   * Every team plays every other team once
   */
  static generateRoundRobinSchedule(participants) {
    const count = participants.length;
    if (count < 2) {
      throw new AppError('Minimum 2 participants required for round-robin schedule', 400, 'INVALID_PARTICIPANT_COUNT');
    }

    let teamList = [...participants];
    const isOdd = count % 2 === 1;
    if (isOdd) {
      teamList.push({ id: null, is_dummy_bye: true, name: 'BYE' });
    }

    const totalTeams = teamList.length;
    const totalRounds = totalTeams - 1;
    const matchesPerRound = totalTeams / 2;
    const rounds = [];

    // Circle algorithm: fix teamList[0], rotate the rest
    for (let r = 1; r <= totalRounds; r++) {
      const roundMatches = [];
      for (let m = 0; m < matchesPerRound; m++) {
        const teamA = teamList[m];
        const teamB = teamList[totalTeams - 1 - m];

        const isBye = teamA.is_dummy_bye || teamB.is_dummy_bye;
        const realTeam = teamA.is_dummy_bye ? teamB : teamA;

        roundMatches.push({
          id: crypto.randomUUID(),
          round_number: r,
          match_number: m + 1,
          bracket_type: 'ROUND_ROBIN',
          stage: `ROUND_${r}`,
          participant_a: teamA.is_dummy_bye ? null : teamA,
          participant_b: teamB.is_dummy_bye ? null : teamB,
          bye_awarded: isBye,
          status: isBye ? 'FINAL' : 'SCHEDULED',
          winner_id: isBye ? realTeam.id : null,
          room_id: null,
          room_password: null,
          room_release_time: null,
        });
      }
      rounds.push({ round_number: r, stage: `ROUND_${r}`, matches: roundMatches });

      // Rotate: fix team 0, rotate teamList[1...totalTeams-1]
      const last = teamList.pop();
      teamList.splice(1, 0, last);
    }

    return {
      bracket_type: 'ROUND_ROBIN',
      total_teams: count,
      total_rounds: totalRounds,
      matches_per_round: matchesPerRound,
      rounds,
    };
  }

  /**
   * Battle Royale Lobby Grouping Generator (Snake Seeding)
   * Groups participants (e.g. 48 squads) into balanced lobbies (e.g. 16 per lobby)
   */
  static generateBattleRoyaleLobbies(participants, lobbySize = 16, matchesPerLobby = 1) {
    const count = participants.length;
    if (count < 2) {
      throw new AppError('Minimum 2 participants required for Battle Royale lobbies', 400, 'INVALID_PARTICIPANT_COUNT');
    }

    const numLobbies = Math.max(1, Math.ceil(count / lobbySize));
    const lobbies = Array.from({ length: numLobbies }, (_, i) => ({
      lobby_index: i + 1,
      participants: [],
      matches: [],
    }));

    // Snake seeding distribution across lobbies
    const sorted = [...participants].map((p, idx) => ({ ...p, seed: p.seed || idx + 1 }));
    let lobbyIdx = 0;
    let direction = 1; // 1 = forward, -1 = reverse

    for (const participant of sorted) {
      lobbies[lobbyIdx].participants.push(participant);
      lobbyIdx += direction;
      if (lobbyIdx >= numLobbies) {
        lobbyIdx = numLobbies - 1;
        direction = -1;
      } else if (lobbyIdx < 0) {
        lobbyIdx = 0;
        direction = 1;
      }
    }

    // Generate matches for each lobby
    for (const lobby of lobbies) {
      for (let m = 1; m <= matchesPerLobby; m++) {
        lobby.matches.push({
          id: crypto.randomUUID(),
          round_number: m,
          match_number: lobby.lobby_index,
          bracket_type: 'BATTLE_ROYALE_LOBBY',
          lobby_group_index: lobby.lobby_index,
          stage: `LOBBY_${lobby.lobby_index}_MATCH_${m}`,
          status: 'SCHEDULED',
          participants: lobby.participants,
          room_id: null,
          room_password: null,
          room_release_time: null,
        });
      }
    }

    return {
      bracket_type: 'BATTLE_ROYALE_LOBBY',
      lobby_size: lobbySize,
      num_lobbies: numLobbies,
      total_participants: count,
      lobbies,
    };
  }

  /**
   * Advance Winner in a Knockout Bracket
   * When match status becomes FINAL, propagate the winner to next_match_id
   */
  static advanceKnockoutWinner(match, allMatches) {
    if (match.status !== 'FINAL' || !match.winner_id || !match.next_match_id) {
      return null;
    }

    const nextMatch = allMatches.find(m => m.id === match.next_match_id);
    if (!nextMatch) return null;

    // Odd match_number feeds participant_a, even feeds participant_b
    if (match.match_number % 2 === 1) {
      nextMatch.participant_a_id = match.winner_id;
    } else {
      nextMatch.participant_b_id = match.winner_id;
    }

    return nextMatch;
  }

  /**
   * Security Gate: Room Code Sanitization Engine
   * Room codes are hidden until server release time and released strictly to checked-in participants.
   * Admins and Tournament Organisers have unrestricted access.
   */
  static sanitizeMatchForUser(match, user, userRegistration = null, serverTime = new Date()) {
    const isStaff = user && (
      user.role === 'SUPER_ADMIN' ||
      user.role === 'ADMIN' ||
      (match.organiser_id && user.id === match.organiser_id)
    );

    // Organiser / Admin view: always unredacted
    if (isStaff) {
      return {
        ...match,
        room_code_status: 'UNRESTRICTED_STAFF',
      };
    }

    // Unauthenticated or regular player view:
    const clone = { ...match };

    // 1. Check server release time
    const releaseTime = match.room_release_time ? new Date(match.room_release_time) : null;
    const now = new Date(serverTime);
    const hasReleaseTimePassed = releaseTime && now >= releaseTime;

    if (!hasReleaseTimePassed) {
      clone.room_id = null;
      clone.room_password = null;
      clone.room_code_status = 'LOCKED_UNTIL_RELEASE_TIME';
      return clone;
    }

    // 2. Check if user is checked in
    const isCheckedIn = userRegistration && (
      userRegistration.status === 'CHECKED_IN' ||
      userRegistration.check_in_confirmed === true ||
      userRegistration.roster_locked === true
    );

    // 3. Check if user belongs to this specific match
    const isMatchParticipant = userRegistration && (
      userRegistration.id === match.participant_a_id ||
      userRegistration.id === match.participant_b_id ||
      (match.participants && match.participants.some(p => p.registration_id === userRegistration.id))
    );

    if (isCheckedIn && isMatchParticipant) {
      clone.room_code_status = 'RELEASED_VERIFIED';
      // keep room_id and room_password intact
      return clone;
    }

    // Player who is not checked in or not in this match
    clone.room_id = null;
    clone.room_password = null;
    clone.room_code_status = 'RESTRICTED_TO_CHECKED_IN_PARTICIPANTS';
    return clone;
  }

  /**
   * Security Gate: Safe Push Notification Payload Builder
   * Room codes are NEVER included in push payloads
   */
  static buildMatchPushPayload(match, alertType = 'MATCH_LOBBY_ALERT') {
    return {
      type: alertType,
      match_id: match.id,
      tournament_id: match.tournament_id,
      round_number: match.round_number,
      match_number: match.match_number,
      stage: match.stage,
      status: match.status,
      deep_link: `vexora://tournaments/${match.tournament_id}/matches/${match.id}`,
      // IMPORTANT: room_id and room_password are NEVER present
    };
  }

  // ─── Database Operations (Live DB & Mock Fallback) ──────────────────────────

  /**
   * Generate and persist bracket for a tournament
   */
  static async generateAndSaveBracket(tournamentId, organiserUser, params = {}, ip = '127.0.0.1') {
    // 1. Verify tournament ownership and status
    const tourRes = await query(
      `SELECT id, organiser_id, status, format, max_participants FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tourRes.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const tournament = tourRes.rows[0];

    // Anti-IDOR check
    if (organiserUser.role !== 'SUPER_ADMIN' && organiserUser.role !== 'ADMIN' && tournament.organiser_id !== organiserUser.id) {
      throw new AppError('Tournament not found or unauthorized', 404, 'NOT_FOUND');
    }

    // Status check: must be in CHECK_IN or LIVE or SCHEDULED or REGISTRATION_OPEN
    const allowedStates = ['CHECK_IN', 'LIVE', 'REGISTRATION_OPEN', 'SCHEDULED'];
    if (!allowedStates.includes(tournament.status)) {
      throw new AppError(
        `Cannot generate bracket in ${tournament.status} state. Tournament must be in CHECK_IN or LIVE state.`,
        400,
        'INVALID_TOURNAMENT_STATE'
      );
    }

    // 2. Fetch checked-in or confirmed registrations
    const regRes = await query(
      `SELECT tr.id, tr.user_id, tr.team_id, tr.slot_number, tr.status,
              COALESCE(t.name, u.username) as name
       FROM tournament_registrations tr
       LEFT JOIN users u ON u.id = tr.user_id
       LEFT JOIN teams t ON t.id = tr.team_id
       WHERE tr.tournament_id = $1 AND tr.status IN ('CHECKED_IN', 'CONFIRMED')
       ORDER BY tr.slot_number ASC NULLS LAST`,
      [tournamentId]
    );

    const participants = regRes.rows;
    if (participants.length < 2) {
      throw new AppError(
        `Insufficient participants (${participants.length}). Minimum 2 checked-in participants required.`,
        400,
        'INSUFFICIENT_PARTICIPANTS'
      );
    }

    const bracketType = params.bracket_type || tournament.format || 'KNOCKOUT';
    let bracketResult;

    if (bracketType === 'ROUND_ROBIN' || bracketType === 'LEAGUE') {
      bracketResult = MatchBracketService.generateRoundRobinSchedule(participants);
    } else if (bracketType === 'BATTLE_ROYALE_LOBBY') {
      bracketResult = MatchBracketService.generateBattleRoyaleLobbies(
        participants,
        params.lobby_size || 16,
        params.matches_per_lobby || 1
      );
    } else {
      // Default to Knockout
      bracketResult = MatchBracketService.generateKnockoutTree(participants, params);
    }

    // 3. Clear existing draft matches and save generated matches
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM matches WHERE tournament_id = $1 AND status = 'SCHEDULED'`, [tournamentId]);

      if (bracketResult.bracket_type === 'KNOCKOUT') {
        // Insert matches in reverse round order or update next_match_id
        for (const round of bracketResult.rounds) {
          for (const m of round.matches) {
            await client.query(
              `INSERT INTO matches (
                id, tournament_id, round_number, match_number, status, bracket_type, stage,
                participant_a_id, participant_b_id, winner_registration_id, bye_awarded, next_match_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (id) DO NOTHING`,
              [
                m.id, tournamentId, m.round_number, m.match_number, m.status,
                'KNOCKOUT', m.stage,
                m.participant_a ? m.participant_a.id : null,
                m.participant_b ? m.participant_b.id : null,
                m.winner_id, m.bye_awarded, m.next_match_id
              ]
            );
          }
        }
      } else if (bracketResult.bracket_type === 'ROUND_ROBIN') {
        for (const round of bracketResult.rounds) {
          for (const m of round.matches) {
            await client.query(
              `INSERT INTO matches (
                id, tournament_id, round_number, match_number, status, bracket_type, stage,
                participant_a_id, participant_b_id, winner_registration_id, bye_awarded
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (id) DO NOTHING`,
              [
                m.id, tournamentId, m.round_number, m.match_number, m.status,
                'ROUND_ROBIN', m.stage,
                m.participant_a ? m.participant_a.id : null,
                m.participant_b ? m.participant_b.id : null,
                m.winner_id, m.bye_awarded
              ]
            );
          }
        }
      } else if (bracketResult.bracket_type === 'BATTLE_ROYALE_LOBBY') {
        for (const lobby of bracketResult.lobbies) {
          for (const m of lobby.matches) {
            await client.query(
              `INSERT INTO matches (
                id, tournament_id, round_number, match_number, status, bracket_type, lobby_group_index, stage
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (id) DO NOTHING`,
              [
                m.id, tournamentId, m.round_number, m.match_number, m.status,
                'BATTLE_ROYALE_LOBBY', m.lobby_group_index, m.stage
              ]
            );

            for (const p of m.participants) {
              await client.query(
                `INSERT INTO match_participants (match_id, registration_id, seed, check_in_confirmed)
                 VALUES ($1, $2, $3, TRUE)
                 ON CONFLICT (match_id, registration_id) DO NOTHING`,
                [m.id, p.id, p.seed || null]
              );
            }
          }
        }
      }
    });

    // 4. Record audit log
    await appendAuditLog({
      actorId: organiserUser.id,
      actorRole: organiserUser.role,
      action: 'BRACKET_GENERATED',
      entityType: 'tournament',
      entityId: tournamentId,
      payload: {
        bracket_type: bracketResult.bracket_type,
        participant_count: participants.length,
      },
      ipHash: hashIP(ip),
    });

    return bracketResult;
  }

  /**
   * Set room credentials and scheduled release time (Organiser/Admin)
   */
  static async updateMatchRoom(matchId, organiserUser, roomData, ip = '127.0.0.1') {
    const matchRes = await query(
      `SELECT m.*, t.organiser_id
       FROM matches m
       JOIN tournaments t ON t.id = m.tournament_id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchRes.rows.length === 0) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    const match = matchRes.rows[0];

    // Anti-IDOR check
    if (organiserUser.role !== 'SUPER_ADMIN' && organiserUser.role !== 'ADMIN' && match.organiser_id !== organiserUser.id) {
      throw new AppError('Match not found or unauthorized', 404, 'NOT_FOUND');
    }

    const { room_id, room_password, room_release_time } = roomData;

    await query(
      `UPDATE matches SET
         room_id = $1,
         room_password = $2,
         room_release_time = $3,
         status = CASE WHEN status = 'SCHEDULED' THEN 'LOBBY_READY' ELSE status END,
         updated_at = NOW()
       WHERE id = $4`,
      [room_id, room_password || null, room_release_time, matchId]
    );

    await appendAuditLog({
      actorId: organiserUser.id,
      actorRole: organiserUser.role,
      action: 'MATCH_ROOM_UPDATED',
      entityType: 'match',
      entityId: matchId,
      payload: { room_id, room_release_time },
      ipHash: hashIP(ip),
    });

    return {
      success: true,
      match_id: matchId,
      room_id,
      room_release_time,
      status: match.status === 'SCHEDULED' ? 'LOBBY_READY' : match.status,
    };
  }

  /**
   * Transition Match State with state-machine validation
   */
  static async transitionMatchState(matchId, newStatus, user, reason = null, ip = '127.0.0.1') {
    const matchRes = await query(
      `SELECT m.*, t.organiser_id
       FROM matches m
       JOIN tournaments t ON t.id = m.tournament_id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchRes.rows.length === 0) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    const match = matchRes.rows[0];

    // Anti-IDOR
    const isPrivileged = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || match.organiser_id === user.id;
    if (!isPrivileged) {
      throw new AppError('Match not found or unauthorized', 404, 'NOT_FOUND');
    }

    if (!canTransitionMatch(match.status, newStatus)) {
      throw new AppError(
        `Cannot transition match from ${match.status} to ${newStatus}.`,
        400,
        'INVALID_MATCH_TRANSITION'
      );
    }

    await query(
      `UPDATE matches SET
         status = $1,
         started_at = CASE WHEN $1 = 'LIVE' AND started_at IS NULL THEN NOW() ELSE started_at END,
         ended_at = CASE WHEN $1 = 'FINAL' AND ended_at IS NULL THEN NOW() ELSE ended_at END,
         updated_at = NOW()
       WHERE id = $2`,
      [newStatus, matchId]
    );

    // If match transitioned to FINAL and has a winner in Knockout, advance winner to next match
    if (newStatus === 'FINAL' && match.winner_registration_id && match.next_match_id) {
      const isOdd = match.match_number % 2 === 1;
      await query(
        `UPDATE matches SET
           ${isOdd ? 'participant_a_id' : 'participant_b_id'} = $1,
           updated_at = NOW()
         WHERE id = $2`,
        [match.winner_registration_id, match.next_match_id]
      );
    }

    await appendAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'MATCH_STATUS_TRANSITION',
      entityType: 'match',
      entityId: matchId,
      payload: { from: match.status, to: newStatus, reason },
      ipHash: hashIP(ip),
    });

    return { success: true, match_id: matchId, status: newStatus };
  }
}
