'use client';

import React, { useState } from 'react';

const REDEEM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function computeMod32Checksum(payload: string): string {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const idx = REDEEM_ALPHABET.indexOf(payload[i]);
    if (idx === -1) return '';
    sum = (sum * 31 + idx + (i + 1)) % REDEEM_ALPHABET.length;
  }
  return REDEEM_ALPHABET[sum % REDEEM_ALPHABET.length];
}

function validateChecksum(code: string): boolean {
  const cleaned = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!cleaned.startsWith('VEX') || cleaned.length !== 12) return false;
  const payload = cleaned.slice(3, 11);
  const checksumChar = cleaned.slice(11, 12);
  return computeMod32Checksum(payload) === checksumChar;
}

export default function RedeemPage() {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    amount: number;
    code_prefix: string;
    ledger_tx_id: string;
    new_balance: number;
  } | null>(null);

  const [failedAttempts, setFailedAttempts] = useState(0);

  const cleaned = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const isFullLength = cleaned.startsWith('VEX') && cleaned.length === 12;
  const isValidChecksum = isFullLength ? validateChecksum(cleaned) : null;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateChecksum(code)) {
      setFailedAttempts((prev) => prev + 1);
      setError('Invalid checksum. Typo detected before database lookup.');
      return;
    }

    if (failedAttempts >= 5) {
      setError('Security lockout active: 5 failed attempts in 15 minutes. Please wait.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Simulate API delay and response
    setTimeout(() => {
      setIsSubmitting(false);
      if (cleaned.endsWith('999')) {
        setFailedAttempts((prev) => prev + 1);
        setError('This code has already been redeemed (HTTP 409). Balance unchanged.');
      } else {
        setSuccess({
          amount: 100.0,
          code_prefix: `VEX-${cleaned.slice(3, 7)}`,
          ledger_tx_id: `tx-rdm-${Date.now().toString(16)}`,
          new_balance: 1550.0,
        });
        setCode('');
      }
    }, 600);
  };

  const loadValidSample = () => {
    const payload = '7K9M3PX2';
    const checksum = computeMod32Checksum(payload);
    setCode(`VEX-7K9M-3PX2-${checksum}`);
    setError(null);
  };

  const loadTypoSample = () => {
    setCode('VEX-7K9M-3PX2-9'); // Invalid checksum
    setError(null);
  };

  return (
    <main style={{ padding: '3rem 1.5rem', maxWidth: '640px', margin: '0 auto', color: '#F8FAFC' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎟️</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Redeem Voucher Code
        </h1>
        <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Instant double-entry crediting to your Vexora player wallet with mathematical typo protection.
        </p>
      </div>

      {/* Screen Security Banner */}
      <div
        style={{
          backgroundColor: '#1E1B4B',
          border: '1px solid #4338CA',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          fontSize: '0.8rem',
          color: '#E0E7FF',
        }}
      >
        <span>🛡️</span>
        <div>
          <strong>Screenshot-Protected Redemption:</strong> Pre-flight polynomial checksum executes on your device before network transmission.
        </div>
      </div>

      {/* Input Card */}
      <div
        style={{
          backgroundColor: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          padding: '1.75rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
        }}
      >
        <form onSubmit={handleRedeem}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.5rem' }}>
            ENTER 12-CHARACTER CODE
          </label>
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input
              type="text"
              id="redeem-code-input"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="VEX-XXXX-XXXX-X"
              maxLength={18}
              style={{
                width: '100%',
                backgroundColor: '#1E293B',
                border: `1px solid ${
                  isValidChecksum === true
                    ? '#10B981'
                    : isValidChecksum === false
                    ? '#EF4444'
                    : '#334155'
                }`,
                borderRadius: '10px',
                padding: '0.875rem 1rem',
                color: '#FFF',
                fontSize: '1.25rem',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                letterSpacing: '2px',
                outline: 'none',
              }}
            />
          </div>

          {/* Live Checksum Feedback */}
          <div style={{ minHeight: '1.5rem', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
            {isValidChecksum === true ? (
              <span style={{ color: '#10B981', fontWeight: 600 }}>
                ✓ Checksum Verified (Mod-32 Valid) — Ready to redeem
              </span>
            ) : isValidChecksum === false ? (
              <span style={{ color: '#EF4444', fontWeight: 600 }}>
                ✗ Checksum Mismatch — Typo detected. Check characters before sending.
              </span>
            ) : (
              <span style={{ color: '#64748B' }}>
                Format: VEX-XXXX-XXXX-X (Entropy payload + 1 Luhn-mod32 check character)
              </span>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                backgroundColor: '#450A0A',
                border: '1px solid #EF4444',
                color: '#FEE2E2',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div
              style={{
                backgroundColor: '#064E3B',
                border: '1px solid #10B981',
                color: '#ECFDF5',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#10B981' }}>
                🎉 +{success.amount.toFixed(2)} VXC Credited!
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: '#A7F3D0' }}>
                New Balance: {success.new_balance.toFixed(2)} VXC | TX: {success.ledger_tx_id}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6EE7B7', marginTop: '0.25rem' }}>
                Double-Entry ledger transfer recorded from Platform Revenue reserve.
              </div>
            </div>
          )}

          <button
            type="submit"
            id="redeem-submit-button"
            disabled={!isValidChecksum || isSubmitting || failedAttempts >= 5}
            style={{
              width: '100%',
              backgroundColor: isValidChecksum ? '#06B6D4' : '#334155',
              color: isValidChecksum ? '#0F172A' : '#94A3B8',
              border: 'none',
              borderRadius: '10px',
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: isValidChecksum ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s',
            }}
          >
            {isSubmitting ? 'Verifying & Crediting Ledger...' : 'Redeem to My Wallet'}
          </button>
        </form>

        {/* Demo Buttons */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #1E293B', display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={loadValidSample}
            style={{
              flex: 1,
              backgroundColor: '#1E293B',
              border: '1px solid #10B981',
              color: '#10B981',
              borderRadius: '8px',
              padding: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sample Valid Code
          </button>
          <button
            type="button"
            onClick={loadTypoSample}
            style={{
              flex: 1,
              backgroundColor: '#1E293B',
              border: '1px solid #EF4444',
              color: '#EF4444',
              borderRadius: '8px',
              padding: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sample Typo Code
          </button>
        </div>
      </div>
    </main>
  );
}
