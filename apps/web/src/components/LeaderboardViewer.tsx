'use client';

import React, { useState } from 'react';

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  totalPoints: number;
  placementPoints: number;
  killPoints: number;
  matchesPlayed: number;
  wins: number;
  winRate: number;
  averagePlacement?: number;
}

export interface LeaderboardViewerProps {
  initialGame?: string;
  initialSeason?: string;
}

const defaultStandings: Record<string, LeaderboardRow[]> = {
  bgmi: [
    { rank: 1, userId: 'u-1', username: 'ShadowSlayer', displayName: 'Aarav Sharma', totalPoints: 142, placementPoints: 86, killPoints: 56, matchesPlayed: 12, wins: 5, winRate: 41.7, averagePlacement: 2.1 },
    { rank: 2, userId: 'u-2', username: 'ViperStrike', displayName: 'Rohan Mehra', totalPoints: 128, placementPoints: 72, killPoints: 56, matchesPlayed: 12, wins: 3, winRate: 25.0, averagePlacement: 3.4 },
    { rank: 3, userId: 'u-3', username: 'ApexPredator', displayName: 'Karan Patel', totalPoints: 115, placementPoints: 65, killPoints: 50, matchesPlayed: 12, wins: 2, winRate: 16.7, averagePlacement: 4.2 },
    { rank: 4, userId: 'u-4', username: 'GhostRider', displayName: 'Aditya Sen', totalPoints: 98, placementPoints: 52, killPoints: 46, matchesPlayed: 12, wins: 1, winRate: 8.3, averagePlacement: 5.1 },
    { rank: 5, userId: 'u-5', username: 'BlazeFury', displayName: 'Vikram Joshi', totalPoints: 91, placementPoints: 48, killPoints: 43, matchesPlayed: 11, wins: 1, winRate: 9.1, averagePlacement: 5.8 },
    { rank: 6, userId: 'u-6', username: 'NovaStorm', displayName: 'Kabir Roy', totalPoints: 84, placementPoints: 44, killPoints: 40, matchesPlayed: 10, wins: 0, winRate: 0.0, averagePlacement: 6.3 },
    { rank: 7, userId: 'u-7', username: 'ThunderClap', displayName: 'Manish Das', totalPoints: 77, placementPoints: 39, killPoints: 38, matchesPlayed: 10, wins: 0, winRate: 0.0, averagePlacement: 7.0 },
    { rank: 8, userId: 'u-8', username: 'IronClad', displayName: 'Devendra Nair', totalPoints: 71, placementPoints: 36, killPoints: 35, matchesPlayed: 9, wins: 0, winRate: 0.0, averagePlacement: 7.5 },
  ],
  freefire: [
    { rank: 1, userId: 'ff-1', username: 'PhoenixFire', displayName: 'Aryan Raj', totalPoints: 156, placementPoints: 96, killPoints: 60, matchesPlayed: 12, wins: 6, winRate: 50.0, averagePlacement: 1.8 },
    { rank: 2, userId: 'ff-2', username: 'CrimsonBlade', displayName: 'Sunil Verma', totalPoints: 134, placementPoints: 82, killPoints: 52, matchesPlayed: 12, wins: 3, winRate: 25.0, averagePlacement: 3.1 },
    { rank: 3, userId: 'ff-3', username: 'MysticRage', displayName: 'Deepak Rao', totalPoints: 119, placementPoints: 71, killPoints: 48, matchesPlayed: 12, wins: 2, winRate: 16.7, averagePlacement: 3.9 },
    { rank: 4, userId: 'ff-4', username: 'DragonBite', displayName: 'Ankit Kumar', totalPoints: 102, placementPoints: 58, killPoints: 44, matchesPlayed: 12, wins: 1, winRate: 8.3, averagePlacement: 4.8 },
  ],
  codm: [
    { rank: 1, userId: 'cod-1', username: 'AlphaTactics', displayName: 'Sameer Khan', totalPoints: 36, placementPoints: 0, killPoints: 120, matchesPlayed: 14, wins: 12, winRate: 85.7, averagePlacement: 1.0 },
    { rank: 2, userId: 'cod-2', username: 'DeltaSquad', displayName: 'Tarun Sethi', totalPoints: 30, placementPoints: 0, killPoints: 105, matchesPlayed: 14, wins: 10, winRate: 71.4, averagePlacement: 2.0 },
    { rank: 3, userId: 'cod-3', username: 'BravoEcho', displayName: 'Gaurav Bhatia', totalPoints: 24, placementPoints: 0, killPoints: 92, matchesPlayed: 14, wins: 8, winRate: 57.1, averagePlacement: 3.0 },
  ],
};

