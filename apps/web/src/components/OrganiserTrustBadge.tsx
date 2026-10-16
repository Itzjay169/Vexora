'use client';

import React, { useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, ExternalLink, Award, FileText } from 'lucide-react';

export interface OrganiserTrustProfile {
  organiser_id: string;
  business_name: string;
  tier: 'STARTER' | 'VERIFIED' | 'PARTNER';
  kyc_status: string;
  trust_score: number;
  total_tournaments: number;
  completed_tournaments: number;
  cancelled_tournaments: number;
  disputed_tournaments: number;
  dispute_rate: number;
  verified_at?: string | null;
  publishing_held: boolean;
  social_links?: Record<string, string>;
}

interface OrganiserTrustBadgeProps {
  profile: OrganiserTrustProfile;
  showModalOnClick?: boolean;
}

export function OrganiserTrustBadge({ profile, showModalOnClick = true }: OrganiserTrustBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const isVerified = profile.tier === 'VERIFIED' || profile.tier === 'PARTNER';
  const tierColor = profile.tier === 'PARTNER'
    ? '#F59E0B'
    : (profile.tier === 'VERIFIED' ? '#6366F1' : '#94A3B8');

  return (
    <>
      <div
        onClick={() => showModalOnClick && setModalOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.75rem',
          backgroundColor: '#0F172A',
          border: `1px solid ${tierColor}40`,
          borderRadius: '20px',
          cursor: showModalOnClick ? 'pointer' : 'default',
          transition: 'border-color 0.2s',
        }}
        title="Click to view Organiser Public Trust Certificate"
      >
        <Shield size={14} color={tierColor} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#F1F5F9' }}>
          {profile.business_name}
        </span>

        {isVerified ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              backgroundColor: `${tierColor}20`,
              color: tierColor,
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.6875rem',
              fontWeight: 700,
            }}
          >
            <CheckCircle size={10} />
            {profile.tier}
          </span>
        ) : (
          <span
            style={{
              backgroundColor: '#334155',
              color: '#94A3B8',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.6875rem',
              fontWeight: 500,
            }}
          >
            STARTER
          </span>
        )}

        {profile.publishing_held && (
          <span
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#EF4444',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.6875rem',
              fontWeight: 600,
            }}
          >
            HELD
          </span>
        )}
      </div>

      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#0F172A',
              border: `1px solid ${tierColor}60`,
              borderRadius: '16px',
              padding: '1.75rem',
              width: '480px',
              maxWidth: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: `${tierColor}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Award size={22} color={tierColor} />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 700 }}>
                    {profile.business_name}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: tierColor, fontWeight: 600 }}>
                    {profile.tier} TIER ORGANISER
                  </div>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#1E293B', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.5rem', fontWeight: 600 }}>
                PUBLIC TRUST METRICS (SECTION 10)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#60A5FA' }}>
                    {profile.completed_tournaments}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>Completed</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34D399' }}>
                    {profile.trust_score.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>Trust Score</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: profile.dispute_rate > 0.05 ? '#EF4444' : '#F1F5F9' }}>
                    {(profile.dispute_rate * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>Dispute Rate</div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.8125rem', color: '#CBD5E1', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <CheckCircle size={14} color="#10B981" />
                <span>Government identity verified by administrative Maker-Checker.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <CheckCircle size={14} color="#10B981" />
                <span>Field-level encrypted KYC documents isolated in secure storage.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={14} color="#10B981" />
                <span>Automatic publishing hold enforced if dispute rate exceeds 5.0%.</span>
              </div>
            </div>

            {profile.verified_at && (
              <div style={{ fontSize: '0.6875rem', color: '#64748B', textAlign: 'center' }}>
                Verified on {new Date(profile.verified_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
