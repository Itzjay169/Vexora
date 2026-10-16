'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface LiveLeaderboardRow {
  rank: number;
  teamName: string;
  kills: number;
  placementPoints: number;
  totalPoints: number;
  status: 'ALIVE' | 'ELIMINATED';
  trend: 'UP' | 'DOWN' | 'SAME';
}

interface LiveFeedEvent {
  id: string;
  sequence: number;
  text: string;
  time: string;
  type: 'KILL' | 'FINAL' | 'STATUS';
}

export default function WebLiveBoardPage() {
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'RECONNECTING' | 'DEGRADED_POLLING'>('CONNECTED');
  const [currentSequence, setCurrentSequence] = useState<number>(8425);
  const [latencyMs, setLatencyMs] = useState<number>(24);

  const [leaderboard, setLeaderboard] = useState<LiveLeaderboardRow[]>([
    { rank: 1, teamName: 'Team Soul', kills: 18, placementPoints: 15, totalPoints: 33, status: 'ALIVE', trend: 'UP' },
    { rank: 2, teamName: 'GodLike Esports', kills: 14, placementPoints: 12, totalPoints: 26, status: 'ALIVE', trend: 'SAME' },
    { rank: 3, teamName: 'Reckoning Esports', kills: 9, placementPoints: 10, totalPoints: 19, status: 'ALIVE', trend: 'UP' },
    { rank: 4, teamName: 'Blind Esports', kills: 8, placementPoints: 8, totalPoints: 16, status: 'ELIMINATED', trend: 'DOWN' },
    { rank: 5, teamName: 'Entity Gaming', kills: 5, placementPoints: 6, totalPoints: 11, status: 'ELIMINATED', trend: 'DOWN' },
  ]);

  const [feedEvents, setFeedEvents] = useState<LiveFeedEvent[]>([
    { id: '1', sequence: 8425, text: 'Team Soul took down Blind Esports (Match Final 2 Teams Remaining)', time: 'Just now', type: 'KILL' },
    { id: '2', sequence: 8424, text: 'Lobby 4 — Zone 6 Collapse Active', time: '1m ago', type: 'STATUS' },
    { id: '3', sequence: 8423, text: 'GodLike Esports eliminated Entity Gaming', time: '2m ago', type: 'KILL' },
  ]);

  // Simulate network disconnect / recovery
  const simulateNetworkDrop = () => {
    setConnectionStatus('RECONNECTING');
    setTimeout(() => {
      setConnectionStatus('DEGRADED_POLLING');
      setTimeout(() => {
        // Auto-reconnect and replay missed events
        setConnectionStatus('CONNECTED');
        setCurrentSequence((prev) => prev + 2);
        setFeedEvents((prev) => [
          {
            id: String(Date.now()),
            sequence: currentSequence + 2,
            text: 'Replay complete: 2 missed events received from sequence #' + currentSequence,
            time: 'Just now',
            type: 'STATUS',
          },
          ...prev,
        ]);
      }, 2500);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#07080D] text-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation & Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800/80 pb-5">
          <div>
            <Link href="/" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 mb-1">
              ← Back to Discovery
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>📡</span> Live Tournament Board & Leaderboard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={simulateNetworkDrop}
              className="px-3 py-1.5 rounded-lg border border-gray-800 bg-gray-900/60 hover:bg-gray-800 text-xs font-semibold text-gray-300 transition-colors"
            >
              Simulate Network Flake
            </button>

            <div
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : connectionStatus === 'RECONNECTING'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'CONNECTED'
                    ? 'bg-emerald-400 animate-pulse'
                    : connectionStatus === 'RECONNECTING'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-red-400'
                }`}
              ></span>
              <span>
                {connectionStatus === 'CONNECTED'
                  ? `LIVE • Seq #${currentSequence} (${latencyMs}ms)`
                  : connectionStatus === 'RECONNECTING'
                  ? 'RECONNECTING...'
                  : 'DEGRADED (READ-ONLY POLLING)'}
              </span>
            </div>
          </div>
        </div>

        {/* Degraded Banner */}
        {connectionStatus === 'DEGRADED_POLLING' && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <strong>Degraded Fallback Mode Active:</strong> WebSocket connection dropped. The client is temporarily operating in read-only polling mode to preserve battery and maintain scoreboard visibility until socket reconnection succeeds.
            </div>
          </div>
        )}

        {/* Match Header Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950 border border-gray-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span> MATCH LIVE
              </span>
              <span className="text-xs font-mono text-gray-400">Match #10 • Erangel</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">BGMI Summer Cup 2026 — Grand Finals Round 3</h2>
            <p className="text-xs text-gray-400 mt-0.5">Organised by Pro Circuit Esports • Verified Prize Escrow Active</p>
          </div>

          <div className="flex gap-4 text-center border-t md:border-t-0 md:border-l border-gray-800 pt-3 md:pt-0 md:pl-6">
            <div>
              <span className="text-[10px] text-gray-400 uppercase">Teams Left</span>
              <div className="text-2xl font-black text-emerald-400">2 / 16</div>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase">Alive Players</span>
              <div className="text-2xl font-black text-white">7 / 64</div>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase">Outbox Seq</span>
              <div className="text-2xl font-mono font-bold text-cyan-400">#{currentSequence}</div>
            </div>
          </div>
        </div>

        {/* Main Grid: Leaderboard & Live Action Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard Table */}
          <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🏆</span> Live Standings
              </h3>
              <span className="text-xs text-emerald-400 font-mono">Updates automatically via WSS</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-950/80 text-xs uppercase text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-3 py-2.5">Rank</th>
                    <th className="px-3 py-2.5">Team</th>
                    <th className="px-3 py-2.5">Kills</th>
                    <th className="px-3 py-2.5">Placement</th>
                    <th className="px-3 py-2.5">Total Points</th>
                    <th className="px-3 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-mono text-xs">
                  {leaderboard.map((row) => (
                    <tr key={row.teamName} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-3 py-3 font-bold text-white">
                        {row.rank === 1 ? '🥇 1' : row.rank === 2 ? '🥈 2' : row.rank === 3 ? '🥉 3' : row.rank}
                      </td>
                      <td className="px-3 py-3 font-sans font-bold text-white flex items-center gap-1.5">
                        <span>{row.teamName}</span>
                        {row.trend === 'UP' && <span className="text-emerald-400 text-[10px]">▲</span>}
                        {row.trend === 'DOWN' && <span className="text-red-400 text-[10px]">▼</span>}
                      </td>
                      <td className="px-3 py-3 text-cyan-300">{row.kills}</td>
                      <td className="px-3 py-3 text-gray-400">{row.placementPoints}</td>
                      <td className="px-3 py-3 font-bold text-emerald-400 text-sm">{row.totalPoints}</td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            row.status === 'ALIVE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-gray-800 text-gray-500'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real-Time Live Feed */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>⚡</span> Match Action Feed
            </h3>

            <div className="space-y-3 font-mono text-xs">
              {feedEvents.map((evt) => (
                <div key={evt.id} className="p-3 rounded-xl bg-gray-950/80 border border-gray-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span className="text-cyan-400 font-bold">Seq #{evt.sequence}</span>
                    <span>{evt.time}</span>
                  </div>
                  <p className="font-sans text-xs text-gray-200">{evt.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
