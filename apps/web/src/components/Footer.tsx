import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--vx-border-subtle, #1E293B)',
        backgroundColor: 'var(--vx-surface, #0F172A)',
        color: 'var(--vx-text-secondary, #94A3B8)',
        padding: '3rem 1.5rem 2rem',
        marginTop: '4rem',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '2.5rem',
          marginBottom: '2.5rem',
        }}
      >
        {/* Brand & Mission */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
            <img
              src="/logo.png"
              alt="Vexora Esports"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                objectFit: 'cover',
                border: '1px solid rgba(99, 102, 241, 0.4)',
              }}
            />
            <span style={{ fontWeight: 800, color: 'var(--vx-text-primary, #F8FAFC)', fontSize: '1rem', letterSpacing: '0.05em' }}>
              VEXORA <span style={{ color: '#6366F1', fontSize: '0.8rem' }}>ESPORTS</span>
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', lineHeight: 1.6, margin: 0 }}>
            The trust-first competitive gaming ecosystem for BGMI, Free Fire MAX, and CODM. Deterministic scoring, zero silent edits, and guaranteed prize escrow.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#34D399',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              ✓ F2P ZERO COMMISSION
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                color: '#38BDF8',
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
            >
              🔒 SHA-256 VERIFIED
            </span>
          </div>
        </div>

        {/* Players */}
        <div>
          <h4 style={{ color: 'var(--vx-text-primary, #F8FAFC)', fontSize: '0.875rem', marginBottom: '0.875rem', fontWeight: 600 }}>
            For Players
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
            <li><Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Tournament Discovery</Link></li>
            <li><Link href="/live" style={{ color: 'inherit', textDecoration: 'none' }}>Live Scoreboard</Link></li>
            <li><Link href="/leaderboard" style={{ color: 'inherit', textDecoration: 'none' }}>Community Leaderboard</Link></li>
            <li><Link href="/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>Player Analytics</Link></li>
            <li><Link href="/redeem" style={{ color: 'inherit', textDecoration: 'none' }}>Redeem Platform Codes</Link></li>
          </ul>
        </div>

        {/* Organisers */}
        <div>
          <h4 style={{ color: 'var(--vx-text-primary, #F8FAFC)', fontSize: '0.875rem', marginBottom: '0.875rem', fontWeight: 600 }}>
            For Organisers
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
            <li><Link href="/organiser" style={{ color: 'inherit', textDecoration: 'none' }}>Organiser Console</Link></li>
            <li><Link href="/verify" style={{ color: 'inherit', textDecoration: 'none' }}>Verification & Tiers</Link></li>
            <li><Link href="/payments" style={{ color: 'inherit', textDecoration: 'none' }}>Prize Escrow Tracking</Link></li>
            <li><Link href="/payouts" style={{ color: 'inherit', textDecoration: 'none' }}>Settlement & Reconciliation</Link></li>
            <li><Link href="/ui-kit" style={{ color: 'inherit', textDecoration: 'none' }}>Design System Tokens</Link></li>
          </ul>
        </div>

        {/* Governance & Trust */}
        <div>
          <h4 style={{ color: 'var(--vx-text-primary, #F8FAFC)', fontSize: '0.875rem', marginBottom: '0.875rem', fontWeight: 600 }}>
            Governance & Compliance
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
            <li><a href="http://localhost:3001" style={{ color: 'inherit', textDecoration: 'none' }}>Admin Zero-Trust Console</a></li>
            <li><Link href="/security" style={{ color: 'inherit', textDecoration: 'none' }}>Responsible Disclosure (RFC 9116)</Link></li>
            <li><Link href="/status" style={{ color: 'inherit', textDecoration: 'none' }}>System Status & Telemetry</Link></li>
            <li><span style={{ color: 'var(--vx-text-muted, #64748B)' }}>DPDP Act 2023 Compliant</span></li>
            <li><span style={{ color: 'var(--vx-text-muted, #64748B)' }}>IT Rules 2021 Grievance Redressal</span></li>
            <li><span style={{ color: 'var(--vx-text-muted, #64748B)' }}>Closed-Loop Platform Credits</span></li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          borderTop: '1px solid var(--vx-border-subtle, #1E293B)',
          paddingTop: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          fontSize: '0.75rem',
        }}
      >
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} Vexora Esports. All rights reserved. Cross-platform web & Android native.
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>English</span>
          <span>•</span>
          <span>हिंदी</span>
          <span>•</span>
          <span>ଓଡ଼ିଆ</span>
        </div>
      </div>
    </footer>
  );
}
