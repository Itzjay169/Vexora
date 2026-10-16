'use client';

import React, { useState } from 'react';

/**
 * Admin Notifications Console — Phase 30
 *
 * Features:
 * - Announcements moderation queue (approve/reject/flag)
 * - System maintenance banner management
 * - FCM delivery logs with status tracking
 * - Dead-letter queue inspection
 * - Admin notification sender
 */

// ─── Mock Data ──────────────────────────────────────────────────────────
const MOCK_MODERATION_QUEUE = [
  {
    id: 'ann-001',
    author_id: 'user-org-01',
    author_role: 'ORGANISER',
    channel: 'TOURNAMENT',
    title: 'BGMI Championship Round 3 Schedule Change',
    body: 'Due to server maintenance, Round 3 has been moved to 8:00 PM IST. All registered participants please note the updated schedule.',
    moderation_status: 'PENDING',
    is_pinned: false,
    created_at: '2026-10-16T18:30:00Z',
  },
  {
    id: 'ann-002',
    author_id: 'user-org-02',
    author_role: 'ORGANISER',
    channel: 'PUBLIC',
    title: 'Free Fire MAX Weekly Tournament Series — Registration Open',
    body: 'Registration is now open for the weekly Free Fire MAX tournament series. 64 slots available, first come first served.',
    moderation_status: 'PENDING',
    is_pinned: true,
    created_at: '2026-10-16T17:00:00Z',
  },
  {
    id: 'ann-003',
    author_id: 'user-org-03',
    author_role: 'ORGANISER',
    channel: 'TOURNAMENT',
    title: 'Prize Distribution Update',
    body: 'Please check the updated prize distribution table for CODM Battle Arena. Changes effective immediately.',
    moderation_status: 'PENDING',
    is_pinned: false,
    created_at: '2026-10-16T15:45:00Z',
  },
];

const MOCK_DELIVERY_LOGS = [
  { id: 'del-001', user_id: 'user-001', platform: 'ANDROID', status: 'DISPATCHED', fcm_message_id: 'fcm_17290_a1b2c3', title: 'Match Starting Soon', category: 'MATCH', created_at: '2026-10-16T19:00:00Z' },
  { id: 'del-002', user_id: 'user-002', platform: 'IOS', status: 'DELIVERED', fcm_message_id: 'fcm_17290_d4e5f6', title: 'Tournament Registration Confirmed', category: 'TOURNAMENT', created_at: '2026-10-16T18:45:00Z' },
  { id: 'del-003', user_id: 'user-003', platform: 'ANDROID', status: 'FAILED', fcm_message_id: null, title: 'Security Alert: New Device Login', category: 'SECURITY', error_message: 'InvalidRegistration', created_at: '2026-10-16T18:30:00Z' },
  { id: 'del-004', user_id: 'user-004', platform: 'WEB', status: 'DEAD_LETTER', fcm_message_id: null, title: 'Wallet Credit Received', category: 'WALLET', error_message: 'Final failure after 3 retries', created_at: '2026-10-16T17:15:00Z' },
];

const MOCK_BANNERS = [
  { id: 'ban-001', title: 'Scheduled Maintenance', message: 'Platform maintenance scheduled for Oct 17, 2:00 AM - 4:00 AM IST. Some features may be unavailable.', severity: 'MAINTENANCE', is_active: true, is_dismissible: true, starts_at: '2026-10-16T20:30:00Z', ends_at: '2026-10-17T04:00:00Z' },
];

