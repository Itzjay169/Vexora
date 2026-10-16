'use client';

import React, { useState } from 'react';

/**
 * Admin Analytics Dashboard — Phase 31
 *
 * Features:
 * - Platform overview with KPI cards
 * - Daily activity chart (90-day trend)
 * - Game popularity rankings
 * - Materialised view refresh controls
 * - Export engine with masking & audit trail
 * - Metric definitions catalogue
 */

const MOCK_PLATFORM = {
  total_users: 12847,
  total_tournaments: 634,
  live_tournaments: 8,
  total_matches_played: 4291,
  total_disputes: 127,
  disputes_resolved: 112,
  verified_organisers: 43,
  active_games: 3,
};

const MOCK_DAILY_STATS = Array.from({ length: 14 }, (_, i) => ({
  stat_date: new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0],
  new_users: Math.floor(Math.random() * 80) + 20,
  new_tournaments: Math.floor(Math.random() * 12) + 2,
  matches_played: Math.floor(Math.random() * 60) + 10,
  new_registrations: Math.floor(Math.random() * 150) + 30,
  disputes_filed: Math.floor(Math.random() * 5),
}));

const MOCK_GAMES = [
  { game_title: 'BGMI', tournament_count: 287, total_participants: 8240, active_players_30d: 3421, popularity_rank: 1 },
  { game_title: 'Free Fire MAX', tournament_count: 213, total_participants: 5890, active_players_30d: 2105, popularity_rank: 2 },
  { game_title: 'Call of Duty Mobile', tournament_count: 134, total_participants: 3210, active_players_30d: 1320, popularity_rank: 3 },
];

const MOCK_VIEWS = [
  { name: 'mv_player_stats', lastRefresh: '2026-10-16T22:00:00Z', status: 'COMPLETED', duration: 1240 },
  { name: 'mv_organiser_stats', lastRefresh: '2026-10-16T22:00:02Z', status: 'COMPLETED', duration: 890 },
  { name: 'mv_platform_daily_stats', lastRefresh: '2026-10-16T22:00:03Z', status: 'COMPLETED', duration: 2100 },
  { name: 'mv_game_popularity', lastRefresh: '2026-10-16T22:00:05Z', status: 'COMPLETED', duration: 560 },
];

const MOCK_EXPORTS = [
  { report_name: 'Monthly Player Stats', export_type: 'PLAYER_STATS', format: 'CSV', row_count: 8420, actor_role: 'ADMIN', exported_at: '2026-10-16T18:30:00Z', is_masked: true },
  { report_name: 'Q3 Organiser Report', export_type: 'ORGANISER_STATS', format: 'CSV', row_count: 43, actor_role: 'FINANCE', exported_at: '2026-10-15T10:00:00Z', is_masked: true },
];

type TabId = 'overview' | 'trends' | 'games' | 'refresh' | 'exports' | 'metrics';

