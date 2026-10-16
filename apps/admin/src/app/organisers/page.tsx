'use client';

import React, { useState } from 'react';
import { AdminShell } from '../../components/AdminShell';

interface OrganiserApplication {
  id: string;
  organiser_id: string;
  business_name: string;
  contact_email: string;
  country: string;
  id_document_type: string;
  id_document_front_hash: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUESTED';
  submitted_at: string;
  tier: 'STARTER' | 'VERIFIED' | 'PARTNER';
  trust_score: number;
  total_tournaments: number;
  dispute_rate: number;
  publishing_held: boolean;
  decrypted_phone?: string;
  decrypted_doc_number?: string;
}

const INITIAL_APPLICATIONS: OrganiserApplication[] = [
  {
    id: 'kyc-app-001',
    organiser_id: 'org-u-101',
    business_name: 'Apex Esports Org',
    contact_email: 'host@apex-esports.gg',
    country: 'IND',
    id_document_type: 'NATIONAL_ID',
    id_document_front_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'PENDING',
    submitted_at: '2026-10-15 14:30 UTC',
    tier: 'STARTER',
    trust_score: 98.5,
    total_tournaments: 14,
    dispute_rate: 0.012,
    publishing_held: false,
  },
  {
    id: 'kyc-app-002',
    organiser_id: 'org-u-102',
    business_name: 'Velocity Gaming League',
    contact_email: 'compliance@velocity.gg',
    country: 'USA',
    id_document_type: 'BUSINESS_REG',
    id_document_front_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    status: 'IN_REVIEW',
    submitted_at: '2026-10-14 09:15 UTC',
    tier: 'VERIFIED',
    trust_score: 100.0,
    total_tournaments: 42,
    dispute_rate: 0.005,
    publishing_held: false,
  },
  {
    id: 'kyc-app-003',
    organiser_id: 'org-u-103',
    business_name: 'Shadow Circuit Hosts',
    contact_email: 'alerts@shadowcircuits.io',
    country: 'DEU',
    id_document_type: 'PASSPORT',
    id_document_front_hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    status: 'PENDING',
    submitted_at: '2026-10-15 11:45 UTC',
    tier: 'STARTER',
    trust_score: 68.0,
    total_tournaments: 5,
    dispute_rate: 0.082,
    publishing_held: true,
  },
];

