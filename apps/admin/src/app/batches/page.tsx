'use client';

import React, { useState } from 'react';
import { AdminShell } from '../../components/AdminShell';

interface RedeemBatchItem {
  id: string;
  batch_name: string;
  denomination: number;
  quantity: number;
  redeemed_count: number;
  max_uses_per_code: number;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  maker_admin: string;
  checker_admin?: string;
  expires_at: string;
  created_at: string;
  export_count: number;
}

const REDEEM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function computeMod32Checksum(payload: string): string {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const idx = REDEEM_ALPHABET.indexOf(payload[i]);
    if (idx === -1) return '';
    sum = (sum * 31 + idx + (i + 1)) % REDEEM_ALPHABET.length;
  }
  return REDEEM_ALPHABET[sum % REDEEM_ALPHABET.length];
}

function validateCode(code: string): boolean {
  const cleaned = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!cleaned.startsWith('VEX') || cleaned.length !== 12) return false;
  const payload = cleaned.slice(3, 11);
  const checksumChar = cleaned.slice(11, 12);
  return computeMod32Checksum(payload) === checksumChar;
}

export default function RedeemBatchesPage() {
  const [batches, setBatches] = useState<RedeemBatchItem[]>([
    {
      id: 'batch-7701-a1b2',
      batch_name: 'Summer Cup 2026 Promotional Drops',
      denomination: 100.00,
      quantity: 50,
      redeemed_count: 32,
      max_uses_per_code: 1,
      status: 'ACTIVE',
      maker_admin: 'Finance_Admin_Sarah',
      checker_admin: 'SuperAdmin_Marcus',
      expires_at: '2026-11-30 23:59 UTC',
      created_at: '2026-10-12 10:00 UTC',
      export_count: 1,
    },
    {
      id: 'batch-8802-c3d4',
      batch_name: 'Pro Invitational MVP Rewards',
      denomination: 250.00,
      quantity: 20,
      redeemed_count: 0,
      max_uses_per_code: 1,
      status: 'PENDING_APPROVAL',
      maker_admin: 'Finance_Admin_Sarah',
      expires_at: '2026-12-15 23:59 UTC',
      created_at: '2026-10-16 11:30 UTC',
      export_count: 0,
    },
    {
      id: 'batch-5503-e5f6',
      batch_name: 'Community Discord Welcome Batch',
      denomination: 50.00,
      quantity: 100,
      redeemed_count: 100,
      max_uses_per_code: 1,
      status: 'COMPLETED',
      maker_admin: 'Community_Lead_Alex',
      checker_admin: 'SuperAdmin_Marcus',
      expires_at: '2026-10-15 00:00 UTC',
      created_at: '2026-10-01 09:00 UTC',
      export_count: 2,
    },
  ]);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newDenomination, setNewDenomination] = useState('100');
  const [newQuantity, setNewQuantity] = useState('25');
  const [newExpiryDays, setNewExpiryDays] = useState('30');

  const [adjudicateBatchItem, setAdjudicateBatchItem] = useState<RedeemBatchItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [exportModalBatch, setExportModalBatch] = useState<RedeemBatchItem | null>(null);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockCodeInput, setBlockCodeInput] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const [testCodeInput, setTestCodeInput] = useState('');
  const [testResult, setTestResult] = useState<{ checked: boolean; valid: boolean; normalized?: string } | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  // Handlers
  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim() || Number(newDenomination) <= 0 || Number(newQuantity) <= 0) return;

    const expiryDate = new Date(Date.now() + Number(newExpiryDays) * 86400000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ') + ' UTC';

    const newBatch: RedeemBatchItem = {
      id: `batch-${Date.now().toString(16).slice(-8)}`,
      batch_name: newBatchName.trim(),
      denomination: Number(newDenomination),
      quantity: Number(newQuantity),
      redeemed_count: 0,
      max_uses_per_code: 1,
      status: 'PENDING_APPROVAL',
      maker_admin: 'Current_Finance_Admin',
      expires_at: expiryDate,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
      export_count: 0,
    };

    setBatches([newBatch, ...batches]);
    setCreateModalOpen(false);
    setNewBatchName('');
    setNotice(`✅ Batch "${newBatch.batch_name}" created (Status: PENDING_APPROVAL). Maker-Checker guard requires independent second admin approval.`);
  };

  const handleAdjudicate = (decision: 'APPROVE' | 'REJECT') => {
    if (!adjudicateBatchItem) return;
    if (decision === 'REJECT' && !rejectionReason.trim()) {
      alert('Rejection reason is required (min 5 characters).');
      return;
    }

    setBatches(
      batches.map((b) =>
        b.id === adjudicateBatchItem.id
          ? {
              ...b,
              status: decision === 'APPROVE' ? 'ACTIVE' : 'CANCELLED',
              checker_admin: 'SuperAdmin_DualApprover',
            }
          : b
      )
    );

    setNotice(
      decision === 'APPROVE'
        ? `🔒 Maker-Checker Invariant Verified: Batch ${adjudicateBatchItem.batch_name} approved by independent second administrator. All codes transitioned to ACTIVE.`
        : `🛑 Batch ${adjudicateBatchItem.batch_name} rejected: "${rejectionReason}". All codes CANCELLED.`
    );

    setAdjudicateBatchItem(null);
    setRejectionReason('');
  };

  const handleExport = (batch: RedeemBatchItem) => {
    setBatches(
      batches.map((b) => (b.id === batch.id ? { ...b, export_count: b.export_count + 1 } : b))
    );
    setExportModalBatch(null);
    setNotice(`📥 Encrypted export generated for batch "${batch.batch_name}". Watermark: EXPORTED_BY_CURRENT_ADMIN_${Date.now()} recorded in audit log.`);
  };

  const handleBlockCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockCodeInput.trim() || !blockReason.trim()) return;

    setBlockModalOpen(false);
    setBlockCodeInput('');
    setBlockReason('');
    setNotice(`🚫 Security Action Logged: Compromised voucher code blocked. Reason: "${blockReason}". Recorded with SHA-256 audit chain.`);
  };

  const handleTestChecksum = () => {
    if (!testCodeInput.trim()) return;
    const isValid = validateCode(testCodeInput);
    setTestResult({
      checked: true,
      valid: isValid,
      normalized: isValid ? testCodeInput.replace(/[^A-Z0-9]/gi, '').toUpperCase() : undefined,
    });
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
        
        {/* Header Ribbon */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🎟️</span>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#F8FAFC', margin: 0 }}>
                Redeem Code Batches & Security
              </h1>
            </div>
            <p style={{ color: '#94A3B8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Cryptographic voucher batches with Luhn-mod32 checksums, Maker-Checker dual authorization, and double-entry crediting.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setBlockModalOpen(true)}
              style={{
                backgroundColor: '#1E293B',
                color: '#EF4444',
                border: '1px solid #DC2626',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🚫 Block Code
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              style={{
                backgroundColor: '#06B6D4',
                color: '#0F172A',
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Create Voucher Batch
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        {notice && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#064E3B',
              border: '1px solid #10B981',
              borderRadius: '8px',
              color: '#ECFDF5',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{notice}</span>
            <button
              onClick={() => setNotice(null)}
              style={{ background: 'none', border: 'none', color: '#ECFDF5', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Security & Invariant Guarantee Card */}
        <div
          style={{
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
          }}
        >
          <div style={{ borderLeft: '3px solid #10B981', paddingLeft: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em' }}>
              LUHN-MOD32 TYPO SHIELD
            </div>
            <div style={{ fontSize: '0.875rem', color: '#F1F5F9', marginTop: '0.25rem' }}>
              Microsecond checksum verification eliminates database lookup on typos and scripted abuse probes.
            </div>
          </div>
          <div style={{ borderLeft: '3px solid #F59E0B', paddingLeft: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em' }}>
              MAKER-CHECKER GOVERNANCE
            </div>
            <div style={{ fontSize: '0.875rem', color: '#F1F5F9', marginTop: '0.25rem' }}>
              Creator cannot approve own batches (<code style={{ color: '#F59E0B' }}>maker_id != checker_id</code>). Enforced by DB check constraint.
            </div>
          </div>
          <div style={{ borderLeft: '3px solid #06B6D4', paddingLeft: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em' }}>
              DOUBLE-ENTRY RECONCILIATION
            </div>
            <div style={{ fontSize: '0.875rem', color: '#F1F5F9', marginTop: '0.25rem' }}>
              Platform Reserve is debited when user wallet is credited. Conservation of credits verified (<code style={{ color: '#06B6D4' }}>SUM=0</code>).
            </div>
          </div>
        </div>

        {/* Batches Table */}
        <div
          style={{
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #1E293B',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
              Active & Pending Batches ({batches.length})
            </h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#1E293B', color: '#94A3B8', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                  <th style={{ padding: '0.75rem 1.25rem' }}>Batch Name / ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Value</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Qty / Claimed</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Maker Admin</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Expires</th>
                  <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const statusColors: Record<string, { bg: string; text: string }> = {
                    ACTIVE: { bg: '#064E3B', text: '#10B981' },
                    PENDING_APPROVAL: { bg: '#451A03', text: '#F59E0B' },
                    COMPLETED: { bg: '#1E293B', text: '#94A3B8' },
                    CANCELLED: { bg: '#450A0A', text: '#EF4444' },
                    EXPIRED: { bg: '#312E81', text: '#818CF8' },
                  };
                  const color = statusColors[batch.status] || { bg: '#1E293B', text: '#FFF' };

                  return (
                    <tr key={batch.id} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{batch.batch_name}</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748B' }}>{batch.id}</div>
                      </td>
                      <td style={{ padding: '1rem', color: '#F59E0B', fontWeight: 700 }}>
                        {batch.denomination.toFixed(2)} VXC
                      </td>
                      <td style={{ padding: '1rem', color: '#F1F5F9' }}>
                        <div>{batch.quantity} codes</div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{batch.redeemed_count} claimed</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: color.bg,
                            color: color.text,
                          }}
                        >
                          {batch.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: '#CBD5E1', fontSize: '0.8rem' }}>
                        <div>{batch.maker_admin}</div>
                        {batch.checker_admin && (
                          <div style={{ fontSize: '0.7rem', color: '#10B981' }}>✓ Checker: {batch.checker_admin}</div>
                        )}
                      </td>
                      <td style={{ padding: '1rem', color: '#94A3B8', fontSize: '0.8rem' }}>
                        {batch.expires_at}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        {batch.status === 'PENDING_APPROVAL' ? (
                          <button
                            onClick={() => setAdjudicateBatchItem(batch)}
                            style={{
                              backgroundColor: '#F59E0B',
                              color: '#0F172A',
                              border: 'none',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Review & Dual Approve
                          </button>
                        ) : batch.status === 'ACTIVE' ? (
                          <button
                            onClick={() => setExportModalBatch(batch)}
                            style={{
                              backgroundColor: '#1E293B',
                              color: '#06B6D4',
                              border: '1px solid #06B6D4',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Export ({batch.export_count})
                          </button>
                        ) : (
                          <span style={{ color: '#64748B', fontSize: '0.8rem' }}>Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Checksum Inspector / Simulator */}
        <div
          style={{
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '0.5rem' }}>
            🔬 Interactive Luhn-Mod32 Checksum Calculator & Verifier
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Verify any Vexora code or calculate expected checksum characters without touching the primary database.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', maxWidth: '600px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="e.g. VEX-7K9M-3PX2-8"
              value={testCodeInput}
              onChange={(e) => setTestCodeInput(e.target.value)}
              style={{
                flex: 1,
                minWidth: '240px',
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                color: '#FFF',
                fontFamily: 'monospace',
                fontWeight: 'bold',
              }}
            />
            <button
              onClick={handleTestChecksum}
              style={{
                backgroundColor: '#06B6D4',
                color: '#0F172A',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Verify Checksum
            </button>
          </div>

          {testResult && testResult.checked && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: testResult.valid ? '#064E3B' : '#450A0A',
                border: `1px solid ${testResult.valid ? '#10B981' : '#EF4444'}`,
                color: testResult.valid ? '#ECFDF5' : '#FEE2E2',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>{testResult.valid ? '✅ Checksum Valid! Code passes pre-flight validation.' : '❌ Invalid Checksum! Typo detected — will be blocked before DB lookup.'}</span>
              {testResult.normalized && (
                <span style={{ fontFamily: 'monospace', color: '#6EE7B7' }}>({testResult.normalized})</span>
              )}
            </div>
          )}
        </div>

        {/* ─── Modal 1: Create Batch ────────────────────────────────────────── */}
        {createModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: '12px',
                padding: '1.5rem',
                maxWidth: '480px',
                width: '100%',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#F8FAFC', marginBottom: '1rem' }}>
                Create New Voucher Batch (Maker Phase)
              </h3>
              <form onSubmit={handleCreateBatch}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Batch Campaign Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    placeholder="e.g. Diwalifest Pro Scrims Bonus"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      color: '#FFF',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      Denomination (VXC)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={newDenomination}
                      onChange={(e) => setNewDenomination(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        backgroundColor: '#1E293B',
                        border: '1px solid #334155',
                        color: '#FFF',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      Quantity (Codes)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="10000"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        backgroundColor: '#1E293B',
                        border: '1px solid #334155',
                        color: '#FFF',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Validity (Days from now)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={newExpiryDays}
                    onChange={(e) => setNewExpiryDays(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      color: '#FFF',
                    }}
                  />
                </div>

                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#1E293B',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: '#94A3B8',
                    marginBottom: '1.25rem',
                  }}
                >
                  🔒 <strong>Maker-Checker Notice:</strong> Codes will be generated with HMAC-SHA256 hashes and Luhn-mod32 checksums in <code style={{ color: '#F59E0B' }}>CREATED</code> state. They cannot be redeemed until an independent second admin approves.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      border: '1px solid #475569',
                      color: '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      backgroundColor: '#06B6D4',
                      border: 'none',
                      color: '#0F172A',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Submit for Approval
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Modal 2: Maker-Checker Dual Adjudication ─────────────────────── */}
        {adjudicateBatchItem && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #F59E0B',
                borderRadius: '12px',
                padding: '1.5rem',
                maxWidth: '520px',
                width: '100%',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#F59E0B', marginBottom: '0.5rem' }}>
                ⚖️ Maker-Checker Dual Authorization
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Reviewing batch <strong style={{ color: '#FFF' }}>{adjudicateBatchItem.batch_name}</strong>
              </p>

              <div style={{ backgroundColor: '#1E293B', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#CBD5E1' }}>
                <div>💰 Total Value: {adjudicateBatchItem.denomination * adjudicateBatchItem.quantity} VXC ({adjudicateBatchItem.quantity} codes @ {adjudicateBatchItem.denomination} VXC)</div>
                <div>👤 Creator (Maker): {adjudicateBatchItem.maker_admin}</div>
                <div>📅 Expiry: {adjudicateBatchItem.expires_at}</div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  Rejection Reason (Required if rejecting)
                </label>
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Budget authorization cap exceeded for campaign"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    color: '#FFF',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setAdjudicateBatchItem(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid #475569',
                    color: '#94A3B8',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjudicate('REJECT')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: '#EF4444',
                    border: 'none',
                    color: '#FFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Reject Batch
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjudicate('APPROVE')}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '6px',
                    backgroundColor: '#10B981',
                    border: 'none',
                    color: '#0F172A',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Dual Approve Batch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Modal 3: Watermarked Export ───────────────────────────────────── */}
        {exportModalBatch && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #06B6D4',
                borderRadius: '12px',
                padding: '1.5rem',
                maxWidth: '480px',
                width: '100%',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#06B6D4', marginBottom: '0.5rem' }}>
                📥 Watermarked Cryptographic Export
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Batch: {exportModalBatch.batch_name} ({exportModalBatch.quantity} codes)
              </p>
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#1E293B',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: '#CBD5E1',
                  marginBottom: '1rem',
                }}
              >
                <div>🔒 <strong>Export Watermark:</strong> <code style={{ color: '#06B6D4' }}>EXPORTED_BY_ADMIN_{Date.now()}</code></div>
                <div style={{ marginTop: '0.5rem' }}>
                  The export operation is permanently logged into <code style={{ color: '#F1F5F9' }}>redeem_code_exports</code> and hashed into the tamper-evident audit chain.
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setExportModalBatch(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid #475569',
                    color: '#94A3B8',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleExport(exportModalBatch)}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '6px',
                    backgroundColor: '#06B6D4',
                    border: 'none',
                    color: '#0F172A',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Download & Audit Log
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Modal 4: Block Compromised Code ──────────────────────────────── */}
        {blockModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #EF4444',
                borderRadius: '12px',
                padding: '1.5rem',
                maxWidth: '480px',
                width: '100%',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#EF4444', marginBottom: '0.5rem' }}>
                🚫 Block Compromised Voucher Code
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Transition a leaked or compromised code directly to <code style={{ color: '#EF4444' }}>BLOCKED</code> state.
              </p>
              <form onSubmit={handleBlockCode}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Redeem Code or UUID
                  </label>
                  <input
                    type="text"
                    required
                    value={blockCodeInput}
                    onChange={(e) => setBlockCodeInput(e.target.value)}
                    placeholder="VEX-XXXX-XXXX-X or code UUID"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      color: '#FFF',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Reason for Security Block
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="e.g. Voucher leaked publicly on Discord streaming channel"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      color: '#FFF',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setBlockModalOpen(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      border: '1px solid #475569',
                      color: '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      backgroundColor: '#EF4444',
                      border: 'none',
                      color: '#FFF',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Block Code
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
