'use client';

import React, { useState } from 'react';
import { AdminShell } from '../../components/AdminShell';

interface PaymentOrder {
  id: string;
  user_id: string;
  provider: 'RAZORPAY' | 'CASHFREE';
  provider_order_id: string;
  amount: number;
  currency: string;
  purpose: 'DEPOSIT' | 'TOURNAMENT_ENTRY' | 'PRIZE_ESCROW';
  status: 'CREATED' | 'PENDING' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  reference_type?: string;
  reference_id?: string;
  idempotency_key: string;
  created_at: string;
}

interface EscrowLock {
  id: string;
  tournament_id: string;
  tournament_title: string;
  organiser_id: string;
  escrow_amount: number;
  status: 'LOCKED' | 'SETTLED' | 'REFUNDED';
  locked_at: string;
  settled_at?: string;
  idempotency_key: string;
}

interface WebhookEvent {
  id: string;
  provider: 'RAZORPAY' | 'CASHFREE';
  event_id: string;
  event_type: string;
  status: 'PROCESSED' | 'DUPLICATE' | 'INVALID_SIGNATURE' | 'FAILED';
  received_at: string;
  ip_address: string;
}

interface RegionalConfig {
  region_code: string;
  region_name: string;
  country_code: string;
  is_enabled: boolean;
  kill_switch_on: boolean;
  kill_switch_reason?: string;
  max_entry_fee: number;
  max_prize_pool: number;
  allowed_providers: string[];
}

