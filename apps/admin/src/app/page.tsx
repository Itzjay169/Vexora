'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '../components/AdminShell';
import { StepUpModal } from '../components/StepUpModal';

export default function AdminDashboardPage() {
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleSensitiveAction = () => {
    setStepUpOpen(true);
  };

  return (
    <AdminShell>
      <div>
        {/* Main Console Header */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1E293B',
            paddingBottom: '1.25rem',
            marginBottom: '2rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6366F1', fontWeight: 700, letterSpacing: '0.05em' }}>
                VEXORA ADMIN
              </span>
              <span style={{ color: '#475569' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Zero-Trust Console</span>
            </div>
            <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700, color: '#F8FAFC' }}>
              System Health & Moderation Overview
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#94A3B8', fontSize: '0.875rem' }}>
              Zero-Trust Console with active cryptographic verification and dual-approval queue.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link
              href="/feature-flags"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#CBD5E1',
                fontSize: '0.8125rem',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              🚩 Feature Flags
            </Link>
            <Link
              href="/audit"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                color: '#34D399',
                fontSize: '0.8125rem',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              ⛓️ Audit Hash Chain
            </Link>
          </div>
        </header>

        {actionNotice && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10B981',
              borderRadius: '8px',
              color: '#34D399',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
            }}
          >
            ✓ {actionNotice}
          </div>
        )}

        {/* ─── Metric Cards Grid ────────────────────────────────────────────── */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ background: '#0F172A', padding: '1.5rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem' }}>Active Tournaments</p>
            <h2 style={{ margin: '0.5rem 0 0', fontSize: '2rem', color: '#F8FAFC' }}>0</h2>
            <span style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '0.25rem', display: 'block' }}>
              Free-Tier Launch Enforced
            </span>
          </div>

          <div style={{ background: '#0F172A', padding: '1.5rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem' }}>Pending Disputes</p>
            <h2 style={{ margin: '0.5rem 0 0', fontSize: '2rem', color: '#F8FAFC' }}>0</h2>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.25rem', display: 'block' }}>
              Avg resolution SLA: 4h
            </span>
          </div>

          <div style={{ background: '#0F172A', padding: '1.5rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem' }}>Organisers Awaiting KYC</p>
            <h2 style={{ margin: '0.5rem 0 0', fontSize: '2rem', color: '#F8FAFC' }}>0</h2>
            <span style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '0.25rem', display: 'block' }}>
              Identity & Trust Verification
            </span>
          </div>

          <div style={{ background: '#0F172A', padding: '1.5rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem' }}>Escrow Total Held</p>
            <h2 style={{ margin: '0.5rem 0 0', fontSize: '2rem', color: '#F8FAFC' }}>0 credits</h2>
            <span style={{ fontSize: '0.75rem', color: '#38BDF8', marginTop: '0.25rem', display: 'block' }}>
              Zero-Sum Ledger Balanced
            </span>
          </div>
        </section>

        {/* ─── Maker-Checker & Security Highlights ─────────────────────────── */}
        <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          {/* Maker-Checker Queue */}
          <div
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: '12px',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#F8FAFC', fontWeight: 600 }}>
                  Financial Maker-Checker Queue
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: '#94A3B8', fontSize: '0.8125rem' }}>
                  Sensitive actions require independent approval. Creator cannot approve own request.
                </p>
              </div>
              <span
                style={{
                  padding: '0.25rem 0.625rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: '9999px',
                  color: '#818CF8',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                0 Pending Review
              </span>
            </div>

            <div
              style={{
                padding: '2rem',
                backgroundColor: '#131B2E',
                borderRadius: '8px',
                border: '1px dashed #334155',
                textAlign: 'center',
                color: '#64748B',
                fontSize: '0.875rem',
              }}
            >
              <p style={{ margin: 0 }}>No pending Maker-Checker requests at this time.</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem' }}>
                All high-value payouts, code batches, and wallet adjustments will appear here for dual approval.
              </p>
            </div>
          </div>

          {/* Quick Security Panel */}
          <div
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: '12px',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#F8FAFC', fontWeight: 600 }}>
              Zero-Trust Controls
            </h3>
            <p style={{ margin: '0.25rem 0 1.25rem', color: '#94A3B8', fontSize: '0.8125rem' }}>
              Security gates & privilege escalation
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#1E293B',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ color: '#E2E8F0' }}>Audit Hash Chain</span>
                <span style={{ color: '#34D399', fontWeight: 600 }}>Verified ✓</span>
              </div>

              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#1E293B',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ color: '#E2E8F0' }}>Mandatory Admin MFA</span>
                <span style={{ color: '#38BDF8', fontWeight: 600 }}>Enforced ✓</span>
              </div>

              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#1E293B',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ color: '#E2E8F0' }}>Break-Glass Elevation</span>
                <span style={{ color: '#94A3B8' }}>Standby (0 active)</span>
              </div>

              <button
                onClick={handleSensitiveAction}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.625rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid #6366F1',
                  borderRadius: '8px',
                  color: '#A5B4FC',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Test Step-Up Authentication Modal
              </button>
            </div>
          </div>
        </section>
      </div>

      <StepUpModal
        isOpen={stepUpOpen}
        title="Admin Step-Up Re-Authentication"
        description="Verify your 6-digit MFA code to test the Zero-Trust step-up component."
        onSuccess={() => {
          setStepUpOpen(false);
          setActionNotice('Step-up authentication verified successfully.');
          setTimeout(() => setActionNotice(null), 4000);
        }}
        onCancel={() => setStepUpOpen(false)}
      />
    </AdminShell>
  );
}
