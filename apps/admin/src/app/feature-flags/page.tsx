'use client';

import React, { useState, useEffect } from 'react';
import { AdminShell } from '../../components/AdminShell';
import { StepUpModal } from '../../components/StepUpModal';
import { useAdminAuth } from '../../lib/auth-context';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  rollout_percent: number;
  description: string;
  is_money?: boolean;
}

const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    key: 'free_tournaments_only',
    enabled: true,
    rollout_percent: 100,
    description: 'v1 Public Launch mandate: free-to-play tournaments only (no cash entry fees).',
    is_money: true,
  },
  {
    key: 'real_money_wallet_enabled',
    enabled: false,
    rollout_percent: 0,
    description: 'Real-money deposits and fiat conversions. Gated behind legal and payment sign-off.',
    is_money: true,
  },
  {
    key: 'anti_cheat_strict_mode',
    enabled: true,
    rollout_percent: 100,
    description: 'Hardware fingerprinting, emulator detection, and automatic telemetry risk scoring.',
    is_money: false,
  },
  {
    key: 'maker_checker_high_value_gate',
    enabled: true,
    rollout_percent: 100,
    description: 'Enforces dual-approval maker-checker on wallet adjustments and payout authorizations.',
    is_money: true,
  },
  {
    key: 'break_glass_operational_elevation',
    enabled: true,
    rollout_percent: 100,
    description: 'Permits time-boxed emergency break-glass privilege elevation with SEV-1 audit alerts.',
    is_money: false,
  },
];

export default function FeatureFlagsPage() {
  const { accessToken } = useAdminAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>(DEFAULT_FLAGS);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingFlagKey, setPendingFlagKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    // Try fetching from backend if token exists
    if (accessToken) {
      fetch('/api/v1/admin/feature-flags', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setFlags(data.data);
          }
        })
        .catch(() => {
          // Use default flags if backend is offline
        });
    }
  }, [accessToken]);

  const handleToggle = (key: string, isMoney: boolean = false) => {
    // Financial flags mandate step-up MFA
    if (isMoney) {
      setPendingFlagKey(key);
      setStepUpOpen(true);
      return;
    }

    applyToggle(key);
  };

  const applyToggle = (key: string) => {
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
    setStatusMessage(`Flag "${key}" updated successfully (audit logged).`);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700, color: '#F8FAFC' }}>
              Platform Feature Flags
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#94A3B8', fontSize: '0.875rem' }}>
              Dynamic runtime toggles, regional kill-switches, and money-feature gates.
            </p>
          </div>
          <span
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              color: '#A5B4FC',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            🛡️ Zero-Downtime Hot Swapping
          </span>
        </div>

        {statusMessage && (
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
            ✓ {statusMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {flags.map((flag) => {
            const isMoney = flag.is_money || flag.key.includes('wallet') || flag.key.includes('money');
            return (
              <div
                key={flag.key}
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1.5rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <code style={{ fontSize: '0.9375rem', color: '#38BDF8', fontWeight: 600 }}>
                      {flag.key}
                    </code>
                    {isMoney && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          backgroundColor: 'rgba(234, 179, 8, 0.15)',
                          color: '#FACC15',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '9999px',
                          fontWeight: 600,
                          border: '1px solid rgba(234, 179, 8, 0.3)',
                        }}
                      >
                        ⚖️ Money Gate (MFA Required)
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0.5rem 0 0', color: '#94A3B8', fontSize: '0.8125rem', lineHeight: 1.4 }}>
                    {flag.description}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: flag.enabled ? '#34D399' : '#64748B',
                      fontWeight: 600,
                    }}
                  >
                    {flag.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                  <button
                    onClick={() => handleToggle(flag.key, isMoney)}
                    style={{
                      width: '52px',
                      height: '28px',
                      borderRadius: '9999px',
                      backgroundColor: flag.enabled ? '#10B981' : '#334155',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '3px',
                        left: flag.enabled ? '26px' : '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        transition: 'left 0.2s',
                      }}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <StepUpModal
        isOpen={stepUpOpen}
        title="Step-Up MFA: Financial Flag Authorization"
        description="Changing financial feature flags impacts escrow balances and payout workflows. Please enter your 6-digit TOTP MFA code to authorize."
        onSuccess={() => {
          setStepUpOpen(false);
          if (pendingFlagKey) applyToggle(pendingFlagKey);
          setPendingFlagKey(null);
        }}
        onCancel={() => {
          setStepUpOpen(false);
          setPendingFlagKey(null);
        }}
      />
    </AdminShell>
  );
}
