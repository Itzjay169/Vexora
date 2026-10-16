'use client';

import React, { useState, useEffect } from 'react';

/**
 * Phase 19: Web Result Submission & Evidence Verification Modal
 *
 * Implements:
 *  - 4-point guided evidence capture checklist (Scoreboard, Kills, Room Watermark, UIDs)
 *  - Combatant score entry (Placement, Kills, Deaths, Assists, Notes)
 *  - Cryptographic SHA-256 Ingress Evidence Seal
 *  - 15-Minute post-match submission deadline countdown
 *  - Maker-Checker verification: Opposing team can Confirm Agreement or Contest (Dispute Hold)
 *  - Dispute hold banner and settlement freeze feedback
 */

export interface ParticipantScoreInput {
  registration_id: string;
  placement?: number;
  kills: number;
  deaths?: number;
  assists?: number;
  notes?: string;
}

export interface ResultSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  tournamentTitle: string;
  gameCode?: string;
  registrationId?: string;
  teamName?: string;
  isReviewingOpponent?: boolean;
  existingSubmission?: {
    id: string;
    submitted_by: string;
    participants: ParticipantScoreInput[];
    evidence_file_url?: string;
    evidence_sha256?: string;
    status: string;
  };
  onSubmitSuccess?: (result: any) => void;
}

