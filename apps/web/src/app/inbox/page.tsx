'use client';

import React, { useState } from 'react';

/**
 * Web Portal — In-App Notifications Inbox
 *
 * Phase 30: Push Notifications, Inbox & Announcements
 *
 * Features:
 * - Notification inbox with category filters
 * - Deep links to match/tournament/dispute
 * - Notification preferences toggle
 * - System banners display
 * - Mark as read / mark all read
 */

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  SECURITY:     { icon: '🔐', color: '#EF4444', label: 'Security' },
  TOURNAMENT:   { icon: '🏆', color: '#F59E0B', label: 'Tournament' },
  MATCH:        { icon: '⚔️', color: '#3B82F6', label: 'Match' },
  DISPUTE:      { icon: '⚖️', color: '#A855F7', label: 'Dispute' },
  WALLET:       { icon: '💰', color: '#10B981', label: 'Wallet' },
  ANNOUNCEMENT: { icon: '📢', color: '#6366F1', label: 'Announcement' },
  SOCIAL:       { icon: '👥', color: '#EC4899', label: 'Social' },
  SYSTEM:       { icon: '⚙️', color: '#64748B', label: 'System' },
};

const MOCK_NOTIFICATIONS = [
  {
    id: 'n-001', category: 'SECURITY', title: 'New device login detected',
    body: 'Your account was accessed from a new Android device. If this wasn\'t you, secure your account immediately.',
    deep_link_web: '/settings/security', is_read: false, is_mutable: false,
    created_at: '2026-10-16T19:30:00Z',
  },
  {
    id: 'n-002', category: 'TOURNAMENT', title: 'Registration confirmed: BGMI Pro League',
    body: 'You have been confirmed for the BGMI Pro League tournament. Check-in starts at 7:30 PM IST.',
    deep_link_web: '/tournaments/bgmi-pro-league', is_read: false, is_mutable: true,
    created_at: '2026-10-16T18:00:00Z',
  },
  {
    id: 'n-003', category: 'MATCH', title: 'Match starting in 15 minutes',
    body: 'Your Round 2 match in the BGMI Pro League is about to begin. Please check in and join the lobby.',
    deep_link_web: '/matches/match-r2-001', is_read: false, is_mutable: true,
    created_at: '2026-10-16T17:45:00Z',
  },
  {
    id: 'n-004', category: 'ANNOUNCEMENT', title: 'Free Fire MAX Weekly Series — Registration Open',
    body: 'Registration is now open for the weekly Free Fire MAX tournament. 64 slots available.',
    deep_link_web: '/tournaments/freefire-weekly', is_read: true, is_mutable: true,
    created_at: '2026-10-16T16:00:00Z',
  },
  {
    id: 'n-005', category: 'DISPUTE', title: 'Dispute resolved in your favour',
    body: 'The dispute for Match #R1-004 has been resolved. The decision was made in your favour.',
    deep_link_web: '/disputes/disp-001', is_read: true, is_mutable: true,
    created_at: '2026-10-16T14:30:00Z',
  },
  {
    id: 'n-006', category: 'WALLET', title: 'Credits received',
    body: 'You received a credit reward. Check your wallet for details.',
    deep_link_web: '/wallet', is_read: true, is_mutable: true,
    created_at: '2026-10-16T12:00:00Z',
  },
];

const MOCK_BANNER = {
  id: 'ban-001',
  title: 'Scheduled Maintenance',
  message: 'Platform maintenance on Oct 17, 2:00 AM - 4:00 AM IST. Some features may be temporarily unavailable.',
  severity: 'MAINTENANCE',
  is_dismissible: true,
};

type CategoryFilter = 'ALL' | string;

