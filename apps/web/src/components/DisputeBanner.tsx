'use client';

import React from 'react';
import { AlertCircle, Lock, ShieldAlert, Clock, ArrowRight } from 'lucide-react';

export interface DisputeBannerProps {
  caseId: string;
  reason: string;
  status: string;
  settlementFrozen: boolean;
  slaRemainingText?: string;
  onViewCase?: () => void;
}

export function DisputeBanner({
  caseId,
  reason,
  status,
  settlementFrozen,
  slaRemainingText = '24h SLA active',
  onViewCase,
}: DisputeBannerProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.875rem 1.25rem',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        borderRadius: '10px',
        margin: '1rem 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShieldAlert size={20} color="#EF4444" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F87171' }}>
              MATCH RESULT DISPUTED — CASE #{caseId}
            </span>
            {settlementFrozen && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  backgroundColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#FECACA',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                }}
              >
                <Lock size={10} />
                Settlement Frozen
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>
            Reason: <strong>{reason}</strong> • Status: <strong>{status}</strong> •{' '}
            <span style={{ color: '#FBBF24' }}>⏱️ {slaRemainingText}</span>
          </div>
        </div>
      </div>

      {onViewCase && (
        <button
          onClick={onViewCase}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#1E293B',
            color: '#F8FAFC',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          View Case Evidence
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