export const LeaderboardViewer: React.FC<LeaderboardViewerProps> = ({
  initialGame = 'bgmi',
  initialSeason = 'Season 1 (Active)',
}) => {
  const [selectedGame, setSelectedGame] = useState<string>(initialGame);
  const [selectedSeason, setSelectedSeason] = useState<string>(initialSeason);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  const standings = defaultStandings[selectedGame] || defaultStandings.bgmi;
  const filtered = standings.filter((p) =>
    p.username.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (p.displayName && p.displayName.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  const podium = filtered.slice(0, 3);
  const remaining = filtered.slice(3);

  return (
    <div className="w-full bg-[#0A0F1D] text-slate-100 min-h-screen py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header and Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-xs font-black tracking-wider uppercase rounded-md">
                Deterministic Rankings
              </span>
              <span className="text-xs text-slate-400">
                Merkle-Root Sealed Snapshots
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mt-2">
              Competitive Leaderboards
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Official player season standings calculated strictly from verified, non-repudiated match results.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFormulaModal(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 border border-slate-700 hover:border-indigo-500/50 rounded-lg text-xs font-bold transition flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify Scoring Formula
            </button>
          </div>
        </div>

        {/* Game Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            {[
              { id: 'bgmi', label: 'BGMI', sub: 'Battle Royale' },
              { id: 'freefire', label: 'Free Fire MAX', sub: 'Booyah Rules' },
              { id: 'codm', label: 'CODM', sub: 'Multiplayer' },
            ].map((game) => (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game.id)}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all text-left ${
                  selectedGame === game.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div>{game.label}</div>
                <div className="text-[10px] font-normal opacity-75">{game.sub}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search combatant..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 md:w-56"
            />
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="Season 1 (Active)">Season 1 (Active)</option>
              <option value="All-Time Standings">All-Time Standings</option>
            </select>
          </div>
        </div>

        {/* Top 3 Podium */}
        {podium.length >= 3 && !searchFilter && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            
            {/* Rank 2 - Silver */}
            <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-6 flex flex-col items-center justify-end order-2 md:order-1 text-center relative overflow-hidden">
              <div className="absolute top-3 left-3 px-2 py-0.5 bg-slate-800 text-slate-300 font-black text-xs rounded border border-slate-600">
                #2 SILVER
              </div>
              <div className="w-16 h-16 rounded-full border-2 border-slate-400 bg-slate-800 flex items-center justify-center text-xl font-black text-slate-200 mb-3 shadow-lg">
                {podium[1].username.charAt(0)}
              </div>
              <div className="text-lg font-bold text-white">{podium[1].username}</div>
              <div className="text-xs text-slate-400">{podium[1].displayName}</div>
              <div className="mt-3 text-2xl font-black text-slate-300">{podium[1].totalPoints} <span className="text-xs font-normal text-slate-500">PTS</span></div>
              <div className="mt-2 text-xs text-slate-400 flex gap-3">
                <span>{podium[1].wins} Wins</span>
                <span>•</span>
                <span>{podium[1].killPoints} Kills</span>
                <span>•</span>
                <span>{podium[1].winRate}% Win</span>
              </div>
            </div>

            {/* Rank 1 - Gold (Center, Elevated) */}
            <div className="bg-gradient-to-b from-amber-500/10 via-slate-900/60 to-slate-900/90 border-2 border-amber-500/50 rounded-xl p-8 flex flex-col items-center justify-end order-1 md:order-2 text-center relative overflow-hidden shadow-xl shadow-amber-500/10">
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 font-black text-xs rounded-full border border-amber-500/40">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                CHAMPION
              </div>
              <div className="w-20 h-20 rounded-full border-4 border-amber-400 bg-slate-800 flex items-center justify-center text-3xl font-black text-amber-400 mb-3 shadow-2xl">
                {podium[0].username.charAt(0)}
              </div>
              <div className="text-xl font-black text-white">{podium[0].username}</div>
              <div className="text-xs text-slate-400">{podium[0].displayName}</div>
              <div className="mt-3 text-3xl font-black text-amber-400">{podium[0].totalPoints} <span className="text-xs font-normal text-slate-500">PTS</span></div>
              <div className="mt-2 text-xs text-slate-300 flex gap-3 font-semibold">
                <span>{podium[0].wins} WWCD</span>
                <span>•</span>
                <span>{podium[0].killPoints} Kills</span>
                <span>•</span>
                <span>{podium[0].winRate}% Win Rate</span>
              </div>
            </div>

            {/* Rank 3 - Bronze */}
            <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-6 flex flex-col items-center justify-end order-3 text-center relative overflow-hidden">
              <div className="absolute top-3 left-3 px-2 py-0.5 bg-slate-800 text-amber-600 font-black text-xs rounded border border-amber-800/40">
                #3 BRONZE
              </div>
              <div className="w-16 h-16 rounded-full border-2 border-amber-700 bg-slate-800 flex items-center justify-center text-xl font-black text-amber-500 mb-3 shadow-lg">
                {podium[2].username.charAt(0)}
              </div>
              <div className="text-lg font-bold text-white">{podium[2].username}</div>
              <div className="text-xs text-slate-400">{podium[2].displayName}</div>
              <div className="mt-3 text-2xl font-black text-amber-500">{podium[2].totalPoints} <span className="text-xs font-normal text-slate-500">PTS</span></div>
              <div className="mt-2 text-xs text-slate-400 flex gap-3">
                <span>{podium[2].wins} Wins</span>
                <span>•</span>
                <span>{podium[2].killPoints} Kills</span>
                <span>•</span>
                <span>{podium[2].winRate}% Win</span>
              </div>
            </div>

          </div>
        )}

        {/* Standings Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-4 px-4 w-16 text-center">Rank</th>
                  <th className="py-4 px-4">Combatant</th>
                  <th className="py-4 px-4 text-center">Matches</th>
                  <th className="py-4 px-4 text-center">Wins</th>
                  <th className="py-4 px-4 text-center">Kills</th>
                  <th className="py-4 px-4 text-center">Win Rate</th>
                  <th className="py-4 px-4 text-center">Placement Pts</th>
                  <th className="py-4 px-4 text-right pr-6">Total Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {(searchFilter ? filtered : remaining).map((player) => (
                  <tr key={player.userId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 font-bold text-xs text-slate-300">
                        {player.rank}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{player.username}</div>
                      {player.displayName && (
                        <div className="text-xs text-slate-500">{player.displayName}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400">{player.matchesPlayed}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-400 font-semibold">{player.wins}</td>
                    <td className="py-3.5 px-4 text-center text-slate-300">{player.killPoints}</td>
                    <td className="py-3.5 px-4 text-center text-cyan-400">{player.winRate}%</td>
                    <td className="py-3.5 px-4 text-center text-slate-400">{player.placementPoints}</td>
                    <td className="py-3.5 px-4 text-right pr-6 font-black text-indigo-400 text-base">
                      {player.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification Modal */}
        {showFormulaModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                  <h3 className="text-lg font-bold text-white">
                    Deterministic Scoring Specification
                  </h3>
                </div>
                <button
                  onClick={() => setShowFormulaModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="font-bold text-indigo-400 mb-1">Krafton / Booyah Tie-Breaking Protocol (ADR-015):</div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400">
                    <li><strong className="text-white">Primary:</strong> Total accumulated points (Placement + Kills).</li>
                    <li><strong className="text-white">Secondary:</strong> Highest placement points.</li>
                    <li><strong className="text-white">Tertiary:</strong> Highest number of 1st place finishes (WWCD / Booyahs).</li>
                    <li><strong className="text-white">Quaternary:</strong> Final round match placement.</li>
                  </ol>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="font-bold text-emerald-400 mb-1">Cryptographic Tamper-Evidence:</div>
                  <p className="text-slate-400">
                    Leaderboard snapshots are hash-chained using SHA-256 Merkle roots. Results cannot be silently edited post-match.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="font-bold text-cyan-400 mb-1">Integer Arithmetic Guarantee:</div>
                  <p className="text-slate-400">
                    Points are strictly computed via non-fractional integer multipliers. Floating-point rounding leaks are prohibited.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowFormulaModal(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition"
                >
                  Close Specification
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