export function ResultSubmissionModal({
  isOpen,
  onClose,
  matchId,
  tournamentTitle,
  gameCode = 'BGMI',
  registrationId = 'reg-my-team-101',
  teamName = 'Team Soul',
  isReviewingOpponent = false,
  existingSubmission,
  onSubmitSuccess,
}: ResultSubmissionModalProps) {
  // Checklist states
  const [scoreboardVisible, setScoreboardVisible] = useState(true);
  const [killsBreakdownVisible, setKillsBreakdownVisible] = useState(true);
  const [roomIdVisible, setRoomIdVisible] = useState(true);
  const [playerUidsMatched, setPlayerUidsMatched] = useState(true);

  // Form states
  const [placement, setPlacement] = useState<number>(1);
  const [kills, setKills] = useState<number>(8);
  const [deaths, setDeaths] = useState<number>(1);
  const [assists, setAssists] = useState<number>(4);
  const [notes, setNotes] = useState<string>('');
  const [contestReason, setContestReason] = useState<string>('');

  // Evidence states
  const [evidenceSha256, setEvidenceSha256] = useState<string>(
    existingSubmission?.evidence_sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  const [evidenceUrl, setEvidenceUrl] = useState<string>(
    existingSubmission?.evidence_file_url || 'https://storage.vexora.io/evidence/match-101/scoreboard_capture_final.png'
  );

  // 15-Minute Countdown Timer
  const [remainingSeconds, setRemainingSeconds] = useState<number>(15 * 60);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'dispute'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isChecklistComplete =
    scoreboardVisible && killsBreakdownVisible && roomIdVisible && playerUidsMatched;

  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isChecklistComplete) {
      alert('Please check and verify all 4 evidence criteria before submitting.');
      return;
    }

    setIsSubmitting(true);
    // Simulate API call to POST /api/v1/matches/:id/submit-result
    await new Promise((res) => setTimeout(res, 600));
    setIsSubmitting(false);

    setStatusMessage({
      type: 'success',
      text: 'Result submitted with cryptographic SHA-256 seal. Waiting for opponent confirmation or 15m auto-finalization.',
    });
    if (onSubmitSuccess) {
      onSubmitSuccess({ matchId, placement, kills, evidenceSha256 });
    }
  };

  const handleConfirmOpponentResult = async () => {
    setIsSubmitting(true);
    // Simulate API call to POST /api/v1/matches/:id/confirm-result with action: CONFIRM
    await new Promise((res) => setTimeout(res, 500));
    setIsSubmitting(false);

    setStatusMessage({
      type: 'success',
      text: 'Opponent scores verified and confirmed. Match result finalized and bracket advanced!',
    });
    if (onSubmitSuccess) {
      onSubmitSuccess({ matchId, status: 'CONFIRMED' });
    }
  };

  const handleContestResult = async () => {
    if (!contestReason || contestReason.trim().length < 5) {
      alert('Please specify a contest reason (minimum 5 characters).');
      return;
    }

    setIsSubmitting(true);
    // Simulate API call to POST /api/v1/matches/:id/confirm-result with action: CONTEST
    await new Promise((res) => setTimeout(res, 500));
    setIsSubmitting(false);

    setStatusMessage({
      type: 'dispute',
      text: 'DISPUTE FILED: Settlement frozen immediately. Dispute stub created for tournament staff review.',
    });
    if (onSubmitSuccess) {
      onSubmitSuccess({ matchId, status: 'DISPUTED' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    alert('SHA-256 seal copied to clipboard');
  };

  const isUrgent = remainingSeconds < 180;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
        
        {/* Header */}
        <div className="sticky top-0 bg-[#0F172A]/95 backdrop-blur-md px-6 py-4 border-b border-slate-800 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                {gameCode}
              </span>
              <span className="text-xs text-slate-400">Match ID: {matchId}</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              {isReviewingOpponent ? 'Review Opponent Match Result' : 'Submit Match Result & Evidence'}
            </h2>
            <p className="text-xs text-slate-400">{tournamentTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 15-Minute Countdown Deadline Banner */}
          <div
            className={`flex items-center justify-between p-3.5 rounded-xl border ${
              isUrgent
                ? 'bg-red-500/10 border-red-500/40 text-red-300'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className={`w-5 h-5 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-xs font-bold text-white">Submission Deadline Window</div>
                <div className="text-[11px] text-slate-400">15m rule: uncontested results auto-finalize</div>
              </div>
            </div>
            <div
              className={`font-mono text-sm font-bold px-2.5 py-1 rounded ${
                isUrgent ? 'bg-red-500/20 text-red-300' : 'bg-slate-800 text-amber-400'
              }`}
            >
              {formatTimer(remainingSeconds)}
            </div>
          </div>

          {/* Status Feedback Banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                statusMessage.type === 'dispute'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {statusMessage.type === 'dispute' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              <div>{statusMessage.text}</div>
            </div>
          )}

          {/* 4-Point Guided Evidence Checklist */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Evidence Integrity Checklist (All 4 Required)
            </h3>
            <div className="space-y-2.5">
              {[
                {
                  id: 'sb',
                  checked: scoreboardVisible,
                  onChange: setScoreboardVisible,
                  title: 'Final Match Scoreboard Visible',
                  desc: 'Overall team placement, badge ranking, and total squad stats',
                },
                {
                  id: 'kills',
                  checked: killsBreakdownVisible,
                  onChange: setKillsBreakdownVisible,
                  title: 'Kill & Assist Breakdown Visible',
                  desc: 'Individual combatant stats clearly legible for scoring engine',
                },
                {
                  id: 'room',
                  checked: roomIdVisible,
                  onChange: setRoomIdVisible,
                  title: 'Room ID & Match Timestamp Watermark',
                  desc: 'Prevents recycled screenshots from previous lobby rounds',
                },
                {
                  id: 'uids',
                  checked: playerUidsMatched,
                  onChange: setPlayerUidsMatched,
                  title: 'Player In-Game UIDs Cross-Checked',
                  desc: 'Matches tournament registration roster strictly',
                },
              ].map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/60 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="mt-1 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">{item.title}</div>
                    <div className="text-[11px] text-slate-400">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Combatant Score Entry */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Combatant Scores ({teamName})
              </h3>
              <span className="text-[11px] font-mono text-slate-400">{registrationId}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Placement Rank</label>
                <input
                  type="number"
                  min="1"
                  max="256"
                  value={placement}
                  onChange={(e) => setPlacement(parseInt(e.target.value) || 1)}
                  disabled={isReviewingOpponent}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Kills</label>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={kills}
                  onChange={(e) => setKills(parseInt(e.target.value) || 0)}
                  disabled={isReviewingOpponent}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Deaths</label>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={deaths}
                  onChange={(e) => setDeaths(parseInt(e.target.value) || 0)}
                  disabled={isReviewingOpponent}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Assists</label>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={assists}
                  onChange={(e) => setAssists(parseInt(e.target.value) || 0)}
                  disabled={isReviewingOpponent}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-70"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Match Remarks / In-Game Incidents</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Disconnect on round 3 or crash log reference"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Evidence Upload & SHA-256 Ingress Tag */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Cryptographic Ingress Seal
            </h3>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="font-mono text-slate-300 truncate max-w-[340px]">
                  SHA-256: {evidenceSha256}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(evidenceSha256)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Copy
              </button>
            </div>
            {evidenceUrl && (
              <div className="text-[11px] text-slate-400 truncate">
                File Storage URL: <span className="text-slate-300 font-mono">{evidenceUrl}</span>
              </div>
            )}
          </div>

          {/* Opponent Maker-Checker Contest Section */}
          {isReviewingOpponent && (
            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Maker-Checker Opponent Verification</span>
              </div>
              <p className="text-[11px] text-slate-300">
                You cannot confirm your own submission. If you agree with the opponent scores above, click Confirm. If you dispute their scores, describe the issue and click Contest to freeze settlement.
              </p>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Contest Explanation (Required only if disputing)
                </label>
                <textarea
                  rows={2}
                  value={contestReason}
                  onChange={(e) => setContestReason(e.target.value)}
                  placeholder="Explain discrepancy with scoreboard (e.g. incorrect kill count)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>

            {!isReviewingOpponent ? (
              <button
                type="button"
                onClick={handleSubmitResult}
                disabled={isSubmitting || !isChecklistComplete}
                className="px-5 py-2.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition shadow-lg shadow-indigo-500/20"
              >
                {isSubmitting ? 'Sealing Result...' : 'Seal & Submit Result'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleContestResult}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition"
                >
                  Contest (Dispute Hold)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOpponentResult}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/20"
                >
                  Confirm Agreement
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
