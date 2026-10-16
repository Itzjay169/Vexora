'use client';

import React, { useState } from 'react';

export interface PlayerOverview {
  matchesPlayed: number;
  wins: number;
  podiums: number;
  totalKills: number;
  totalPoints: number;
  winRate: number;
  averagePlacement: number;
  pointsPerMatch: number;
  killsPerMatch: number;
}

export interface RecentFormMatch {
  matchId: string;
  tournamentTitle: string;
  gameSlug: string;
  gameName: string;
  placement: number;
  kills: number;
  points: number;
  outcome: 'WWCD' | 'PODIUM' | 'TOP_5' | 'COMPLETED';
  timestamp: string;
}

export interface PlayerDashboardData {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  country?: string;
  fairPlayScore: number;
  profileVisibility: 'PUBLIC' | 'PRIVATE' | 'FRIENDS_ONLY';
  isPrivate: boolean;
  statsHidden: boolean;
  overview?: PlayerOverview;
  recentForm?: RecentFormMatch[];
  tournamentHistory?: Array<{ id: string; title: string; placement: string; status: string; date: string }>;
  teamHistory?: Array<{ team: string; tag: string; role: string; period: string }>;
}

export interface PlayerDashboardViewerProps {
  initialData?: PlayerDashboardData;
}

const mockDefaultData: PlayerDashboardData = {
  userId: 'u-101',
  username: 'ShadowSlayer',
  displayName: 'Aarav Sharma',
  fairPlayScore: 100,
  profileVisibility: 'PUBLIC',
  isPrivate: false,
  statsHidden: false,
  overview: {
    matchesPlayed: 24,
    wins: 8,
    podiums: 15,
    totalKills: 112,
    totalPoints: 284,
    winRate: 33.33,
    averagePlacement: 2.8,
    pointsPerMatch: 11.83,
    killsPerMatch: 4.67,
  },
  recentForm: [
    { matchId: 'm-1', tournamentTitle: 'Vexora Inaugural BGMI Cup', gameSlug: 'bgmi', gameName: 'BGMI', placement: 1, kills: 9, points: 19, outcome: 'WWCD', timestamp: '2026-10-15T12:00:00Z' },
    { matchId: 'm-2', tournamentTitle: 'Vexora Inaugural BGMI Cup', gameSlug: 'bgmi', gameName: 'BGMI', placement: 2, kills: 6, points: 12, outcome: 'PODIUM', timestamp: '2026-10-14T18:00:00Z' },
    { matchId: 'm-3', tournamentTitle: 'Apex Champions League', gameSlug: 'bgmi', gameName: 'BGMI', placement: 1, kills: 11, points: 21, outcome: 'WWCD', timestamp: '2026-10-13T16:00:00Z' },
    { matchId: 'm-4', tournamentTitle: 'Apex Champions League', gameSlug: 'bgmi', gameName: 'BGMI', placement: 3, kills: 4, points: 9, outcome: 'PODIUM', timestamp: '2026-10-12T14:00:00Z' },
    { matchId: 'm-5', tournamentTitle: 'Fall Invitational', gameSlug: 'bgmi', gameName: 'BGMI', placement: 5, kills: 3, points: 6, outcome: 'TOP_5', timestamp: '2026-10-10T20:00:00Z' },
  ],
  tournamentHistory: [
    { id: 't-1', title: 'Vexora Inaugural BGMI Cup', placement: '1st Place (WWCD)', status: 'FINAL', date: 'Oct 2026' },
    { id: 't-2', title: 'Apex Champions League', placement: '2nd Place', status: 'FINAL', date: 'Sep 2026' },
    { id: 't-3', title: 'Fall Invitational Series', placement: '3rd Place', status: 'FINAL', date: 'Aug 2026' },
  ],
  teamHistory: [
    { team: 'Team Velocity', tag: 'VEL', role: 'CAPTAIN', period: 'Active' },
    { team: 'Phoenix Rising', tag: 'PHX', role: 'PLAYER', period: 'Season 0' },
  ],
};

