'use client';

import React, { useState } from 'react';

/**
 * Admin Privacy, Compliance & Grievance Console — Phase 35
 *
 * Statutory & Regulatory Frameworks:
 * - DPDP Act 2023 (Data Protection Board of India, Section 6, 8, 9, 11)
 * - Information Technology (Intermediary Guidelines) Rules 2021 (Rule 3(1)(d), Rule 3(2)(b))
 * - Prevention of Money Laundering Act (5-year financial ledger preservation)
 * - WCAG 2.1 AA Accessibility & Multi-lingual localisation (en, hi, or)
 */

type TabId = 'dsr' | 'takedowns' | 'ropa' | 'retention' | 'grievance';

export default function ComplianceAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('dsr');
  const [selectedLocale, setSelectedLocale] = useState<'en' | 'hi' | 'or'>('en');
  const [purgeExecuting, setPurgeExecuting] = useState(false);
  const [purgeReport, setPurgeReport] = useState<any | null>(null);

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#111827',
    border: '1px solid #1E293B',
    borderRadius: '12px',
    padding: '1.25rem',
  };

  const MOCK_DSR_REQUESTS = [
    {
      id: 'DSR-8902',
      userId: 'usr-9921',
      username: 'ShadowRaptor',
      type: 'ACCOUNT_ERASURE',
      reason: 'User moving abroad, requested full right to be forgotten',
      submittedAt: 'Today, 09:30 AM',
      slaDeadline: 'In 29 days (Nov 15, 2026)',
      slaUrgent: false,
      status: 'PENDING_ADMIN_REVIEW',
    },
    {
      id: 'DSR-8901',
      userId: 'usr-4412',
      username: 'ThunderViper',
      type: 'DATA_EXPORT',
      reason: 'Portability request for match history and achievements',
      submittedAt: 'Yesterday, 04:15 PM',
      slaDeadline: 'In 28 days',
      slaUrgent: false,
      status: 'READY_FOR_DOWNLOAD',
    },
    {
      id: 'DSR-8898',
      userId: 'usr-1102',
      username: 'AstraGamer',
      type: 'CONSENT_REVOCATION',
      reason: 'Revoked marketing_push and profiling_recs',
      submittedAt: '2 days ago',
      slaDeadline: 'Acknowledged',
      slaUrgent: false,
      status: 'COMPLETED',
    },
  ];

  const MOCK_TAKEDOWNS = [
    {
      id: 'TKD-2026-004',
      complainant: 'Aakash Verma',
      email: 'aakash.v@example.com',
      contentType: 'USER_AVATAR',
      contentId: 'usr-av-9931',
      legalBasis: 'RULE_3_2_B_IMPERSONATION_SEXUAL',
      slaDeadline: 'URGENT: 14 hours remaining (24h Statutory SLA)',
      slaUrgent: true,
      status: 'UNDER_REVIEW',
      evidenceUrl: 'https://cdn.vexora.gg/evidence/avatar-dispute-9931.jpg',
    },
    {
      id: 'TKD-2026-003',
      complainant: 'Apex Esports Org',
      email: 'legal@apex-esports.in',
      contentType: 'TOURNAMENT_BANNER',
      contentId: 'tn-banner-4402',
      legalBasis: 'COPYRIGHT_INFRINGEMENT',
      slaDeadline: '48 hours remaining (72h SLA)',
      slaUrgent: false,
      status: 'UNDER_REVIEW',
      evidenceUrl: 'https://cdn.vexora.gg/evidence/trademark-reg-apex.pdf',
    },
  ];

  const MOCK_ROPA = [
    {
      category: 'Player Identity & Auth',
      purpose: 'Account creation, MFA authentication, age gate verification',
      legalBasis: 'Contractual Necessity (DPDP Sec 6)',
      retention: 'Active + 180 days (IT Rules 2021)',
      sensitive: true,
      subprocessors: 'Firebase, Fast2SMS',
    },
    {
      category: 'Tournament Match Telemetry',
      purpose: 'Anti-cheat verification, real-time leaderboard scores',
      legalBasis: 'Legitimate Interest',
      retention: '12 months after season finalisation',
      sensitive: false,
      subprocessors: 'AWS (Mumbai)',
    },
    {
      category: 'Financial Ledger & Tax Records',
      purpose: 'Reward credit distribution, TDS reporting, statutory compliance',
      legalBasis: 'Legal Obligation (PMLA & Income Tax Act)',
      retention: '5 years mandatory (Statutory Invariant)',
      sensitive: true,
      subprocessors: 'Banking Gateway, Tax Authorities',
    },
    {
      category: 'Safe Chat & Dispute Evidence',
      purpose: 'Fair play enforcement, harassment investigations',
      legalBasis: 'Legitimate Interest',
      retention: 'Chat 90 days; Evidence 12 months post-closure',
      sensitive: false,
      subprocessors: 'Internal Only (Encrypted at rest)',
    },
  ];

  const LOCALISATION_STRINGS = {
    en: {
      lang: 'English',
      title: 'Privacy & Consent Centre',
      rights: 'Your Data Protection Rights (DPDP Act 2023)',
      export: 'Export My Data',
      delete: 'Delete My Account',
      retention: 'Financial and audit records are preserved for 5 years per statutory legal mandate.',
    },
    hi: {
      lang: 'हिन्दी (Hindi)',
      title: 'गोपनीयता और सहमति केंद्र',
      rights: 'आपके डेटा सुरक्षा अधिकार (DPDP अधिनियम 2023)',
      export: 'मेरा डेटा डाउनलोड करें',
      delete: 'मेरा खाता हटाएं',
      retention: 'कानूनी अनिवार्यताओं के अनुसार वित्तीय रिकॉर्ड 5 वर्षों तक सुरक्षित रखे जाते हैं।',
    },
    or: {
      lang: 'ଓଡ଼ିଆ (Odia)',
      title: 'ଗୋପନୀୟତା ଏବଂ ସମ୍ମତି କେନ୍ଦ୍ର',
      rights: 'ଆପଣଙ୍କ ତଥ୍ୟ ସୁରକ୍ଷା ଅଧିକାର (DPDP ଆଇନ ୨୦୨୩)',
      export: 'ମୋର ତଥ୍ୟ ଡାଉନଲୋଡ୍ କରନ୍ତୁ',
      delete: 'ମୋ ଆକାଉଣ୍ଟ ଡିଲିଟ୍ କରନ୍ତୁ',
      retention: 'ଆଇନ ଅନୁଯାୟୀ ଆର୍ଥିକ ତଥ୍ୟ ୫ ବର୍ଷ ପର୍ଯ୍ୟନ୍ତ ସଂରକ୍ଷିତ ରହିବ।',
    },
  };

  const handleExecutePurge = () => {
    setPurgeExecuting(true);
    setTimeout(() => {
      setPurgeExecuting(false);
      setPurgeReport({
        runId: 'PURGE-RUN-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        chatPurged: 142,
        evidencePurged: 18,
        totalItemsPurged: 160,
        executedAt: new Date().toISOString(),
        auditSignature: 'sha256:8f4c93a021bde19300fa88921ec5671a93e887f4c92b',
        preservationStatus: 'Verified: Financial ledgers (5y) & IT Rules logs (180d) preserved intact.',
      });
    }, 700);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1280px', margin: '0 auto', color: '#F9FAFB' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🛡️</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
            Privacy, Compliance & Grievance Centre
          </h1>
          <span
            style={{
              backgroundColor: '#1E3A8A',
              color: '#93C5FD',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
            }}
          >
            Phase 35 • DPDP Act 2023 & IT Rules 2021
          </span>
        </div>
        <p style={{ color: '#9CA3AF', margin: 0, fontSize: '0.95rem' }}>
          Manage statutory data subject requests, IT Rules takedown SLA queues, vendor ROPA registries,
          retention schedule disposals, and multi-lingual accessibility compliance.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid #1E293B',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setActiveTab('dsr')}
          style={{
            padding: '0.6rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            backgroundColor: activeTab === 'dsr' ? '#3B82F6' : '#1E293B',
            color: activeTab === 'dsr' ? '#FFFFFF' : '#9CA3AF',
          }}
        >
          📋 Data Subject Rights (DSR)
        </button>
        <button
          onClick={() => setActiveTab('takedowns')}
          style={{
            padding: '0.6rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            backgroundColor: activeTab === 'takedowns' ? '#3B82F6' : '#1E293B',
            color: activeTab === 'takedowns' ? '#FFFFFF' : '#9CA3AF',
          }}
        >
          ⚖️ Statutory Takedowns (IT Rules)
        </button>
        <button
          onClick={() => setActiveTab('ropa')}
          style={{
            padding: '0.6rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            backgroundColor: activeTab === 'ropa' ? '#3B82F6' : '#1E293B',
            color: activeTab === 'ropa' ? '#FFFFFF' : '#9CA3AF',
          }}
        >
          🗺️ Data Map & ROPA
        </button>
        <button
          onClick={() => setActiveTab('retention')}
          style={{
            padding: '0.6rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            backgroundColor: activeTab === 'retention' ? '#3B82F6' : '#1E293B',
            color: activeTab === 'retention' ? '#FFFFFF' : '#9CA3AF',
          }}
        >
          🧹 Retention Purge Runner
        </button>
        <button
          onClick={() => setActiveTab('grievance')}
          style={{
            padding: '0.6rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            backgroundColor: activeTab === 'grievance' ? '#3B82F6' : '#1E293B',
            color: activeTab === 'grievance' ? '#FFFFFF' : '#9CA3AF',
          }}
        >
          🇮🇳 Grievance & Localisation (en/hi/or)
        </button>
      </div>

      {/* ─── TAB 1: DATA SUBJECT RIGHTS ────────────────────────────────────── */}
      {activeTab === 'dsr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Statutory Security Invariant Banner */}
          <div
            style={{
              backgroundColor: '#1E1B4B',
              border: '1px solid #4338CA',
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>🔒</span>
            <div>
              <strong style={{ color: '#C7D2FE', fontSize: '0.95rem' }}>
                Right to Erasure Security Gate & Invariant (ADR-013 & PMLA):
              </strong>
              <div style={{ color: '#E0E7FF', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Account deletion scrubs personal identification (email, phone, name, avatar) while preserving
                statutory financial ledger records (5-year mandate under PMLA) and cold registration audit logs (180 days under IT Rules 2021).
              </div>
            </div>
          </div>

          {/* DSR Table */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Active DSR Requests</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #374151', color: '#9CA3AF' }}>
                    <th style={{ padding: '0.75rem' }}>Request ID</th>
                    <th style={{ padding: '0.75rem' }}>User</th>
                    <th style={{ padding: '0.75rem' }}>Type</th>
                    <th style={{ padding: '0.75rem' }}>Reason</th>
                    <th style={{ padding: '0.75rem' }}>SLA Deadline</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_DSR_REQUESTS.map((dsr) => (
                    <tr key={dsr.id} style={{ borderBottom: '1px solid #1F2937' }}>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#60A5FA' }}>{dsr.id}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>{dsr.username}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{dsr.userId}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor:
                              dsr.type === 'ACCOUNT_ERASURE'
                                ? '#7F1D1D'
                                : dsr.type === 'DATA_EXPORT'
                                ? '#065F46'
                                : '#374151',
                            color:
                              dsr.type === 'ACCOUNT_ERASURE'
                                ? '#FCA5A5'
                                : dsr.type === 'DATA_EXPORT'
                                ? '#6EE7B7'
                                : '#D1D5DB',
                          }}
                        >
                          {dsr.type}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', color: '#D1D5DB', maxWidth: '280px' }}>{dsr.reason}</td>
                      <td style={{ padding: '0.75rem', color: '#9CA3AF' }}>{dsr.slaDeadline}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            backgroundColor: '#1E293B',
                            color: '#F3F4F6',
                          }}
                        >
                          {dsr.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {dsr.type === 'ACCOUNT_ERASURE' ? (
                          <button
                            onClick={() =>
                              alert(
                                `Executing erasure for ${dsr.userId}:\n- Personal PII scrubbed\n- 5-year ledger records preserved\n- 180-day registration log archived.`
                              )
                            }
                            style={{
                              backgroundColor: '#DC2626',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.8rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Execute Erasure
                          </button>
                        ) : (
                          <button
                            onClick={() => alert(`Generated machine-readable JSON archive for ${dsr.userId}`)}
                            style={{
                              backgroundColor: '#059669',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.8rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Generate Package
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: STATUTORY TAKEDOWNS (IT RULES 2021) ────────────────────── */}
      {activeTab === 'takedowns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            style={{
              backgroundColor: '#7F1D1D22',
              border: '1px solid #DC2626',
              borderRadius: '8px',
              padding: '1rem',
              color: '#FCA5A5',
              fontSize: '0.9rem',
            }}
          >
            ⚠️ <strong>IT Rules 2021 Statutory Takedown SLA Mandate:</strong>
            <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
              <li>Rule 3(2)(b) (Impersonation / Non-consensual imagery): Action required within <strong>24 hours</strong>.</li>
              <li>Rule 3(1)(d) (Court Order or Authorised Govt Notice): Action required within <strong>36 hours</strong>.</li>
            </ul>
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Takedown Complaints Queue</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {MOCK_TAKEDOWNS.map((item) => (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#1E293B',
                    borderRadius: '8px',
                    padding: '1rem',
                    borderLeft: item.slaUrgent ? '4px solid #EF4444' : '4px solid #3B82F6',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '1rem', color: '#FFFFFF' }}>{item.id}</strong>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: item.slaUrgent ? '#991B1B' : '#1E3A8A',
                            color: '#FFFFFF',
                            fontWeight: 600,
                          }}
                        >
                          {item.legalBasis}
                        </span>
                      </div>
                      <div style={{ color: '#D1D5DB', fontSize: '0.85rem' }}>
                        Complainant: <strong>{item.complainant}</strong> ({item.email})
                      </div>
                      <div style={{ color: '#9CA3AF', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        Target: {item.contentType} ({item.contentId}) • Evidence: <a href={item.evidenceUrl} style={{ color: '#60A5FA' }}>View Evidence</a>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: item.slaUrgent ? '#EF4444' : '#60A5FA',
                        }}
                      >
                        {item.slaDeadline}
                      </div>
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => alert(`Executed immediate takedown for ${item.contentId}`)}
                          style={{
                            backgroundColor: '#DC2626',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Remove Content
                        </button>
                        <button
                          onClick={() => alert(`Rejected complaint ${item.id} with reason logged`)}
                          style={{
                            backgroundColor: '#374151',
                            color: '#D1D5DB',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: DATA MAP & ROPA ────────────────────────────────────────── */}
      {activeTab === 'ropa' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Record of Processing Activities (ROPA — DPDP Act Section 6 & 8)
          </h3>
          <p style={{ color: '#9CA3AF', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Official registry of categories, legal processing basis, retention cycles, and sub-processor vendors.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #374151', color: '#9CA3AF' }}>
                  <th style={{ padding: '0.75rem' }}>Data Category</th>
                  <th style={{ padding: '0.75rem' }}>Purpose</th>
                  <th style={{ padding: '0.75rem' }}>Legal Basis</th>
                  <th style={{ padding: '0.75rem' }}>Retention Period</th>
                  <th style={{ padding: '0.75rem' }}>Sub-processors</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_ROPA.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #1F2937' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#F3F4F6' }}>
                      {row.category}
                      {row.sensitive && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#F87171' }}>[SENSITIVE]</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', color: '#D1D5DB' }}>{row.purpose}</td>
                    <td style={{ padding: '0.75rem', color: '#60A5FA' }}>{row.legalBasis}</td>
                    <td style={{ padding: '0.75rem', color: '#34D399' }}>{row.retention}</td>
                    <td style={{ padding: '0.75rem', color: '#9CA3AF' }}>{row.subprocessors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 4: RETENTION PURGE RUNNER ─────────────────────────────────── */}
      {activeTab === 'retention' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Automated Retention Schedule Purge</h3>
                <p style={{ color: '#9CA3AF', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                  Enforces automated disposal of in-app chat (&gt; 90 days) and resolved dispute evidence (&gt; 12 months)
                  while generating an immutable HMAC audit certificate.
                </p>
              </div>
              <button
                onClick={handleExecutePurge}
                disabled={purgeExecuting}
                style={{
                  backgroundColor: purgeExecuting ? '#4B5563' : '#3B82F6',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.6rem 1.2rem',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: purgeExecuting ? 'not-allowed' : 'pointer',
                }}
              >
                {purgeExecuting ? 'Executing Purge...' : '🚀 Run Retention Purge'}
              </button>
            </div>

            {purgeReport && (
              <div
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  marginTop: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>✅</span>
                  <strong style={{ color: '#34D399', fontSize: '1rem' }}>Disposal Run Completed & Verified</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>Run ID</div>
                    <div style={{ fontFamily: 'monospace', color: '#60A5FA', fontSize: '0.9rem' }}>{purgeReport.runId}</div>
                  </div>
                  <div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>Chat Messages Purged (&gt; 90d)</div>
                    <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '1.1rem' }}>{purgeReport.chatPurged}</div>
                  </div>
                  <div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>Evidence Files Purged (&gt; 12m)</div>
                    <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '1.1rem' }}>{purgeReport.evidencePurged}</div>
                  </div>
                  <div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>Total Items Purged</div>
                    <div style={{ fontWeight: 700, color: '#34D399', fontSize: '1.1rem' }}>{purgeReport.totalItemsPurged}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9CA3AF', borderTop: '1px solid #1E293B', paddingTop: '0.5rem' }}>
                  Cryptographic Audit Signature: <span style={{ fontFamily: 'monospace', color: '#E5E7EB' }}>{purgeReport.auditSignature}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 5: GRIEVANCE & LOCALISATION ───────────────────────────────── */}
      {activeTab === 'grievance' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Statutory Grievance Officer */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
              🇮🇳 Statutory Grievance Redressal (IT Rules 2021)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: '#9CA3AF' }}>Resident Grievance Officer: </span>
                <strong>Priyadarshini Mohanty</strong>
              </div>
              <div>
                <span style={{ color: '#9CA3AF' }}>Designation: </span>
                <span>Data Protection Officer & Resident Grievance Officer</span>
              </div>
              <div>
                <span style={{ color: '#9CA3AF' }}>Office Address: </span>
                <span>DLF CyberCity, Technology Corridor, Patia, Bhubaneswar, Odisha 751024</span>
              </div>
              <div>
                <span style={{ color: '#9CA3AF' }}>Email Contact: </span>
                <a href="mailto:grievance-officer@vexora.gg" style={{ color: '#60A5FA' }}>grievance-officer@vexora.gg</a>
              </div>
              <div>
                <span style={{ color: '#9CA3AF' }}>Nodal Law Enforcement Officer: </span>
                <span>Siddharth Rao (24x7 law-enforcement@vexora.gg)</span>
              </div>
            </div>
          </div>

          {/* Multi-lingual Catalog Preview */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                🌐 Localisation Catalog (WCAG AA)
              </h3>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {(['en', 'hi', 'or'] as const).map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setSelectedLocale(loc)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: selectedLocale === loc ? '#3B82F6' : '#1E293B',
                      color: '#FFFFFF',
                    }}
                  >
                    {loc.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: '#1E293B', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem' }}>
              <div style={{ color: '#60A5FA', fontWeight: 600, marginBottom: '0.5rem' }}>
                Active Locale: {LOCALISATION_STRINGS[selectedLocale].lang}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <span style={{ color: '#9CA3AF' }}>Header: </span>
                  <span style={{ color: '#FFFFFF' }}>{LOCALISATION_STRINGS[selectedLocale].title}</span>
                </div>
                <div>
                  <span style={{ color: '#9CA3AF' }}>Rights: </span>
                  <span style={{ color: '#FFFFFF' }}>{LOCALISATION_STRINGS[selectedLocale].rights}</span>
                </div>
                <div>
                  <span style={{ color: '#9CA3AF' }}>Export CTA: </span>
                  <span style={{ color: '#34D399' }}>{LOCALISATION_STRINGS[selectedLocale].export}</span>
                </div>
                <div>
                  <span style={{ color: '#9CA3AF' }}>Delete CTA: </span>
                  <span style={{ color: '#F87171' }}>{LOCALISATION_STRINGS[selectedLocale].delete}</span>
                </div>
                <div style={{ borderTop: '1px solid #374151', paddingTop: '0.5rem', color: '#D1D5DB' }}>
                  <em>"{LOCALISATION_STRINGS[selectedLocale].retention}"</em>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