export default function OrganiserApprovalsPage() {
  const [applications, setApplications] = useState<OrganiserApplication[]>(INITIAL_APPLICATIONS);
  const [selectedApp, setSelectedApp] = useState<OrganiserApplication | null>(null);
  const [viewReason, setViewReason] = useState('');
  const [decryptedUnlocked, setDecryptedUnlocked] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'TIERS'>('QUEUE');

  const handleInspectKyc = (app: OrganiserApplication) => {
    setSelectedApp(app);
    setViewReason('');
    setDecryptedUnlocked(false);
    setRejectionReason('');
  };

  const handleUnlockKycData = () => {
    if (!viewReason.trim() || viewReason.trim().length < 5) {
      alert('Security Gate: Viewing KYC requires an explicit business reason (min 5 characters) for the immutable audit log.');
      return;
    }
    // Simulate KYC access log creation and decryption
    setDecryptedUnlocked(true);
    setActionNotice(`KYC access logged in immutable audit journal: Reason recorded as "${viewReason}".`);
  };

  const handleDecision = (decision: 'APPROVE' | 'REJECT' | 'REQUEST_RESUBMISSION') => {
    if (!selectedApp) return;

    if (decision === 'REJECT' && !rejectionReason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }

    setApplications((prev) =>
      prev.map((a) => {
        if (a.id === selectedApp.id) {
          const newStatus = decision === 'APPROVE' ? 'APPROVED' : (decision === 'REJECT' ? 'REJECTED' : 'RESUBMISSION_REQUESTED');
          const newTier = decision === 'APPROVE' ? 'VERIFIED' : a.tier;
          return {
            ...a,
            status: newStatus,
            tier: newTier,
            publishing_held: decision === 'APPROVE' ? false : a.publishing_held,
          };
        }
        return a;
      })
    );

    setActionNotice(`Application ${selectedApp.id} marked as ${decision}. Organiser tier updated.`);
    setSelectedApp(null);
  };

  const handleTogglePublishingHold = (appId: string) => {
    setApplications((prev) =>
      prev.map((a) => {
        if (a.id === appId) {
          const newState = !a.publishing_held;
          setActionNotice(`Publishing hold ${newState ? 'PLACED on' : 'RELEASED for'} ${a.business_name}.`);
          return { ...a, publishing_held: newState };
        }
        return a;
      })
    );
  };

  const handleTierChange = (appId: string, newTier: 'STARTER' | 'VERIFIED' | 'PARTNER') => {
    setApplications((prev) =>
      prev.map((a) => {
        if (a.id === appId) {
          setActionNotice(`Organiser ${a.business_name} tier adjusted to ${newTier}.`);
          return { ...a, tier: newTier };
        }
        return a;
      })
    );
  };

  return (
    <AdminShell>
      <div>
        <header style={{ borderBottom: '1px solid #1E293B', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#6366F1', fontWeight: 700, letterSpacing: '0.05em' }}>
              TRUST & SAFETY
            </span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Section 10 & 39 Phase 5</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700, color: '#F8FAFC' }}>
            Organiser Verification & Tier Management
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#94A3B8', fontSize: '0.875rem' }}>
            Review KYC documents, verify organiser identities, enforce tier capabilities, and safeguard tournament publishing.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              onClick={() => setActiveTab('QUEUE')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: activeTab === 'QUEUE' ? '#6366F1' : '#1E293B',
                color: '#FFF',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              📋 Review Queue ({applications.filter((a) => a.status === 'PENDING' || a.status === 'IN_REVIEW').length})
            </button>
            <button
              onClick={() => setActiveTab('TIERS')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: activeTab === 'TIERS' ? '#6366F1' : '#1E293B',
                color: '#FFF',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              🛡️ Tiers & Publishing Holds ({applications.length})
            </button>
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

        {/* ─── TAB 1: REVIEW QUEUE ────────────────────────────────────────────── */}
        {activeTab === 'QUEUE' && (
          <section>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#1E293B', textAlign: 'left', color: '#94A3B8', fontSize: '0.75rem' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ORGANISATION</th>
                  <th style={{ padding: '0.75rem 1rem' }}>DOCUMENT TYPE</th>
                  <th style={{ padding: '0.75rem 1rem' }}>DOCUMENT SHA-256</th>
                  <th style={{ padding: '0.75rem 1rem' }}>TRUST METRICS</th>
                  <th style={{ padding: '0.75rem 1rem' }}>STATUS</th>
                  <th style={{ padding: '0.75rem 1rem' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid #1E293B', color: '#F1F5F9', fontSize: '0.875rem' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{app.business_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{app.contact_email} • {app.country}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#334155', fontSize: '0.75rem' }}>
                        {app.id_document_type}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#818CF8' }}>
                      {app.id_document_front_hash.substring(0, 16)}...
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div>Score: <strong style={{ color: app.trust_score < 70 ? '#EF4444' : '#10B981' }}>{app.trust_score}</strong></div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {app.total_tournaments} events • {(app.dispute_rate * 100).toFixed(1)}% disputes
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor:
                            app.status === 'APPROVED'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : app.status === 'REJECTED'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(245, 158, 11, 0.2)',
                          color:
                            app.status === 'APPROVED'
                              ? '#34D399'
                              : app.status === 'REJECTED'
                              ? '#F87171'
                              : '#FBBF24',
                        }}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={() => handleInspectKyc(app)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          backgroundColor: '#6366F1',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Inspect & Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ─── TAB 2: TIERS & PUBLISHING HOLDS ────────────────────────────────── */}
        {activeTab === 'TIERS' && (
          <section>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#1E293B', textAlign: 'left', color: '#94A3B8', fontSize: '0.75rem' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ORGANISER</th>
                  <th style={{ padding: '0.75rem 1rem' }}>CURRENT TIER</th>
                  <th style={{ padding: '0.75rem 1rem' }}>CAPACITIES</th>
                  <th style={{ padding: '0.75rem 1rem' }}>PUBLISHING STATUS</th>
                  <th style={{ padding: '0.75rem 1rem' }}>TIER ADJUSTMENT</th>
                  <th style={{ padding: '0.75rem 1rem' }}>HOLD ACTION</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid #1E293B', color: '#F1F5F9', fontSize: '0.875rem' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{app.business_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>ID: {app.organiser_id}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor:
                            app.tier === 'PARTNER'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : app.tier === 'VERIFIED'
                              ? 'rgba(99, 102, 241, 0.2)'
                              : 'rgba(148, 163, 184, 0.2)',
                          color:
                            app.tier === 'PARTNER'
                              ? '#FBBF24'
                              : app.tier === 'VERIFIED'
                              ? '#818CF8'
                              : '#94A3B8',
                        }}
                      >
                        {app.tier}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: '#94A3B8' }}>
                      {app.tier === 'PARTNER' && '2048 Players • 20 Active Events'}
                      {app.tier === 'VERIFIED' && '256 Players • 5 Active Events'}
                      {app.tier === 'STARTER' && '32 Players • 1 Active Event'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {app.publishing_held ? (
                        <span style={{ color: '#EF4444', fontWeight: 600, fontSize: '0.75rem' }}>
                          ⚠️ PUBLISHING HELD
                        </span>
                      ) : (
                        <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.75rem' }}>
                          ✓ Active / Eligible
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <select
                        value={app.tier}
                        onChange={(e) => handleTierChange(app.id, e.target.value as any)}
                        style={{
                          backgroundColor: '#1E293B',
                          color: '#F1F5F9',
                          border: '1px solid #334155',
                          borderRadius: '4px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                        }}
                      >
                        <option value="STARTER">Starter</option>
                        <option value="VERIFIED">Verified</option>
                        <option value="PARTNER">Partner</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={() => handleTogglePublishingHold(app.id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          backgroundColor: app.publishing_held ? '#10B981' : '#EF4444',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        {app.publishing_held ? 'Release Hold' : 'Place Hold'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ─── MODAL: INSPECT KYC WITH AUDIT GATE ──────────────────────────────── */}
        {selectedApp && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '2rem',
                width: '600px',
                maxWidth: '90vw',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <h2 style={{ margin: '0 0 1rem', color: '#F8FAFC', fontSize: '1.25rem' }}>
                KYC Verification Review: {selectedApp.business_name}
              </h2>

              <div style={{ backgroundColor: '#1E293B', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8125rem', color: '#CBD5E1' }}>
                  <div><strong>Application ID:</strong> {selectedApp.id}</div>
                  <div><strong>Country:</strong> {selectedApp.country}</div>
                  <div><strong>Document Type:</strong> {selectedApp.id_document_type}</div>
                  <div><strong>Current Tier:</strong> {selectedApp.tier}</div>
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                  <strong>SHA-256 Front Document Hash:</strong>
                  <div style={{ fontFamily: 'monospace', color: '#818CF8', wordBreak: 'break-all', marginTop: '2px' }}>
                    {selectedApp.id_document_front_hash}
                  </div>
                </div>
              </div>

              {/* Security Gate Checkpoint */}
              {!decryptedUnlocked ? (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '1.25rem',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#F87171', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    🔒 Security Gate: Field-Level KYC Decryption
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#CBD5E1', margin: '0 0 0.75rem' }}>
                    Access to government ID numbers and phone records is logged to <code>kyc_access_logs</code>. Moderators cannot access this data. Enter a valid business reason (min 5 characters) to proceed.
                  </p>
                  <input
                    type="text"
                    placeholder="e.g. Identity verification for Ignition Cup Tier Promotion"
                    value={viewReason}
                    onChange={(e) => setViewReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      backgroundColor: '#020617',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      color: '#F8FAFC',
                      fontSize: '0.8125rem',
                      marginBottom: '0.75rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onClick={handleUnlockKycData}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#6366F1',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                    }}
                  >
                    Unlock & Log KYC Access
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ color: '#34D399', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    ✓ Decrypted Identity Records (Logged to kyc_access_logs)
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#F1F5F9' }}>
                    <div><strong>Phone:</strong> +91 98765 43210 (AES-256 decrypted)</div>
                    <div><strong>ID Number:</strong> DOC-98214-X (AES-256 decrypted)</div>
                    <div><strong>Tax ID:</strong> GSTIN29ABCDE1234F1Z5</div>
                  </div>
                </div>
              )}

              {/* Decision Section */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#94A3B8', marginBottom: '0.25rem' }}>
                  Rejection Reason (if rejecting or requesting resubmission):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Document image is blurry or expired"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.8125rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={() => setSelectedApp(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#334155',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => handleDecision('REJECT')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#EF4444',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Reject
                </button>
                <button
                  onClick={() => handleDecision('APPROVE')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#10B981',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Approve & Promote to Verified
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