const DELIVERY_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:     { bg: 'rgba(250, 204, 21, 0.15)', text: '#FACC15' },
  DISPATCHED:  { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6' },
  DELIVERED:   { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' },
  FAILED:      { bg: 'rgba(239, 68, 68, 0.15)',  text: '#EF4444' },
  DEAD_LETTER: { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7' },
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  INFO:        { bg: 'rgba(59, 130, 246, 0.1)',  text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
  WARNING:     { bg: 'rgba(250, 204, 21, 0.1)',  text: '#FACC15', border: 'rgba(250, 204, 21, 0.3)' },
  CRITICAL:    { bg: 'rgba(239, 68, 68, 0.1)',   text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
  MAINTENANCE: { bg: 'rgba(168, 85, 247, 0.1)',  text: '#A855F7', border: 'rgba(168, 85, 247, 0.3)' },
};

type TabId = 'moderation' | 'banners' | 'deliveries' | 'dead-letter' | 'send';

export default function NotificationsAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('moderation');
  const [moderationQueue, setModerationQueue] = useState(MOCK_MODERATION_QUEUE);
  const [banners, setBanners] = useState(MOCK_BANNERS);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [sendForm, setSendForm] = useState({ userId: '', category: 'SYSTEM', title: '', body: '' });

  const tabs: { id: TabId; label: string; icon: string; badge?: number }[] = [
    { id: 'moderation', label: 'Moderation Queue', icon: '📋', badge: moderationQueue.length },
    { id: 'banners', label: 'System Banners', icon: '📢' },
    { id: 'deliveries', label: 'Delivery Logs', icon: '📬' },
    { id: 'dead-letter', label: 'Dead-Letter Queue', icon: '💀', badge: MOCK_DELIVERY_LOGS.filter(d => d.status === 'DEAD_LETTER').length },
    { id: 'send', label: 'Send Notification', icon: '📤' },
  ];

  const handleApprove = (id: string) => {
    setModerationQueue(prev => prev.filter(a => a.id !== id));
  };

  const handleReject = (id: string) => {
    if (rejectReason.length < 5) return;
    setModerationQueue(prev => prev.filter(a => a.id !== id));
    setRejectModalId(null);
    setRejectReason('');
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#111827',
    border: '1px solid #1E293B',
    borderRadius: '12px',
    padding: '1.5rem',
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🔔</span>
          <h1 style={{ fontSize: '1.5rem', color: '#F8FAFC', margin: 0, fontWeight: 700 }}>
            Notifications &amp; Announcements
          </h1>
        </div>
        <p style={{ color: '#64748B', margin: 0, fontSize: '0.875rem' }}>
          Phase 30 — Manage announcements moderation, FCM delivery, system banners, and dead-letter queue
        </p>
      </div>

      {/* Security Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(168, 85, 247, 0.08))',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '10px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <span style={{ fontSize: '1.25rem' }}>🛡️</span>
        <div>
          <span style={{ color: '#F87171', fontWeight: 600, fontSize: '0.8125rem' }}>Push Payload Security Gate Active</span>
          <p style={{ color: '#94A3B8', margin: 0, fontSize: '0.75rem' }}>
            No wallet balances, KYC details, or room codes/passwords are ever included in push payloads. Identifiers only — fetch securely on-device.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.625rem 1rem',
              borderRadius: '8px',
              border: activeTab === tab.id ? '1px solid #6366F1' : '1px solid #1E293B',
              backgroundColor: activeTab === tab.id ? 'rgba(99, 102, 241, 0.15)' : '#111827',
              color: activeTab === tab.id ? '#818CF8' : '#94A3B8',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span style={{
                backgroundColor: '#EF4444',
                color: '#FFF',
                padding: '0.1rem 0.4rem',
                borderRadius: '9999px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                minWidth: '18px',
                textAlign: 'center',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Moderation Queue Tab ─────────────────────────────────────── */}
      {activeTab === 'moderation' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
            Announcements Moderation Queue
          </h2>
          {moderationQueue.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
              <span style={{ fontSize: '2rem' }}>✅</span>
              <p style={{ color: '#64748B', marginTop: '0.75rem' }}>All announcements have been reviewed</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {moderationQueue.map(ann => (
                <div key={ann.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.6875rem', fontWeight: 600, padding: '0.2rem 0.5rem',
                          borderRadius: '4px', backgroundColor: 'rgba(250, 204, 21, 0.15)', color: '#FACC15',
                        }}>
                          {ann.channel}
                        </span>
                        <span style={{
                          fontSize: '0.6875rem', fontWeight: 600, padding: '0.2rem 0.5rem',
                          borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6',
                        }}>
                          {ann.author_role}
                        </span>
                        {ann.is_pinned && (
                          <span style={{ fontSize: '0.6875rem', color: '#F97316' }}>📌 Pinned</span>
                        )}
                      </div>
                      <h3 style={{ color: '#F8FAFC', fontSize: '1rem', fontWeight: 600, margin: 0 }}>{ann.title}</h3>
                    </div>
                    <span style={{ color: '#64748B', fontSize: '0.75rem' }}>
                      {new Date(ann.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ color: '#94A3B8', fontSize: '0.875rem', margin: '0 0 1rem', lineHeight: 1.5 }}>{ann.body}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleApprove(ann.id)}
                      style={{
                        padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontSize: '0.8125rem',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => setRejectModalId(ann.id)}
                      style={{
                        padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', fontSize: '0.8125rem',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      ✗ Reject
                    </button>
                    <button
                      style={{
                        padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid rgba(250, 204, 21, 0.3)',
                        backgroundColor: 'rgba(250, 204, 21, 0.1)', color: '#FACC15', fontSize: '0.8125rem',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      ⚑ Flag
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reject Modal */}
          {rejectModalId && (
            <div style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}>
              <div style={{ ...cardStyle, width: '480px', maxWidth: '90vw' }}>
                <h3 style={{ color: '#F8FAFC', margin: '0 0 1rem', fontSize: '1rem' }}>Reject Announcement</h3>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Rejection reason (min 5 characters)..."
                  style={{
                    width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: '8px',
                    border: '1px solid #334155', backgroundColor: '#0F172A', color: '#F8FAFC',
                    fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setRejectModalId(null); setRejectReason(''); }}
                    style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1E293B', color: '#94A3B8', fontSize: '0.8125rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReject(rejectModalId)}
                    disabled={rejectReason.length < 5}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)',
                      backgroundColor: rejectReason.length >= 5 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.05)',
                      color: rejectReason.length >= 5 ? '#EF4444' : '#64748B', fontSize: '0.8125rem',
                      fontWeight: 600, cursor: rejectReason.length >= 5 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Banners Tab ──────────────────────────────────────────────── */}
      {activeTab === 'banners' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>System Banners</h2>
            <button
              onClick={() => setShowBannerModal(true)}
              style={{
                padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)',
                backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', fontSize: '0.8125rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              + New Banner
            </button>
          </div>
          {banners.map(banner => {
            const sev = SEVERITY_COLORS[banner.severity] || SEVERITY_COLORS.INFO;
            return (
              <div key={banner.id} style={{ ...cardStyle, marginBottom: '0.75rem', borderLeft: `3px solid ${sev.text}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.6rem',
                      borderRadius: '4px', backgroundColor: sev.bg, color: sev.text, border: `1px solid ${sev.border}`,
                    }}>
                      {banner.severity}
                    </span>
                    <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.9375rem' }}>{banner.title}</span>
                  </div>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px',
                    backgroundColor: banner.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: banner.is_active ? '#10B981' : '#EF4444',
                  }}>
                    {banner.is_active ? '● ACTIVE' : '○ INACTIVE'}
                  </span>
                </div>
                <p style={{ color: '#94A3B8', fontSize: '0.8125rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  {banner.message}
                </p>
                <div style={{ display: 'flex', gap: '1rem', color: '#64748B', fontSize: '0.75rem' }}>
                  <span>Starts: {new Date(banner.starts_at).toLocaleString()}</span>
                  {banner.ends_at && <span>Ends: {new Date(banner.ends_at).toLocaleString()}</span>}
                  <span>{banner.is_dismissible ? 'Dismissible' : 'Non-dismissible'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Delivery Logs Tab ────────────────────────────────────────── */}
      {activeTab === 'deliveries' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
            FCM Delivery Logs
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B' }}>
                  {['Status', 'Platform', 'Category', 'Title', 'FCM ID', 'Error', 'Time'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 0.5rem', color: '#64748B', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_DELIVERY_LOGS.map(log => {
                  const sc = DELIVERY_STATUS_COLORS[log.status] || DELIVERY_STATUS_COLORS.PENDING;
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #1E293B22' }}>
                      <td style={{ padding: '0.625rem 0.5rem' }}>
                        <span style={{
                          fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.5rem',
                          borderRadius: '4px', backgroundColor: sc.bg, color: sc.text,
                        }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ color: '#94A3B8', padding: '0.625rem 0.5rem' }}>{log.platform}</td>
                      <td style={{ color: '#94A3B8', padding: '0.625rem 0.5rem' }}>{log.category}</td>
                      <td style={{ color: '#F8FAFC', padding: '0.625rem 0.5rem' }}>{log.title}</td>
                      <td style={{ color: '#64748B', padding: '0.625rem 0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {log.fcm_message_id || '—'}
                      </td>
                      <td style={{ color: '#F87171', padding: '0.625rem 0.5rem', fontSize: '0.75rem' }}>
                        {log.error_message || '—'}
                      </td>
                      <td style={{ color: '#64748B', padding: '0.625rem 0.5rem', fontSize: '0.75rem' }}>
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Dead-Letter Tab ──────────────────────────────────────────── */}
      {activeTab === 'dead-letter' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Dead-Letter Queue</h2>
            <button style={{
              padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(250, 204, 21, 0.3)',
              backgroundColor: 'rgba(250, 204, 21, 0.1)', color: '#FACC15', fontSize: '0.8125rem',
              fontWeight: 600, cursor: 'pointer',
            }}>
              ↻ Retry All Failed
            </button>
          </div>
          {MOCK_DELIVERY_LOGS.filter(d => d.status === 'DEAD_LETTER').map(dlq => (
            <div key={dlq.id} style={{ ...cardStyle, marginBottom: '0.75rem', borderLeft: '3px solid #A855F7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{dlq.title}</span>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.5rem',
                  borderRadius: '4px', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#A855F7',
                }}>
                  DEAD_LETTER
                </span>
              </div>
              <p style={{ color: '#F87171', fontSize: '0.8125rem', margin: 0 }}>Error: {dlq.error_message}</p>
              <div style={{ display: 'flex', gap: '1rem', color: '#64748B', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                <span>Platform: {dlq.platform}</span>
                <span>Category: {dlq.category}</span>
                <span>Time: {new Date(dlq.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Send Notification Tab ────────────────────────────────────── */}
      {activeTab === 'send' && (
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
            Send Notification (Admin)
          </h2>
          <div style={{ ...cardStyle, maxWidth: '600px' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.375rem' }}>User ID</label>
              <input
                type="text"
                value={sendForm.userId}
                onChange={e => setSendForm(prev => ({ ...prev, userId: e.target.value }))}
                placeholder="UUID of target user"
                style={{
                  width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #334155',
                  backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '0.875rem', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.375rem' }}>Category</label>
              <select
                value={sendForm.category}
                onChange={e => setSendForm(prev => ({ ...prev, category: e.target.value }))}
                style={{
                  width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #334155',
                  backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '0.875rem',
                }}
              >
                {['SECURITY', 'TOURNAMENT', 'MATCH', 'DISPUTE', 'WALLET', 'ANNOUNCEMENT', 'SOCIAL', 'SYSTEM'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.375rem' }}>Title</label>
              <input
                type="text"
                value={sendForm.title}
                onChange={e => setSendForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Notification title"
                style={{
                  width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #334155',
                  backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '0.875rem', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.375rem' }}>Body</label>
              <textarea
                value={sendForm.body}
                onChange={e => setSendForm(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Notification body text..."
                style={{
                  width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: '8px',
                  border: '1px solid #334155', backgroundColor: '#0F172A', color: '#F8FAFC',
                  fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>
            <button style={{
              padding: '0.625rem 1.5rem', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: '#FFF', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}>
              Send Notification
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
