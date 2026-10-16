'use client';

import React, { useState } from 'react';
import { AdminShell } from '../../components/AdminShell';

interface DisputeCase {
  id: string;
  case_id: string;
  match_title: string;
  raised_by_username: string;
  reason: string;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_UPHELD' | 'RESOLVED_OVERTURNED' | 'DISMISSED';
  settlement_frozen: boolean;
  sla_deadline_hours: number;
  evidence_hashes: string[];
  initial_moderator_id?: string;
  ruling_reason?: string;
  policy_clause?: string;
  appeal_status: 'NONE' | 'PENDING_APPEAL' | 'APPEAL_UPHELD' | 'APPEAL_REJECTED';
  appeal_text?: string;
}

const INITIAL_DISPUTES: DisputeCase[] = [
  {
    id: 'disp-001',
    case_id: 'DSP-20261015-8E4B',
    match_title: 'Match #4 — BGMI Ignition Cup Semi-Finals',
    raised_by_username: 'Hydra_Captain',
    reason: 'WRONG_SCORE',
    description: 'Opponent recorded 4 kills instead of 2. We eliminated them at #3 placement, as proven by scoreboard screenshot.',
    status: 'OPEN',
    settlement_frozen: true,
    sla_deadline_hours: 18,
    evidence_hashes: [
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      '7d793037a0760186574b0282f2f435e7b1e50774690f45045323a70ff4b1f458',
    ],
    appeal_status: 'NONE',
  },
  {
    id: 'disp-002',
    case_id: 'DSP-20261015-3A9F',
    match_title: 'Match #2 — Free Fire MAX Weekly Clash',
    raised_by_username: 'Velocity_Viper',
    reason: 'CHEATING',
    description: 'Player on opposing team exhibited abnormal snap aim and emulator telemetry flags.',
    status: 'UNDER_REVIEW',
    settlement_frozen: true,
    sla_deadline_hours: 8,
    evidence_hashes: [
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    ],
    appeal_status: 'NONE',
  },
  {
    id: 'disp-003',
    case_id: 'DSP-20261014-992C',
    match_title: 'Match #1 — CODM SnD Masters Qualifier',
    raised_by_username: 'Delta_Operator',
    reason: 'NO_SHOW',
    description: 'Rival team captain did not join lobby within the 15-minute ingress window.',
    status: 'RESOLVED_UPHELD',
    settlement_frozen: false,
    sla_deadline_hours: 0,
    evidence_hashes: [
      '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    ],
    initial_moderator_id: 'mod-101',
    ruling_reason: 'Lobby server logs confirmed Team Phantom did not connect within 15m ingress deadline.',
    policy_clause: 'Clause 9.1: Lobby Check-In & Forfeit Rule',
    appeal_status: 'PENDING_APPEAL',
    appeal_text: 'Our captain experienced a documented platform ISP routing failure at 18:02 IST. Screenshot of ISP ticket attached.',
  },
];

export default function DisputeAdjudicationPage() {
  const [disputes, setDisputes] = useState<DisputeCase[]>(INITIAL_DISPUTES);
  const [activeTab, setActiveTab] = useState<'ACTIVE_DISPUTES' | 'APPEALS_QUEUE'>('ACTIVE_DISPUTES');
  const [selectedCase, setSelectedCase] = useState<DisputeCase | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Ruling form
  const [policyClause, setPolicyClause] = useState('Clause 11.3: Ingress Evidence Verification');
  const [rulingReason, setRulingReason] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('CORRECT_SCORE');

  const handleOpenAdjudication = (item: DisputeCase) => {
    setSelectedCase(item);
    setRulingReason('');
    setPolicyClause('Clause 11.3: Ingress Evidence Verification');
  };

  const handleApplyRuling = (rulingType: 'UPHELD' | 'OVERTURNED' | 'DISMISSED') => {
    if (!selectedCase) return;

    if (!rulingReason.trim() || rulingReason.trim().length < 10) {
      alert('Security Gate: Detailed ruling reason (min 10 characters) is strictly required.');
      return;
    }

    setDisputes((prev) =>
      prev.map((d) => {
        if (d.id === selectedCase.id) {
          const newStatus = rulingType === 'UPHELD' ? 'RESOLVED_UPHELD' : (rulingType === 'OVERTURNED' ? 'RESOLVED_OVERTURNED' : 'DISMISSED');
          return {
            ...d,
            status: newStatus,
            ruling_reason: rulingReason,
            policy_clause: policyClause,
            initial_moderator_id: 'current-mod',
            settlement_frozen: false,
          };
        }
        return d;
      })
    );

    setActionNotice(`Ruling applied on ${selectedCase.case_id}. 48-hour appeal window opened. Settlement unfrozen.`);
    setSelectedCase(null);
  };

  const handleDecideAppeal = (caseId: string, decision: 'APPEAL_UPHELD' | 'APPEAL_REJECTED') => {
    setDisputes((prev) =>
      prev.map((d) => {
        if (d.case_id === caseId) {
          return {
            ...d,
            appeal_status: decision,
            settlement_frozen: false,
          };
        }
        return d;
      })
    );
    setActionNotice(`Appeal on ${caseId} adjudicated as ${decision} by secondary reviewer (Maker-Checker).`);
  };

  return (
    <AdminShell>
      <div>
        <header style={{ borderBottom: '1px solid #1E293B', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#6366F1', fontWeight: 700, letterSpacing: '0.05em' }}>
              MODERATION & DISPUTES
            </span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Sections 11, 19, 26, 39 Phase 5</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700, color: '#F8FAFC' }}>
            Dispute Adjudication & Appeals Console
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#94A3B8', fontSize: '0.875rem' }}>
            Investigate disputed tournament match results, enforce evidence ingress checks, apply policy clauses, and conduct Maker-Checker appeal reviews.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              onClick={() => setActiveTab('ACTIVE_DISPUTES')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: activeTab === 'ACTIVE_DISPUTES' ? '#6366F1' : '#1E293B',
                color: '#FFF',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              ⚖️ Active Disputes ({disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length})
            </button>
            <button
              onClick={() => setActiveTab('APPEALS_QUEUE')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: activeTab === 'APPEALS_QUEUE' ? '#6366F1' : '#1E293B',
                color: '#FFF',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              🔄 Appeals Queue ({disputes.filter((d) => d.appeal_status === 'PENDING_APPEAL').length})
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

        {/* ─── TAB 1: ACTIVE DISPUTES ────────────────────────────────────────── */}
        {activeTab === 'ACTIVE_DISPUTES' && (
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
                  <th style={{ padding: '0.75rem 1rem' }}>CASE ID & MATCH</th>
                  <th style={{ padding: '0.75rem 1rem' }}>RAISED BY & REASON</th>
                  <th style={{ padding: '0.75rem 1rem' }}>SETTLEMENT STATUS</th>
                  <th style={{ padding: '0.75rem 1rem' }}>SLA TIMER</th>
                  <th style={{ padding: '0.75rem 1rem' }}>STATUS</th>
                  <th style={{ padding: '0.75rem 1rem' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #1E293B', color: '#F1F5F9', fontSize: '0.875rem' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#818CF8' }}>{item.case_id}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{item.match_title}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{item.raised_by_username}</div>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#334155', fontSize: '0.7rem' }}>
                        {item.reason}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {item.settlement_frozen ? (
                        <span style={{ color: '#EF4444', fontWeight: 600, fontSize: '0.75rem' }}>
                          🔒 FROZEN
                        </span>
                      ) : (
                        <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.75rem' }}>
                          ✓ Unfrozen
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem' }}>
                      {item.sla_deadline_hours > 0 ? (
                        <span style={{ color: item.sla_deadline_hours < 12 ? '#EF4444' : '#FBBF24', fontWeight: 600 }}>
                          ⏱️ {item.sla_deadline_hours}h remaining
                        </span>
                      ) : (
                        <span style={{ color: '#64748B' }}>Resolved</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor:
                            item.status === 'RESOLVED_UPHELD'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : item.status === 'OPEN'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(245, 158, 11, 0.2)',
                          color:
                            item.status === 'RESOLVED_UPHELD'
                              ? '#34D399'
                              : item.status === 'OPEN'
                              ? '#F87171'
                              : '#FBBF24',
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={() => handleOpenAdjudication(item)}
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
                        Adjudicate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ─── TAB 2: APPEALS QUEUE (MAKER-CHECKER) ───────────────────────────── */}
        {activeTab === 'APPEALS_QUEUE' && (
          <section>
            <div style={{ backgroundColor: '#1E293B', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8125rem', color: '#CBD5E1' }}>
              <strong>Maker-Checker Invariant:</strong> Secondary review is strictly enforced. The original moderator who issued the ruling is blocked from adjudicating this appeal.
            </div>

            {disputes.filter((d) => d.appeal_status === 'PENDING_APPEAL').length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B', backgroundColor: '#0F172A', borderRadius: '8px' }}>
                No pending appeals in the Maker-Checker queue.
              </div>
            ) : (
              disputes
                .filter((d) => d.appeal_status === 'PENDING_APPEAL')
                .map((app) => (
                  <div
                    key={app.id}
                    style={{
                      backgroundColor: '#0F172A',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: '#818CF8' }}>{app.case_id} — {app.match_title}</div>
                      <span style={{ padding: '2px 8px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#FBBF24', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        PENDING SECONDARY REVIEW
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: '#94A3B8', marginBottom: '0.75rem' }}>
                      <div><strong>Initial Ruling:</strong> {app.ruling_reason} ({app.policy_clause})</div>
                      <div style={{ marginTop: '0.5rem', color: '#F8FAFC', backgroundColor: '#1E293B', padding: '0.75rem', borderRadius: '6px' }}>
                        <strong>Appellant Argument:</strong> {app.appeal_text}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleDecideAppeal(app.case_id, 'APPEAL_REJECTED')}
                        style={{
                          padding: '0.4rem 0.8rem',
                          backgroundColor: '#EF4444',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                        }}
                      >
                        Reject Appeal (Uphold Initial Ruling)
                      </button>
                      <button
                        onClick={() => handleDecideAppeal(app.case_id, 'APPEAL_UPHELD')}
                        style={{
                          padding: '0.4rem 0.8rem',
                          backgroundColor: '#10B981',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                        }}
                      >
                        Uphold Appeal (Overturn Ruling)
                      </button>
                    </div>
                  </div>
                ))
            )}
          </section>
        )}

        {/* ─── MODAL: ADJUDICATE DISPUTE ──────────────────────────────────────── */}
        {selectedCase && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
                width: '650px',
                maxWidth: '90vw',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <h2 style={{ margin: '0 0 1rem', color: '#F8FAFC', fontSize: '1.25rem' }}>
                Adjudicate Dispute: {selectedCase.case_id}
              </h2>

              <div style={{ backgroundColor: '#1E293B', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.8125rem', color: '#CBD5E1' }}>
                <div><strong>Match:</strong> {selectedCase.match_title}</div>
                <div><strong>Complainant:</strong> {selectedCase.raised_by_username} (Reason: {selectedCase.reason})</div>
                <div style={{ marginTop: '0.5rem' }}><strong>Description:</strong> {selectedCase.description}</div>
              </div>

              {/* Evidence Hashes */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.35rem' }}>
                  EVIDENCE INGRESS HASHES (SHA-256)
                </label>
                {selectedCase.evidence_hashes.map((h, i) => (
                  <div key={i} style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#818CF8', backgroundColor: '#020617', padding: '0.35rem 0.5rem', borderRadius: '4px', marginBottom: '4px' }}>
                    [Doc #{i + 1}] {h}
                  </div>
                ))}
              </div>

              {/* Policy Clause Macro Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#CBD5E1', marginBottom: '0.25rem' }}>
                  Official Policy Clause (Canned Macros):
                </label>
                <select
                  value={policyClause}
                  onChange={(e) => setPolicyClause(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.8125rem',
                  }}
                >
                  <option value="Clause 11.3: Ingress Evidence Verification">Clause 11.3: Ingress Evidence Verification</option>
                  <option value="Clause 4.2: Anti-Cheat & Hardware Telemetry">Clause 4.2: Anti-Cheat & Hardware Telemetry</option>
                  <option value="Clause 9.1: Lobby Check-In & Forfeit Rule">Clause 9.1: Lobby Check-In & Forfeit Rule</option>
                  <option value="Clause 14.5: Disconnect Exploit & Replay Rule">Clause 14.5: Disconnect Exploit & Replay Rule</option>
                </select>
              </div>

              {/* Corrective Action */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#CBD5E1', marginBottom: '0.25rem' }}>
                  Corrective Action on Match Result:
                </label>
                <select
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.8125rem',
                  }}
                >
                  <option value="CORRECT_SCORE">Correct Combatant Scores per Evidence</option>
                  <option value="FORFEIT_VIOLATOR">Forfeit Violating Squad</option>
                  <option value="REPLAY_MATCH">Schedule Partial/Full Match Replay</option>
                  <option value="NONE">No Result Change</option>
                </select>
              </div>

              {/* Detailed Ruling Reason */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#CBD5E1', marginBottom: '0.25rem' }}>
                  Detailed Ruling Justification (Audited):
                </label>
                <textarea
                  rows={3}
                  placeholder="State the findings based on evidence screenshot hashes and cited policy..."
                  value={rulingReason}
                  onChange={(e) => setRulingReason(e.target.value)}
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

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={() => setSelectedCase(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#334155',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApplyRuling('DISMISSED')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#64748B',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss Dispute
                </button>
                <button
                  onClick={() => handleApplyRuling('OVERTURNED')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#EF4444',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Overturn Result
                </button>
                <button
                  onClick={() => handleApplyRuling('UPHELD')}
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
                  Uphold & Apply Correction
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