export const PlayerDashboardViewer: React.FC<PlayerDashboardViewerProps> = ({
  initialData = mockDefaultData,
}) => {
  const [data] = useState<PlayerDashboardData>(initialData);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(`https://vexora.gg/player/${data.username}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (data.isPrivate) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">This Profile is Private</h2>
          <p className="text-sm text-slate-400">
            @{data.username} has set their competitive performance identity to private. Detailed metrics and history are protected by Vexora privacy controls.
          </p>
        </div>
      </div>
    );
  }

  const overview = data.overview || mockDefaultData.overview!;
  const recentForm = data.recentForm || mockDefaultData.recentForm!;

  return (
    <div className="w-full bg-[#0A0F1D] text-slate-100 min-h-screen py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Identity Header */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-3xl font-black text-white shadow-lg border border-indigo-400/30">
              {data.username.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">{data.username}</h1>
                <span className="p-1 text-cyan-400" title="Verified Competitive Profile">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              </div>
              <p className="text-sm text-slate-400">{data.displayName} • Member since 2026</p>
              
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Fair-Play Score: {data.fairPlayScore}/100
                </span>
                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-semibold rounded-md border border-slate-700">
                  Tier: Diamond Competitor
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Competitive Passport
            </button>
          </div>
        </div>

        {/* 6 Core Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Matches Played', val: overview.matchesPlayed, sub: 'All Seasons', color: 'text-white' },
            { label: 'Win Rate', val: `${overview.winRate}%`, sub: `${overview.wins} Victories`, color: 'text-indigo-400' },
            { label: 'First Place (WWCD)', val: overview.wins, sub: 'Trophy Finishes', color: 'text-amber-400' },
            { label: 'Podiums (Top 3)', val: overview.podiums, sub: '62.5% Rate', color: 'text-slate-300' },
            { label: 'Total Kills', val: overview.totalKills, sub: `${overview.killsPerMatch} Kills/Match`, color: 'text-rose-400' },
            { label: 'Average Placement', val: `#${overview.averagePlacement}`, sub: 'Consistency', color: 'text-emerald-400' },
          ].map((card, idx) => (
            <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</span>
              <div className="my-2">
                <span className={`text-2xl font-black ${card.color}`}>{card.val}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">{card.sub}</span>
            </div>
          ))}
        </div>

        {/* Recent Form Streak */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Recent Match Form</h2>
              <p className="text-xs text-slate-400">Chronological placement and scoring in recent official matches</p>
            </div>
            <span className="text-xs text-slate-500">{recentForm.length} Matches Logged</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {recentForm.map((m, idx) => {
              const isWin = m.placement === 1;
              const isPodium = m.placement <= 3;
              const border = isWin ? 'border-amber-500/60 bg-amber-500/10' : (isPodium ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-slate-800 bg-slate-950');
              const badgeColor = isWin ? 'text-amber-400' : (isPodium ? 'text-indigo-400' : 'text-slate-400');

              return (
                <div key={idx} className={`p-4 rounded-xl border ${border} flex flex-col justify-between`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-300">{m.gameName}</span>
                    <span className={`text-xs font-bold ${badgeColor}`}>
                      {isWin ? 'WWCD #1' : `#${m.placement}`}
                    </span>
                  </div>
                  <div className="my-3">
                    <div className="text-xs text-slate-400 truncate">{m.tournamentTitle}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{m.kills} Kills recorded</div>
                  </div>
                  <div className="text-xs font-bold text-emerald-400">
                    +{m.points} Points
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two Columns: Tournament History & Team Roster History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Tournament History */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Tournament Participation History</h2>
            <div className="divide-y divide-slate-800">
              {(data.tournamentHistory || mockDefaultData.tournamentHistory!).map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-white">{t.title}</div>
                    <div className="text-xs text-slate-400">{t.placement} • {t.date}</div>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-600/20 text-indigo-400 text-xs font-bold rounded">
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Team Roster History */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Team Roster History</h2>
            <div className="divide-y divide-slate-800">
              {(data.teamHistory || mockDefaultData.teamHistory!).map((team, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-slate-800 text-cyan-400 font-black text-xs rounded border border-slate-700">
                      {team.tag}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-white">{team.team}</div>
                      <div className="text-xs text-slate-400">Role: {team.role}</div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{team.period}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Share Passport Modal */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">Competitive Passport</h3>
                <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500 flex items-center justify-center text-2xl font-black text-white mx-auto">
                  {data.username.charAt(0)}
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{data.username}</div>
                  <div className="text-xs text-slate-400">{data.displayName} • Fair-Play {data.fairPlayScore}%</div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/80 text-xs">
                  <div>
                    <div className="font-bold text-white">{overview.wins}</div>
                    <div className="text-[10px] text-slate-500">WWCD</div>
                  </div>
                  <div>
                    <div className="font-bold text-white">{overview.winRate}%</div>
                    <div className="text-[10px] text-slate-500">WIN RATE</div>
                  </div>
                  <div>
                    <div className="font-bold text-white">{overview.totalPoints}</div>
                    <div className="text-[10px] text-slate-500">TOTAL PTS</div>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl w-32 h-32 mx-auto flex flex-col items-center justify-center">
                  <div className="text-slate-900 font-black text-2xl">VEXORA</div>
                  <div className="text-[8px] text-slate-700 font-mono mt-1">SHA-256 VERIFIED</div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Scan or visit to inspect verified match history and deterministic formula scoring.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCopyLink}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  {copiedLink ? 'Copied to Clipboard!' : 'Copy Verification URL'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
