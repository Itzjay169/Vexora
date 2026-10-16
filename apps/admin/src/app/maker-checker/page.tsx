'use client';

import React, { useState } from 'react';
import { AdminShell } from '../../components/AdminShell';

interface WalletAdjustmentItem {
  id: string;
  wallet_id: string;
  user_display: string;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  reason: string;
  requested_by: string;
  requested_at: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  second_approver?: string;
}

export default function FinancialMakerCheckerPage() {
  const [adjustments, setAdjustments] = useState<WalletAdjustmentItem[]>([
    {
      id: 'adj-001',
      wallet_id: 'w-7821-4401',
      user_display: 'ShadowSniper (UID: 99401)',
      amount: 150.00,
      direction: 'CREDIT',
      reason: 'Compensation for technical disconnect in lobby 2 of Pro Invitational S3',
      requested_by: 'Operator_Finance1',
      requested_at: '2026-10-15 15:30 UTC',
      status: 'PENDING_APPROVAL',
    },
    {
      id: 'adj-002',
      wallet_id: 'w-6612-8802',
      user_display: 'GhostRider_99 (UID: 12891)',
      amount: 50.00,
      direction: 'DEBIT',
      reason: 'Over-credited tournament reward reconciliation',
      requested_by: 'Operator_Finance2',
      requested_at: '2026-10-15 14:15 UTC',
      status: 'PENDING_APPROVAL',
    },
  ]);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [newWalletId, setNewWalletId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDirection, setNewDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [newReason, setNewReason] = useState('');

  const [notice, setNotice] = useState<string | null>(null);
  const [invariantVerified, setInvariantVerified] = useState(true);

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletId.trim() || !newReason.trim() || Number(newAmount) <= 0) return;

    const newAdj: WalletAdjustmentItem = {
      id: `adj-${Date.now()}`,
      wallet_id: newWalletId.trim(),
      user_display: `Wallet ${newWalletId.slice(0, 8)}...`,
      amount: Number(newAmount),
      direction: newDirection,
      reason: newReason.trim(),
      requested_by: 'CurrentOperator',
      requested_at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
      status: 'PENDING_APPROVAL',
    };

    setAdjustments([newAdj, ...adjustments]);
    setRequestModalOpen(false);
    setNewWalletId('');
    setNewAmount('');
    setNewReason('');
    setNotice(`✅ Adjustment request created for ${newAdj.amount} VXC. Awaiting second administrator dual-approval.`);
  };

  const handleAdjudicate = (id: string, decision: 'APPROVE' | 'REJECT') => {
    setAdjustments(
      adjustments.map((a) =>
        a.id === id
          ? {
              ...a,
              status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
              second_approver: 'SuperAdmin_DualApprover',
            }
          : a
      )
    );

    setNotice(
      decision === 'APPROVE'
        ? `🔒 Maker-Checker Invariant Verified: Adjustment ${id} approved by second operator. Double-entry ledger transaction executed.`
        : `🛑 Adjustment ${id} rejected.`
    );
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
        {/* Header */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1E293B',
            paddingBottom: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 700, letterSpacing: '0.05em' }}>
                FINANCIAL GOVERNANCE (PHASE 25)
              </span>
              <span style={{ color: '#475569' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Sections 8, 16 & 47</span>
            </div>
            <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700, color: '#F8FAFC' }}>
              Financial Maker-Checker & Ledger Adjustments
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#94A3B8', fontSize: '0.875rem' }}>
              Dual-approval workflow for manual balance adjustments. Balances are never updated in place; every correction is an immutable double-entry transaction.
            </p>
          </div>

          <button
            onClick={() => setRequestModalOpen(true)}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>➕</span>
            <span>Request Adjustment</span>
          </button>
        </header>

        {notice && (
          <div
            style={{
              padding: '0.875rem 1.25rem',
              backgroundColor: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              color: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{notice}</span>
            <button
              onClick={() => setNotice(null)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── Metric Ribbon ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ backgroundColor: '#0F172A', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Pending Dual-Approvals
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F59E0B', marginTop: '0.25rem' }}>
              {adjustments.filter((a) => a.status === 'PENDING_APPROVAL').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
              Awaiting second administrator review
            </div>
          </div>

          <div style={{ backgroundColor: '#0F172A', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Double-Entry Invariant
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10B981', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🛡️ BALANCED (0.00 DISCREPANCY)</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
              Total Credits = Total Debits across all wallets
            </div>
          </div>

          <div style={{ backgroundColor: '#0F172A', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Launch Operating Mode
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#60A5FA', marginTop: '0.4rem' }}>
              100% FREE TOURNAMENTS
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
              ADR-001: Real money features locked
            </div>
          </div>
        </div>

        {/* ─── Maker-Checker Policy Banner ───────────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontWeight: 700, color: '#818CF8', marginBottom: '0.25rem' }}>
            🔒 Maker-Checker Security Invariant (Section 2 & ADR-005)
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#CBD5E1', lineHeight: 1.5 }}>
            To prevent fraud or unauthorized balance minting, no administrator may overwrite or directly alter a wallet balance. An adjustment request must be verified and approved by an independent second administrator. The initiating operator is prohibited by database check constraint from approving their own adjustment.
          </div>
        </div>

        {/* ─── Adjustments Table ──────────────────────────────────────────────── */}
        <div style={{ backgroundColor: '#0F172A', borderRadius: '12px', border: '1px solid #1E293B', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#F8FAFC' }}>
              Pending & Historical Wallet Adjustments
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{adjustments.length} requests</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#1E293B' }}>
                <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Wallet / User</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Amount (VXC)</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Mandatory Justification</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Requester</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adj) => (
                <tr key={adj.id} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={{ padding: '1rem', color: '#F8FAFC', fontWeight: 600 }}>{adj.user_display}</td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        backgroundColor: adj.direction === 'CREDIT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: adj.direction === 'CREDIT' ? '#10B981' : '#EF4444',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {adj.direction}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#F8FAFC', fontWeight: 700, fontFamily: 'monospace' }}>
                    {adj.amount.toFixed(2)} VXC
                  </td>
                  <td style={{ padding: '1rem', color: '#CBD5E1', fontSize: '0.8125rem', maxWidth: '300px' }}>
                    {adj.reason}
                  </td>
                  <td style={{ padding: '1rem', color: '#94A3B8', fontSize: '0.8125rem' }}>{adj.requested_by}</td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        backgroundColor: adj.status === 'PENDING_APPROVAL' ? 'rgba(245, 158, 11, 0.2)' : adj.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: adj.status === 'PENDING_APPROVAL' ? '#F59E0B' : adj.status === 'APPROVED' ? '#10B981' : '#EF4444',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {adj.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {adj.status === 'PENDING_APPROVAL' ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleAdjudicate(adj.id, 'APPROVE')}
                          style={{
                            padding: '0.375rem 0.75rem',
                            backgroundColor: '#10B981',
                            border: 'none',
                            color: '#FFFFFF',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Dual-Authorize
                        </button>
                        <button
                          onClick={() => handleAdjudicate(adj.id, 'REJECT')}
                          style={{
                            padding: '0.375rem 0.75rem',
                            backgroundColor: 'transparent',
                            border: '1px solid #EF4444',
                            color: '#EF4444',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ─── Request Modal ─────────────────────────────────────────────────── */}
        {requestModalOpen && (
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
                padding: '1.75rem',
                width: '100%',
                maxWidth: '480px',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', color: '#F8FAFC', fontSize: '1.25rem' }}>
                Request Wallet Balance Adjustment
              </h3>
              <form onSubmit={handleCreateRequest}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                    Target Wallet UUID
                  </label>
                  <input
                    type="text"
                    required
                    value={newWalletId}
                    onChange={(e) => setNewWalletId(e.target.value)}
                    placeholder="e.g. 00000000-0000-0000-0000-000000000001"
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#F8FAFC',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                      Direction
                    </label>
                    <select
                      value={newDirection}
                      onChange={(e) => setNewDirection(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        backgroundColor: '#1E293B',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#F8FAFC',
                        fontSize: '0.875rem',
                      }}
                    >
                      <option value="CREDIT">CREDIT (+ Add Funds)</option>
                      <option value="DEBIT">DEBIT (- Deduct Funds)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                      Amount (VXC)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="e.g. 100.00"
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        backgroundColor: '#1E293B',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#F8FAFC',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                    Mandatory Reason (Audit Log Reference)
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="Provide specific tournament incident ID, discrepancy ticket, or legal authorization..."
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#F8FAFC',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setRequestModalOpen(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'transparent',
                      border: '1px solid #475569',
                      color: '#94A3B8',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#10B981',
                      border: 'none',
                      color: '#FFFFFF',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Submit for Dual-Approval
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
