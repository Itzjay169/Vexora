'use client';

import React, { useState } from 'react';

export interface CombatantScore {
  participantId: string;
  identifier: string;
  tag?: string | null;
  placement: number;
  kills: number;
  calculatedPoints: number;
  isWinner: boolean;
}

export interface EvidenceHash {
  id: string;
  sha256: string;
  fileType: string;
  uploadedAt: string;
}

export interface VerificationCertificateData {
  matchId: string;
  tournamentId: string;
  tournamentTitle: string;
  tournamentFormat: string;
  gameName: string;
  gameSlug: string;
  matchStatus: string;
  resultHash: string;
  formulaVersion: {
    schemaId: string;
    mode: string;
    version: string;
    formula: any;
  };
  timestamps: {
    scheduledAt: string;
    submittedAt: string;
    confirmedAt: string;
    verifiedAt: string;
  };
  combatantScores: CombatantScore[];
  evidenceHashes: EvidenceHash[];
  immutabilityGuarantee: {
    auditChainLocked: boolean;
    tamperEvidentSeal: string;
    noSilentEditsAllowed: boolean;
  };
}

export interface ResultVerificationViewerProps {
  initialData?: VerificationCertificateData;
}

const mockDefaultCertificate: VerificationCertificateData = {
  matchId: '00000000-0000-0000-0000-000000000001',
  tournamentId: 't-101',
  tournamentTitle: 'Vexora Inaugural BGMI Cup — Grand Finals',
  tournamentFormat: 'BATTLE_ROYALE_LOBBY',
  gameName: 'Battlegrounds Mobile India',
  gameSlug: 'bgmi',
  matchStatus: 'FINAL',
  resultHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
  formulaVersion: {
    schemaId: 'bgmi-br-schema',
    mode: 'battle-royale-squad',
    version: '1.0.0',
    formula: {
      type: 'KRAFTON_STANDARD_10_POINT',
      placement_points: { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 },
      kill_points: 1,
    },
  },
  timestamps: {
    scheduledAt: '2026-10-15T10:00:00Z',
    submittedAt: '2026-10-15T10:42:15Z',
    confirmedAt: '2026-10-15T10:55:00Z',
    verifiedAt: '2026-10-15T16:00:00Z',
  },
  combatantScores: [
    { participantId: 'p-1', identifier: 'ShadowSlayer', tag: 'VEL', placement: 1, kills: 9, calculatedPoints: 19, isWinner: true },
    { participantId: 'p-2', identifier: 'ViperStrike', tag: 'VIP', placement: 2, kills: 6, calculatedPoints: 12, isWinner: false },
    { participantId: 'p-3', identifier: 'ApexPredator', tag: 'APX', placement: 3, kills: 4, calculatedPoints: 9, isWinner: false },
    { participantId: 'p-4', identifier: 'GhostRider', tag: 'GHO', placement: 4, kills: 3, calculatedPoints: 7, isWinner: false },
    { participantId: 'p-5', identifier: 'NovaStorm', tag: 'NOV', placement: 5, kills: 2, calculatedPoints: 5, isWinner: false },
  ],
  evidenceHashes: [
    {
      id: 'ev-1',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      fileType: 'IMAGE_PNG_SCOREBOARD',
      uploadedAt: '2026-10-15T10:42:00Z',
    },
    {
      id: 'ev-2',
      sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      fileType: 'IMAGE_JPEG_WATERMARK',
      uploadedAt: '2026-10-15T10:42:10Z',
    },
  ],
  immutabilityGuarantee: {
    auditChainLocked: true,
    tamperEvidentSeal: 'SHA-256 MERKLE VERIFIED',
    noSilentEditsAllowed: true,
  },
};

export const ResultVerificationViewer: React.FC<ResultVerificationViewerProps> = ({
  initialData = mockDefaultCertificate,
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  return (
    <div className="w-full bg-[#0A0F1D] text-slate-100 min-h-screen py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Certificate Header Banner */}
        <div className="bg-slate-900/90 border-2 border-emerald-500/40 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-black tracking-wider uppercase rounded">
                  Immutable Result Certificate
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  MATCH #{initialData.matchId.slice(0, 8)}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mt-3">
                {initialData.tournamentTitle}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {initialData.gameName} • {initialData.tournamentFormat} • Adjudication Status: <strong className="text-emerald-400">{initialData.matchStatus}</strong>
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Audit Security</div>
              <div className="text-sm font-black text-emerald-400 mt-0.5">SHA-256 LOCKED</div>
              <div className="text-[10px] text-slate-400 mt-1">Zero Silent Edits</div>
            </div>
          </div>
        </div>

        {/* Cryptographic Result Seal */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Result SHA-256 Digest Seal
            </h2>
            <button
              onClick={() => copyToClipboard(initialData.resultHash, 'result')}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-lg transition"
            >
              {copiedHash === 'result' ? 'Copied!' : 'Copy Hash'}
            </button>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-indigo-400 break-all">
            {initialData.resultHash}
          </div>
          <p className="text-xs text-slate-400">
            Computed over the exact adjudicated combatant scoreboard. Any alteration to points or placements invalidates this seal.
          </p>
        </div>

        {/* Two Columns: Evidence Ingress Hashes & Scoring Formula Version */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Evidence Hashes */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Evidence Files Ingress Hashes ({initialData.evidenceHashes.length})
            </h2>

            <div className="space-y-3">
              {initialData.evidenceHashes.map((ev) => (
                <div key={ev.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">{ev.fileType}</span>
                    <button
                      onClick={() => copyToClipboard(ev.sha256, ev.id)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                    >
                      {copiedHash === ev.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 break-all">
                    {ev.sha256}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring Formula Version */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Deterministic Formula Version
            </h2>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Formula Version:</span>
                <span className="font-mono font-bold text-white">{initialData.formulaVersion.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mode Protocol:</span>
                <span className="font-bold text-slate-200">{initialData.formulaVersion.mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Kill Multiplier:</span>
                <span className="font-bold text-emerald-400">1 pt / kill</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">1st Place Placement Pts:</span>
                <span className="font-bold text-amber-400">10 pts</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between text-slate-400">
                <span>Integer Arithmetic Invariant:</span>
                <span className="text-emerald-400 font-bold">ENFORCED (No floats)</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              All scores reproducible from stored raw combatant inputs.
            </div>
          </div>

        </div>

        {/* Adjudicated Combatant Scoreboard Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Adjudicated Combatant Standings
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-16 text-center">Placement</th>
                  <th className="py-3 px-4">Combatant</th>
                  <th className="py-3 px-4 text-center">Tag</th>
                  <th className="py-3 px-4 text-center">Kills</th>
                  <th className="py-3 px-4 text-right pr-6">Calculated Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {initialData.combatantScores.map((c) => (
                  <tr key={c.participantId} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-center font-bold text-white">
                      {c.placement === 1 ? '🥇 #1' : `#${c.placement}`}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {c.identifier}
                      {c.isWinner && <span className="ml-2 text-xs text-amber-400 font-bold">(Winner)</span>}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-cyan-400 text-xs">{c.tag || '—'}</td>
                    <td className="py-3 px-4 text-center text-slate-300">{c.kills}</td>
                    <td className="py-3 px-4 text-right pr-6 font-black text-indigo-400">
                      {c.calculatedPoints} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
