'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function WebPaymentsPage() {
  const [selectedProvider, setSelectedProvider] = useState<'RAZORPAY' | 'CASHFREE'>('RAZORPAY');
  const [entryAmount, setEntryAmount] = useState<number>(50);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentStep, setPaymentStep] = useState<'SELECT' | 'GATEWAY' | 'CONFIRMING' | 'SUCCESS'>('SELECT');
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [showRefundPolicy, setShowRefundPolicy] = useState<boolean>(false);

  const tournament = {
    id: 'trn-7701-summer-cup',
    title: 'BGMI Summer Cup 2026 — Qualifier 1',
    organiser: 'Pro Circuit Esports',
    organiserVerified: true,
    prizePool: '₹5,000.00',
    escrowStatus: 'LOCKED',
    escrowLockId: 'esc-501-lock',
    entryFee: 50,
    startTime: '2026-10-20 18:00 UTC',
    refundWindowHours: 2,
  };

  const handleStartPayment = () => {
    setIsProcessing(true);
    setPaymentStep('GATEWAY');

    // Simulate Gateway redirect & webhook confirmation
    setTimeout(() => {
      setPaymentStep('CONFIRMING');
      setTimeout(() => {
        setIsProcessing(false);
        setPaymentStep('SUCCESS');
        setPaymentResult({
          orderId: `po-${Date.now().toString().slice(-6)}`,
          providerOrderId: selectedProvider === 'RAZORPAY' ? 'order_NxR998124' : 'cf_order_88231',
          amount: entryAmount,
          holdId: `hld-${Date.now().toString().slice(-6)}`,
          status: 'HOLD_CONFIRMED',
          webhookSignatureVerified: true,
          timestamp: new Date().toISOString(),
        });
      }, 1500);
    }, 2000);
  };

  const resetFlow = () => {
    setPaymentStep('SELECT');
    setPaymentResult(null);
  };

  return (
    <div className="min-h-screen bg-[#07080D] text-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-5">
          <div>
            <Link href="/" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 mb-1">
              ← Back to Discovery
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>💳</span> Secure Tournament Entry & Escrow
            </h1>
          </div>
          <button
            onClick={() => setShowRefundPolicy(true)}
            className="px-3.5 py-1.5 rounded-lg border border-gray-700 bg-gray-900/60 hover:bg-gray-800 text-xs font-medium text-gray-300 transition-colors flex items-center gap-1.5"
          >
            <span>📜</span> Published Refund Policy
          </button>
        </div>

        {/* Escrow Guarantee Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-gray-900/40 to-cyan-950/40 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl">
              🔒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Organiser Prize Escrow Locked</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Verified Invariant
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                The total prize pool of <strong className="text-white">{tournament.prizePool}</strong> was locked into Vexora Escrow by {tournament.organiser} before registrations opened.
              </p>
            </div>
          </div>
          <div className="text-right sm:border-l sm:border-gray-800 sm:pl-4">
            <span className="text-[10px] uppercase font-mono text-gray-500 block">Escrow Reference</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">{tournament.escrowLockId}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tournament Overview Card */}
          <div className="md:col-span-1 bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Tournament Entry
            </span>
            <h2 className="text-lg font-bold text-white">{tournament.title}</h2>
            <div className="space-y-2 text-xs text-gray-400 pt-2 border-t border-gray-800">
              <p>Organiser: <span className="text-gray-200 font-medium">{tournament.organiser}</span></p>
              <p>Start Time: <span className="text-gray-200 font-mono">{tournament.startTime}</span></p>
              <p>Entry Protection: <span className="text-emerald-400 font-medium">Automatic Wallet Hold</span></p>
            </div>

            <div className="pt-4 border-t border-gray-800">
              <span className="text-xs text-gray-400 block mb-1">Entry Fee</span>
              <div className="text-3xl font-black text-white">₹{tournament.entryFee.toFixed(2)}</div>
              <p className="text-[11px] text-gray-500 mt-1">
                Amount is held in your account and only deducted when the tournament officially starts.
              </p>
            </div>
          </div>

          {/* Payment Action Area */}
          <div className="md:col-span-2 bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-6">
            {paymentStep === 'SELECT' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white">Select Payment Provider</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Payments are processed via authorized payment aggregators with signed webhook verification.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSelectedProvider('RAZORPAY')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedProvider === 'RAZORPAY'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                        : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-lg font-black text-blue-400">Razorpay</div>
                    <div className="text-xs text-gray-400 mt-1">UPI (GPay/PhonePe), Credit/Debit Cards, Netbanking</div>
                    {selectedProvider === 'RAZORPAY' && (
                      <span className="inline-block mt-2 text-[10px] font-bold text-emerald-400 uppercase">● Selected</span>
                    )}
                  </button>

                  <button
                    onClick={() => setSelectedProvider('CASHFREE')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedProvider === 'CASHFREE'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                        : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-lg font-black text-purple-400">Cashfree</div>
                    <div className="text-xs text-gray-400 mt-1">UPI, Instant Wallets, Cards, PayLater</div>
                    {selectedProvider === 'CASHFREE' && (
                      <span className="inline-block mt-2 text-[10px] font-bold text-emerald-400 uppercase">● Selected</span>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-gray-950/60 border border-gray-800/80 space-y-2 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Entry Hold Amount:</span>
                    <strong className="text-white">₹{tournament.entryFee.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Service Charge:</span>
                    <strong className="text-emerald-400">₹0.00 (Free in v1)</strong>
                  </div>
                  <div className="pt-2 border-t border-gray-800 flex justify-between font-bold text-sm">
                    <span className="text-white">Total Authorised Hold:</span>
                    <span className="text-emerald-400">₹{tournament.entryFee.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleStartPayment}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-emerald-950/50"
                >
                  Pay ₹{tournament.entryFee.toFixed(2)} & Lock Registration
                </button>
              </div>
            )}

            {paymentStep === 'GATEWAY' && (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
                <h3 className="text-lg font-bold text-white">Connecting to {selectedProvider}...</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Authorizing transaction with payment gateway. Please complete authentication in your banking or UPI app.
                </p>
              </div>
            )}

            {paymentStep === 'CONFIRMING' && (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto"></div>
                <h3 className="text-lg font-bold text-white">Verifying Signed Webhook...</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Vexora server is verifying the HMAC-SHA256 signature from {selectedProvider}. Client never confirms payments directly.
                </p>
              </div>
            )}

            {paymentStep === 'SUCCESS' && paymentResult && (
              <div className="space-y-6 py-4">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 text-2xl flex items-center justify-center mx-auto">
                    ✓
                  </div>
                  <h3 className="text-xl font-bold text-white">Entry Payment Held Successfully!</h3>
                  <p className="text-xs text-gray-300">
                    Your tournament slot is secured. The fee is held in escrow and protected by our refund guarantee.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono space-y-2 text-gray-400">
                  <div className="flex justify-between">
                    <span>Order ID:</span>
                    <span className="text-white">{paymentResult.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Provider Ref:</span>
                    <span className="text-gray-300">{paymentResult.providerOrderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hold ID:</span>
                    <span className="text-emerald-400">{paymentResult.holdId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HMAC Signature:</span>
                    <span className="text-emerald-400">VERIFIED (SHA-256)</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetFlow}
                    className="flex-1 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs transition-colors"
                  >
                    Simulate Another Entry
                  </button>
                  <Link
                    href="/dashboard"
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs text-center transition-colors flex items-center justify-center"
                  >
                    Go to Player Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Published Refund Rules */}
        {showRefundPolicy && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0F1018] border border-gray-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📜</span> Published Refund & Cancellation Policy
                </h3>
                <button onClick={() => setShowRefundPolicy(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-4 text-xs text-gray-300 max-h-96 overflow-y-auto pr-2">
                <div>
                  <h4 className="font-bold text-white text-sm">1. Tournament Cancellation by Organiser</h4>
                  <p className="mt-1 text-gray-400">
                    If an organiser cancels a tournament or fails to start within 30 minutes of scheduled start time, 100% of player entry holds are released immediately back to available balance. Organiser prize escrow is subject to moderation review.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">2. Voluntary Player Withdrawal</h4>
                  <p className="mt-1 text-gray-400">
                    Players may withdraw and receive a 100% refund of their entry fee up to 2 hours before registration close. Cancellations within 2 hours of bracket generation are non-refundable to prevent bracket manipulation.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">3. Technical / Server Failure</h4>
                  <p className="mt-1 text-gray-400">
                    In the event of an unrecoverable server failure or game server crash certified by our moderation team, all active match participants receive a 100% refund and any locked escrow is restored.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">4. Disqualification for Cheating</h4>
                  <p className="mt-1 text-gray-400">
                    Any player or team disqualified for cheating, unauthorized third-party tools, or match-fixing forfeits their entry fee, which is transferred to the platform integrity fund.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800 text-right">
                <button
                  onClick={() => setShowRefundPolicy(false)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-bold transition-colors"
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
