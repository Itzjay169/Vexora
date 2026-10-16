import React from 'react';

export default function HomePage() {
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
      <header>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          VEXORA ESPORTS
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#94A3B8', marginTop: '1rem' }}>
          The Trust-First Competitive Gaming Ecosystem. Verified Organisers. Zero Silent Edits. Deterministic Scoring.
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginTop: '4rem', textAlign: 'left' }}>
        <div style={{ background: '#131B2E', padding: '2rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#38BDF8' }}>Verified Tournaments</h2>
          <p style={{ color: '#94A3B8' }}>Compete in Battlegrounds Mobile India, Free Fire, and CODM with guaranteed prize escrow holds.</p>
        </div>
        <div style={{ background: '#131B2E', padding: '2rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#A855F7' }}>Transparent Adjudication</h2>
          <p style={{ color: '#94A3B8' }}>Every result backed by SHA-256 evidence hashing and immutable audit trails.</p>
        </div>
        <div style={{ background: '#131B2E', padding: '2rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#10B981' }}>Double-Entry Ledger</h2>
          <p style={{ color: '#94A3B8' }}>Closed-loop platform credits with zero-sum accounting and maker-checker financial controls.</p>
        </div>
      </section>
    </main>
  );
}