export default function InboxPage() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('ALL');
  const [showPrefs, setShowPrefs] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const filtered = activeFilter === 'ALL'
    ? notifications
    : notifications.filter(n => n.category === activeFilter);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleArchive = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* System Banner */}
      {!bannerDismissed && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(99, 102, 241, 0.1))',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🔧</span>
            <div>
              <span style={{ color: '#A855F7', fontWeight: 600, fontSize: '0.875rem' }}>{MOCK_BANNER.title}</span>
              <p style={{ color: '#94A3B8', margin: 0, fontSize: '0.8125rem' }}>{MOCK_BANNER.message}</p>
            </div>
          </div>
          {MOCK_BANNER.is_dismissible && (
            <button
              onClick={() => setBannerDismissed(true)}
              style={{
                border: 'none', background: 'transparent', color: '#64748B',
                cursor: 'pointer', fontSize: '1.25rem', padding: '0.25rem',
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', color: '#F8FAFC', margin: 0, fontWeight: 700 }}>
            Notifications
            {unreadCount > 0 && (
              <span style={{
                marginLeft: '0.75rem', fontSize: '0.875rem', fontWeight: 700,
                padding: '0.2rem 0.6rem', borderRadius: '9999px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444',
              }}>
                {unreadCount} unread
              </span>
            )}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleMarkAllRead}
            style={{
              padding: '0.5rem 0.875rem', borderRadius: '8px',
              border: '1px solid #1E293B', backgroundColor: '#111827',
              color: '#94A3B8', fontSize: '0.8125rem', cursor: 'pointer',
            }}
          >
            Mark All Read
          </button>
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            style={{
              padding: '0.5rem 0.875rem', borderRadius: '8px',
              border: showPrefs ? '1px solid #6366F1' : '1px solid #1E293B',
              backgroundColor: showPrefs ? 'rgba(99, 102, 241, 0.15)' : '#111827',
              color: showPrefs ? '#818CF8' : '#94A3B8', fontSize: '0.8125rem', cursor: 'pointer',
            }}
          >
            ⚙ Preferences
          </button>
        </div>
      </div>

      {/* Preferences Panel */}
      {showPrefs && (
        <div style={{
          backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '12px',
          padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <h3 style={{ color: '#F8FAFC', fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>
            Notification Preferences
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(CATEGORY_CONFIG).map(([cat, config]) => {
              const isSecurityLocked = cat === 'SECURITY';
              return (
                <div key={cat} style={{
                  padding: '0.75rem', borderRadius: '8px', backgroundColor: '#0F172A',
                  border: '1px solid #1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{config.icon}</span>
                    <span style={{ color: '#F8FAFC', fontSize: '0.8125rem', fontWeight: 500 }}>{config.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isSecurityLocked && (
                      <span style={{ fontSize: '0.6875rem', color: '#EF4444', fontWeight: 600 }}>LOCKED</span>
                    )}
                    <div style={{
                      width: '36px', height: '20px', borderRadius: '10px',
                      backgroundColor: isSecurityLocked ? '#10B981' : 'rgba(99, 102, 241, 0.5)',
                      position: 'relative', cursor: isSecurityLocked ? 'not-allowed' : 'pointer',
                      opacity: isSecurityLocked ? 0.7 : 1,
                    }}>
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#FFF',
                        position: 'absolute', top: '2px', right: '2px',
                        transition: 'all 0.2s',
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            🔒 Security notifications cannot be disabled. They are mandatory for your account safety.
          </p>
        </div>
      )}

      {/* Category Filter Chips */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveFilter('ALL')}
          style={{
            padding: '0.375rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
            border: activeFilter === 'ALL' ? '1px solid #6366F1' : '1px solid #1E293B',
            backgroundColor: activeFilter === 'ALL' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeFilter === 'ALL' ? '#818CF8' : '#64748B', cursor: 'pointer',
          }}
        >
          All
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([cat, config]) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
              border: activeFilter === cat ? `1px solid ${config.color}` : '1px solid #1E293B',
              backgroundColor: activeFilter === cat ? `${config.color}20` : 'transparent',
              color: activeFilter === cat ? config.color : '#64748B', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
            }}
          >
            <span style={{ fontSize: '0.8rem' }}>{config.icon}</span>
            {config.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.length === 0 ? (
          <div style={{
            backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '12px',
            padding: '3rem', textAlign: 'center',
          }}>
            <span style={{ fontSize: '2.5rem' }}>📭</span>
            <p style={{ color: '#64748B', marginTop: '0.75rem', fontSize: '0.9375rem' }}>No notifications</p>
          </div>
        ) : (
          filtered.map(notif => {
            const cat = CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG.SYSTEM;
            return (
              <div
                key={notif.id}
                style={{
                  backgroundColor: notif.is_read ? '#0F172A' : '#111827',
                  border: `1px solid ${notif.is_read ? '#1E293B' : '#1E293B'}`,
                  borderLeft: `3px solid ${notif.is_read ? '#1E293B' : cat.color}`,
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => handleMarkRead(notif.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '8px',
                      backgroundColor: `${cat.color}20`, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ fontSize: '1.125rem' }}>{cat.icon}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{
                          color: '#F8FAFC', fontWeight: notif.is_read ? 400 : 600,
                          fontSize: '0.875rem',
                        }}>
                          {notif.title}
                        </span>
                        {!notif.is_mutable && (
                          <span style={{
                            fontSize: '0.625rem', fontWeight: 700, padding: '0.1rem 0.4rem',
                            borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444',
                          }}>
                            MANDATORY
                          </span>
                        )}
                        {!notif.is_read && (
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            backgroundColor: cat.color, flexShrink: 0,
                          }} />
                        )}
                      </div>
                      <p style={{
                        color: '#94A3B8', fontSize: '0.8125rem', margin: 0,
                        lineHeight: 1.4, opacity: notif.is_read ? 0.7 : 1,
                      }}>
                        {notif.body}
                      </p>
                      {notif.deep_link_web && (
                        <span style={{
                          display: 'inline-block', marginTop: '0.5rem',
                          color: '#818CF8', fontSize: '0.75rem', fontWeight: 500,
                        }}>
                          View details →
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                    <span style={{ color: '#64748B', fontSize: '0.75rem' }}>
                      {timeAgo(notif.created_at)}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleArchive(notif.id); }}
                      style={{
                        border: 'none', background: 'transparent', color: '#475569',
                        cursor: 'pointer', fontSize: '0.875rem', padding: '0.125rem',
                      }}
                      title="Archive"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
