'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../lib/auth-context';

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginStep1, verifyMfaStep2 } = useAdminAuth();

  // Step 1 state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'CREDENTIALS' | 'MFA'>('CREDENTIALS');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  // Step 2 state (MFA)
  const [mfaCode, setMfaCode] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Identifier and password are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await loginStep1(identifier, password);
      setChallengeToken(res.challengeToken);
      setStep('MFA');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken || !/^\d{6}$/.test(mfaCode.trim())) {
      setError('Please enter a valid 6-digit MFA code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verifyMfaStep2(challengeToken, mfaCode.trim());
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'MFA code verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0B0F19',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '0.75rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontSize: '1.75rem' }}>🛡️</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', color: '#F8FAFC', margin: 0, fontWeight: 700 }}>
            VEXORA ADMIN
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.375rem' }}>
            Zero-Trust Console & Administration
          </p>

          <div
            style={{
              marginTop: '1rem',
              display: 'inline-block',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '9999px',
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              color: '#F87171',
              fontWeight: 600,
            }}
          >
            🔒 Mandatory MFA Enforced
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #EF4444',
              borderRadius: '8px',
              color: '#F87171',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
            }}
          >
            {error}
          </div>
        )}

        {/* ─── Step 1: Credentials Form ────────────────────────────────────────── */}
        {step === 'CREDENTIALS' && (
          <form onSubmit={handleStep1Submit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="identifier"
                style={{ display: 'block', fontSize: '0.75rem', color: '#CBD5E1', marginBottom: '0.5rem', fontWeight: 500 }}
              >
                Username or Administrator Email
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@vexora.gg"
                required
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: '0.75rem', color: '#CBD5E1', marginBottom: '0.5rem', fontWeight: 500 }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#6366F1',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Verifying Credentials...' : 'Proceed to MFA Verification →'}
            </button>
          </form>
        )}

        {/* ─── Step 2: Mandatory MFA Verification ──────────────────────────────── */}
        {step === 'MFA' && (
          <form onSubmit={handleStep2Submit}>
            <div
              style={{
                padding: '0.875rem',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, color: '#A5B4FC', fontSize: '0.8125rem', fontWeight: 500 }}>
                Step 2: Enter the 6-digit TOTP code from your registered Authenticator device.
              </p>
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label
                htmlFor="mfa-code"
                style={{ display: 'block', fontSize: '0.75rem', color: '#CBD5E1', marginBottom: '0.5rem', fontWeight: 500, textAlign: 'center' }}
              >
                6-Digit TOTP Authentication Code
              </label>
              <input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.875rem 1rem',
                  backgroundColor: '#1E293B',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  fontSize: '1.5rem',
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: mfaCode.length === 6 ? '#10B981' : '#334155',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: mfaCode.length === 6 ? 'pointer' : 'not-allowed',
                marginBottom: '0.75rem',
              }}
            >
              {loading ? 'Verifying TOTP...' : 'Verify MFA & Enter Console'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('CREDENTIALS');
                setChallengeToken(null);
                setMfaCode('');
                setError(null);
              }}
              style={{
                width: '100%',
                padding: '0.625rem',
                borderRadius: '6px',
                border: '1px solid #334155',
                backgroundColor: 'transparent',
                color: '#94A3B8',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              ← Back to login credentials
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