export default function AdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState<'orders' | 'escrow' | 'webhooks' | 'regional'>('orders');

  const [orders, setOrders] = useState<PaymentOrder[]>([
    {
      id: 'po-901-ab12',
      user_id: 'usr-1049-omega',
      provider: 'RAZORPAY',
      provider_order_id: 'order_NxR90123Abc',
      amount: 500.00,
      currency: 'INR',
      purpose: 'DEPOSIT',
      status: 'CAPTURED',
      idempotency_key: 'po-1049-1734567890123',
      created_at: '2026-10-16 14:20 UTC',
    },
    {
      id: 'po-902-cd34',
      user_id: 'usr-2088-viper',
      provider: 'RAZORPAY',
      provider_order_id: 'order_NxR90124Def',
      amount: 250.00,
      currency: 'INR',
      purpose: 'TOURNAMENT_ENTRY',
      reference_type: 'tournament',
      reference_id: 'trn-7701-summer-cup',
      status: 'CAPTURED',
      idempotency_key: 'po-2088-1734567900456',
      created_at: '2026-10-16 15:10 UTC',
    },
    {
      id: 'po-903-ef56',
      user_id: 'usr-3341-phoenix',
      provider: 'CASHFREE',
      provider_order_id: 'cf_order_882910',
      amount: 1000.00,
      currency: 'INR',
      purpose: 'PRIZE_ESCROW',
      reference_type: 'tournament',
      reference_id: 'trn-8802-pro-championship',
      status: 'PENDING',
      idempotency_key: 'po-3341-1734568012345',
      created_at: '2026-10-16 15:35 UTC',
    },
  ]);

  const [escrows, setEscrows] = useState<EscrowLock[]>([
    {
      id: 'esc-501-lock',
      tournament_id: 'trn-7701-summer-cup',
      tournament_title: 'BGMI Summer Cup 2026',
      organiser_id: 'org-101-pro-circuit',
      escrow_amount: 5000.00,
      status: 'LOCKED',
      locked_at: '2026-10-15 10:00 UTC',
      idempotency_key: 'escrow-lock-trn-7701',
    },
    {
      id: 'esc-502-settled',
      tournament_id: 'trn-6602-freefire-masters',
      tournament_title: 'Free Fire Fall Masters',
      organiser_id: 'org-102-battle-arena',
      escrow_amount: 2500.00,
      status: 'SETTLED',
      locked_at: '2026-10-10 12:00 UTC',
      settled_at: '2026-10-14 18:00 UTC',
      idempotency_key: 'escrow-lock-trn-6602',
    },
  ]);

  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([
    {
      id: 'wh-001',
      provider: 'RAZORPAY',
      event_id: 'payment.captured-pay_NxR90123Abc',
      event_type: 'payment.captured',
      status: 'PROCESSED',
      received_at: '2026-10-16 14:21:05 UTC',
      ip_address: '52.76.12.98',
    },
    {
      id: 'wh-002',
      provider: 'RAZORPAY',
      event_id: 'payment.captured-pay_NxR90123Abc',
      event_type: 'payment.captured',
      status: 'DUPLICATE',
      received_at: '2026-10-16 14:21:08 UTC',
      ip_address: '52.76.12.98',
    },
    {
      id: 'wh-003',
      provider: 'RAZORPAY',
      event_id: 'payment.captured-bad_sig_attempt',
      event_type: 'payment.captured',
      status: 'INVALID_SIGNATURE',
      received_at: '2026-10-16 15:02:11 UTC',
      ip_address: '194.165.16.2',
    },
  ]);

  const [regionalConfigs, setRegionalConfigs] = useState<RegionalConfig[]>([
    {
      region_code: 'IN-ALL',
      region_name: 'India (National Baseline)',
      country_code: 'IN',
      is_enabled: true,
      kill_switch_on: false,
      max_entry_fee: 500.00,
      max_prize_pool: 25000.00,
      allowed_providers: ['RAZORPAY', 'CASHFREE'],
    },
    {
      region_code: 'IN-TN',
      region_name: 'Tamil Nadu (Restricted State)',
      country_code: 'IN',
      is_enabled: false,
      kill_switch_on: true,
      kill_switch_reason: 'Statutory skill-gaming review in progress',
      max_entry_fee: 0,
      max_prize_pool: 0,
      allowed_providers: [],
    },
    {
      region_code: 'IN-KA',
      region_name: 'Karnataka',
      country_code: 'IN',
      is_enabled: true,
      kill_switch_on: false,
      max_entry_fee: 250.00,
      max_prize_pool: 10000.00,
      allowed_providers: ['RAZORPAY'],
    },
  ]);

  const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRefund = (orderId: string) => {
    if (!refundReason.trim()) return;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'REFUNDED' } : o))
    );
    setSuccessMessage(`Order ${orderId} refunded successfully: "${refundReason}"`);
    setSelectedOrder(null);
    setRefundReason('');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const toggleKillSwitch = (regionCode: string) => {
    setRegionalConfigs((prev) =>
      prev.map((c) => {
        if (c.region_code === regionCode) {
          const nextState = !c.kill_switch_on;
          return {
            ...c,
            kill_switch_on: nextState,
            is_enabled: !nextState,
            kill_switch_reason: nextState ? 'Admin manual emergency toggle' : undefined,
          };
        }
        return c;
      })
    );
    setSuccessMessage(`Regional kill-switch updated for ${regionCode}`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>💳</span> Payments, Escrow & Webhooks
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Phase 27: Payment gateway tracking, prize escrow verification, signed webhook monitoring, and regional kill-switches.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ● Gateway: LIVE / Sandbox
            </span>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Feature Flag: ACTIVE
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
            { id: 'orders', label: 'Payment Orders', count: orders.length, icon: '📋' },
            { id: 'escrow', label: 'Prize Escrow Locks', count: escrows.length, icon: '🔒' },
            { id: 'webhooks', label: 'Webhook Event Log', count: webhooks.length, icon: '⚡' },
            { id: 'regional', label: 'Regional Kill-Switches', count: regionalConfigs.length, icon: '🌐' },
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

        {/* TAB 1: Payment Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-gray-950/80 text-xs uppercase text-gray-400 border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Purpose</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-emerald-400 font-bold">{order.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{order.user_id}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {order.provider}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-white">₹{order.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-mono bg-purple-500/10 text-purple-300">
                            {order.purpose}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              order.status === 'CAPTURED'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : order.status === 'REFUNDED'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{order.created_at}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-2.5 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
                          >
                            Details / Refund
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Prize Escrow Locks */}
        {activeTab === 'escrow' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {escrows.map((escrow) => (
                <div
                  key={escrow.id}
                  className="p-5 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-gray-700 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                      {escrow.id}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        escrow.status === 'LOCKED'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {escrow.status === 'LOCKED' ? '🔒 ESCROW LOCKED' : '✅ PRIZES SETTLED'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{escrow.tournament_title}</h3>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>Tournament ID: <span className="font-mono text-gray-300">{escrow.tournament_id}</span></p>
                    <p>Organiser ID: <span className="font-mono text-gray-300">{escrow.organiser_id}</span></p>
                    <p>Idempotency Key: <span className="font-mono text-gray-300">{escrow.idempotency_key}</span></p>
                  </div>
                  <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-400">Locked Prize Escrow</span>
                      <p className="text-xl font-black text-white">₹{escrow.escrow_amount.toFixed(2)}</p>
                    </div>
                    <span className="text-xs text-gray-400">Locked at: {escrow.locked_at}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Webhook Event Log */}
        {activeTab === 'webhooks' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-800 text-xs text-gray-400 flex items-center gap-3">
              <span className="text-base">🛡️</span>
              <span>
                <strong>Zero Trust Ingestion:</strong> All webhooks must pass HMAC-SHA256 signature verification and timestamp replay checks. Processed events are deduplicated via unique <code>(provider, event_id)</code> constraints.
              </span>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-950/80 text-xs uppercase text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Internal ID</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Provider Event ID</th>
                    <th className="px-4 py-3">Event Type</th>
                    <th className="px-4 py-3">Security Status</th>
                    <th className="px-4 py-3">Ingress IP</th>
                    <th className="px-4 py-3 text-right">Received At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {webhooks.map((wh) => (
                    <tr key={wh.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{wh.id}</td>
                      <td className="px-4 py-3 font-semibold text-xs text-blue-400">{wh.provider}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-200">{wh.event_id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-purple-400">{wh.event_type}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            wh.status === 'PROCESSED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : wh.status === 'DUPLICATE'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {wh.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{wh.ip_address}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">{wh.received_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Regional Kill-Switches */}
        {activeTab === 'regional' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {regionalConfigs.map((config) => (
                <div
                  key={config.region_code}
                  className={`p-5 rounded-xl border transition-all space-y-4 ${
                    config.kill_switch_on
                      ? 'bg-red-950/20 border-red-500/40'
                      : 'bg-gray-900/60 border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-gray-300 bg-gray-800 px-2 py-0.5 rounded">
                      {config.region_code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        config.kill_switch_on
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {config.kill_switch_on ? '🚨 KILL-SWITCH ENGAGED' : 'ACTIVE'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-white text-base">{config.region_name}</h3>
                    {config.kill_switch_reason && (
                      <p className="text-xs text-red-400 mt-1 italic">{config.kill_switch_reason}</p>
                    )}
                  </div>

                  <div className="text-xs text-gray-400 space-y-1">
                    <p>Max Entry Fee: <strong className="text-gray-200">₹{config.max_entry_fee}</strong></p>
                    <p>Max Prize Pool: <strong className="text-gray-200">₹{config.max_prize_pool}</strong></p>
                    <p>Allowed Providers: <span className="font-mono text-gray-300">{config.allowed_providers.join(', ') || 'None'}</span></p>
                  </div>

                  <button
                    onClick={() => toggleKillSwitch(config.region_code)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all ${
                      config.kill_switch_on
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950'
                        : 'bg-red-600/80 hover:bg-red-600 text-white shadow-lg shadow-red-950'
                    }`}
                  >
                    {config.kill_switch_on ? 'Deactivate Kill-Switch' : 'Engage Emergency Kill-Switch'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Order Details & Refund */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-lg font-bold text-white">Payment Order Details</h3>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-2 text-sm text-gray-300">
                <p><strong>Order ID:</strong> <span className="font-mono text-emerald-400">{selectedOrder.id}</span></p>
                <p><strong>Provider Order ID:</strong> <span className="font-mono">{selectedOrder.provider_order_id}</span></p>
                <p><strong>Amount:</strong> ₹{selectedOrder.amount.toFixed(2)} {selectedOrder.currency}</p>
                <p><strong>Purpose:</strong> {selectedOrder.purpose}</p>
                <p><strong>Status:</strong> {selectedOrder.status}</p>
                <p><strong>Idempotency Key:</strong> <span className="font-mono text-xs">{selectedOrder.idempotency_key}</span></p>
              </div>

              {selectedOrder.status === 'CAPTURED' && (
                <div className="space-y-3 pt-3 border-t border-gray-800">
                  <label className="block text-xs font-semibold text-gray-400 uppercase">
                    Admin Refund Reason
                  </label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="e.g. Tournament cancelled by organiser"
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRefund(selectedOrder.id)}
                      disabled={!refundReason.trim()}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Issue Full Refund
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
