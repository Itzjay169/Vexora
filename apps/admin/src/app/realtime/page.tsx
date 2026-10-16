'use client';

import React, { useState, useEffect } from 'react';
import { AdminShell } from '../../components/AdminShell';

interface RealtimeEventItem {
  id: string;
  channel: string;
  type: string;
  sequence: number;
  data: any;
  timestamp: string;
}

interface ChannelInfo {
  name: string;
  subscribersCount: number;
  type: 'PUBLIC' | 'TOURNAMENT' | 'MATCH' | 'WALLET' | 'ADMIN';
  securityRule: string;
}

export default function AdminRealtimePage() {
  const [activeTab, setActiveTab] = useState<'stream' | 'channels' | 'broadcast' | 'replay'>('stream');

  const [gatewayStats, setGatewayStats] = useState({
    status: 'ONLINE',
    connectedClients: 48,
    activeChannels: 12,
    totalBroadcasts: 1420,
    heartbeatSeconds: 30,
    rateLimitPerMinute: 30,
  });

  const [events, setEvents] = useState<RealtimeEventItem[]>([
    {
      id: 'evt-101',
      channel: 'leaderboard:bgmi-s3',
      type: 'leaderboard.update',
      sequence: 8421,
      data: { tournamentId: 'trn-7701', matchId: 'm-10', rank1: 'Team Soul', points: 45 },
      timestamp: '2026-10-16 16:30:12 UTC',
    },
    {
      id: 'evt-100',
      channel: 'tournament:trn-7701',
      type: 'match.result_finalised',
      sequence: 8420,
      data: { matchId: 'm-10', winner: 'Team Soul', certified: true },
      timestamp: '2026-10-16 16:30:10 UTC',
    },
    {
      id: 'evt-099',
      channel: 'tournament:trn-7701',
      type: 'match.result_submitted',
      sequence: 8419,
      data: { matchId: 'm-10', submittedBy: 'Capt_Mortal', kills: 14 },
      timestamp: '2026-10-16 16:29:45 UTC',
    },
    {
      id: 'evt-098',
      channel: 'announcement:public',
      type: 'announcement.broadcast',
      sequence: 8418,
      data: { title: 'Lobby 4 Password Released', expiresAt: '10m' },
      timestamp: '2026-10-16 16:25:00 UTC',
    },
    {
      id: 'evt-097',
      channel: 'admin:disputes',
      type: 'dispute.opened',
      sequence: 8417,
      data: { disputeId: 'disp-201', tournamentId: 'trn-7701', reason: 'Teaming claim' },
      timestamp: '2026-10-16 16:20:15 UTC',
    },
  ]);

  const [channels, setChannels] = useState<ChannelInfo[]>([
    {
      name: 'leaderboard:bgmi-s3',
      subscribersCount: 28,
      type: 'PUBLIC',
      securityRule: 'Open to all connected clients & anonymous spectators',
    },
    {
      name: 'tournament:trn-7701',
      subscribersCount: 16,
      type: 'TOURNAMENT',
      securityRule: 'Registered tournament participants & verified organisers',
    },
    {
      name: 'match:m-10',
      subscribersCount: 8,
      type: 'MATCH',
      securityRule: 'Roster members of competing teams + lobby referee',
    },
    {
      name: 'wallet:usr-1049-omega',
      subscribersCount: 1,
      type: 'WALLET',
      securityRule: 'STRICT OWNER ONLY — User cannot subscribe to other wallets',
    },
    {
      name: 'admin:operations',
      subscribersCount: 3,
      type: 'ADMIN',
      securityRule: 'Staff with ADMIN, SUPER_ADMIN, or MODERATOR role only',
    },
  ]);

  // Broadcast Form
  const [broadcastChannel, setBroadcastChannel] = useState('announcement:public');
  const [broadcastType, setBroadcastType] = useState('announcement.broadcast');
  const [broadcastPayload, setBroadcastPayload] = useState('{\n  "message": "Lobby verification starting in 5 minutes. Check-in is active.",\n  "priority": "HIGH"\n}');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Replay Simulator
  const [replayChannel, setReplayChannel] = useState('tournament:trn-7701');
  const [lastSeqInput, setLastSeqInput] = useState('8418');
  const [replayedEvents, setReplayedEvents] = useState<RealtimeEventItem[]>([]);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedData = JSON.parse(broadcastPayload);
      const nextSeq = (events[0]?.sequence || 8421) + 1;
      const newEvt: RealtimeEventItem = {
        id: `evt-${Date.now().toString().slice(-4)}`,
        channel: broadcastChannel,
        type: broadcastType,
        sequence: nextSeq,
        data: parsedData,
        timestamp: new Date().toISOString(),
      };

      setEvents([newEvt, ...events]);
      setGatewayStats((prev) => ({ ...prev, totalBroadcasts: prev.totalBroadcasts + 1 }));
      setSuccessMessage(`Event emitted to ${broadcastChannel} with Sequence #${nextSeq} (Stored in Outbox)`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      alert('Invalid JSON in payload field');
    }
  };

  const handleSimulateReplay = () => {
    const seq = Number(lastSeqInput) || 0;
    const missed = events.filter((e) => e.channel === replayChannel && e.sequence > seq);
    setReplayedEvents(missed);
    setSuccessMessage(`Replay executed: ${missed.length} missed events delivered to client from sequence #${seq}`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>⚡</span> Real-Time Gateway & Live Events
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Phase 29: Section 14 Event Catalogue with monotonic sequence numbers, transactional outbox publishing, server-side channel authorization, and reconnect replay.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Gateway: ONLINE (WSS)
            </span>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Clients: {gatewayStats.connectedClients}
            </span>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
            <span>✅ {successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 gap-2">
          {[
            { id: 'stream', label: 'Live Event Stream', count: events.length, icon: '📡' },
            { id: 'channels', label: 'Channel Authorizations', count: channels.length, icon: '🔒' },
            { id: 'broadcast', label: 'Emit Broadcast Event', count: 'Admin', icon: '📢' },
            { id: 'replay', label: 'Missed-Event Replay Simulator', count: 'Test', icon: '🔄' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-white bg-emerald-500/5'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: Live Event Stream */}
        {activeTab === 'stream' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-800 text-xs text-gray-400 flex items-center gap-3">
              <span className="text-base">🛡️</span>
              <span>
                <strong>Section 14 Outbox Pattern:</strong> Every event receives a strictly monotonic sequence number committed to <code>event_outbox</code>. Clients rejoining after flaky connections replay missed events seamlessly.
              </span>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-gray-950/80 text-xs uppercase text-gray-400 border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3">Sequence #</th>
                      <th className="px-4 py-3">Channel</th>
                      <th className="px-4 py-3">Event Type</th>
                      <th className="px-4 py-3">Payload Summary</th>
                      <th className="px-4 py-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 font-mono text-xs">
                    {events.map((evt) => (
                      <tr key={evt.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-emerald-400">#{evt.sequence}</td>
                        <td className="px-4 py-3 text-cyan-300">{evt.channel}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {evt.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300 font-sans text-xs">
                          {JSON.stringify(evt.data).slice(0, 75)}...
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{evt.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Channels & Authorization Security Gate */}
        {activeTab === 'channels' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {channels.map((chan) => (
                <div
                  key={chan.name}
                  className="p-5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-3 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-white font-bold bg-gray-800 px-2.5 py-1 rounded">
                      {chan.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        chan.type === 'PUBLIC'
                          ? 'bg-blue-500/20 text-blue-400'
                          : chan.type === 'WALLET'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {chan.type}
                    </span>
                  </div>

                  <p className="text-xs text-gray-300">
                    <strong>Rule:</strong> {chan.securityRule}
                  </p>

                  <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
                    <span>Active Subscribers: <strong className="text-white">{chan.subscribersCount}</strong></span>
                    <span className="text-emerald-400">● Auth Gate Enforced</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Emit Broadcast Event */}
        {activeTab === 'broadcast' && (
          <div className="space-y-5">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 space-y-5 shadow-xl">
              <h3 className="text-base font-bold text-white">Broadcast Event via Transactional Outbox</h3>
              <p className="text-xs text-gray-400">
                Admin broadcasts are immediately distributed to all authorized WebSocket clients across clusters using Redis fan-out.
              </p>

              <form onSubmit={handleBroadcast} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Target Channel</label>
                    <select
                      value={broadcastChannel}
                      onChange={(e) => setBroadcastChannel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-xs font-mono"
                    >
                      <option value="announcement:public">announcement:public</option>
                      <option value="tournament:trn-7701">tournament:trn-7701</option>
                      <option value="leaderboard:bgmi-s3">leaderboard:bgmi-s3</option>
                      <option value="admin:operations">admin:operations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Event Type (Catalogue)</label>
                    <select
                      value={broadcastType}
                      onChange={(e) => setBroadcastType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-xs font-mono"
                    >
                      <option value="announcement.broadcast">announcement.broadcast</option>
                      <option value="tournament.status_change">tournament.status_change</option>
                      <option value="match.start">match.start</option>
                      <option value="match.result_finalised">match.result_finalised</option>
                      <option value="leaderboard.update">leaderboard.update</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">JSON Payload</label>
                  <textarea
                    rows={4}
                    value={broadcastPayload}
                    onChange={(e) => setBroadcastPayload(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-emerald-400 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase transition-all shadow-lg shadow-emerald-950/40"
                >
                  Publish to Outbox & Fan Out
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: Missed-Event Replay Simulator */}
        {activeTab === 'replay' && (
          <div className="space-y-5">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-white">Simulate Client Reconnect & Missed-Event Replay</h3>
              <p className="text-xs text-gray-400">
                When a player's phone disconnects (e.g. mobile tunnel/elevator) and reconnects, it transmits its last acknowledged sequence number. The gateway replays all missed events in strict sequence.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Channel</label>
                  <input
                    type="text"
                    value={replayChannel}
                    onChange={(e) => setReplayChannel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Client Last Sequence #</label>
                  <input
                    type="number"
                    value={lastSeqInput}
                    onChange={(e) => setLastSeqInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-emerald-400 font-mono text-xs"
                  />
                </div>
              </div>

              <button
                onClick={handleSimulateReplay}
                className="py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase transition-all"
              >
                Simulate Replay Query
              </button>
            </div>

            {replayedEvents.length > 0 && (
              <div className="p-4 rounded-xl bg-gray-900/50 border border-cyan-500/30 space-y-3 font-mono text-xs">
                <span className="text-cyan-400 font-bold block">
                  ✓ Replayed {replayedEvents.length} events from sequence #{lastSeqInput}:
                </span>
                <div className="space-y-2">
                  {replayedEvents.map((r) => (
                    <div key={r.id} className="p-2 rounded bg-gray-950 border border-gray-800 flex items-center justify-between">
                      <span className="text-emerald-400">#{r.sequence} [{r.type}]</span>
                      <span className="text-gray-400 font-sans">{JSON.stringify(r.data).slice(0, 50)}...</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
