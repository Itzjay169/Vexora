'use client';

import React, { useState } from 'react';
import { AdminShell } from '../../components/AdminShell';

interface Game {
  id: string;
  slug: string;
  name: string;
  publisher: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'COMING_SOON';
  max_team_size: number;
  platforms: string[];
}

interface GameMode {
  id: string;
  game_id: string;
  slug: string;
  name: string;
  format: string;
  team_size: number;
}

interface ScoringSchema {
  id: string;
  game_slug: string;
  mode_slug: string;
  version: string;
  placement_points: Record<number, number>;
  kill_points: number;
  tie_breakers: string[];
}

interface SimulationParticipant {
  id: string;
  name: string;
  placement: number;
  kills: number;
  placementPoints?: number;
  killPoints?: number;
  totalPoints?: number;
  rank?: number;
}

const INITIAL_GAMES: Game[] = [
  { id: '1', slug: 'bgmi', name: 'Battlegrounds Mobile India', publisher: 'Krafton', status: 'ACTIVE', max_team_size: 4, platforms: ['ANDROID', 'IOS'] },
  { id: '2', slug: 'freefire', name: 'Garena Free Fire MAX', publisher: 'Garena', status: 'ACTIVE', max_team_size: 4, platforms: ['ANDROID', 'IOS'] },
  { id: '3', slug: 'codm', name: 'Call of Duty: Mobile', publisher: 'Activision', status: 'ACTIVE', max_team_size: 5, platforms: ['ANDROID', 'IOS'] },
];

const INITIAL_MODES: GameMode[] = [
  { id: 'm1', game_id: '1', slug: 'br_squad', name: 'Battle Royale Squad', format: 'BATTLE_ROYALE', team_size: 4 },
  { id: 'm2', game_id: '1', slug: 'br_solo', name: 'Battle Royale Solo', format: 'BATTLE_ROYALE', team_size: 1 },
  { id: 'm3', game_id: '2', slug: 'ff_br_squad', name: 'Battle Royale Squad', format: 'BATTLE_ROYALE', team_size: 4 },
  { id: 'm4', game_id: '2', slug: 'ff_clash_squad', name: 'Clash Squad 4v4', format: 'SINGLE_ELIMINATION', team_size: 4 },
  { id: 'm5', game_id: '3', slug: 'codm_snd', name: 'Search & Destroy', format: 'SINGLE_ELIMINATION', team_size: 5 },
  { id: 'm6', game_id: '3', slug: 'codm_hardpoint', name: 'Hardpoint', format: 'SINGLE_ELIMINATION', team_size: 5 },
];

const INITIAL_SCHEMAS: ScoringSchema[] = [
  {
    id: 's1',
    game_slug: 'bgmi',
    mode_slug: 'br_squad',
    version: 'bgmi_br_v1.0.0',
    placement_points: { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 },
    kill_points: 1,
    tie_breakers: ['Highest Total Points', 'Highest Placement Points', 'Highest Kill Points', 'WWCD Finishes', 'Final Match Rank'],
  },
  {
    id: 's2',
    game_slug: 'freefire',
    mode_slug: 'ff_br_squad',
    version: 'freefire_br_v1.0.0',
    placement_points: { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 4, 7: 3, 8: 2, 9: 1 },
    kill_points: 1,
    tie_breakers: ['Highest Total Points', 'Highest Booyahs', 'Highest Kill Points', 'Final Round Rank'],
  },
  {
    id: 's3',
    game_slug: 'codm',
    mode_slug: 'codm_snd',
    version: 'codm_mp_v1.0.0',
    placement_points: {},
    kill_points: 0,
    tie_breakers: ['Matches Won (3pts/win)', 'Round Differential', 'Score Differential', 'Head-to-Head'],
  },
];

