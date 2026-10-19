'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

interface TournamentItem {
  id: string;
  title: string;
  game: 'BGMI' | 'Free Fire MAX' | 'CODM' | 'Valorant';
  format: string;
  prizePool: string;
  entryFee: string;
  registeredTeams: number;
  maxTeams: number;
  status: 'REGISTRATION_OPEN' | 'CHECK_IN' | 'LIVE' | 'COMPLETED';
  statusLabel: string;
  statusBadgeClass: string;
  schedule: string;
  organiserName: string;
  isOrganiserVerified: boolean;
  trustScore: number;
  formulaVersion: string;
}

const TOURNAMENTS: TournamentItem[] = [
  {
    id: 'trn_bgmi_pro_cup_2026',
    title: 'BGMI Pro Ignition Championship — Season 4',
    game: 'BGMI',
    format: 'Battle Royale Squad (TPP)',
    prizePool: '₹1,50,000',
    entryFee: 'FREE (F2P Launch)',
    registeredTeams: 88,
    maxTeams: 100,
    status: 'REGISTRATION_OPEN',
    statusLabel: 'Registration Open',
    statusBadgeClass: 'badge-state-registration-open',
    schedule: 'Starts Today at 19:00 IST',
    organiserName: 'Apex Pro Circuit',
    isOrganiserVerified: true,
    trustScore: 98,
    formulaVersion: 'v2.4 (SHA-256 Validated)',
  },
  {
    id: 'trn_ff_clash_squad',
    title: 'Free Fire MAX Strike Cup — Grand Finals',
    game: 'Free Fire MAX',
    format: 'Clash Squad 4v4',
    prizePool: '₹75,000',
    entryFee: 'FREE (F2P Launch)',
    registeredTeams: 32,
    maxTeams: 32,
    status: 'LIVE',
    statusLabel: 'Tournament Live',
    statusBadgeClass: 'badge-state-live',
    schedule: 'Match #3 Underway',
    organiserName: 'Phoenix Esports League',
    isOrganiserVerified: true,
    trustScore: 96,
    formulaVersion: 'v2.1 (Deterministic)',
  },
  {
    id: 'trn_codm_snd_invitational',
    title: 'Call of Duty Mobile Search & Destroy Masters',
    game: 'CODM',
    format: '5v5 Search & Destroy',
    prizePool: '₹50,000',
    entryFee: 'FREE (F2P Launch)',
    registeredTeams: 54,
    maxTeams: 64,
    status: 'CHECK_IN',
    statusLabel: 'Check-In Live',
    statusBadgeClass: 'badge-state-check-in',
    schedule: 'Lobby release in 15 mins',
    organiserName: 'Black Ops Arena',
    isOrganiserVerified: true,
    trustScore: 94,
    formulaVersion: 'v3.0 (Anti-Smurf)',
  },
  {
    id: 'trn_bgmi_weekend_brawl',
    title: 'Weekend Community Scrims — Tier 1 & 2',
    game: 'BGMI',
    format: 'Battle Royale Squad',
    prizePool: '₹25,000',
    entryFee: 'FREE (F2P Launch)',
    registeredTeams: 16,
    maxTeams: 25,
    status: 'REGISTRATION_OPEN',
    statusLabel: 'Registration Open',
    statusBadgeClass: 'badge-state-registration-open',
    schedule: 'Starts Tomorrow at 18:00 IST',
    organiserName: 'Vexora Community Hub',
    isOrganiserVerified: true,
    trustScore: 99,
    formulaVersion: 'v2.4 (Standard)',
  },
  {
    id: 'trn_val_spike_rush',
    title: 'Valorant Spike Challenge — Invitational',
    game: 'Valorant',
    format: '5v5 Standard Tournament',
    prizePool: '₹1,00,000',
    entryFee: 'FREE (F2P Launch)',
    registeredTeams: 16,
    maxTeams: 16,
    status: 'COMPLETED',
    statusLabel: 'Completed & Settled',
    statusBadgeClass: 'badge-state-completed',
    schedule: 'Settled Yesterday',
    organiserName: 'Vanguard Gaming India',
    isOrganiserVerified: true,
    trustScore: 97,
    formulaVersion: 'v2.0 (Double-Entry Ledger)',
  },
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const filteredTournaments = useMemo(() => {
    return TOURNAMENTS.filter((t) => {
      const matchGame = selectedGame === 'ALL' || t.game === selectedGame;
      const matchStatus = selectedStatus === 'ALL' || t.status === selectedStatus;
      const matchSearch =
        searchQuery.trim() === '' ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.game.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.organiserName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchGame && matchStatus && matchSearch;
    });
  }, [searchQuery, selectedGame, selectedStatus]);

  const games = ['ALL', 'BGMI', 'Free Fire MAX', 'CODM', 'Valorant'];

  return (
    <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      {/* ─── Hero Section ─────────────────────────────────────────────────── */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          marginBottom: '2.5rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.85rem', borderRadius: '9999px', backgroundColor: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.3)', color: '#06B6D4', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '1.25rem' }}>
          <span>🛡️</span> VEXORA ESPORTS • ZERO PLATFORM COMMISSION F2P LAUNCH
        </div>

        <h1
          id="hero-title"
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900,
            lineHeight: 1.15,
            margin: '0 0 1rem',
            background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}
        >
          VEXORA ESPORTS
        </h1>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.15rem', color: '#38BDF8', fontWeight: 700 }}>
            Verified Tournaments
          </span>
          <span style={{ color: '#64748B' }}>•</span>
          <span style={{ fontSize: '1.15rem', color: '#F8FAFC', fontWeight: 600 }}>
            Guaranteed Trust
          </span>
        </div>

        <p
          style={{
            fontSize: 'clamp(0.95rem, 2vw, 1.2rem)',
            color: 'var(--vx-text-secondary, #94A3B8)',
            maxWidth: '750px',
            margin: '0 auto 2rem',
            lineHeight: 1.6,
          }}
        >
          India’s premier esports competition platform. Verified organisers, immutable SHA-256 match evidence, and instant prize escrow settlement with closed-loop ledger protection.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
          <a
            href="#tournaments-feed"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              backgroundColor: 'var(--vx-brand-primary, #6366F1)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.9375rem',
              textDecoration: 'none',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
              transition: 'transform 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>🏆</span> Explore Tournaments
          </a>
          <Link
            href="/live"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              backgroundColor: 'var(--vx-surface-elevated, #131B2E)',
              color: '#F8FAFC',
              fontWeight: 600,
              fontSize: '0.9375rem',
              textDecoration: 'none',
              border: '1px solid var(--vx-border, #334155)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ color: '#FB7185' }}>●</span> Watch Live Board
          </Link>
          <Link
            href="/organiser"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              color: '#C084FC',
              fontWeight: 600,
              fontSize: '0.9375rem',
              textDecoration: 'none',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>🛡️</span> Organiser Operations
          </Link>
        </div>
      </section>

      {/* ─── Trust Pillars ────────────────────────────────────────────────── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          marginBottom: '3rem',
        }}
      >
        <div id="card-tournaments" style={{ backgroundColor: 'var(--vx-surface-elevated, #131B2E)', border: '1px solid var(--vx-border, #334155)', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>🔒</div>
          <h3 style={{ fontSize: '1.05rem', color: '#38BDF8', margin: '0 0 0.5rem', fontWeight: 700 }}>
            Verified Tournaments
          </h3>
          <p style={{ color: 'var(--vx-text-secondary, #94A3B8)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
            Organisers lock prize pools before registrations open. Compete in BGMI, Free Fire MAX, and CODM with guaranteed prize escrow holds.
          </p>
        </div>

        <div id="card-adjudication" style={{ backgroundColor: 'var(--vx-surface-elevated, #131B2E)', border: '1px solid var(--vx-border, #334155)', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⚖️</div>
          <h3 style={{ fontSize: '1.05rem', color: '#A855F7', margin: '0 0 0.5rem', fontWeight: 700 }}>
            Transparent Adjudication
          </h3>
          <p style={{ color: 'var(--vx-text-secondary, #94A3B8)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
            Every result backed by SHA-256 evidence hashing and immutable audit trails. Automated conflict resolution with a 48-hour appeal window.
          </p>
        </div>

        <div id="card-ledger" style={{ backgroundColor: 'var(--vx-surface-elevated, #131B2E)', border: '1px solid var(--vx-border, #334155)', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⚡</div>
          <h3 style={{ fontSize: '1.05rem', color: '#10B981', margin: '0 0 0.5rem', fontWeight: 700 }}>
            Double-Entry Ledger
          </h3>
          <p style={{ color: 'var(--vx-text-secondary, #94A3B8)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
            Closed-loop platform credits with zero-sum accounting and maker-checker financial controls. Instant disbursement upon match completion.
          </p>
        </div>
      </section>

      {/* ─── Tournament Discovery Feed ────────────────────────────────────── */}
      <section id="tournaments-feed" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--vx-text-primary, #F8FAFC)' }}>
              🏆 Active Tournaments & Competitions
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--vx-text-secondary, #94A3B8)', margin: '0.25rem 0 0' }}>
              Showing {filteredTournaments.length} verified events ready for registration
            </p>
          </div>

          {/* Search Box */}
          <div style={{ width: '100%', maxWidth: '320px' }}>
            <input
              type="text"
              placeholder="Search tournament, game, or organiser..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search tournaments"
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--vx-border, #334155)',
                backgroundColor: 'var(--vx-surface, #0F172A)',
                color: 'var(--vx-text-primary, #F8FAFC)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.75rem' }}>
          {games.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGame(g)}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: selectedGame === g ? '1px solid #6366F1' : '1px solid var(--vx-border, #334155)',
                backgroundColor: selectedGame === g ? 'rgba(99, 102, 241, 0.2)' : 'var(--vx-surface, #0F172A)',
                color: selectedGame === g ? '#818CF8' : 'var(--vx-text-secondary, #94A3B8)',
                transition: 'all 0.15s ease',
              }}
            >
              {g === 'ALL' ? 'All Games' : g}
            </button>
          ))}
        </div>

        {/* Tournament Cards Grid */}
        {filteredTournaments.length === 0 ? (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--vx-surface-elevated, #131B2E)',
              borderRadius: '12px',
              border: '1px solid var(--vx-border, #334155)',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
            <h3 style={{ color: 'var(--vx-text-primary, #F8FAFC)', margin: 0 }}>No tournaments found</h3>
            <p style={{ color: 'var(--vx-text-muted, #64748B)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Try adjusting your search query or game filters.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: '1.25rem',
            }}
          >
            {filteredTournaments.map((trn) => {
              const capacityPct = Math.round((trn.registeredTeams / trn.maxTeams) * 100);
              return (
                <div
                  key={trn.id}
                  style={{
                    backgroundColor: 'var(--vx-surface-elevated, #131B2E)',
                    border: '1px solid var(--vx-border, #334155)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--vx-shadow-card)',
                    transition: 'border-color 0.15s ease, transform 0.15s ease',
                  }}
                >
                  <div>
                    {/* Header: Game chip & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#06B6D4',
                          backgroundColor: 'rgba(6, 182, 212, 0.12)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                        }}
                      >
                        {trn.game}
                      </span>
                      <span className={`badge-chip ${trn.statusBadgeClass}`}>
                        {trn.statusLabel}
                      </span>
                    </div>

                    {/* Tournament Title */}
                    <h3
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: 'var(--vx-text-primary, #F8FAFC)',
                        margin: '0 0 0.5rem',
                        lineHeight: 1.35,
                      }}
                    >
                      {trn.title}
                    </h3>

                    {/* Format & Schedule */}
                    <p style={{ fontSize: '0.8125rem', color: 'var(--vx-text-secondary, #94A3B8)', margin: '0 0 0.75rem' }}>
                      {trn.format} • {trn.schedule}
                    </p>

                    {/* Organiser Trust Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.75rem',
                        color: 'var(--vx-text-muted, #64748B)',
                        marginBottom: '1rem',
                      }}
                    >
                      <span>Organiser:</span>
                      <span style={{ color: 'var(--vx-text-primary, #F8FAFC)', fontWeight: 600 }}>
                        {trn.organiserName}
                      </span>
                      {trn.isOrganiserVerified && (
                        <span className="badge-verified" title={`Trust Score: ${trn.trustScore}/100`}>
                          ✓ Verified ({trn.trustScore}%)
                        </span>
                      )}
                    </div>

                    {/* Capacity Bar */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--vx-text-secondary, #94A3B8)' }}>Registered Capacity</span>
                        <span style={{ fontWeight: 600, color: capacityPct >= 90 ? '#EF4444' : '#10B981' }}>
                          {trn.registeredTeams} / {trn.maxTeams} Teams ({capacityPct}%)
                        </span>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '6px',
                          backgroundColor: '#1E293B',
                          borderRadius: '9999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${capacityPct}%`,
                            height: '100%',
                            backgroundColor: capacityPct >= 90 ? '#EF4444' : '#6366F1',
                            borderRadius: '9999px',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prize & Action Footer */}
                  <div
                    style={{
                      borderTop: '1px solid var(--vx-border-subtle, #1E293B)',
                      paddingTop: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--vx-text-muted, #64748B)', textTransform: 'uppercase' }}>
                        Prize Pool
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10B981' }}>
                        {trn.prizePool}
                      </div>
                    </div>

                    <Link
                      href={trn.status === 'LIVE' ? '/live' : '/dashboard'}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        backgroundColor:
                          trn.status === 'LIVE'
                            ? '#E11D48'
                            : 'var(--vx-brand-primary, #6366F1)',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        minHeight: '38px',
                      }}
                    >
                      {trn.status === 'LIVE' ? (
                        <>
                          <span style={{ fontSize: '0.65rem' }}>●</span> Watch Live
                        </>
                      ) : (
                        'Register Team'
                      )}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
