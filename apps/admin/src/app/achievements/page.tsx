'use client';

import React, { useState } from 'react';

/**
 * Admin Achievements & Gamification Console — Phase 32
 *
 * Features:
 * - Achievement catalogue management
 * - Mission management (daily/weekly/seasonal)
 * - Streak definitions
 * - Badge award audit trail
 * - Responsible design controls overview
 */

const RARITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  COMMON:    { bg: 'rgba(148, 163, 184, 0.1)', text: '#94A3B8', border: 'rgba(148, 163, 184, 0.3)' },
  UNCOMMON:  { bg: 'rgba(16, 185, 129, 0.1)',  text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
  RARE:      { bg: 'rgba(59, 130, 246, 0.1)',   text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
  EPIC:      { bg: 'rgba(168, 85, 247, 0.1)',   text: '#A855F7', border: 'rgba(168, 85, 247, 0.3)' },
  LEGENDARY: { bg: 'rgba(245, 158, 11, 0.1)',   text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
};

const MOCK_ACHIEVEMENTS = [
  { slug: 'first_tournament', title: 'First Steps', category: 'PARTICIPATION', rarity: 'COMMON', xp_reward: 50, criteria_type: 'tournaments_joined', criteria_value: 1, awarded_count: 8420 },
  { slug: 'first_win', title: 'Victory Royale', category: 'SKILL', rarity: 'COMMON', xp_reward: 100, criteria_type: 'matches_won', criteria_value: 1, awarded_count: 5891 },
  { slug: 'fifty_wins', title: 'Champion', category: 'SKILL', rarity: 'RARE', xp_reward: 750, criteria_type: 'matches_won', criteria_value: 50, awarded_count: 234 },
  { slug: 'hundred_wins', title: 'Legend', category: 'SKILL', rarity: 'EPIC', xp_reward: 1500, criteria_type: 'matches_won', criteria_value: 100, awarded_count: 47 },
  { slug: 'fair_play_perfect', title: 'Exemplary Conduct', category: 'FAIR_PLAY', rarity: 'RARE', xp_reward: 500, criteria_type: 'fair_play_score_min', criteria_value: 100, awarded_count: 312 },
  { slug: 'thousand_kills', title: 'Apex Predator', category: 'SKILL', rarity: 'EPIC', xp_reward: 1000, criteria_type: 'total_kills', criteria_value: 1000, awarded_count: 89 },
];

const MOCK_MISSIONS = [
  { slug: 'daily_play_1', title: 'Daily Warrior', type: 'DAILY', category: 'PARTICIPATION', target_count: 1, xp_reward: 15 },
  { slug: 'weekly_5_matches', title: 'Weekly Grind', type: 'WEEKLY', category: 'PARTICIPATION', target_count: 5, xp_reward: 50 },
  { slug: 'weekly_fair_play', title: 'Sportsmanship Award', type: 'WEEKLY', category: 'FAIR_PLAY', target_count: 5, xp_reward: 60 },
];

type TabId = 'achievements' | 'missions' | 'responsible';

export default function AchievementsAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('achievements');
  const cardStyle: React.CSSProperties = { backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '12px', padding: '1.5rem' };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'achievements', label: 'Achievement Catalogue', icon: '🏅' },
    { id: 'missions', label: 'Missions & Streaks', icon: '🎯' },
    { id: 'responsible', label: 'Responsible Design', icon: '🛡️' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🏅</span>
          <h1 style={{ fontSize: '1.5rem', color: '#F8FAFC', margin: 0, fontWeight: 700 }}>Achievements &amp; Gamification</h1>
        </div>
        <p style={{ color: '#64748B', margin: 0, fontSize: '0.875rem' }}>Phase 32 — Badge engine, missions, streaks, responsible design controls</p>
      </div>

      {/* Security Banners */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(168, 85, 247, 0.08))', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🔒</span>
          <div><span style={{ color: '#F87171', fontWeight: 600, fontSize: '0.75rem' }}>Server-Only Awards</span><p style={{ color: '#94A3B8', margin: 0, fontSize: '0.6875rem' }}>Badges CANNOT be granted by client API calls</p></div>
        </div>
        <div style={{ flex: 1, minWidth: '250px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(99, 102, 241, 0.08))', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🚫</span>
          <div><span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.75rem' }}>No Pay-to-Win</span><p style={{ color: '#94A3B8', margin: 0, fontSize: '0.6875rem' }}>All rewards are cosmetic or participation-based</p></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '0.625rem 1rem', borderRadius: '8px',
            border: activeTab === tab.id ? '1px solid #6366F1' : '1px solid #1E293B',
            backgroundColor: activeTab === tab.id ? 'rgba(99, 102, 241, 0.15)' : '#111827',
            color: activeTab === tab.id ? '#818CF8' : '#94A3B8',
            fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}><span>{tab.icon}</span><span>{tab.label}</span></button>
        ))}
      </div>

      {/* Achievements Tab */}
      {activeTab === 'achievements' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Achievement Catalogue</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {MOCK_ACHIEVEMENTS.map(ach => {
              const rc = RARITY_COLORS[ach.rarity] || RARITY_COLORS.COMMON;
              return (
                <div key={ach.slug} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: rc.bg, border: `1px solid ${rc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>🏅</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.9375rem' }}>{ach.title}</span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}>{ach.rarity}</span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818CF8' }}>{ach.category}</span>
                    </div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                      <span style={{ fontFamily: 'monospace' }}>{ach.criteria_type} ≥ {ach.criteria_value}</span>
                      <span style={{ marginLeft: '1rem' }}>⭐ {ach.xp_reward} XP</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '1.125rem' }}>{ach.awarded_count.toLocaleString()}</span>
                    <div style={{ color: '#64748B', fontSize: '0.6875rem' }}>awarded</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Missions Tab */}
      {activeTab === 'missions' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Active Missions</h2>
          {MOCK_MISSIONS.map(m => (
            <div key={m.slug} style={{ ...cardStyle, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{m.title}</span>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: m.type === 'DAILY' ? 'rgba(250, 204, 21, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: m.type === 'DAILY' ? '#FACC15' : '#3B82F6' }}>{m.type}</span>
                  <span style={{ fontSize: '0.625rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818CF8' }}>{m.category}</span>
                </div>
                <span style={{ color: '#64748B', fontSize: '0.75rem' }}>Target: {m.target_count} • ⭐ {m.xp_reward} XP</span>
              </div>
              <span style={{ fontSize: '0.625rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>ACTIVE</span>
            </div>
          ))}
        </div>
      )}

      {/* Responsible Design Tab */}
      {activeTab === 'responsible' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Responsible Design Controls</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {[
              { title: 'No Pay-to-Win', desc: 'CHECK constraint on DB: is_pay_to_win = FALSE enforced at schema level', icon: '🚫', status: 'ENFORCED' },
              { title: 'No Spend-Based Missions', desc: 'CHECK constraint: is_spend_based = FALSE on all missions', icon: '💰', status: 'ENFORCED' },
              { title: 'No Purchasable Cosmetics', desc: 'CHECK constraint: is_purchasable = FALSE on v1 titles', icon: '🎨', status: 'ENFORCED' },
              { title: 'Self-Exclusion Tools', desc: 'Users can set daily/weekly play limits and cooldown periods', icon: '⏰', status: 'AVAILABLE' },
              { title: 'Age Verification', desc: 'Age verification field with parental consent tracking', icon: '👤', status: 'AVAILABLE' },
              { title: 'Badge Immutability', desc: 'Trigger prevents UPDATE/DELETE on awarded badges', icon: '🔒', status: 'ENFORCED' },
            ].map((rule, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{rule.icon}</span>
                    <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.875rem' }}>{rule.title}</span>
                  </div>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>{rule.status}</span>
                </div>
                <p style={{ color: '#94A3B8', fontSize: '0.75rem', margin: 0 }}>{rule.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
