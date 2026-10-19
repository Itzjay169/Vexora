'use client';

import React, { useState } from 'react';
import { useAdminAuth } from '../lib/auth-context';

interface StepUpModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  actionDescription?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StepUpModal({
  isOpen,
  title = 'Step-Up Authentication Required',
  description,
  actionDescription,
  onSuccess,
  onCancel,
}: StepUpModalProps) {
  const displayDescription = actionDescription || description || 'This is a sensitive administrative action. Please re-enter your 6-digit TOTP MFA code to proceed.';
  const { triggerStepUp } = useAdminAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Please enter a valid 6-digit MFA code');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await triggerStepUp(code.trim());
      setCode('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'MFA step-up verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#0F172A',
          border: '1px solid #334155',
          borderRadius: '12px',
          maxWidth: '440px',
          width: '100%',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🔐</span>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#F8FAFC', fontWeight: 600 }}>{title}</h2>
        </div>

        <p style={{ margin: '0 0 1.5rem', color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.5 }}>
          {displayDescription}
        </p>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #EF4444',
              borderRadius: '8px',
              color: '#F87171',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="stepup-code"
              style={{ display: 'block', fontSize: '0.75rem', color: '#CBD5E1', marginBottom: '0.5rem', fontWeight: 500 }}
            >
              6-Digit Authenticator Code
            </label>
            <input
              id="stepup-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.75rem 1rem',
                backgroundColor: '#1E293B',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#F8FAFC',
                fontSize: '1.25rem',
                letterSpacing: '0.25em',
                textAlign: 'center',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '6px',
                border: '1px solid #475569',
                backgroundColor: 'transparent',
                color: '#94A3B8',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: code.length === 6 ? '#6366F1' : '#475569',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: code.length === 6 ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Verifying...' : 'Authorize Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
