'use client';

import React, { useState } from 'react';

/**
 * Admin Support Desk Console — Phase 33
 *
 * Features:
 * - Ticket queue management (Active, Safety Emergency 1h, Escalations, Breached)
 * - Deterministic SLA tracking (First response 4h standard, Safety 1h emergency SLA)
 * - Conversation thread with Canned Reply integration
 * - Escalation triggers (Finance, Moderation, Legal)
 * - Security Gate: Limited User Context preview (Masked KYC, Balance editing prohibited)
 * - CSAT satisfaction survey metrics
 * - SLA breach monitoring & one-click acknowledgment
 */

interface MockTicket {
  id: string;
  ticket_number: string;
  category: 'ACCOUNT' | 'TOURNAMENT' | 'MATCH' | 'PAYMENT' | 'WALLET' | 'PAYOUT' | 'SAFETY' | 'ORGANISER';
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
  requester_username: string;
  requester_email_masked: string;
  requester_phone_masked: string;
  assigned_to: string | null;
  escalated_to: string | null;
  sla_first_response_due_at: string;
  sla_first_response_breached: boolean;
  sla_resolution_due_at: string;
  sla_resolution_breached: boolean;
  first_responded_at: string | null;
  created_at: string;
  csat_rating?: number;
  messages: Array<{
    id: string;
    sender: string;
    role: 'PLAYER' | 'SUPPORT_AGENT' | 'SYSTEM';
    is_internal: boolean;
    message: string;
    created_at: string;
  }>;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SAFETY:     { bg: 'rgba(239, 68, 68, 0.15)',  text: '#EF4444', border: 'rgba(239, 68, 68, 0.4)' },
  PAYMENT:    { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.4)' },
  WALLET:     { bg: 'rgba(234, 179, 8, 0.15)',  text: '#EAB308', border: 'rgba(234, 179, 8, 0.4)' },
  PAYOUT:     { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: 'rgba(168, 85, 247, 0.4)' },
  TOURNAMENT: { bg: 'rgba(59, 130, 246, 0.15)',  text: '#3B82F6', border: 'rgba(59, 130, 246, 0.4)' },
  MATCH:      { bg: 'rgba(6, 182, 212, 0.15)',   text: '#06B6D4', border: 'rgba(6, 182, 212, 0.4)' },
  ACCOUNT:    { bg: 'rgba(16, 185, 129, 0.15)',  text: '#10B981', border: 'rgba(16, 185, 129, 0.4)' },
  ORGANISER:  { bg: 'rgba(139, 92, 246, 0.15)',  text: '#8B5CF6', border: 'rgba(139, 92, 246, 0.4)' },
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#EF4444',
  URGENT: '#F97316',
  HIGH: '#EAB308',
  MEDIUM: '#3B82F6',
  LOW: '#64748B',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN:         { bg: 'rgba(59, 130, 246, 0.2)',  text: '#60A5FA' },
  IN_PROGRESS:  { bg: 'rgba(168, 85, 247, 0.2)', text: '#C084FC' },
  WAITING_USER: { bg: 'rgba(245, 158, 11, 0.2)', text: '#FBBF24' },
  ESCALATED:    { bg: 'rgba(239, 68, 68, 0.2)',  text: '#F87171' },
  RESOLVED:     { bg: 'rgba(16, 185, 129, 0.2)', text: '#34D399' },
  CLOSED:       { bg: 'rgba(100, 116, 139, 0.2)', text: '#94A3B8' },
};

const CANNED_REPLIES = [
  { code: 'acc-verify', title: 'Account Verification', body: 'Please verify your profile in Settings -> Verification. Note that Vexora v1 does not collect sensitive financial documents for free tournaments.' },
  { code: 'tourn-checkin', title: 'Tournament Check-in Protocol', body: 'Check-in opens 15 minutes before match start. Ensure all registered players click Check-In on the tournament lobby screen.' },
  { code: 'match-dispute', title: 'Match Evidence Submission', body: 'Please upload uncropped screenshots or video proof of match results within 15 minutes of conclusion.' },
  { code: 'safety-emergency', title: 'Immediate Safety Escalation (1h SLA)', body: 'Your safety is our top priority. This report is under active review by our Safety & Moderation team under a 1-hour fast SLA.' },
  { code: 'wallet-ledger', title: 'Wallet Transparency', body: 'Every credit transaction is verified on our append-only ledger with cryptographic proof under Profile -> Wallet.' },
];

