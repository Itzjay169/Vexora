'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  FileCode, 
  ExternalLink, 
  Trophy, 
  Users, 
  Flame, 
  Clock, 
  AlertTriangle,
  Lock,
  ArrowUpRight,
  Sun,
  Moon
} from 'lucide-react';

export default function UIKitPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const isDark = theme === 'dark';

  const states = [
    { key: 'DRAFT', label: 'Draft', class: 'badge-state-draft' },
    { key: 'PENDING_REVIEW', label: 'Pending Review', class: 'badge-state-pending-review' },
    { key: 'SCHEDULED', label: 'Scheduled', class: 'badge-state-scheduled' },
    { key: 'REGISTRATION_OPEN', label: 'Registration Open', class: 'badge-state-registration-open' },
    { key: 'CHECK_IN', label: 'Check-In Live', class: 'badge-state-check-in' },
    { key: 'LIVE', label: 'Tournament Live', class: 'badge-state-live' },
    { key: 'RESULT_PENDING', label: 'Result Pending', class: 'badge-state-result-pending' },
    { key: 'DISPUTED', label: 'Disputed', class: 'badge-state-disputed' },
    { key: 'COMPLETED', label: 'Completed', class: 'badge-state-completed' },
    { key: 'SETTLED', label: 'Settled', class: 'badge-state-settled' },
    { key: 'ARCHIVED', label: 'Archived', class: 'badge-state-archived' },
  ];

  const bgColor = isDark ? '#0A0F1D' : '#F8FAFC';
  const cardBg = isDark ? '#131B2E' : '#FFFFFF';
  const borderColor = isDark ? '#1E293B' : '#E2E8F0';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const subtextColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <div style={{ backgroundColor: bgColor, color: textColor, minHeight: '100vh', padding: '3rem 2rem', transition: 'all 200ms ease' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header with Theme Toggle */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', borderBottom: `1px solid ${borderColor}`, paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              VEXORA DESIGN SYSTEM & UI KIT
            </h1>
            <p style={{ color: subtextColor, marginTop: '0.5rem' }}>
              Stitch-driven, WCAG AA Accessible Component Showcase (PDF Section 44)
            </p>
          </div>
          <button 
            onClick={toggleTheme}
            id="theme-toggle-btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 18px', 
              borderRadius: '8px', 
              background: isDark ? '#1E293B' : '#E2E8F0', 
              color: textColor, 
              border: `1px solid ${borderColor}`, 
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            {isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          </button>
        </header>

        {/* Section 1: Tournament State Machine Chips */}
        <section style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#6366F1' }}>
            1. Tournament Finite State Machine Chips (11 States)
          </h2>
          <p style={{ color: subtextColor, marginBottom: '1.25rem' }}>
            Strictly enforces the Section 4 lifecycle: <code style={{ color: '#A855F7' }}>DRAFT → ARCHIVED</code>.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {states.map(s => (
              <span key={s.key} className={`badge-chip ${s.class}`} id={`chip-${s.key.toLowerCase()}`}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }} />
                {s.label}
              </span>
            ))}
          </div>
        </section>

        {/* Section 2: Trust UI Patterns */}
        <section style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#38BDF8' }}>
            2. Trust UI Patterns (Section 25 & 44)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
            
            {/* Verified Badge */}
            <div style={{ background: cardBg, border: `1px solid ${borderColor}`, padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ color: subtextColor, fontSize: '0.875rem', marginBottom: '8px' }}>Verified Organiser Badge</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge-verified" id="badge-verified-sample">
                  <ShieldCheck size={14} /> VERIFIED HOST
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Delta Esports Org</span>
              </div>
            </div>

            {/* Evidence Hash Checkmark */}
            <div style={{ background: cardBg, border: `1px solid ${borderColor}`, padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ color: subtextColor, fontSize: '0.875rem', marginBottom: '8px' }}>Evidence SHA-256 Ingress Hash</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10B981" />
                <span className="badge-evidence-hash" id="badge-evidence-hash-sample">
                  sha256:7f83b165...7f4
                </span>
              </div>
            </div>

            {/* Formula Version Badge */}
            <div style={{ background: cardBg, border: `1px solid ${borderColor}`, padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ color: subtextColor, fontSize: '0.875rem', marginBottom: '8px' }}>Deterministic Scoring Schema</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCode size={16} color="#A855F7" />
                <span style={{ background: '#1E1B4B', color: '#A855F7', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #4F46E5' }}>
                  bgmi_br_v1.0.0
                </span>
                <span style={{ fontSize: '0.875rem', color: subtextColor }}>Official Rules</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Component Showcase */}
        <section style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: '#A855F7' }}>
            3. Core Components Library
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
            
            {/* Tournament Card */}
            <div id="component-tournament-card" style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)' }}>
              <div style={{ height: '140px', background: 'linear-gradient(135deg, #1E1B4B 0%, #311042 100%)', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                  BGMI BATTLE ROYALE
                </span>
                <span className="badge-chip badge-state-registration-open">Registration Open</span>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Vexora Apex Invitational - Season 1</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: subtextColor, fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  <span className="badge-verified"><ShieldCheck size={12} /> VERIFIED</span>
                  <span>Hosted by Phoenix Gaming</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', borderTop: `1px solid ${borderColor}`, paddingTop: '1rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: subtextColor }}>ENTRY</div>
                    <div style={{ fontWeight: 700, color: '#10B981' }}>100% FREE</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: subtextColor }}>ESCROW PRIZE</div>
                    <div style={{ fontWeight: 700, color: '#F59E0B' }}>15,000 pts</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: subtextColor }}>CAPACITY</div>
                    <div style={{ fontWeight: 700 }}>42 / 64 Teams</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bracket Match Node */}
            <div id="component-bracket-node" style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '14px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#6366F1' }}>QUARTER-FINALS • MATCH #4</span>
                <span className="badge-chip badge-state-live">LIVE</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: isDark ? '#1E293B' : '#F1F5F9', borderRadius: '8px', borderLeft: '4px solid #10B981' }}>
                  <span style={{ fontWeight: 600 }}>Team Soul</span>
                  <span style={{ fontWeight: 800, color: '#10B981' }}>2</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: isDark ? '#1E293B' : '#F1F5F9', borderRadius: '8px', borderLeft: '4px solid #64748B' }}>
                  <span style={{ fontWeight: 600, color: subtextColor }}>GodLike Esports</span>
                  <span style={{ fontWeight: 800, color: subtextColor }}>1</span>
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: subtextColor }}>
                <span>Room Code: Assigned</span>
                <span style={{ color: '#10B981' }}>Server Clock: UTC Synchronized</span>
              </div>
            </div>

            {/* Double-Entry Ledger Row */}
            <div id="component-ledger-row" style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '14px', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10B981', marginBottom: '1rem' }}>
                DOUBLE-ENTRY LEDGER TRANSACTION
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: isDark ? '#0F172A' : '#F8FAFC', borderRadius: '8px', border: `1px solid ${borderColor}` }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: subtextColor }}>tx_0192a8e4-b7c1-7f02</div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '2px' }}>TOURNAMENT_HOLD (Escrow Reserve)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#EF4444' }}>-500 pts</div>
                  <div style={{ fontSize: '0.75rem', color: '#10B981' }}>SUM = 0 VERIFIED</div>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: subtextColor, marginTop: '1rem' }}>
                Append-only trigger enforced: No database administrator can overwrite credit balances directly.
              </p>
            </div>

            {/* Error / Dispute State Card */}
            <div id="component-dispute-card" style={{ background: cardBg, border: `1px solid #EF4444`, borderRadius: '14px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontWeight: 700, marginBottom: '0.75rem' }}>
                <AlertTriangle size={18} /> SETTLEMENT FROZEN (Dispute Case #8821)
              </div>
              <p style={{ fontSize: '0.875rem', color: subtextColor, marginBottom: '1rem' }}>
                Conflicting score evidence uploaded by opposing captains. Funds held in escrow pending Moderator adjudication.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', background: '#450A0A', color: '#F87171', padding: '4px 8px', borderRadius: '4px' }}>
                  Evidence SHA-256 Preserved
                </span>
                <span style={{ fontSize: '0.75rem', background: '#1E293B', color: '#94A3B8', padding: '4px 8px', borderRadius: '4px' }}>
                  SLA: 4h
                </span>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
