'use client';

import React, { useState } from 'react';

/**
 * Web Portal — Player Dashboard & Analytics
 *
 * Phase 31: Analytics & Dashboards
 *
 * Features:
 * - Player performance overview (win rate, kills, score, fair play)
 * - Match history chart
 * - Tournament participation stats
 * - Game-specific breakdown
 */

const MOCK_PLAYER = {
  username: 'ProPlayer_007',
  joined_at: '2026-03-15',
  tournaments_joined: 42,
  matches_played: 187,
  matches_won: 89,
  win_rate_pct: 47.59,
  total_kills: 1423,
  total_score: 28750,
  fair_play_score: 94,
  disputes_filed: 2,
  disputes_won: 1,
};

const MOCK_HISTORY = Array.from({ length: 14 }, (_, i) => ({
  match_date: new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0],
  matches_played: Math.floor(Math.random() * 4) + 1,
  wins: Math.floor(Math.random() * 3),
  kills: Math.floor(Math.random() * 15) + 2,
  score: Math.floor(Math.random() * 300) + 50,
}));

const MOCK_GAMES_BREAKDOWN = [
  { game: 'BGMI', matches: 112, wins: 58, winRate: 51.8, kills: 892 },
  { game: 'Free Fire MAX', matches: 53, wins: 22, winRate: 41.5, kills: 387 },
  { game: 'CODM', matches: 22, wins: 9, winRate: 40.9, kills: 144 },
];

export default function DashboardPage() {
  const [historyDays, setHistoryDays] = useState(14);
  const stats = MOCK_PLAYER;

  const statCard = (label: string, value: string | number, icon: string, color: string, sub?: string) => (
    <div style={{
      backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '12px',
      padding: '1.25rem', borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
      </div>
      <span style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700 }}>{value}</span>
      {sub && <div style={{ color: '#64748B', fontSize: '0.6875rem', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );

  const maxKills = Math.max(...MOCK_HISTORY.map(h => h.kills), 1);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', color: '#F8FAFC', margin: 0, fontWeight: 700 }}>
            📊 Player Dashboard
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>
            @{stats.username} • Member since {new Date(stats.joined_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 1rem', borderRadius: '9999px',
          backgroundColor: stats.fair_play_score >= 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(250, 204, 21, 0.1)',
          border: `1px solid ${stats.fair_play_score >= 80 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(250, 204, 21, 0.3)'}`,
        }}>
          <span style={{ fontSize: '0.875rem' }}>🛡️</span>
          <span style={{ color: stats.fair_play_score >= 80 ? '#10B981' : '#FACC15', fontWeight: 600, fontSize: '0.875rem' }}>
            Fair Play: {stats.fair_play_score}/100
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
        {statCard('Win Rate', `${stats.win_rate_pct}%`, '🎯', '#6366F1', `${stats.matches_won}W / ${stats.matches_played - stats.matches_won}L`)}
        {statCard('Matches', stats.matches_played, '⚔️', '#3B82F6', `${stats.matches_won} victories`)}
        {statCard('Tournaments', stats.tournaments_joined, '🏆', '#F59E0B', 'Registered')}
        {statCard('Total Kills', stats.total_kills.toLocaleString(), '💥', '#EF4444')}
        {statCard('Total Score', stats.total_score.toLocaleString(), '⭐', '#10B981')}
      </div>

      {/* Performance Chart */}
      <div style={{
        backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '12px',
        padding: '1.5rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: '#F8FAFC', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Kill Performance</h2>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setHistoryDays(d)} style={{
                padding: '0.25rem 0.625rem', borderRadius: '6px', fontSize: '0.75rem',
                border: historyDays === d ? '1px solid #6366F1' : '1px solid #1E293B',
                backgroundColor: historyDays === d ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: historyDays === d ? '#818CF8' : '#64748B', cursor: 'pointer', fontWeight: 600,
              }}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px' }}>
          {MOCK_HISTORY.slice(-historyDays).map((day, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#64748B', fontSize: '0.625rem' }}>{day.kills}</span>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                height: `${(day.kills / maxKills) * 100}px`,
                background: day.wins > 0
                  ? 'linear-gradient(to top, rgba(99, 102, 241, 0.7), rgba(139, 92, 246, 0.5))'
                  : 'rgba(100, 116, 139, 0.3)',
                minHeight: '4px',
              }} title={`${day.match_date}: ${day.kills} kills, ${day.wins} wins`} />
            </div>
          ))}
        </div>
      </div>

      {/* Game Breakdown */}
      <div style={{
        backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <h2 style={{ color: '#F8FAFC', fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>Game Breakdown</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {MOCK_GAMES_BREAKDOWN.map((g, i) => (
            <div key={g.game} style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '0.75rem 1rem', borderRadius: '10px',
              backgroundColor: '#0F172A', border: '1px solid #1E293B',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: `linear-gradient(135deg, ${['#6366F1', '#F59E0B', '#10B981'][i]}, ${['#818CF8', '#FBBF24', '#34D399'][i]})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.875rem', fontWeight: 700, color: '#FFF', flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.875rem' }}>{g.game}</span>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.125rem', color: '#64748B', fontSize: '0.75rem' }}>
                  <span>{g.matches} matches</span>
                  <span>{g.wins} wins</span>
                  <span>{g.kills} kills</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  color: g.winRate >= 50 ? '#10B981' : '#F59E0B',
                  fontWeight: 700, fontSize: '1.125rem',
                }}>
                  {g.winRate}%
                </span>
                <div style={{ color: '#64748B', fontSize: '0.6875rem' }}>Win Rate</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