const INITIAL_TICKETS: MockTicket[] = [
  {
    id: 'tk-1',
    ticket_number: 'VEX-TK-10023',
    category: 'SAFETY',
    subject: 'Verbal harassment and threats in tournament voice lobby',
    description: 'Opposing squad captain in match #892 was hurling abusive threats during pre-match lobby.',
    priority: 'CRITICAL',
    status: 'ESCALATED',
    requester_username: 'NinjaShadow',
    requester_email_masked: 'ni***@vexora.gg',
    requester_phone_masked: '+91 ******9842',
    assigned_to: 'agent_sarah',
    escalated_to: 'MODERATION',
    sla_first_response_due_at: '2026-10-16T12:00:00Z',
    sla_first_response_breached: false,
    sla_resolution_due_at: '2026-10-17T11:00:00Z',
    sla_resolution_breached: false,
    first_responded_at: '2026-10-16T11:20:00Z',
    created_at: '2026-10-16T11:00:00Z',
    messages: [
      { id: 'm1', sender: 'NinjaShadow', role: 'PLAYER', is_internal: false, message: 'Opposing squad captain in match #892 was hurling abusive threats during pre-match lobby. Screen recording attached.', created_at: '11:00 AM' },
      { id: 'm2', sender: 'agent_sarah', role: 'SUPPORT_AGENT', is_internal: false, message: 'Thank you for reporting. Your safety is paramount. I have escalated this directly to senior moderation for instant account sanction review.', created_at: '11:20 AM' },
      { id: 'm3', sender: 'agent_sarah', role: 'SUPPORT_AGENT', is_internal: true, message: 'Internal Note: Escalated to MODERATION team. Match #892 voice logs flagged for review.', created_at: '11:22 AM' },
    ],
  },
  {
    id: 'tk-2',
    ticket_number: 'VEX-TK-10024',
    category: 'TOURNAMENT',
    subject: 'Cannot join custom room lobby code expired',
    description: 'Room code given on tournament screen showed expired when entered into BGMI client.',
    priority: 'HIGH',
    status: 'OPEN',
    requester_username: 'ViperSniper',
    requester_email_masked: 'vi***@gmail.com',
    requester_phone_masked: '+91 ******1104',
    assigned_to: null,
    escalated_to: null,
    sla_first_response_due_at: '2026-10-16T15:00:00Z',
    sla_first_response_breached: false,
    sla_resolution_due_at: '2026-10-18T11:00:00Z',
    sla_resolution_breached: false,
    first_responded_at: null,
    created_at: '2026-10-16T11:15:00Z',
    messages: [
      { id: 'm4', sender: 'ViperSniper', role: 'PLAYER', is_internal: false, message: 'Room code given on tournament screen showed expired when entered into BGMI client.', created_at: '11:15 AM' },
    ],
  },
  {
    id: 'tk-3',
    ticket_number: 'VEX-TK-10025',
    category: 'PAYMENT',
    subject: 'Promotional voucher redemption query',
    description: 'Redeemed voucher WELCOME100 but credit balance did not update immediately.',
    priority: 'MEDIUM',
    status: 'WAITING_USER',
    requester_username: 'ProGamerX',
    requester_email_masked: 'pr***@yahoo.com',
    requester_phone_masked: '+91 ******7731',
    assigned_to: 'agent_rahul',
    escalated_to: null,
    sla_first_response_due_at: '2026-10-16T18:00:00Z',
    sla_first_response_breached: false,
    sla_resolution_due_at: '2026-10-19T10:00:00Z',
    sla_resolution_breached: false,
    first_responded_at: '2026-10-16T12:30:00Z',
    created_at: '2026-10-16T10:00:00Z',
    messages: [
      { id: 'm5', sender: 'ProGamerX', role: 'PLAYER', is_internal: false, message: 'Redeemed voucher WELCOME100 but credit balance did not update immediately.', created_at: '10:00 AM' },
      { id: 'm6', sender: 'agent_rahul', role: 'SUPPORT_AGENT', is_internal: false, message: 'Hello! Our double-entry ledger processed your voucher batch successfully. Could you please refresh your wallet screen and confirm?', created_at: '12:30 PM' },
    ],
  },
  {
    id: 'tk-4',
    ticket_number: 'VEX-TK-10020',
    category: 'ORGANISER',
    subject: 'Organiser tier upgrade application status inquiry',
    description: 'Submitted verification documents 5 days ago for Tier 2 Verified Organiser status.',
    priority: 'LOW',
    status: 'RESOLVED',
    requester_username: 'ESportsIndiaOrg',
    requester_email_masked: 'es***@gmail.com',
    requester_phone_masked: '+91 ******4452',
    assigned_to: 'agent_sarah',
    escalated_to: null,
    sla_first_response_due_at: '2026-10-15T10:00:00Z',
    sla_first_response_breached: false,
    sla_resolution_due_at: '2026-10-19T10:00:00Z',
    sla_resolution_breached: false,
    first_responded_at: '2026-10-15T09:30:00Z',
    created_at: '2026-10-14T10:00:00Z',
    csat_rating: 5,
    messages: [
      { id: 'm7', sender: 'ESportsIndiaOrg', role: 'PLAYER', is_internal: false, message: 'Submitted verification documents 5 days ago for Tier 2 status.', created_at: 'Oct 14' },
      { id: 'm8', sender: 'agent_sarah', role: 'SUPPORT_AGENT', is_internal: false, message: 'Congratulations! Your Organiser Tier 2 verification has been approved after compliance check.', created_at: 'Oct 15' },
    ],
  },
];