export default function AnalyticsAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [exportForm, setExportForm] = useState({ reportName: '', exportType: 'PLAYER_STATS', format: 'CSV' });

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Platform Overview', icon: '📊' },
    { id: 'trends', label: 'Daily Trends', icon: '📈' },
    { id: 'games', label: 'Game Popularity', icon: '🎮' },
    { id: 'refresh', label: 'View Refresh', icon: '🔄' },
    { id: 'exports', label: 'Data Exports', icon: '📥' },
    { id: 'metrics', label: 'Metric Catalogue', icon: '📋' },
  ];

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#111827', border: '1px solid #1E293B',
    borderRadius: '12px', padding: '1.5rem',
  };

  const kpiCard = (label: string, value: string | number, icon: string, color: string, subtext?: string) => (
    <div style={{
      ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.5rem',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      </div>
      <span style={{ color: '#F8FAFC', fontSize: '1.75rem', fontWeight: 700 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {subtext && <span style={{ color: '#64748B', fontSize: '0.75rem' }}>{subtext}</span>}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.75rem' }}>📊</span>
          <h1 style={{ fontSize: '1.5rem', color: '#F8FAFC', margin: 0, fontWeight: 700 }}>Analytics &amp; Dashboards</h1>
        </div>
        <p style={{ color: '#64748B', margin: 0, fontSize: '0.875rem' }}>
          Phase 31 — Platform analytics, materialised views, masked exports with audit trail
        </p>
      </div>

      {/* Security banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(99, 102, 241, 0.08))',
        border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px',
        padding: '0.875rem 1.25rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <span style={{ fontSize: '1.125rem' }}>🛡️</span>
        <div>
          <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.8125rem' }}>Export Security Gate Active</span>
          <p style={{ color: '#94A3B8', margin: 0, fontSize: '0.75rem' }}>
            All exports are PII-masked, watermarked, and audit-logged. No raw personal data leaves the system.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '0.625rem 1rem', borderRadius: '8px',
            border: activeTab === tab.id ? '1px solid #6366F1' : '1px solid #1E293B',
            backgroundColor: activeTab === tab.id ? 'rgba(99, 102, 241, 0.15)' : '#111827',
            color: activeTab === tab.id ? '#818CF8' : '#94A3B8',
            fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ─── Overview Tab ──────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Platform KPIs</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {kpiCard('Total Users', MOCK_PLATFORM.total_users, '👥', '#6366F1')}
            {kpiCard('Total Tournaments', MOCK_PLATFORM.total_tournaments, '🏆', '#F59E0B')}
            {kpiCard('Live Now', MOCK_PLATFORM.live_tournaments, '🔴', '#EF4444', 'Active tournaments')}
            {kpiCard('Matches Played', MOCK_PLATFORM.total_matches_played, '⚔️', '#3B82F6')}
            {kpiCard('Verified Organisers', MOCK_PLATFORM.verified_organisers, '✅', '#10B981')}
            {kpiCard('Active Games', MOCK_PLATFORM.active_games, '🎮', '#A855F7')}
            {kpiCard('Total Disputes', MOCK_PLATFORM.total_disputes, '⚖️', '#F97316')}
            {kpiCard('Resolution Rate', `${Math.round((MOCK_PLATFORM.disputes_resolved / MOCK_PLATFORM.total_disputes) * 100)}%`, '📋', '#14B8A6', `${MOCK_PLATFORM.disputes_resolved} resolved`)}
          </div>
        </div>
      )}

      {/* ─── Trends Tab ────────────────────────────────────────── */}
      {activeTab === 'trends' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Daily Activity (14-Day Trend)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B' }}>
                  {['Date', 'New Users', 'Tournaments', 'Matches', 'Registrations', 'Disputes'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 0.5rem', color: '#64748B', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_DAILY_STATS.map(day => (
                  <tr key={day.stat_date} style={{ borderBottom: '1px solid #1E293B22' }}>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#94A3B8' }}>{day.stat_date}</td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#818CF8', fontWeight: 600 }}>{day.new_users}</td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#F59E0B' }}>{day.new_tournaments}</td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#3B82F6' }}>{day.matches_played}</td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#10B981' }}>{day.new_registrations}</td>
                    <td style={{ padding: '0.625rem 0.5rem', color: day.disputes_filed > 3 ? '#EF4444' : '#64748B' }}>{day.disputes_filed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mini bar chart visualization */}
          <div style={{ ...cardStyle, marginTop: '1rem' }}>
            <h3 style={{ color: '#94A3B8', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Registrations Trend</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100px' }}>
              {MOCK_DAILY_STATS.map((day, i) => {
                const maxReg = Math.max(...MOCK_DAILY_STATS.map(d => d.new_registrations));
                const height = (day.new_registrations / maxReg) * 100;
                return (
                  <div key={i} style={{
                    flex: 1, height: `${height}%`, borderRadius: '3px 3px 0 0',
                    background: `linear-gradient(to top, rgba(99, 102, 241, 0.6), rgba(139, 92, 246, 0.4))`,
                    minWidth: '8px',
                  }} title={`${day.stat_date}: ${day.new_registrations} registrations`} />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Games Tab ──────────────────────────────────────────── */}
      {activeTab === 'games' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Game Popularity Rankings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {MOCK_GAMES.map((game, i) => (
              <div key={i} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: `linear-gradient(135deg, ${['#6366F1', '#F59E0B', '#10B981'][i]}, ${['#818CF8', '#FBBF24', '#34D399'][i]})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem', fontWeight: 700, color: '#FFF',
                }}>
                  #{game.popularity_rank}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '1rem' }}>{game.game_title}</span>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                    <span style={{ color: '#64748B', fontSize: '0.75rem' }}>🏆 {game.tournament_count} tournaments</span>
                    <span style={{ color: '#64748B', fontSize: '0.75rem' }}>👥 {game.total_participants.toLocaleString()} participants</span>
                    <span style={{ color: '#64748B', fontSize: '0.75rem' }}>🎮 {game.active_players_30d.toLocaleString()} active (30d)</span>
                  </div>
                </div>
                {/* Popularity bar */}
                <div style={{ width: '120px' }}>
                  <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#1E293B', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px',
                      width: `${(game.active_players_30d / MOCK_GAMES[0].active_players_30d) * 100}%`,
                      background: `linear-gradient(to right, ${['#6366F1', '#F59E0B', '#10B981'][i]}, ${['#818CF8', '#FBBF24', '#34D399'][i]})`,
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Refresh Tab ────────────────────────────────────────── */}
      {activeTab === 'refresh' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Materialised View Refresh</h2>
            <button style={{
              padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)',
              backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', fontSize: '0.8125rem',
              fontWeight: 600, cursor: 'pointer',
            }}>
              🔄 Refresh All Views
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {MOCK_VIEWS.map(v => (
              <div key={v.name} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'monospace' }}>{v.name}</span>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981',
                  }}>{v.status}</span>
                </div>
                <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                  <div>Last refresh: {new Date(v.lastRefresh).toLocaleString()}</div>
                  <div>Duration: {v.duration}ms</div>
                </div>
                <button style={{
                  marginTop: '0.75rem', padding: '0.375rem 0.75rem', borderRadius: '6px',
                  border: '1px solid #334155', backgroundColor: '#1E293B', color: '#94A3B8',
                  fontSize: '0.75rem', cursor: 'pointer', width: '100%',
                }}>
                  ↻ Refresh Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Exports Tab ────────────────────────────────────────── */}
      {activeTab === 'exports' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Data Exports (Masked &amp; Logged)</h2>
          <div style={{ ...cardStyle, maxWidth: '500px', marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#F8FAFC', fontSize: '0.9375rem', margin: '0 0 1rem' }}>New Export</h3>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Report Name</label>
              <input value={exportForm.reportName} onChange={e => setExportForm(p => ({ ...p, reportName: e.target.value }))} placeholder="e.g. Monthly Player Stats" style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '0.875rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Type</label>
                <select value={exportForm.exportType} onChange={e => setExportForm(p => ({ ...p, exportType: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '0.875rem' }}>
                  {['PLAYER_STATS', 'ORGANISER_STATS', 'PLATFORM_DAILY', 'GAME_POPULARITY'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Format</label>
                <select value={exportForm.format} onChange={e => setExportForm(p => ({ ...p, format: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '0.875rem' }}>
                  {['CSV', 'PDF', 'JSON'].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <button style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#FFF',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}>
              📥 Export (Masked)
            </button>
          </div>

          <h3 style={{ color: '#94A3B8', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Export Audit Trail</h3>
          {MOCK_EXPORTS.map((exp, i) => (
            <div key={i} style={{ ...cardStyle, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.875rem' }}>{exp.report_name}</span>
                <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {exp.export_type} • {exp.format} • {exp.row_count.toLocaleString()} rows • by {exp.actor_role}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>PII MASKED</span>
                <div style={{ color: '#64748B', fontSize: '0.7rem', marginTop: '0.25rem' }}>{new Date(exp.exported_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Metrics Tab ────────────────────────────────────────── */}
      {activeTab === 'metrics' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Metric Definitions Catalogue</h2>
          <p style={{ color: '#64748B', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            Every metric has a documented definition and a test against known data (Phase 31 exit criterion).
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B' }}>
                  {['Key', 'Name', 'Category', 'Source', 'Aggregation', 'Refresh'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 0.5rem', color: '#64748B', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'total_users', name: 'Total Registered Users', cat: 'PLATFORM', src: 'users', agg: 'COUNT', refresh: 'HOURLY' },
                  { key: 'active_users_daily', name: 'Daily Active Users', cat: 'PLATFORM', src: 'user_sessions', agg: 'COUNT_DISTINCT', refresh: 'HOURLY' },
                  { key: 'player_win_rate', name: 'Player Win Rate', cat: 'PLAYER', src: 'match_participants', agg: 'RATIO', refresh: 'HOURLY' },
                  { key: 'organiser_avg_fill_rate', name: 'Avg Fill Rate', cat: 'ORGANISER', src: 'tournaments', agg: 'AVG', refresh: 'DAILY' },
                  { key: 'game_active_players', name: 'Active Players/Game', cat: 'GAME', src: 'match_participants', agg: 'COUNT_DISTINCT', refresh: 'DAILY' },
                ].map(m => (
                  <tr key={m.key} style={{ borderBottom: '1px solid #1E293B22' }}>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#818CF8', fontFamily: 'monospace', fontSize: '0.75rem' }}>{m.key}</td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#F8FAFC' }}>{m.name}</td>
                    <td style={{ padding: '0.625rem 0.5rem' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>{m.cat}</span>
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.75rem' }}>{m.src}</td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#94A3B8' }}>{m.agg}</td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#64748B' }}>{m.refresh}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
