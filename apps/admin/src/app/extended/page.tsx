'use client';

import React, { useState } from 'react';

/**
 * Admin Extended Operations Console — Phase 34
 *
 * Section 41 & 43 Extended Capabilities:
 * - Case Management Timeline (Cross-entity audit of user lifecycle)
 * - Fraud Graph View (Device & IP clusters with privacy hashing)
 * - AI Co-pilot Studio (Draft announcements & rules, strictly non-authoritative)
 * - Read-Only "View As" Simulator (Troubleshooting without impersonation)
 * - Dynamic Feature Flags status
 */

type TabId = 'timeline' | 'fraud' | 'copilot' | 'viewas';

export default function ExtendedOperationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [targetUserId, setTargetUserId] = useState('user-8924');
  const [copilotType, setCopilotType] = useState('ANNOUNCEMENT');
  const [copilotDraft, setCopilotDraft] = useState<string | null>(null);
  const [simulatedView, setSimulatedView] = useState<any | null>(null);

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#111827',
    border: '1px solid #1E293B',
    borderRadius: '12px',
    padding: '1.25rem',
  };

  const MOCK_TIMELINE_EVENTS = [
    { type: 'FAIR_PLAY_PLEDGE', title: 'Signed Fair Play Pledge', time: 'Oct 16, 11:30 AM', desc: 'Accepted competitive integrity standards v1.0' },
    { type: 'SUPPORT_TICKET', title: 'Support Ticket VEX-TK-10023', time: 'Oct 16, 11:00 AM', desc: 'SAFETY: Harassment reported in voice lobby' },
    { type: 'DISPUTE_RAISED', title: 'Match Dispute Filed', time: 'Oct 15, 08:45 PM', desc: 'Match #892: Result screenshot discrepancy' },
    { type: 'TOURNAMENT_JOIN', title: 'Joined BGMI Open Championship', time: 'Oct 15, 02:10 PM', desc: 'Squad Registration: Team Alpha (Slot 4)' },
    { type: 'WALLET_LEDGER', title: 'Credit Voucher WELCOME100', time: 'Oct 14, 09:00 AM', desc: '+100 Credits (Free Reward Tier, Hash: a89f...)' },
  ];

  const MOCK_FRAUD_CLUSTERS = [
    {
      clusterId: 'CLUSTER-DEV-8821',
      deviceHash: 'sha256:d89f2a41c9b...',
      riskScore: '92% Collusion Risk',
      riskColor: '#EF4444',
      linkedAccounts: ['PhantomGamer', 'ShadowSniper', 'NightStalker'],
      triggerReason: '3 accounts sharing identical hardware fingerprint in same Battle Royale lobby',
    },
    {
      clusterId: 'CLUSTER-IP-3104',
      deviceHash: 'sha256:4a12bc90e71...',
      riskScore: '24% Low Risk',
      riskColor: '#34D399',
      linkedAccounts: ['CampusGamer1', 'CampusGamer2'],
      triggerReason: 'Shared university campus Wi-Fi IP subnet, different devices',
    },
  ];

  const handleGenerateCopilot = () => {
    if (copilotType === 'ANNOUNCEMENT') {
      setCopilotDraft(
        `🏆 ANNOUNCEMENT: Vexora BGMI Squad Championship!\n\n` +
        `Calling all squads! Registrations are now officially live. Format: 16-team lobbies, 3-match qualifier rotation.\n` +
        `Check-in begins 15 minutes before match start on mobile or web.\n\n` +
        `Entry: 100% Free • Fair Play Rules Strictly Enforced.`
      );
    } else {
      setCopilotDraft(
        `📜 TOURNAMENT RULES & MATCH-DAY PROTOCOL:\n\n` +
        `1. Room Codes: Disclosed exactly 10 minutes prior to scheduled start to checked-in players only.\n` +
        `2. Disconnects: If fewer than 2 squad members reconnect within 3 minutes, match proceeds.\n` +
        `3. Evidence Capture: End-of-match score screenshot showing all 4 squad kills is mandatory within 15 minutes of completion.`
      );
    }
  };

  const handleSimulateViewAs = () => {
    setSimulatedView({
      userId: targetUserId,
      username: 'ApexPredator99',
      maskedEmail: 'ap***@vexora.gg',
      maskedPhone: '+91 ******7812',
      registeredAt: '2026-06-12',
      reputationScore: 98,
      readOnlyBalance: '250.00 Credits (Promotional/Free)',
      activeTournaments: ['BGMI Weekly Cup #4'],
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🔮</span>
            <h1 style={{ fontSize: '1.5rem', color: '#F8FAFC', margin: 0, fontWeight: 700 }}>Extended Operations</h1>
          </div>
          <p style={{ color: '#64748B', margin: 0, fontSize: '0.875rem' }}>
            Phase 34 — Case Management Timeline, Fraud Graph, AI Co-Pilot, and Safe View-As Simulator
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34D399', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
            ● Extended Modules Active
          </span>
          <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60A5FA', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
            Zero Impersonation Enforced
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1E293B', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { id: 'timeline', label: '🗂️ Case Management Timeline' },
          { id: 'fraud', label: '🕸️ Fraud Graph View' },
          { id: 'copilot', label: '🤖 AI Co-Pilot Studio' },
          { id: 'viewas', label: '👁️ Safe "View As" Simulator' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as TabId)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: activeTab === t.id ? '1px solid #3B82F6' : '1px solid transparent',
              backgroundColor: activeTab === t.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === t.id ? '#60A5FA' : '#94A3B8',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Case Management Timeline */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem' }}>
          <div style={cardStyle}>
            <h3 style={{ color: '#F8FAFC', fontSize: '1rem', marginTop: 0 }}>Target User Lookup</h3>
            <p style={{ color: '#64748B', fontSize: '0.8rem' }}>Enter user ID or handle to compile chronological cross-module timeline</p>
            <input
              type="text"
              value={targetUserId}
              onChange={e => setTargetUserId(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                color: '#F8FAFC',
                padding: '0.5rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
                marginBottom: '1rem',
              }}
            />
            <div style={{ backgroundColor: '#0F172A', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: '#94A3B8' }}>
              <div>Linked Disputes: <strong style={{ color: '#F59E0B' }}>1</strong></div>
              <div>Support Tickets: <strong style={{ color: '#60A5FA' }}>1</strong></div>
              <div>Sanctions/Flags: <strong style={{ color: '#10B981' }}>0 Active</strong></div>
              <div>Fair Play Score: <strong style={{ color: '#34D399' }}>98/100</strong></div>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ color: '#F8FAFC', fontSize: '1rem', marginTop: 0, marginBottom: '1rem' }}>
              Consolidated Case Timeline for <code>{targetUserId}</code>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
              {MOCK_TIMELINE_EVENTS.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '0.875rem',
                    backgroundColor: '#0F172A',
                    borderRadius: '8px',
                    border: '1px solid #1E293B',
                  }}
                >
                  <div style={{ width: '130px', fontSize: '0.75rem', color: '#64748B' }}>{ev.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#F1F5F9', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      {ev.title}
                    </div>
                    <div style={{ color: '#94A3B8', fontSize: '0.8rem' }}>{ev.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Fraud Graph View */}
      {activeTab === 'fraud' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={cardStyle}>
            <h3 style={{ color: '#F8FAFC', fontSize: '1rem', marginTop: 0 }}>Device &amp; IP Hardware Clusters (Privacy Preserved)</h3>
            <p style={{ color: '#64748B', fontSize: '0.8rem' }}>
              Identifies collusion rings and multi-account abusers using hashed device fingerprints and salt-hashed IP subnets.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
            {MOCK_FRAUD_CLUSTERS.map(c => (
              <div key={c.clusterId} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <code style={{ color: '#38BDF8', fontSize: '0.8rem' }}>{c.clusterId}</code>
                  <span style={{ color: c.riskColor, fontWeight: 700, fontSize: '0.85rem' }}>{c.riskScore}</span>
                </div>
                <div style={{ color: '#64748B', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  Hashed Fingerprint: <code>{c.deviceHash}</code>
                </div>
                <div style={{ backgroundColor: '#0F172A', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.75rem' }}>
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Linked Accounts:</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {c.linkedAccounts.map(a => (
                      <span key={a} style={{ backgroundColor: '#1E293B', color: '#F1F5F9', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                        👤 {a}
                      </span>
                    ))}
                  </div>
                </div>
                <p style={{ color: '#E2E8F0', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>
                  {c.triggerReason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: AI Co-Pilot Studio */}
      {activeTab === 'copilot' && (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.25rem' }}>
          <div style={cardStyle}>
            <h3 style={{ color: '#F8FAFC', fontSize: '1rem', marginTop: 0 }}>Organiser AI Co-Pilot</h3>
            <p style={{ color: '#64748B', fontSize: '0.8rem' }}>Draft compliant announcements and structured rules for community tournaments.</p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Draft Type</label>
              <select
                value={copilotType}
                onChange={e => setCopilotType(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}
              >
                <option value="ANNOUNCEMENT">Community Announcement</option>
                <option value="RULES_SUMMARY">Tournament Rules &amp; Protocol</option>
              </select>
            </div>

            <button
              onClick={handleGenerateCopilot}
              style={{
                width: '100%',
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.6rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              ✨ Generate AI Draft
            </button>
          </div>

          <div style={cardStyle}>
            {/* Safety Mandate Banner */}
            <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid #EAB308', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#FACC15' }}>
              ⚠️ <strong>Blueprint Section 43 Constraint:</strong> AI drafts are advisory only and must be confirmed by human organisers. AI never modifies match outcomes, scores, or financial balances.
            </div>

            {copilotDraft ? (
              <div>
                <pre style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '8px',
                  padding: '1rem',
                  color: '#E2E8F0',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                }}>
                  {copilotDraft}
                </pre>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button
                    onClick={() => alert('Draft copied to clipboard!')}
                    style={{ backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    ✓ Accept &amp; Copy Draft
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748B', padding: '3rem' }}>
                Click "Generate AI Draft" to synthesize rules or announcements.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Safe "View As" Simulator */}
      {activeTab === 'viewas' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem' }}>
          <div style={cardStyle}>
            <h3 style={{ color: '#F8FAFC', fontSize: '1rem', marginTop: 0 }}>View-As Simulator</h3>
            <p style={{ color: '#64748B', fontSize: '0.8rem' }}>Inspect client experience without impersonation, token generation, or session hijacking.</p>
            <button
              onClick={handleSimulateViewAs}
              style={{
                width: '100%',
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.6rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              Launch Simulator Preview
            </button>
          </div>

          <div style={cardStyle}>
            {/* Hard Security Gate Warning */}
            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3B82F6', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#60A5FA' }}>
              🔒 <strong>Security Gate Enforced:</strong> Impersonation prohibited. All actions taken in simulator are strictly read-only; no session tokens are issued.
            </div>

            {simulatedView ? (
              <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>🎮</span>
                    <div>
                      <strong style={{ color: '#F8FAFC' }}>{simulatedView.username}</strong>
                      <div style={{ color: '#64748B', fontSize: '0.75rem' }}>User ID: {simulatedView.userId}</div>
                    </div>
                  </div>
                  <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34D399', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                    Fair Play: {simulatedView.reputationScore}/100
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Masked Contact: </span>
                    <span style={{ color: '#F1F5F9' }}>{simulatedView.maskedEmail} • {simulatedView.maskedPhone}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Wallet Balance: </span>
                    <span style={{ color: '#FACC15', fontWeight: 600 }}>{simulatedView.readOnlyBalance}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748B', padding: '3rem' }}>
                Launch preview to inspect user client view safely.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
