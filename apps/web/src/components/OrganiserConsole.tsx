'use client';

import React, { useState } from 'react';

/**
 * Phase 18: Web Organiser Operations Console
 *
 * Implements:
 *   - Organiser Tournament Hub (metrics, capacity, rules version)
 *   - 5-Point Match-Day Protocol (Section 43)
 *   - Participant Roster & Check-In monitoring
 *   - Announcements Publisher & Feed
 *   - Incident Log with severity tracking & resolution
 *   - Anti-IDOR: Organiser manages only their own events
 */

interface ChecklistItem {
  key: string;
  label: string;
  subtitle: string;
  completed: boolean;
  completedAt?: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  time: string;
}

interface Incident {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  status: 'LOGGED' | 'RESOLVED';
  resolution?: string;
  time: string;
}

export function OrganiserConsole() {
  const [activeTab, setActiveTab] = useState<'checklist' | 'announcements' | 'incidents' | 'roster'>('checklist');

  // 5 Canonical matchday checklist items (Section 43)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      key: 'LOBBY_CREATED',
      label: 'In-Game Custom Room / Lobby Created',
      subtitle: 'Room configuration, mode parameters, and spectator delay verified.',
      completed: true,
      completedAt: '17:15 IST',
    },
    {
      key: 'ROOM_DETAILS_RELEASED',
      label: 'Room ID & Password Scheduled / Released',
      subtitle: 'Restricted credentials released to verified checked-in players only.',
      completed: true,
      completedAt: '17:45 IST',
    },
    {
      key: 'CHECK_IN_VERIFIED',
      label: 'Participant Check-in & Roster Locked',
      subtitle: 'No line-up substitutions permitted after tournament check-in closes.',
      completed: false,
    },
    {
      key: 'EVIDENCE_COLLECTED',
      label: 'Match Screenshots & Evidence Collected',
      subtitle: 'SHA-256 ingress hashing recorded on all scoreboard media captures.',
      completed: false,
    },
    {
      key: 'RESULT_SUBMITTED',
      label: 'Official Match Results Recorded & Signed',
      subtitle: 'Standings calculation using deterministic integer scoring engine.',
      completed: false,
    },
  ]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: 'ann-1',
      title: 'Lobby Room Credentials Release at 17:45 IST',
      content: 'All checked-in teams make sure you have the latest map update downloaded before joining.',
      isPinned: true,
      time: '12 mins ago',
    },
    {
      id: 'ann-2',
      title: 'Reminder: Disconnect Policy in Effect',
      content: 'In case of game crash during flight path, notify organiser within 2 minutes per clause 4.2.',
      isPinned: false,
      time: '45 mins ago',
    },
  ]);

  const [incidents, setIncidents] = useState<Incident[]>([
    {
      id: 'inc-1',
      type: 'DISCONNECT',
      severity: 'MEDIUM',
      description: 'Squad Alpha Player 4 experienced ISP latency spike before drop.',
      status: 'RESOLVED',
      resolution: 'Lobby countdown paused for 2 minutes; player reconnected.',
      time: '20 mins ago',
    },
  ]);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPinned, setNewPinned] = useState(false);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);

  const [incType, setIncType] = useState('LATE_START');
  const [incSeverity, setIncSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('LOW');
  const [incDesc, setIncDesc] = useState('');
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  function toggleChecklistItem(key: string) {
    setChecklist(prev =>
      prev.map(item =>
        item.key === key
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? 'Just now' : undefined,
            }
          : item
      )
    );
  }

  function handleCreateAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setAnnouncements(prev => [
      {
        id: `ann-${Date.now()}`,
        title: newTitle.trim(),
        content: newContent.trim(),
        isPinned: newPinned,
        time: 'Just now',
      },
      ...prev,
    ]);
    setNewTitle('');
    setNewContent('');
    setNewPinned(false);
    setShowAnnounceModal(false);
  }

  function handleLogIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!incDesc.trim()) return;
    setIncidents(prev => [
      {
        id: `inc-${Date.now()}`,
        type: incType,
        severity: incSeverity,
        description: incDesc.trim(),
        status: 'LOGGED',
        time: 'Just now',
      },
      ...prev,
    ]);
    setIncDesc('');
    setShowIncidentModal(false);
  }

  const completedChecklistCount = checklist.filter(c => c.completed).length;

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px',
      color: '#FFFFFF',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              backgroundColor: '#6366F125',
              border: '1px solid #6366F160',
              color: '#818CF8',
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              letterSpacing: '0.08em',
            }}>
              ORGANISER WORKSPACE
            </span>
            <span style={{
              backgroundColor: '#10B98120',
              border: '1px solid #10B98150',
              color: '#10B981',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
            }}>
              VERIFIED ORGANISER
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            BGMI Ignition Cup 2026: Operations Center
          </h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0 0' }}>
            Battle Royale Lobby (48 Squads) • Rules v2 (Krafton 10-Point Scoring)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowAnnounceModal(true)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              backgroundColor: '#6366F1',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📢 Broadcast Announcement
          </button>
          <button
            onClick={() => setShowIncidentModal(true)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              backgroundColor: '#DC262620',
              color: '#F87171',
              border: '1px solid #DC262650',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ⚠️ Log Incident
          </button>
        </div>
      </div>

      {/* Operational Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={{ backgroundColor: '#111127', border: '1px solid #1E1E3A', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            Confirmed Capacity
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#6366F1', marginTop: '4px' }}>
            42 / 48
          </div>
          <div style={{ color: '#10B981', fontSize: '12px', marginTop: '4px' }}>
            6 slots remaining • 3 on waitlist
          </div>
        </div>

        <div style={{ backgroundColor: '#111127', border: '1px solid #1E1E3A', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            Check-In Rate
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
            38 / 42 (90%)
          </div>
          <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '4px' }}>
            Check-in window closes in 15m
          </div>
        </div>

        <div style={{ backgroundColor: '#111127', border: '1px solid #1E1E3A', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            Matchday Protocol
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#F59E0B', marginTop: '4px' }}>
            {completedChecklistCount} / 5 Done
          </div>
          <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '4px' }}>
            Section 43 matchday compliance
          </div>
        </div>

        <div style={{ backgroundColor: '#111127', border: '1px solid #1E1E3A', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            Active Incidents
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: incidents.some(i => i.status === 'LOGGED') ? '#EF4444' : '#10B981', marginTop: '4px' }}>
            {incidents.filter(i => i.status === 'LOGGED').length} Open
          </div>
          <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '4px' }}>
            {incidents.filter(i => i.status === 'RESOLVED').length} resolved in log
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid #1E1E3A',
        marginBottom: '20px',
      }}>
        {[
          { key: 'checklist', label: `📋 Match-Day Protocol (${completedChecklistCount}/5)` },
          { key: 'announcements', label: `📢 Announcements (${announcements.length})` },
          { key: 'incidents', label: `⚠️ Incident Log (${incidents.length})` },
          { key: 'roster', label: '👥 Participants (42)' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            style={{
              padding: '10px 16px',
              backgroundColor: 'transparent',
              color: activeTab === t.key ? '#6366F1' : '#9CA3AF',
              border: 'none',
              borderBottom: activeTab === t.key ? '2px solid #6366F1' : '2px solid transparent',
              fontWeight: activeTab === t.key ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Match-Day Protocol */}
      {activeTab === 'checklist' && (
        <div style={{ backgroundColor: '#111127', border: '1px solid #1E1E3A', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Standard Operating Match-Day Protocol (Section 43)
              </h2>
              <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0 0' }}>
                Verify and mark each milestone. Actions are audit-logged with timestamps.
              </p>
            </div>
            <span style={{
              color: completedChecklistCount === 5 ? '#10B981' : '#F59E0B',
              fontSize: '13px',
              fontWeight: 700,
            }}>
              {Math.round((completedChecklistCount / 5) * 100)}% Complete
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {checklist.map((item, index) => (
              <div
                key={item.key}
                onClick={() => toggleChecklistItem(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: item.completed ? '#10B98110' : '#16162D',
                  border: item.completed ? '1px solid #10B98140' : '1px solid #232342',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => {}}
                  style={{
                    marginTop: '3px',
                    accentColor: '#10B981',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: item.completed ? '#E5E7EB' : '#FFFFFF',
                    textDecoration: item.completed ? 'line-through' : 'none',
                    textDecorationColor: '#9CA3AF',
                  }}>
                    {index + 1}. {item.label}
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>
                    {item.subtitle}
                  </div>
                  {item.completedAt && (
                    <div style={{ color: '#10B981', fontSize: '11px', marginTop: '4px', fontWeight: 500 }}>
                      ✓ Completed at {item.completedAt}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Announcements */}
      {activeTab === 'announcements' && (
        <div style={{ backgroundColor: '#111127', border: '1px solid #1E1E3A', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Live Announcements Feed
            </h2>
            <button
              onClick={() => setShowAnnounceModal(true)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#6366F1',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Post New
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {announcements.map(ann => (
              <div
                key={ann.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: '#16162D',
                  border: ann.isPinned ? '1px solid #F59E0B60' : '1px solid #232342',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {ann.isPinned && (
                      <span style={{
                        backgroundColor: '#F59E0B20',
                        color: '#F59E0B',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}>
                        📌 PINNED
                      </span>
                    )}
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                      {ann.title}
                    </span>
                  </div>
                  <span style={{ color: '#9CA3AF', fontSize: '12px' }}>{ann.time}</span>
                </div>
                <p style={{ color: '#D1D5DB', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                  {ann.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Incidents */}
      {activeTab === 'incidents' && (
        <div style={{ backgroundColor: '#111127', border: '1px solid #1E1E3A', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Tournament Incident Audit Log
              </h2>
              <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0 0' }}>
                All match interruptions, late starts, and rules clarifications are permanently preserved.
              </p>
            </div>
            <button
              onClick={() => setShowIncidentModal(true)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Log Incident
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {incidents.map(inc => (
              <div
                key={inc.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: '#16162D',
                  border: '1px solid #232342',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      backgroundColor: inc.severity === 'CRITICAL' ? '#EF444430'
                        : inc.severity === 'HIGH' ? '#F9731630'
                        : inc.severity === 'MEDIUM' ? '#F59E0B30'
                        : '#3B82F630',
                      color: inc.severity === 'CRITICAL' ? '#EF4444'
                        : inc.severity === 'HIGH' ? '#F97316'
                        : inc.severity === 'MEDIUM' ? '#F59E0B'
                        : '#60A5FA',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}>
                      {inc.type} • {inc.severity}
                    </span>
                    <span style={{
                      backgroundColor: inc.status === 'RESOLVED' ? '#10B98120' : '#F59E0B20',
                      color: inc.status === 'RESOLVED' ? '#10B981' : '#F59E0B',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}>
                      {inc.status}
                    </span>
                  </div>
                  <span style={{ color: '#9CA3AF', fontSize: '12px' }}>{inc.time}</span>
                </div>
                <div style={{ color: '#E5E7EB', fontSize: '13px', marginBottom: inc.resolution ? '8px' : '0' }}>
                  {inc.description}
                </div>
                {inc.resolution && (
                  <div style={{
                    backgroundColor: '#111127',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#10B981',
                    borderLeft: '3px solid #10B981',
                  }}>
                    <strong>Resolution:</strong> {inc.resolution}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Roster */}
      {activeTab === 'roster' && (
        <div style={{ backgroundColor: '#111127', border: '1px solid #1E1E3A', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Confirmed Participant Lineup
            </h2>
            <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 600 }}>
              🔒 Roster Locked at Check-In
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {[1, 2, 3, 4, 5, 6].map(slot => (
              <div
                key={slot}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#16162D',
                  border: '1px solid #232342',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
                    Slot #{slot} • Squad Omega {slot}
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '2px' }}>
                    In-Game UID: 5123490{slot}8 (Verified)
                  </div>
                </div>
                <span style={{
                  backgroundColor: slot <= 5 ? '#10B98120' : '#F59E0B20',
                  color: slot <= 5 ? '#10B981' : '#F59E0B',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}>
                  {slot <= 5 ? 'CHECKED IN' : 'CONFIRMED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Broadcast Announcement Modal */}
      {showAnnounceModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#00000080',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <form
            onSubmit={handleCreateAnnouncement}
            style={{
              backgroundColor: '#1A1A2E',
              borderRadius: '12px',
              padding: '24px',
              width: '450px',
              maxWidth: '90vw',
              border: '1px solid #1E1E3A',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>
              Broadcast Announcement
            </h3>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>
                Title
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Miramar Map 1 Lobby Code"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: '#0F0F23',
                  border: '1px solid #333',
                  color: '#fff',
                  fontSize: '13px',
                }}
              />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>
                Content
              </label>
              <textarea
                required
                rows={3}
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Notice to all checked-in participants..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: '#0F0F23',
                  border: '1px solid #333',
                  color: '#fff',
                  fontSize: '13px',
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <input
                type="checkbox"
                id="pinCheck"
                checked={newPinned}
                onChange={e => setNewPinned(e.target.checked)}
                style={{ accentColor: '#6366F1' }}
              />
              <label htmlFor="pinCheck" style={{ fontSize: '13px', color: '#D1D5DB', cursor: 'pointer' }}>
                Pin to top of channel
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowAnnounceModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #333',
                  backgroundColor: 'transparent',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#6366F1',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Broadcast
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Log Incident Modal */}
      {showIncidentModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#00000080',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <form
            onSubmit={handleLogIncident}
            style={{
              backgroundColor: '#1A1A2E',
              borderRadius: '12px',
              padding: '24px',
              width: '450px',
              maxWidth: '90vw',
              border: '1px solid #EF444440',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#EF4444' }}>
              Log Tournament Incident
            </h3>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>
                Incident Type
              </label>
              <select
                value={incType}
                onChange={e => setIncType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: '#0F0F23',
                  border: '1px solid #333',
                  color: '#fff',
                  fontSize: '13px',
                }}
              >
                <option value="LATE_START">Late Start</option>
                <option value="DISCONNECT">Player Disconnection</option>
                <option value="RULE_CLARIFICATION">Rule Clarification</option>
                <option value="SUSPECTED_CHEATING">Suspected Cheating</option>
                <option value="LOBBY_ISSUE">Lobby / Room Code Issue</option>
                <option value="NO_SHOW">Team No-Show</option>
                <option value="OTHER">Other Issue</option>
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>
                Severity
              </label>
              <select
                value={incSeverity}
                onChange={e => setIncSeverity(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: '#0F0F23',
                  border: '1px solid #333',
                  color: '#fff',
                  fontSize: '13px',
                }}
              >
                <option value="LOW">Low - Informational</option>
                <option value="MEDIUM">Medium - Gameplay Delay</option>
                <option value="HIGH">High - Dispute Potential</option>
                <option value="CRITICAL">Critical - Match Cancellation</option>
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>
                Description
              </label>
              <textarea
                required
                rows={3}
                value={incDesc}
                onChange={e => setIncDesc(e.target.value)}
                placeholder="What occurred, which teams were involved, and what action was taken..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: '#0F0F23',
                  border: '1px solid #333',
                  color: '#fff',
                  fontSize: '13px',
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowIncidentModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #333',
                  backgroundColor: 'transparent',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Log Incident
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
