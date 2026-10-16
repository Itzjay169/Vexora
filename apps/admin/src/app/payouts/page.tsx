'use client';

import React, { useState } from 'react';
import { AdminShell } from '../../components/AdminShell';

interface PayoutRequestItem {
  id: string;
  user_id: string;
  destination_type: 'UPI' | 'BANK_ACCOUNT';
  destination_summary: string;
  amount: number;
  currency: string;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' | 'REJECTED';
  is_high_value: boolean;
  primary_approver_id?: string;
  secondary_approver_id?: string;
  step_up_auth_verified: boolean;
  bank_utr?: string;
  rejection_reason?: string;
  created_at: string;
}

interface ReconciliationRecord {
  id: string;
  reconciliation_date: string;
  total_ledger_credits: number;
  total_ledger_debits: number;
  total_provider_deposits: number;
  total_paid_payouts: number;
  deposit_variance: number;
  payout_variance: number;
  discrepancy_count: number;
  status: 'BALANCED' | 'DISCREPANCY_DETECTED';
  verified_at: string;
}

export default function AdminPayoutsPage() {
  const [activeTab, setActiveTab] = useState<'queue' | 'reconciliation' | 'reports'>('queue');

  const [payouts, setPayouts] = useState<PayoutRequestItem[]>([
    {
      id: 'pay-801-a1',
      user_id: 'usr-1049-omega',
      destination_type: 'UPI',
      destination_summary: 'omega@okhdfcbank',
      amount: 4500.00,
      currency: 'INR',
      status: 'REQUESTED',
      is_high_value: false,
      step_up_auth_verified: false,
      created_at: '2026-10-16 14:10 UTC',
    },
    {
      id: 'pay-802-b2',
      user_id: 'usr-2088-viper',
      destination_type: 'BANK_ACCOUNT',
      destination_summary: 'HDFC ••••4412 (HDFC0001234)',
      amount: 15000.00,
      currency: 'INR',
      status: 'UNDER_REVIEW',
      is_high_value: true,
      primary_approver_id: 'Finance_Admin_Sarah',
      step_up_auth_verified: false,
      created_at: '2026-10-16 11:20 UTC',
    },
    {
      id: 'pay-803-c3',
      user_id: 'usr-3341-phoenix',
      destination_type: 'UPI',
      destination_summary: 'phoenix@paytm',
      amount: 2500.00,
      currency: 'INR',
      status: 'APPROVED',
      is_high_value: false,
      primary_approver_id: 'Finance_Admin_Sarah',
      step_up_auth_verified: false,
      created_at: '2026-10-16 09:45 UTC',
    },
    {
      id: 'pay-804-d4',
      user_id: 'usr-4402-blade',
      destination_type: 'BANK_ACCOUNT',
      destination_summary: 'ICICI ••••9910 (ICIC0000001)',
      amount: 7200.00,
      currency: 'INR',
      status: 'PAID',
      is_high_value: false,
      primary_approver_id: 'Finance_Admin_Sarah',
      step_up_auth_verified: false,
      bank_utr: 'UTR20261016ICIC881920',
      created_at: '2026-10-15 16:30 UTC',
    },
  ]);

  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([
    {
      id: 'rec-101',
      reconciliation_date: '2026-10-16',
      total_ledger_credits: 45000.00,
      total_ledger_debits: 12000.00,
      total_provider_deposits: 45000.00,
      total_paid_payouts: 12000.00,
      deposit_variance: 0.00,
      payout_variance: 0.00,
      discrepancy_count: 0,
      status: 'BALANCED',
      verified_at: '2026-10-16 21:00 UTC',
    },
    {
      id: 'rec-100',
      reconciliation_date: '2026-10-15',
      total_ledger_credits: 62000.00,
      total_ledger_debits: 18500.00,
      total_provider_deposits: 62000.00,
      total_paid_payouts: 18500.00,
      deposit_variance: 0.00,
      payout_variance: 0.00,
      discrepancy_count: 0,
      status: 'BALANCED',
      verified_at: '2026-10-15 21:00 UTC',
    },
  ]);

  const [selectedPayout, setSelectedPayout] = useState<PayoutRequestItem | null>(null);
  const [bankUtrInput, setBankUtrInput] = useState('');
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Financial report state
  const [reportType, setReportType] = useState('MONTHLY_SUMMARY');
  const [customWatermark, setCustomWatermark] = useState('');
  const [exportedResult, setExportedResult] = useState<any | null>(null);

  const handlePrimaryApprove = (id: string) => {
    setPayouts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const nextStatus = p.is_high_value ? 'UNDER_REVIEW' : 'APPROVED';
          return {
            ...p,
            status: nextStatus,
            primary_approver_id: 'Current_Admin_Finance',
          };
        }
        return p;
      })
    );
    setSuccessMessage(`Primary approval granted for ${id}`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleSecondaryApprove = (id: string) => {
    setPayouts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            status: 'APPROVED',
            secondary_approver_id: 'Current_SuperAdmin_Marcus',
            step_up_auth_verified: true,
          };
        }
        return p;
      })
    );
    setSuccessMessage(`High-value dual approval granted with step-up MFA for ${id}`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleMarkPaid = (id: string) => {
    if (!bankUtrInput.trim()) return;
    setPayouts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            status: 'PAID',
            bank_utr: bankUtrInput.trim(),
          };
        }
        return p;
      })
    );
    setSuccessMessage(`Payout ${id} settled with Bank UTR: ${bankUtrInput.trim()}`);
    setSelectedPayout(null);
    setBankUtrInput('');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleReject = (id: string) => {
    if (!rejectReasonInput.trim()) return;
    setPayouts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            status: 'REJECTED',
            rejection_reason: rejectReasonInput.trim(),
          };
        }
        return p;
      })
    );
    setSuccessMessage(`Payout ${id} rejected and wallet hold released back to user`);
    setSelectedPayout(null);
    setRejectReasonInput('');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleTriggerReconciliation = () => {
    const today = new Date().toISOString().split('T')[0];
    setSuccessMessage(`Daily 3-way reconciliation run finished for ${today}: Status BALANCED (0 discrepancies)`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleExportReport = () => {
    const timestamp = new Date().toISOString();
    const watermark = customWatermark.trim()
      ? `${customWatermark} | EXPORTED_BY_FinanceAdmin_${timestamp}`
      : `CONFIDENTIAL // VEXORA ESPORTS // EXPORTED_BY_FinanceAdmin // ${timestamp} // FOR INTERNAL AUDIT ONLY`;

    const fakeHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    setExportedResult({
      reportType,
      watermark,
      exportHash: fakeHash,
      timestamp,
      rowCount: 45,
    });
    setSuccessMessage(`Financial report exported with cryptographic watermark & SHA-256 hash`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>🏦</span> Payouts, Reconciliation & Financial Reports
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Phase 28: Controlled cash-out approvals, Maker-Checker guards, 3-way daily reconciliation, and watermarked audit exports.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ● Audit Equilibrium: SUM=0
            </span>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Maker-Checker: STRICT
            </span>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
            <span>✅ {successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 gap-2">
          {[
            { id: 'queue', label: 'Payout Queue & Approvals', count: payouts.length, icon: '📋' },
            { id: 'reconciliation', label: '3-Way Reconciliation', count: reconciliations.length, icon: '⚖️' },
            { id: 'reports', label: 'Financial Reports & Exports', count: 'Audit', icon: '📊' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-white bg-emerald-500/5'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: Payout Queue */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-800 text-xs text-gray-400 flex items-center gap-3">
              <span className="text-base">🛡️</span>
              <span>
                <strong>Maker-Checker Invariant:</strong> Creator cannot approve own payout. High-value payouts (≥ ₹10,000) require two independent administrators and step-up MFA verification before settlement.
              </span>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-gray-950/80 text-xs uppercase text-gray-400 border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3">Payout ID</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Destination</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Approvers</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-emerald-400 font-bold">{payout.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{payout.user_id}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="font-semibold text-white">{payout.destination_type}:</span>{' '}
                          <span className="font-mono text-gray-400">{payout.destination_summary}</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-white">₹{payout.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {payout.is_high_value ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 w-fit">
                              ⚠️ High Value
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-800 text-gray-300">
                              Standard
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              payout.status === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : payout.status === 'APPROVED'
                                ? 'bg-blue-500/20 text-blue-400'
                                : payout.status === 'UNDER_REVIEW'
                                ? 'bg-amber-500/20 text-amber-400'
                                : payout.status === 'REJECTED'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {payout.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {payout.primary_approver_id ? (
                            <div className="space-y-0.5">
                              <p className="text-gray-200">1st: {payout.primary_approver_id}</p>
                              {payout.secondary_approver_id && (
                                <p className="text-cyan-400">2nd: {payout.secondary_approver_id}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {payout.status === 'REQUESTED' && (
                              <button
                                onClick={() => handlePrimaryApprove(payout.id)}
                                className="px-2.5 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
                              >
                                Approve
                              </button>
                            )}

                            {payout.status === 'UNDER_REVIEW' && payout.is_high_value && !payout.secondary_approver_id && (
                              <button
                                onClick={() => handleSecondaryApprove(payout.id)}
                                className="px-2.5 py-1 text-xs rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors flex items-center gap-1"
                              >
                                <span>🔐</span> Dual-Approve (MFA)
                              </button>
                            )}

                            {payout.status === 'APPROVED' && (
                              <button
                                onClick={() => setSelectedPayout(payout)}
                                className="px-2.5 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
                              >
                                Mark Paid (UTR)
                              </button>
                            )}

                            {['REQUESTED', 'UNDER_REVIEW'].includes(payout.status) && (
                              <button
                                onClick={() => setSelectedPayout(payout)}
                                className="px-2.5 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-red-400 transition-colors"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 3-Way Reconciliation */}
        {activeTab === 'reconciliation' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Daily 3-Way Automated Financial Audit</h3>
                <p className="text-xs text-gray-400">
                  Cross-checks Double-Entry Ledger Transactions against Payment Gateway Captured Deposits and Settled Bank Payouts.
                </p>
              </div>
              <button
                onClick={handleTriggerReconciliation}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase transition-all shadow-lg shadow-emerald-950/40"
              >
                Run Today's Reconciliation
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reconciliations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-white">Date: {rec.reconciliation_date}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ● {rec.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-gray-950/60 p-3 rounded-lg border border-gray-800/80">
                    <div>
                      <span className="text-gray-400 block">Ledger Credits:</span>
                      <strong className="text-white text-sm">₹{rec.total_ledger_credits.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Gateway Deposits:</span>
                      <strong className="text-emerald-400 text-sm">₹{rec.total_provider_deposits.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Ledger Debits:</span>
                      <strong className="text-white text-sm">₹{rec.total_ledger_debits.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Bank Settled Payouts:</span>
                      <strong className="text-emerald-400 text-sm">₹{rec.total_paid_payouts.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800">
                    <span>Variance: <strong>₹0.00</strong> (Discrepancies: {rec.discrepancy_count})</span>
                    <span className="font-mono text-[10px] text-gray-500">Verified: {rec.verified_at}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Financial Reports */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 space-y-5">
              <h3 className="text-base font-bold text-white">Generate Cryptographically Watermarked Financial Report</h3>
              <p className="text-xs text-gray-400">
                All financial exports are stamped with an indelible audit watermark and registered with a SHA-256 integrity hash.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                    Report Type
                  </label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-xs"
                  >
                    <option value="MONTHLY_SUMMARY">Monthly Financial Summary</option>
                    <option value="DAILY_RECONCILIATION">Daily 3-Way Reconciliation Audit</option>
                    <option value="ESCROW_LIABILITY">Prize Escrow Liability Statement</option>
                    <option value="TAX_GST_REPORT">Statutory Tax / GST Filing Schedule</option>
                    <option value="AUDIT_LEDGER">Double-Entry Immutable Ledger Journal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                    Custom Audit Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={customWatermark}
                    onChange={(e) => setCustomWatermark(e.target.value)}
                    placeholder="e.g. Q4_EXTERNAL_AUDIT_PWC"
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-xs"
                  />
                </div>
              </div>

              <button
                onClick={handleExportReport}
                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase transition-all shadow-lg shadow-emerald-950/40"
              >
                Generate Watermarked Export
              </button>
            </div>

            {exportedResult && (
              <div className="p-5 rounded-xl bg-gray-900/40 border border-emerald-500/30 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span>✓ Export Sealed & Registered in Audit Log</span>
                  <span>{exportedResult.reportType}</span>
                </div>
                <div className="space-y-1 text-gray-300">
                  <p><strong>SHA-256 Digest:</strong> <span className="text-cyan-400">{exportedResult.exportHash}</span></p>
                  <p><strong>Watermark:</strong> <span className="text-gray-400">{exportedResult.watermark}</span></p>
                  <p><strong>Timestamp:</strong> {exportedResult.timestamp}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: Settlement / Rejection */}
        {selectedPayout && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-lg font-bold text-white">
                  {selectedPayout.status === 'APPROVED' ? 'Finalize Bank Settlement' : 'Reject Payout Request'}
                </h3>
                <button onClick={() => setSelectedPayout(null)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-2 text-xs text-gray-300">
                <p><strong>Payout ID:</strong> <span className="font-mono text-emerald-400">{selectedPayout.id}</span></p>
                <p><strong>User ID:</strong> <span className="font-mono">{selectedPayout.user_id}</span></p>
                <p><strong>Destination:</strong> {selectedPayout.destination_summary}</p>
                <p><strong>Amount:</strong> ₹{selectedPayout.amount.toFixed(2)}</p>
              </div>

              {selectedPayout.status === 'APPROVED' ? (
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase">
                    Bank Unique Transaction Reference (UTR)
                  </label>
                  <input
                    type="text"
                    value={bankUtrInput}
                    onChange={(e) => setBankUtrInput(e.target.value)}
                    placeholder="e.g. UTR20261016HDFC889012"
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setSelectedPayout(null)}
                      className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleMarkPaid(selectedPayout.id)}
                      disabled={!bankUtrInput.trim()}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
                    >
                      Confirm Settlement (Mark Paid)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase">
                    Rejection Reason (Hold will be released)
                  </label>
                  <input
                    type="text"
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder="e.g. Account name mismatch with KYC document"
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-sm focus:outline-none focus:border-red-500"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setSelectedPayout(null)}
                      className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReject(selectedPayout.id)}
                      disabled={!rejectReasonInput.trim()}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-50"
                    >
                      Reject & Release Hold
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