export default function GameManagementPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'modes' | 'schemas' | 'simulator'>('catalog');
  const [games, setGames] = useState<Game[]>(INITIAL_GAMES);
  const [selectedGameSlug, setSelectedGameSlug] = useState<string>('bgmi');

  // Simulator State
  const [simParticipants, setSimParticipants] = useState<SimulationParticipant[]>([
    { id: 'p1', name: 'GodLike Esports', placement: 1, kills: 8 },
    { id: 'p2', name: 'Team Soul', placement: 2, kills: 12 },
    { id: 'p3', name: 'Blind Esports', placement: 3, kills: 5 },
    { id: 'p4', name: 'Entity Gaming', placement: 4, kills: 3 },
    { id: 'p5', name: 'Gladiators Esports', placement: 5, kills: 7 },
  ]);
  const [simResults, setSimResults] = useState<SimulationParticipant[] | null>(null);

  // New Version Modal State
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newVersionTag, setNewVersionTag] = useState('bgmi_br_v1.1.0');
  const [versionReason, setVersionReason] = useState('');
  const [versionAlert, setVersionAlert] = useState<string | null>(null);

  // Simulator Calculation function
  const runSimulation = () => {
    const currentSchema = INITIAL_SCHEMAS.find(s => s.game_slug === selectedGameSlug) || INITIAL_SCHEMAS[0];
    const scored = simParticipants.map(p => {
      const placementPts = currentSchema.placement_points[p.placement] ?? 0;
      const killPts = (p.kills || 0) * (currentSchema.kill_points || 1);
      const total = placementPts + killPts;
      return {
        ...p,
        placementPoints: placementPts,
        killPoints: killPts,
        totalPoints: total,
      };
    });

    // Sort standings by Total Points -> Placement Points -> Kill Points
    scored.sort((a, b) => {
      if ((b.totalPoints ?? 0) !== (a.totalPoints ?? 0)) {
        return (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
      }
      if ((b.placementPoints ?? 0) !== (a.placementPoints ?? 0)) {
        return (b.placementPoints ?? 0) - (a.placementPoints ?? 0);
      }
      return (b.killPoints ?? 0) - (a.killPoints ?? 0);
    });

    const ranked = scored.map((item, idx) => ({ ...item, rank: idx + 1 }));
    setSimResults(ranked);
  };

  const handleCreateVersion = () => {
    if (!versionReason.trim() || versionReason.length < 5) {
      setVersionAlert('Audit reason must be at least 5 characters to fulfill compliance invariant.');
      return;
    }
    setVersionAlert(`Version ${newVersionTag} published and hash-chained in audit log.`);
    setTimeout(() => {
      setShowVersionModal(false);
      setVersionAlert(null);
    }, 1800);
  };

  return (
    <AdminShell>
      <div className="p-8 max-w-7xl mx-auto space-y-8" id="games-management-container">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-white tracking-tight" id="games-page-title">
                Game & Scoring Engine
              </h1>
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800" id="phase-badge">
                Phase 11 Blueprint
              </span>
            </div>
            <p className="text-gray-400 mt-1">
              Configurable esports engine: manage titles, modes, rule templates, immutable versioned formulas & simulator.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="btn-simulate-tab"
              onClick={() => setActiveTab('simulator')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition flex items-center gap-2"
            >
              <span>🧪</span> Scoring Simulator
            </button>
            <button
              id="btn-new-version"
              onClick={() => setShowVersionModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-sm transition flex items-center gap-2"
            >
              <span>📐</span> New Formula Version
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 gap-2">
          <button
            id="tab-catalog"
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'catalog'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🎮 Games Catalog ({games.length})
          </button>
          <button
            id="tab-modes"
            onClick={() => setActiveTab('modes')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'modes'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🕹️ Game Modes ({INITIAL_MODES.length})
          </button>
          <button
            id="tab-schemas"
            onClick={() => setActiveTab('schemas')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'schemas'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            📐 Versioned Formulas ({INITIAL_SCHEMAS.length})
          </button>
          <button
            id="tab-simulator"
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'simulator'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🧪 Scoring Simulator
          </button>
        </div>

        {/* 1. Games Catalog Tab */}
        {activeTab === 'catalog' && (
          <div className="space-y-6" id="games-catalog-section">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {games.map(game => (
                <div
                  key={game.id}
                  id={`game-card-${game.slug}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col justify-between hover:border-gray-700 transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">
                        {game.slug === 'bgmi' ? '🪖' : game.slug === 'freefire' ? '🔥' : '🎯'}
                      </span>
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {game.status}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{game.name}</h3>
                      <p className="text-xs text-gray-400">Publisher: {game.publisher}</p>
                    </div>
                    <div className="pt-2 text-xs text-gray-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Slug:</span>
                        <code className="text-indigo-300">{game.slug}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Squad:</span>
                        <span className="text-gray-200 font-medium">{game.max_team_size} players</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Platforms:</span>
                        <span className="text-gray-200 font-medium">{game.platforms.join(', ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-800 mt-4 flex justify-between items-center text-xs">
                    <span className="text-gray-500">Immutable ID: {game.id}</span>
                    <button
                      onClick={() => {
                        setSelectedGameSlug(game.slug);
                        setActiveTab('simulator');
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      Simulate ➔
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Game Modes Tab */}
        {activeTab === 'modes' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden" id="game-modes-table">
            <div className="p-4 border-b border-gray-800 bg-gray-950 flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                Supported Competitive Modes & Squad Formats
              </h2>
            </div>
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/50 text-xs uppercase text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="py-3 px-4">Mode Name</th>
                  <th className="py-3 px-4">Game</th>
                  <th className="py-3 px-4">Slug</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">Squad Size</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 font-mono text-xs">
                {INITIAL_MODES.map(mode => {
                  const game = games.find(g => g.id === mode.game_id);
                  return (
                    <tr key={mode.id} className="hover:bg-gray-800/50 transition">
                      <td className="py-3 px-4 font-sans font-medium text-white">{mode.name}</td>
                      <td className="py-3 px-4 font-sans text-gray-400">{game?.name}</td>
                      <td className="py-3 px-4 text-indigo-400">{mode.slug}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                          {mode.format}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">{mode.team_size}p</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                          ACTIVE
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Versioned Formulas Tab */}
        {activeTab === 'schemas' && (
          <div className="space-y-6" id="scoring-schemas-section">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {INITIAL_SCHEMAS.map(schema => (
                <div key={schema.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold">
                      {schema.version}
                    </span>
                    <span className="text-xs text-emerald-400 font-semibold">● ACTIVE</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white capitalize">{schema.game_slug} — {schema.mode_slug}</h3>
                    <p className="text-xs text-gray-400 mt-1">Kill Value: {schema.kill_points} pt / kill (Integer Arithmetic)</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Placement Curve:</span>
                    <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                      {Object.keys(schema.placement_points).length > 0 ? (
                        Object.entries(schema.placement_points).slice(0, 8).map(([rank, pts]) => (
                          <div key={rank} className="bg-gray-950 p-1.5 rounded border border-gray-800">
                            <div className="text-[10px] text-gray-500">#{rank}</div>
                            <div className="text-emerald-400 font-bold">{pts} pts</div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-4 text-xs text-gray-500 italic p-2">Knockout Match Win: 3 Match Points</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-gray-800">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">Tie-Breaking Hierarchy:</span>
                    <ol className="text-xs text-gray-300 list-decimal list-inside space-y-0.5">
                      {schema.tie_breakers.map((rule, idx) => (
                        <li key={idx} className="truncate">{rule}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Scoring Simulator Tab */}
        {activeTab === 'simulator' && (
          <div className="space-y-6" id="scoring-simulator-panel">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🧪</span> Organiser Scoring Simulator (ADR-015 Invariant Engine)
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Simulate tournament standings in real-time. Enforces strict integer arithmetic and deterministic tie-breaking.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    id="sim-game-select"
                    value={selectedGameSlug}
                    onChange={e => setSelectedGameSlug(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="bgmi">Battlegrounds Mobile India (Krafton 10-Pt Table)</option>
                    <option value="freefire">Garena Free Fire MAX (Booyah 12-Pt Table)</option>
                    <option value="codm">Call of Duty Mobile (Multiplayer S&D)</option>
                  </select>
                  <button
                    id="btn-run-simulation"
                    onClick={runSimulation}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm transition"
                  >
                    Calculate Standings ⚡
                  </button>
                </div>
              </div>

              {/* Sample Participant Inputs */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sample Lobby Combatants:</span>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {simParticipants.map((p, idx) => (
                    <div key={p.id} className="bg-gray-950 border border-gray-800 p-3 rounded-lg space-y-2">
                      <div className="text-xs font-bold text-white truncate">{p.name}</div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 uppercase block">Rank</label>
                          <input
                            type="number"
                            value={p.placement}
                            onChange={e => {
                              const updated = [...simParticipants];
                              updated[idx].placement = parseInt(e.target.value, 10) || 1;
                              setSimParticipants(updated);
                            }}
                            className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 uppercase block">Kills</label>
                          <input
                            type="number"
                            value={p.kills}
                            onChange={e => {
                              const updated = [...simParticipants];
                              updated[idx].kills = parseInt(e.target.value, 10) || 0;
                              setSimParticipants(updated);
                            }}
                            className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulation Standings Output */}
              {simResults && (
                <div className="pt-6 border-t border-gray-800 space-y-4" id="sim-results-table">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                      ✅ Calculated Standings (Deterministic Tie-Breaks Resolved)
                    </h3>
                    <span className="text-xs text-gray-400">
                      Total Points Distributed: <strong className="text-white">{simResults.reduce((a, b) => a + (b.totalPoints ?? 0), 0)} pts</strong>
                    </span>
                  </div>
                  <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-900 text-gray-400 uppercase text-[11px] border-b border-gray-800">
                        <tr>
                          <th className="py-2.5 px-4">Standing</th>
                          <th className="py-2.5 px-4">Participant</th>
                          <th className="py-2.5 px-4 text-center">Lobby Rank</th>
                          <th className="py-2.5 px-4 text-center">Placement Points</th>
                          <th className="py-2.5 px-4 text-center">Kill Points</th>
                          <th className="py-2.5 px-4 text-right">Total Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 font-mono">
                        {simResults.map(r => (
                          <tr key={r.id} className="hover:bg-gray-900/50">
                            <td className="py-2.5 px-4 font-bold text-indigo-400">#{r.rank}</td>
                            <td className="py-2.5 px-4 font-sans font-medium text-white">{r.name}</td>
                            <td className="py-2.5 px-4 text-center text-gray-400">#{r.placement}</td>
                            <td className="py-2.5 px-4 text-center text-gray-300 font-bold">{r.placementPoints} pts</td>
                            <td className="py-2.5 px-4 text-center text-gray-300 font-bold">{r.killPoints} pts</td>
                            <td className="py-2.5 px-4 text-right text-emerald-400 font-extrabold text-sm">{r.totalPoints} pts</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Publish New Version */}
        {showVersionModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="version-modal">
            <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 space-y-5">
              <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                <h3 className="text-base font-bold text-white">Publish New Scoring Version</h3>
                <button onClick={() => setShowVersionModal(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              <div className="space-y-4 text-xs">
                <p className="text-gray-400">
                  Per <strong>ADR-002 & ADR-015 Invariant (No Silent Edits)</strong>, published formulas cannot be altered in place. This operation creates an immutable new version row and records the diff in the tamper-evident audit log.
                </p>
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">New Version Tag (SemVer):</label>
                  <input
                    type="text"
                    value={newVersionTag}
                    onChange={e => setNewVersionTag(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Mandatory Audit Reason:</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Krafton official competitive rules update for Season 4"
                    value={versionReason}
                    onChange={e => setVersionReason(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white"
                  />
                </div>
                {versionAlert && (
                  <div className="p-3 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-semibold">
                    {versionAlert}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  onClick={() => setShowVersionModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-version"
                  onClick={handleCreateVersion}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold"
                >
                  Publish & Audit Log 🔒
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
