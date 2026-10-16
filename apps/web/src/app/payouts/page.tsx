'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface DestinationItem {
  id: string;
  type: 'UPI' | 'BANK_ACCOUNT';
  details: string;
  holderName: string;
  isCoolingOff: boolean;
  coolingOffRemainingHours: number;
}

interface UserPayout {
  id: string;
  amount: number;
  destination: string;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' | 'REJECTED';
  bankUtr?: string;
  createdAt: string;
}

export default function WebPayoutsPage() {
  const [destinations, setDestinations] = useState<DestinationItem[]>([
    {
      id: 'dest-01',
      type: 'UPI',
      details: 'alex@okhdfcbank',
      holderName: 'Alex Player',
      isCoolingOff: false,
      coolingOffRemainingHours: 0,
    },
    {
      id: 'dest-02',
      type: 'BANK_ACCOUNT',
      details: 'HDFC Bank ••••3910 (HDFC0001234)',
      holderName: 'Alex Player',
      isCoolingOff: true,
      coolingOffRemainingHours: 18,
    },
  ]);

  const [pastPayouts, setPastPayouts] = useState<UserPayout[]>([
    {
      id: 'po-7701-x1',
      amount: 2500.00,
      destination: 'alex@okhdfcbank',
      status: 'PAID',
      bankUtr: 'UTR20261014HDFC998124',
      createdAt: '2026-10-14 12:30 UTC',
    },
    {
      id: 'po-7702-x2',
      amount: 1500.00,
      destination: 'alex@okhdfcbank',
      status: 'UNDER_REVIEW',
      createdAt: '2026-10-16 11:15 UTC',
    },
  ]);

  const [availableBalance] = useState<number>(3450.00);
  const [selectedDestination, setSelectedDestination] = useState<string>('dest-01');
  const [amountInput, setAmountInput] = useState<string>('1000');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Destination Form
  const [showAddDestModal, setShowAddDestModal] = useState<boolean>(false);
  const [newDestType, setNewDestType] = useState<'UPI' | 'BANK_ACCOUNT'>('UPI');
  const [newUpi, setNewUpi] = useState<string>('');
  const [newAccNum, setNewAccNum] = useState<string>('');
  const [newIfsc, setNewIfsc] = useState<string>('');
  const [newHolderName, setNewHolderName] = useState<string>('');

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountInput);
    if (!amount || amount <= 0 || amount > availableBalance) return;

    const dest = destinations.find((d) => d.id === selectedDestination);
    if (!dest || dest.isCoolingOff) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const newPayout: UserPayout = {
        id: `po-${Date.now().toString().slice(-6)}`,
        amount,
        destination: dest.details,
        status: amount >= 10000 ? 'UNDER_REVIEW' : 'REQUESTED',
        createdAt: new Date().toISOString(),
      };
      setPastPayouts([newPayout, ...pastPayouts]);
      setSuccessMessage(`Cash-out request for ₹${amount.toFixed(2)} submitted. Amount placed on hold.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    }, 1200);
  };

  const handleAddDestination = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolderName.trim()) return;

    const newDest: DestinationItem = {
      id: `dest-${Date.now().toString().slice(-4)}`,
      type: newDestType,
      details: newDestType === 'UPI' ? newUpi.trim() : `Account ••••${newAccNum.slice(-4)} (${newIfsc.toUpperCase()})`,
      holderName: newHolderName.trim(),
      isCoolingOff: true,
      coolingOffRemainingHours: 24,
    };

    setDestinations([...destinations, newDest]);
    setShowAddDestModal(false);
    setNewUpi('');
    setNewAccNum('');
    setNewIfsc('');
    setNewHolderName('');
    setSuccessMessage(`New ${newDestType} destination added. Mandatory 24-hour security cooling-off engaged.`);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  return (
    <div className="min-h-screen bg-[#07080D] text-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-5">
          <div>
            <Link href="/dashboard" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 mb-1">
              ← Back to Player Dashboard
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>🏦</span> Cash-Out & Payouts
            </h1>
          </div>
          <button
            onClick={() => setShowAddDestModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
          >
            <span>+</span> Add Withdrawal Destination
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between shadow-xl">
            <span>✅ {successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Balance & Cooling-off Warning */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 border border-gray-800 shadow-xl space-y-1">
            <span className="text-xs text-gray-400 block">Available Cash-Out Balance</span>
            <div className="text-3xl font-black text-white">₹{availableBalance.toFixed(2)}</div>
            <p className="text-[11px] text-emerald-400 mt-1 font-medium">● Verified Double-Entry Ledger</p>
          </div>

          <div className="md:col-span-2 p-5 rounded-2xl bg-gray-900/40 border border-gray-800/80 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-lg shrink-0">
              🛡️
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <h4 className="font-bold text-white text-sm">Security Cooling-Off Guarantee</h4>
              <p>
                To protect player accounts against unauthorized cash-outs, any new or changed bank account or UPI ID has a mandatory <strong>24-hour cooling-off delay</strong>. Security alerts are dispatched immediately upon destination modification.
              </p>
            </div>
          </div>
        </div>

        {/* Cash-Out Request Form */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-bold text-white">Initiate Withdrawal Request</h2>

          <form onSubmit={handleRequestPayout} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
                Select Verified Destination
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {destinations.map((dest) => (
                  <div
                    key={dest.id}
                    onClick={() => !dest.isCoolingOff && setSelectedDestination(dest.id)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      dest.isCoolingOff
                        ? 'opacity-60 bg-gray-950 border-gray-800 cursor-not-allowed'
                        : selectedDestination === dest.id
                        ? 'bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-950/40'
                        : 'bg-gray-950/60 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{dest.type}</span>
                      {dest.isCoolingOff ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                          ⏳ {dest.coolingOffRemainingHours}h Cooling-Off
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">● Ready</span>
                      )}
                    </div>
                    <div className="text-sm font-mono text-gray-200 mt-1">{dest.details}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{dest.holderName}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
                Withdrawal Amount (₹)
              </label>
              <input
                type="number"
                min="100"
                max={availableBalance}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-800 text-white text-lg font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[11px] text-gray-500 block mt-1">
                Minimum withdrawal: ₹100. Payouts over ₹10,000 require dual administrative verification.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 shadow-xl shadow-emerald-950/40"
            >
              {isSubmitting ? 'Submitting Cash-Out Request...' : `Withdraw ₹${Number(amountInput || 0).toFixed(2)}`}
            </button>
          </form>
        </div>

        {/* Past Payouts History */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white">Recent Payout Requests</h3>
          <div className="divide-y divide-gray-800">
            {pastPayouts.map((po) => (
              <div key={po.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">{po.id}</span>
                    <span className="font-semibold text-white">₹{po.amount.toFixed(2)}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        po.status === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : po.status === 'UNDER_REVIEW'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {po.status}
                    </span>
                  </div>
                  <div className="text-gray-400 mt-1">
                    To: {po.destination} {po.bankUtr && `• Bank UTR: ${po.bankUtr}`}
                  </div>
                </div>
                <div className="text-gray-500 font-mono text-[11px] sm:text-right">{po.createdAt}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal: Add Destination */}
        {showAddDestModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0F1018] border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-lg font-bold text-white">Register Withdrawal Destination</h3>
                <button onClick={() => setShowAddDestModal(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleAddDestination} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-400 uppercase font-semibold mb-1">Destination Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewDestType('UPI')}
                      className={`py-2 rounded-lg font-bold text-center border ${
                        newDestType === 'UPI'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white'
                          : 'bg-gray-950 border-gray-800 text-gray-400'
                      }`}
                    >
                      UPI ID
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDestType('BANK_ACCOUNT')}
                      className={`py-2 rounded-lg font-bold text-center border ${
                        newDestType === 'BANK_ACCOUNT'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white'
                          : 'bg-gray-950 border-gray-800 text-gray-400'
                      }`}
                    >
                      Bank Account
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 uppercase font-semibold mb-1">Account Holder Full Name</label>
                  <input
                    type="text"
                    required
                    value={newHolderName}
                    onChange={(e) => setNewHolderName(e.target.value)}
                    placeholder="Must match KYC document"
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-xs"
                  />
                </div>

                {newDestType === 'UPI' ? (
                  <div>
                    <label className="block text-gray-400 uppercase font-semibold mb-1">UPI ID (VPA)</label>
                    <input
                      type="text"
                      required
                      value={newUpi}
                      onChange={(e) => setNewUpi(e.target.value)}
                      placeholder="e.g. mobile@okhdfcbank"
                      className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-xs font-mono"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-gray-400 uppercase font-semibold mb-1">Bank Account Number</label>
                      <input
                        type="text"
                        required
                        value={newAccNum}
                        onChange={(e) => setNewAccNum(e.target.value)}
                        placeholder="e.g. 501002341290"
                        className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 uppercase font-semibold mb-1">IFSC Code</label>
                      <input
                        type="text"
                        required
                        maxLength={11}
                        value={newIfsc}
                        onChange={(e) => setNewIfsc(e.target.value.toUpperCase())}
                        placeholder="e.g. HDFC0001234"
                        className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-xs font-mono uppercase"
                      />
                    </div>
                  </>
                )}

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                  ⚠️ A 24-hour security cooling-off delay applies to this destination before cash-out can be requested.
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowAddDestModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    Confirm & Register
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
