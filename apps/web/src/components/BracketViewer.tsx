'use client';

import React, { useState } from 'react';
import { ResultSubmissionModal } from './ResultSubmissionModal';

/**
 * Phase 17: Web Bracket & Match Engine Viewer Component
 *
 * Visualizes:
 *  - Knockout Bracket tree with multiple rounds (Round of 16, Quarterfinals, Semifinals, Finals)
 *  - Combatant seeds, byes, scores, and winner indicators
 *  - Secure Room Code Release Tile (hidden until release time, checked-in only)
 *  - Interactive round selection & match status chips
 */

export interface Participant {
  name: string;
  seed?: number | null;
  score?: number | null;
  is_winner?: boolean | null;
}

export interface MatchNode {
  id: string;
  match_number: number;
  stage: string;
  status: 'SCHEDULED' | 'LOBBY_READY' | 'LIVE' | 'RESULT_SUBMITTED' | 'CONFIRMED' | 'DISPUTED' | 'FINAL' | 'CANCELLED';
  participant_a: Participant | null;
  participant_b: Participant | null;
  bye_awarded?: boolean;
  room_code_status: 'LOCKED_UNTIL_RELEASE_TIME' | 'RELEASED_VERIFIED' | 'RESTRICTED_TO_CHECKED_IN_PARTICIPANTS';
  room_id?: string | null;
  room_password?: string | null;
  room_release_time?: string | null;
}

export interface RoundGroup {
  round_number: number;
  stage: string;
  title: string;
  matches: MatchNode[];
}

export interface BracketViewerProps {
  tournamentTitle: string;
  format?: string;
  rounds?: RoundGroup[];
}

export const defaultMockRounds: RoundGroup[] = [
  {
    round_number: 1,
    stage: 'ROUND_OF_16',
    title: 'Round of 16',
    matches: [
      {
        id: 'm-101',
        match_number: 1,
        stage: 'Round of 16',
        status: 'FINAL',
        participant_a: { name: 'Team Soul', seed: 1, score: 2, is_winner: true },
        participant_b: { name: 'GodLike Esports', seed: 16, score: 0, is_winner: false },
        bye_awarded: false,
        room_code_status: 'RELEASED_VERIFIED',
        room_id: 'ROOM-77881',
        room_password: 'PASS-SOUL-WIN',
      },
      {
        id: 'm-102',
        match_number: 2,
        stage: 'Round of 16',
        status: 'FINAL',
        participant_a: { name: 'Blind Esports', seed: 8, score: 2, is_winner: true },
        participant_b: { name: 'Revenant X', seed: 9, score: 1, is_winner: false },
        bye_awarded: false,
        room_code_status: 'RELEASED_VERIFIED',
        room_id: 'ROOM-77882',
        room_password: 'PASS-BLIND-WIN',
      },
      {
        id: 'm-103',
        match_number: 3,
        stage: 'Round of 16',
        status: 'FINAL',
        participant_a: { name: 'Team Tamilas', seed: 4, score: 2, is_winner: true },
        participant_b: { name: 'Entity Gaming', seed: 13, score: 1, is_winner: false },
        bye_awarded: false,
        room_code_status: 'RELEASED_VERIFIED',
        room_id: 'ROOM-77883',
        room_password: 'PASS-TAMIL-WIN',
      },
      {
        id: 'm-104',
        match_number: 4,
        stage: 'Round of 16',
        status: 'FINAL',
        participant_a: { name: 'Orangutan Gaming', seed: 5, score: 2, is_winner: true },
        participant_b: { name: 'Global Esports', seed: 12, score: 0, is_winner: false },
        bye_awarded: false,
        room_code_status: 'RELEASED_VERIFIED',
        room_id: 'ROOM-77884',
        room_password: 'PASS-OG-WIN',
      },
    ],
  },
  {
    round_number: 2,
    stage: 'QUARTER_FINALS',
    title: 'Quarterfinals',
    matches: [
      {
        id: 'm-201',
        match_number: 1,
        stage: 'Quarterfinals',
        status: 'LIVE',
        participant_a: { name: 'Team Soul', seed: 1, score: 1, is_winner: null },
        participant_b: { name: 'Blind Esports', seed: 8, score: 1, is_winner: null },
        bye_awarded: false,
        room_code_status: 'RELEASED_VERIFIED',
        room_id: 'ROOM-88991',
        room_password: 'PASS-QF-LIVE',
      },
      {
        id: 'm-202',
        match_number: 2,
        stage: 'Quarterfinals',
        status: 'LOBBY_READY',
        participant_a: { name: 'Team Tamilas', seed: 4, score: 0, is_winner: null },
        participant_b: { name: 'Orangutan Gaming', seed: 5, score: 0, is_winner: null },
        bye_awarded: false,
        room_code_status: 'LOCKED_UNTIL_RELEASE_TIME',
        room_release_time: 'In 5 minutes (8:00 PM UTC)',
      },
    ],
  },
  {
    round_number: 3,
    stage: 'SEMI_FINALS',
    title: 'Semifinals',
    matches: [
      {
        id: 'm-301',
        match_number: 1,
        stage: 'Semifinals',
        status: 'SCHEDULED',
        participant_a: { name: 'Winner of QF 1', seed: null, score: 0, is_winner: null },
        participant_b: { name: 'Winner of QF 2', seed: null, score: 0, is_winner: null },
        bye_awarded: false,
        room_code_status: 'LOCKED_UNTIL_RELEASE_TIME',
        room_release_time: 'Tomorrow, 5:00 PM UTC',
      },
    ],
  },
  {
    round_number: 4,
    stage: 'FINALS',
    title: 'Grand Finals',
    matches: [
      {
        id: 'm-401',
        match_number: 1,
        stage: 'Grand Finals',
        status: 'SCHEDULED',
        participant_a: { name: 'Winner of SF 1', seed: null, score: 0, is_winner: null },
        participant_b: { name: 'Winner of SF 2', seed: null, score: 0, is_winner: null },
        bye_awarded: false,
        room_code_status: 'LOCKED_UNTIL_RELEASE_TIME',
        room_release_time: 'Tomorrow, 8:00 PM UTC',
      },
    ],
  },
];