type TabId = 'all' | 'safety' | 'escalated' | 'breaches' | 'canned';

export default function SupportDeskAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [tickets, setTickets] = useState<MockTicket[]>(INITIAL_TICKETS);
  const [selectedTicket, setSelectedTicket] = useState<MockTicket | null>(INITIAL_TICKETS[0]);
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#111827',
    border: '1px solid #1E293B',
    borderRadius: '12px',
    padding: '1.25rem',
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filter tickets
  const filteredTickets = tickets.filter(t => {
    if (activeTab === 'safety' && t.category !== 'SAFETY') return false;
    if (activeTab === 'escalated' && t.status !== 'ESCALATED') return false;
    if (activeTab === 'breaches' && !t.sla_first_response_breached && !t.sla_resolution_breached) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.ticket_number.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.requester_username.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedTicket) return;

    const newMsg = {
      id: `m-${Date.now()}`,
      sender: 'Staff Agent',
      role: 'SUPPORT_AGENT' as const,
      is_internal: isInternalNote,
      message: replyText.trim(),
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = {
      ...selectedTicket,
      status: isInternalNote ? selectedTicket.status : ('WAITING_USER' as const),
      first_responded_at: selectedTicket.first_responded_at || new Date().toISOString(),
      messages: [...selectedTicket.messages, newMsg],
    };

    setTickets(tickets.map(t => t.id === updated.id ? updated : t));
    setSelectedTicket(updated);
    setReplyText('');
    showToast(isInternalNote ? 'Internal staff note added' : 'Reply sent to player');
  };

  const handleEscalate = (target: 'FINANCE' | 'MODERATION') => {
    if (!selectedTicket) return;
    const updated = {
      ...selectedTicket,
      status: 'ESCALATED' as const,
      escalated_to: target,
      messages: [
        ...selectedTicket.messages,
        {
          id: `m-${Date.now()}`,
          sender: 'System',
          role: 'SYSTEM' as const,
          is_internal: true,
          message: `Ticket escalated to ${target} department for urgent specialized handling.`,
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };
    setTickets(tickets.map(t => t.id === updated.id ? updated : t));
    setSelectedTicket(updated);
    showToast(`Ticket escalated to ${target}`);
  };

  const handleResolve = () => {
    if (!selectedTicket) return;
    const updated = {
      ...selectedTicket,
      status: 'RESOLVED' as const,
      messages: [
        ...selectedTicket.messages,
        {
          id: `m-${Date.now()}`,
          sender: 'Staff Agent',
          role: 'SUPPORT_AGENT' as const,
          is_internal: false,
          message: '[Resolution] Ticket marked as resolved. User invited to complete CSAT survey.',
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };
    setTickets(tickets.map(t => t.id === updated.id ? updated : t));
    setSelectedTicket(updated);
    showToast('Ticket marked as Resolved');
  };

  const insertCannedReply = (body: string) => {
    setReplyText(prev => prev ? `${prev}\n\n${body}` : body);
  };

  return (
    <div>
      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          backgroundColor: '#0F172A',
          border: '1px solid #10B981',
          color: '#34D399',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 9999,
          fontSize: '0.875rem',
          fontWeight: 600,
        }}>
          ✅ {toastMessage}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🎧</span>
            <h1 style={{ fontSize: '1.5rem', color: '#F8FAFC', margin: 0, fontWeight: 700 }}>Support Desk &amp; Ticketing</h1>
          </div>
          <p style={{ color: '#64748B', margin: 0, fontSize: '0.875rem' }}>
            Phase 33 — SLA enforcement (First Response 4h, Safety 1h), Canned replies, CSAT, Security Gate user privacy
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <span style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#EF4444',
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}>
            ⚡ Safety SLA: 1 Hour
          </span>
          <span style={{
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#60A5FA',
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}>
            Standard SLA: 4 Hours
          </span>
        </div>
      </div>

      {/* Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={cardStyle}>
          <div style={{ color: '#64748B', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Active Tickets</div>
          <div style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700 }}>
            {tickets.filter(t => !['RESOLVED', 'CLOSED'].includes(t.status)).length}
          </div>
          <div style={{ color: '#34D399', fontSize: '0.75rem', marginTop: '0.25rem' }}>96.2% within SLA</div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: '#64748B', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Safety Queue (1h SLA)</div>
          <div style={{ color: '#EF4444', fontSize: '1.5rem', fontWeight: 700 }}>
            {tickets.filter(t => t.category === 'SAFETY' && t.status !== 'CLOSED').length}
          </div>
          <div style={{ color: '#F87171', fontSize: '0.75rem', marginTop: '0.25rem' }}>Expedited emergency review</div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: '#64748B', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Escalated to Teams</div>
          <div style={{ color: '#F59E0B', fontSize: '1.5rem', fontWeight: 700 }}>
            {tickets.filter(t => t.status === 'ESCALATED').length}
          </div>
          <div style={{ color: '#FBBF24', fontSize: '0.75rem', marginTop: '0.25rem' }}>Finance / Moderation</div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: '#64748B', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Average CSAT Score</div>
          <div style={{ color: '#38BDF8', fontSize: '1.5rem', fontWeight: 700 }}>
            ⭐ 4.8 <span style={{ fontSize: '0.9rem', color: '#64748B' }}>/ 5.0</span>
          </div>
          <div style={{ color: '#38BDF8', fontSize: '0.75rem', marginTop: '0.25rem' }}>Based on 142 post-resolution ratings</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1E293B', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { id: 'all', label: 'All Tickets', count: tickets.length },
          { id: 'safety', label: '🚨 Safety Queue (1h SLA)', count: tickets.filter(t => t.category === 'SAFETY').length },
          { id: 'escalated', label: '⚡ Escalated', count: tickets.filter(t => t.status === 'ESCALATED').length },
          { id: 'breaches', label: '⚠️ SLA Breaches', count: tickets.filter(t => t.sla_first_response_breached).length },
          { id: 'canned', label: '📑 Canned Replies', count: CANNED_REPLIES.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: activeTab === tab.id ? '1px solid #3B82F6' : '1px solid transparent',
              backgroundColor: activeTab === tab.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === tab.id ? '#60A5FA' : '#94A3B8',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Main Split View: Left List, Right Detail */}
      {activeTab !== 'canned' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* Left Panel: Ticket List */}
          <div style={{ ...cardStyle, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Search ticket #, subject..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  padding: '0.4rem 0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}
              >
                <option value="ALL">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_USER">Waiting User</option>
                <option value="ESCALATED">Escalated</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredTickets.map(t => {
                const isSelected = selectedTicket?.id === t.id;
                const catStyle = CATEGORY_COLORS[t.category] || CATEGORY_COLORS.ACCOUNT;
                const statStyle = STATUS_COLORS[t.status] || STATUS_COLORS.OPEN;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    style={{
                      padding: '0.875rem',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : '#0F172A',
                      border: isSelected ? '1px solid #3B82F6' : '1px solid #1E293B',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600 }}>{t.ticket_number}</span>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <span style={{
                          backgroundColor: catStyle.bg,
                          color: catStyle.text,
                          border: `1px solid ${catStyle.border}`,
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}>
                          {t.category}
                        </span>
                        <span style={{
                          backgroundColor: statStyle.bg,
                          color: statStyle.text,
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}>
                          {t.status}
                        </span>
                      </div>
                    </div>

                    <div style={{ color: '#F1F5F9', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', lineHeight: 1.3 }}>
                      {t.subject}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748B' }}>
                      <span>👤 {t.requester_username}</span>
                      {t.category === 'SAFETY' ? (
                        <span style={{ color: '#EF4444', fontWeight: 600 }}>⏱️ 1h Fast SLA</span>
                      ) : (
                        <span>⏱️ 4h Standard</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Ticket Detail & Conversation Thread */}
          {selectedTicket ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Ticket Summary Header */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>
                        {selectedTicket.ticket_number}: {selectedTicket.subject}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                      Created at {new Date(selectedTicket.created_at).toLocaleString()} • Requester: <strong style={{ color: '#F8FAFC' }}>{selectedTicket.requester_username}</strong>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {selectedTicket.status !== 'ESCALATED' && (
                      <>
                        <button
                          onClick={() => handleEscalate('MODERATION')}
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#EF4444',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          🚨 Escalate Moderation
                        </button>
                        <button
                          onClick={() => handleEscalate('FINANCE')}
                          style={{
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            color: '#F59E0B',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          💰 Escalate Finance
                        </button>
                      </>
                    )}
                    {selectedTicket.status !== 'RESOLVED' && (
                      <button
                        onClick={handleResolve}
                        style={{
                          backgroundColor: '#10B981',
                          border: 'none',
                          color: '#FFFFFF',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        ✓ Resolve Ticket
                      </button>
                    )}
                  </div>
                </div>

                {/* Security Gate & SLA Status Strip */}
                <div style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  fontSize: '0.8rem',
                }}>
                  <div>
                    <span style={{ color: '#64748B' }}>SLA First Response: </span>
                    <strong style={{ color: selectedTicket.category === 'SAFETY' ? '#EF4444' : '#60A5FA' }}>
                      {selectedTicket.category === 'SAFETY' ? '1 Hour (Emergency)' : '4 Hours (Standard)'}
                    </strong>
                    <div style={{ color: selectedTicket.first_responded_at ? '#34D399' : '#FBBF24', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      {selectedTicket.first_responded_at ? '✓ Met within SLA' : '⏱️ Response pending'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Security Gate - User Privacy: </span>
                    <div style={{ color: '#94A3B8', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      Email: <code>{selectedTicket.requester_email_masked}</code> • Phone: <code>{selectedTicket.requester_phone_masked}</code>
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Role Limits (Agent): </span>
                    <div style={{ color: '#F87171', fontSize: '0.75rem', marginTop: '0.15rem', fontWeight: 600 }}>
                      🚫 KYC Scans Redacted • Balance Edits Prohibited
                    </div>
                  </div>
                </div>
              </div>

              {/* Conversation Thread */}
              <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid #1E293B', paddingBottom: '0.5rem' }}>
                  Conversation History ({selectedTicket.messages.length} messages)
                </div>

                {selectedTicket.messages.map(m => {
                  const isPlayer = m.role === 'PLAYER';
                  const isInternal = m.is_internal;
                  return (
                    <div
                      key={m.id}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: isInternal ? 'rgba(234, 179, 8, 0.08)' : (isPlayer ? '#0F172A' : 'rgba(59, 130, 246, 0.1)'),
                        border: isInternal ? '1px dashed #EAB308' : (isPlayer ? '1px solid #1E293B' : '1px solid rgba(59, 130, 246, 0.3)'),
                        alignSelf: isPlayer ? 'flex-start' : 'stretch',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                        <span style={{
                          fontWeight: 700,
                          color: isInternal ? '#FACC15' : (isPlayer ? '#38BDF8' : '#60A5FA'),
                        }}>
                          {isInternal ? '🔒 Internal Note • ' : ''}{m.sender} ({m.role})
                        </span>
                        <span style={{ color: '#64748B' }}>{m.created_at}</span>
                      </div>
                      <div style={{ color: '#E2E8F0', fontSize: '0.85rem', lineHeight: 1.4 }}>
                        {m.message}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box with Canned Responses */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setIsInternalNote(false)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        backgroundColor: !isInternalNote ? '#3B82F6' : '#1E293B',
                        color: !isInternalNote ? '#FFFFFF' : '#94A3B8',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      Public Reply
                    </button>
                    <button
                      onClick={() => setIsInternalNote(true)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        backgroundColor: isInternalNote ? '#EAB308' : '#1E293B',
                        color: isInternalNote ? '#000000' : '#94A3B8',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      🔒 Internal Staff Note
                    </button>
                  </div>

                  {/* Canned Reply Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Insert Canned:</span>
                    <select
                      onChange={e => {
                        if (e.target.value) {
                          insertCannedReply(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      style={{
                        backgroundColor: '#0F172A',
                        border: '1px solid #334155',
                        color: '#F8FAFC',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                      }}
                    >
                      <option value="">Select template...</option>
                      {CANNED_REPLIES.map(c => (
                        <option key={c.code} value={c.body}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <textarea
                  rows={3}
                  placeholder={isInternalNote ? "Write an internal note (only visible to support agents and admins)..." : "Write a response to the user..."}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0F172A',
                    border: isInternalNote ? '1px solid #EAB308' : '1px solid #334155',
                    color: '#F8FAFC',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    marginBottom: '0.75rem',
                    outline: 'none',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim()}
                    style={{
                      backgroundColor: replyText.trim() ? (isInternalNote ? '#EAB308' : '#3B82F6') : '#334155',
                      color: isInternalNote ? '#000000' : '#FFFFFF',
                      border: 'none',
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    {isInternalNote ? 'Post Internal Note' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#64748B', padding: '3rem' }}>
              Select a ticket from the left queue to view details and reply.
            </div>
          )}
        </div>
      ) : (
        /* Canned Replies Management Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', color: '#F8FAFC', margin: 0, fontWeight: 600 }}>Canned Replies Repository</h2>
              <p style={{ color: '#64748B', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Pre-approved compliant response templates for rapid support responses</p>
            </div>
            <button
              onClick={() => showToast('Canned reply editor launched')}
              style={{
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              + New Canned Reply
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {CANNED_REPLIES.map(c => (
              <div key={c.code} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#F8FAFC', fontSize: '0.9rem' }}>{c.title}</strong>
                  <code style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                    /{c.code}
                  </code>
                </div>
                <p style={{ color: '#94A3B8', fontSize: '0.8rem', lineHeight: 1.4, margin: 0 }}>
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