export function BracketViewer({
  tournamentTitle,
  format = 'KNOCKOUT',
  rounds = defaultMockRounds,
}: BracketViewerProps) {
  const [activeRoundIndex, setActiveRoundIndex] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState<MatchNode | null>(null);
  const currentRound = rounds[activeRoundIndex] || rounds[0];

  return (
    <div className="w-full bg-[#0F172A] border border-slate-800 rounded-2xl p-6 text-white shadow-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {format}
            </span>
            <span className="text-xs text-slate-400">16 Teams • Single Elimination</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">{tournamentTitle}</h2>
        </div>

        {/* Security Policy Banner */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300">
          <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Room codes released at server scheduled time to checked-in players only</span>
        </div>
      </div>

      {/* Round Tabs */}
      <div className="flex gap-2 overflow-x-auto py-4 border-b border-slate-800 scrollbar-none">
        {rounds.map((round, idx) => (
          <button
            key={round.round_number}
            onClick={() => setActiveRoundIndex(idx)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeRoundIndex === idx
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {round.title}
            <span className="ml-2 text-xs opacity-60">({round.matches.length})</span>
          </button>
        ))}
      </div>

      {/* Matches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {currentRound?.matches.map((match) => (
          <div
            key={match.id}
            className={`bg-slate-900/90 border rounded-xl overflow-hidden transition-all hover:border-slate-700 ${
              match.status === 'LIVE' ? 'border-red-500/50 shadow-lg shadow-red-500/10' : 'border-slate-800'
            }`}
          >
            {/* Match Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 text-xs">
              <span className="font-mono font-semibold text-slate-300">Match #{match.match_number}</span>
              <div className="flex items-center gap-2">
                {match.bye_awarded && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    BYE
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    match.status === 'LIVE'
                      ? 'bg-red-500/20 text-red-400 animate-pulse'
                      : match.status === 'FINAL'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : match.status === 'LOBBY_READY'
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {match.status}
                </span>
              </div>
            </div>

            {/* Combatants */}
            <div className="p-4 space-y-2.5">
              {/* Participant A */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {match.participant_a?.seed && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      #{match.participant_a.seed}
                    </span>
                  )}
                  <span className={`text-sm ${match.participant_a?.is_winner ? 'font-bold text-emerald-400' : 'text-slate-200'}`}>
                    {match.participant_a?.name || 'TBD'}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-slate-300">
                  {match.participant_a?.score !== null && match.participant_a?.score !== undefined ? match.participant_a.score : '-'}
                </span>
              </div>

              <div className="h-px bg-slate-800 w-full" />

              {/* Participant B */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {match.participant_b?.seed && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      #{match.participant_b.seed}
                    </span>
                  )}
                  <span className={`text-sm ${match.participant_b?.is_winner ? 'font-bold text-emerald-400' : 'text-slate-200'}`}>
                    {match.participant_b?.name || 'TBD'}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-slate-300">
                  {match.participant_b?.score !== null && match.participant_b?.score !== undefined ? match.participant_b.score : '-'}
                </span>
              </div>
            </div>

            {/* Room Credentials Banner */}
            <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs">
              {match.room_code_status === 'RELEASED_VERIFIED' ? (
                <div className="flex items-center justify-between text-emerald-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    <span>ID: {match.room_id} • PASS: {match.room_password}</span>
                  </div>
                  <span className="text-[10px] uppercase font-sans font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                    Unlocked
                  </span>
                </div>
              ) : match.room_code_status === 'LOCKED_UNTIL_RELEASE_TIME' ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="truncate">Release at: {match.room_release_time}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Room code restricted to verified match combatants</span>
                </div>
              )}
            </div>

            {/* Result Action Bar */}
            {(match.status === 'LIVE' || match.status === 'RESULT_SUBMITTED' || match.status === 'DISPUTED') && (
              <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-semibold">
                  {match.status === 'DISPUTED'
                    ? 'Dispute hold active'
                    : match.status === 'RESULT_SUBMITTED'
                    ? 'Awaiting opponent review'
                    : 'Match in progress'}
                </span>
                <button
                  onClick={() => setSelectedMatch(match)}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    match.status === 'DISPUTED'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                      : match.status === 'RESULT_SUBMITTED'
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/40'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500'
                  }`}
                >
                  {match.status === 'RESULT_SUBMITTED' ? 'Review Result' : 'Submit Result'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Result Submission & Verification Modal */}
      {selectedMatch && (
        <ResultSubmissionModal
          isOpen={true}
          onClose={() => setSelectedMatch(null)}
          matchId={selectedMatch.id}
          tournamentTitle={tournamentTitle}
          isReviewingOpponent={selectedMatch.status === 'RESULT_SUBMITTED'}
          onSubmitSuccess={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}
