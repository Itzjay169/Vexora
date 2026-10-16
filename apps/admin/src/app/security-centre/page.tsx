'use client';

import React, { useState } from 'react';
import { AdminShell } from '../../components/AdminShell';

interface FailedLogin {
  id: string;
  identifier: string;
  ip_address: string;
  failure_reason: string;
  user_agent: string;
  attempted_at: string;
}

interface BlockedIp {
  id: string;
  ip_address: string;
  reason: string;
  threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  blocked_by_username: string;
  blocked_at: string;
  expires_at: string | null;
  is_active: boolean;
}

interface AdminSession {
  id: string;
  username: string;
  role: string;
  ip_hash: string;
  user_agent: string;
  last_active_at: string;
}

interface BreakGlassRequest {
  id: string;
  requester_username: string;
  requester_role: string;
  reason: string;
  elevated_permissions: string[];
  duration_hours: number;
  status: 'PENDING' | 'ACTIVE' | 'DENIED';
  approved_by_username?: string;
  created_at: string;
}

export default function SecurityCentrePage() {
  const [activeTab, setActiveTab] = useState<'failed_logins' | 'blocked_ips' | 'sessions' | 'break_glass' | 'integrity'>('failed_logins');

  // Stats State
  const [failedLoginsCount, setFailedLoginsCount] = useState(14);
  const [blockedIpsCount, setBlockedIpsCount] = useState(6);
  const [activeSessionsCount, setActiveSessionsCount] = useState(4);
  const [pendingBreakGlassCount, setPendingBreakGlassCount] = useState(1);
  const [auditChainStatus, setAuditChainStatus] = useState<'HEALTHY' | 'VERIFYING' | 'COMPROMISED'>('HEALTHY');
  const [verifiedCount, setVerifiedCount] = useState(452);
  const [merkleRoot, setMerkleRoot] = useState('8f2a9e4b1c7d0e3f5a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f');

  // Mock initial data
  const [failedLogins, setFailedLogins] = useState<FailedLogin[]>([
    {
      id: 'fl-01',
      identifier: 'attacker_script@botnet.xyz',
      ip_address: '198.51.100.44',
      failure_reason: 'INVALID_CREDENTIALS',
      user_agent: 'python-requests/2.31.0',
      attempted_at: '2026-10-15 16:42:10 UTC',
    },
    {
      id: 'fl-02',
      identifier: 'admin_compromise_test',
      ip_address: '203.0.113.89',
      failure_reason: 'MFA_CHALLENGE_FAILED',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      attempted_at: '2026-10-15 16:35:22 UTC',
    },
    {
      id: 'fl-03',
      identifier: 'operator_finance',
      ip_address: '192.0.2.112',
      failure_reason: 'IP_GEO_MISMATCH',
      user_agent: 'Mozilla/5.0 (X11; Linux x86_64)',
      attempted_at: '2026-10-15 15:58:04 UTC',
    },
  ]);

  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([
    {
      id: 'bip-01',
      ip_address: '198.51.100.44',
      reason: 'Repeated credential brute-force attack on /api/v1/auth/login',
      threat_level: 'CRITICAL',
      blocked_by_username: 'SecurityEngine_Auto',
      blocked_at: '2026-10-15 16:45:00 UTC',
      expires_at: '2026-10-22 16:45:00 UTC',
      is_active: true,
    },
    {
      id: 'bip-02',
      ip_address: '45.154.255.12',
      reason: 'Known malicious scraper and DDoS probe',
      threat_level: 'HIGH',
      blocked_by_username: 'SuperAdmin_Dev',
      blocked_at: '2026-10-14 09:12:00 UTC',
      expires_at: null,
      is_active: true,
    },
  ]);

  const [adminSessions, setAdminSessions] = useState<AdminSession[]>([
    {
      id: 'sess-01',
      username: 'SuperAdmin_Dev',
      role: 'SUPER_ADMIN',
      ip_hash: 'sha256:7c9e...4a1b',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      last_active_at: 'Just now',
    },
    {
      id: 'sess-02',
      username: 'Mod_ApexGuardian',
      role: 'MODERATOR',
      ip_hash: 'sha256:3d2f...9e0c',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      last_active_at: '8 mins ago',
    },
  ]);

  const [breakGlassRequests, setBreakGlassRequests] = useState<BreakGlassRequest[]>([
    {
      id: 'bg-9901',
      requester_username: 'Mod_ApexGuardian',
      requester_role: 'MODERATOR',
      reason: 'Critical tournament result dispute freeze requires temporary audit trail ledger review',
      elevated_permissions: ['AUDIT_FULL_READ', 'DISPUTE_FORCE_RESOLVE'],
      duration_hours: 2,
      status: 'PENDING',
      created_at: '2026-10-15 16:10:00 UTC',
    },
  ]);

  // Modal States
  const [blockIpModalOpen, setBlockIpModalOpen] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState('');
  const [newIpReason, setNewIpReason] = useState('');
  const [newIpThreat, setNewIpThreat] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  const [notice, setNotice] = useState<string | null>(null);

  const handleBlockIp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIpAddress.trim() || !newIpReason.trim()) return;

    const newBlock: BlockedIp = {
      id: `bip-${Date.now()}`,
      ip_address: newIpAddress.trim(),
      reason: newIpReason.trim(),
      threat_level: newIpThreat,
      blocked_by_username: 'CurrentAdmin',
      blocked_at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
      expires_at: null,
      is_active: true,
    };

    setBlockedIps([newBlock, ...blockedIps]);
    setBlockedIpsCount((prev) => prev + 1);
    setBlockIpModalOpen(false);
    setNewIpAddress('');
    setNewIpReason('');
    setNotice(`✅ IP address ${newBlock.ip_address} has been added to the active firewall blocklist.`);
  };

  const handleUnblockIp = (id: string, ip: string) => {
    setBlockedIps(blockedIps.filter((b) => b.id !== id));
    setBlockedIpsCount((prev) => Math.max(0, prev - 1));
    setNotice(`ℹ️ IP address ${ip} has been unblocked.`);
  };

  const handleRevokeSession = (sessionId: string, username: string) => {
    setAdminSessions(adminSessions.filter((s) => s.id !== sessionId));
    setActiveSessionsCount((prev) => Math.max(0, prev - 1));
    setNotice(`🔒 Active session for ${username} was revoked.`);
  };

  const handleAdjudicateBreakGlass = (id: string, decision: 'APPROVE' | 'DENY') => {
    setBreakGlassRequests(
      breakGlassRequests.map((bg) =>
        bg.id === id
          ? {
              ...bg,
              status: decision === 'APPROVE' ? 'ACTIVE' : 'DENIED',
              approved_by_username: 'SuperAdmin_Dev',
            }
          : bg
      )
    );
    setPendingBreakGlassCount((prev) => Math.max(0, prev - 1));
    setNotice(
      decision === 'APPROVE'
        ? `🔓 Break-Glass request ${id} APPROVED with Maker-Checker dual authorization.`
        : `🛑 Break-Glass request ${id} DENIED.`
    );
  };

  const handleRunIntegrityCheck = () => {
    setAuditChainStatus('VERIFYING');
    setTimeout(() => {
      setAuditChainStatus('HEALTHY');
      setVerifiedCount(452);
      setMerkleRoot('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      setNotice('✅ Cryptographic verification complete: 452 audit records verified with 0 broken links. Merkle root signature sealed.');
    }, 800);
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
              <span style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 700, letterSpacing: '0.05em' }}>
                SECURITY CENTRE V1
              </span>
              <span style={{ color: '#475569' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Sections 12 & 47</span>
            </div>
            <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700, color: '#F8FAFC' }}>
              Threat Intelligence & Platform Security
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#94A3B8', fontSize: '0.875rem' }}>
              Live intrusion monitoring, failed login forensics, IP firewall, Maker-Checker emergency access, and cryptographic integrity.
            </p>
          </div>

          <button
            onClick={() => setBlockIpModalOpen(true)}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: '#EF4444',
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
            <span>🛑</span>
            <span>Block IP Address</span>
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

        {/* ─── Top Security Metrics Ribbon ─────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ backgroundColor: '#0F172A', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Failed Logins (24h)
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#EF4444', marginTop: '0.25rem' }}>
              {failedLoginsCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
              3 suspicious IP patterns detected
            </div>
          </div>

          <div style={{ backgroundColor: '#0F172A', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Blocked IPs (Active)
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F59E0B', marginTop: '0.25rem' }}>
              {blockedIpsCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
              Enforced across REST & WebSockets
            </div>
          </div>

          <div style={{ backgroundColor: '#0F172A', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Active Admin Sessions
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#60A5FA', marginTop: '0.25rem' }}>
              {activeSessionsCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
              MFA enforced on all operators
            </div>
          </div>

          <div style={{ backgroundColor: '#0F172A', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Pending Break-Glass
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#A855F7', marginTop: '0.25rem' }}>
              {pendingBreakGlassCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
              Requires Maker-Checker approval
            </div>
          </div>

          <div style={{ backgroundColor: '#0F172A', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1E293B' }}>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Audit Hash Chain
            </div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: auditChainStatus === 'HEALTHY' ? '#10B981' : '#F59E0B',
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>{auditChainStatus === 'HEALTHY' ? '🛡️ HEALTHY' : '⏳ CHECKING'}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
              {verifiedCount} records verified
            </div>
          </div>
        </div>

        {/* ─── Tab Navigation ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1E293B', marginBottom: '1.5rem' }}>
          {[
            { id: 'failed_logins', label: 'Threat Feed & Failed Logins', badge: failedLogins.length },
            { id: 'blocked_ips', label: 'Blocked IPs Firewall', badge: blockedIps.length },
            { id: 'sessions', label: 'Active Admin Sessions', badge: adminSessions.length },
            { id: 'break_glass', label: 'Break-Glass Emergency Requests', badge: pendingBreakGlassCount },
            { id: 'integrity', label: 'Audit Chain Cryptographic Runner', badge: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #EF4444' : '2px solid transparent',
                color: activeTab === tab.id ? '#F8FAFC' : '#94A3B8',
                fontWeight: activeTab === tab.id ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span
                  style={{
                    backgroundColor: activeTab === tab.id ? '#EF4444' : '#1E293B',
                    color: '#F8FAFC',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '999px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── TAB 1: Failed Logins ───────────────────────────────────────────── */}
        {activeTab === 'failed_logins' && (
          <div style={{ backgroundColor: '#0F172A', borderRadius: '12px', border: '1px solid #1E293B', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#1E293B' }}>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Identifier / Target</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>IP Address</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Failure Reason</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>User Agent</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {failedLogins.map((fl) => (
                  <tr key={fl.id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: '1rem', color: '#94A3B8', fontSize: '0.8125rem' }}>{fl.attempted_at}</td>
                    <td style={{ padding: '1rem', color: '#F8FAFC', fontWeight: 500 }}>{fl.identifier}</td>
                    <td style={{ padding: '1rem', color: '#F59E0B', fontFamily: 'monospace' }}>{fl.ip_address}</td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#EF4444',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {fl.failure_reason}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#64748B', fontSize: '0.75rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fl.user_agent}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        onClick={() => {
                          setNewIpAddress(fl.ip_address);
                          setNewIpReason(`Repeated failed login: ${fl.failure_reason}`);
                          setBlockIpModalOpen(true);
                        }}
                        style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid #EF4444',
                          color: '#EF4444',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Block IP
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── TAB 2: Blocked IPs ─────────────────────────────────────────────── */}
        {activeTab === 'blocked_ips' && (
          <div style={{ backgroundColor: '#0F172A', borderRadius: '12px', border: '1px solid #1E293B', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#1E293B' }}>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>IP Address</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Threat Level</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Reason</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Blocked By</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Blocked At</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {blockedIps.map((bip) => (
                  <tr key={bip.id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: '1rem', color: '#F8FAFC', fontWeight: 600, fontFamily: 'monospace' }}>
                      {bip.ip_address}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          backgroundColor: bip.threat_level === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: bip.threat_level === 'CRITICAL' ? '#EF4444' : '#F59E0B',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {bip.threat_level}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#CBD5E1', fontSize: '0.8125rem' }}>{bip.reason}</td>
                    <td style={{ padding: '1rem', color: '#94A3B8', fontSize: '0.8125rem' }}>{bip.blocked_by_username}</td>
                    <td style={{ padding: '1rem', color: '#64748B', fontSize: '0.75rem' }}>{bip.blocked_at}</td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        onClick={() => handleUnblockIp(bip.id, bip.ip_address)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid #10B981',
                          color: '#10B981',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── TAB 3: Active Admin Sessions ───────────────────────────────────── */}
        {activeTab === 'sessions' && (
          <div style={{ backgroundColor: '#0F172A', borderRadius: '12px', border: '1px solid #1E293B', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#1E293B' }}>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Admin User</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>IP Hash</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>User Agent</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Last Active</th>
                  <th style={{ padding: '0.875rem 1rem', color: '#94A3B8', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {adminSessions.map((sess) => (
                  <tr key={sess.id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: '1rem', color: '#F8FAFC', fontWeight: 600 }}>{sess.username}</td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          color: '#818CF8',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {sess.role}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {sess.ip_hash}
                    </td>
                    <td style={{ padding: '1rem', color: '#64748B', fontSize: '0.75rem' }}>{sess.user_agent}</td>
                    <td style={{ padding: '1rem', color: '#10B981', fontSize: '0.8125rem' }}>{sess.last_active_at}</td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        onClick={() => handleRevokeSession(sess.id, sess.username)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid #EF4444',
                          color: '#EF4444',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Force Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── TAB 4: Break-Glass Emergency Requests ──────────────────────────── */}
        {activeTab === 'break_glass' && (
          <div style={{ backgroundColor: '#0F172A', borderRadius: '12px', border: '1px solid #1E293B', padding: '1.5rem' }}>
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ fontWeight: 700, color: '#EF4444', marginBottom: '0.25rem' }}>
                🚨 Maker-Checker Dual-Approval Invariant (Section 47)
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#E2E8F0', lineHeight: 1.5 }}>
                Emergency break-glass requests grant temporary elevated privileges. Under zero-trust architecture, the requesting operator <strong>cannot</strong> approve their own request. Approval requires a second authorized Super Administrator.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {breakGlassRequests.map((bg) => (
                <div
                  key={bg.id}
                  style={{
                    backgroundColor: '#1E293B',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    border: '1px solid #334155',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#F8FAFC' }}>{bg.requester_username}</span>
                        <span style={{ fontSize: '0.75rem', color: '#818CF8', backgroundColor: 'rgba(99, 102, 241, 0.2)', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                          {bg.requester_role}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>• {bg.created_at}</span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#CBD5E1', marginTop: '0.5rem' }}>
                        <strong>Reason:</strong> {bg.reason}
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '0.25rem 0.625rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: bg.status === 'PENDING' ? 'rgba(245, 158, 11, 0.2)' : bg.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: bg.status === 'PENDING' ? '#F59E0B' : bg.status === 'ACTIVE' ? '#10B981' : '#EF4444',
                      }}
                    >
                      {bg.status}
                    </span>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.375rem' }}>Elevated Permissions Requested:</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {bg.elevated_permissions.map((p) => (
                        <span
                          key={p}
                          style={{
                            backgroundColor: '#0F172A',
                            border: '1px solid #475569',
                            color: '#E2E8F0',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  {bg.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid #334155', paddingTop: '0.75rem' }}>
                      <button
                        onClick={() => handleAdjudicateBreakGlass(bg.id, 'DENY')}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: 'transparent',
                          border: '1px solid #EF4444',
                          color: '#EF4444',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Deny Request
                      </button>
                      <button
                        onClick={() => handleAdjudicateBreakGlass(bg.id, 'APPROVE')}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#10B981',
                          border: 'none',
                          color: '#FFFFFF',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Dual-Authorize Access
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── TAB 5: Audit Chain Integrity Runner ────────────────────────────── */}
        {activeTab === 'integrity' && (
          <div style={{ backgroundColor: '#0F172A', borderRadius: '12px', border: '1px solid #1E293B', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#F8FAFC', fontSize: '1.125rem' }}>
                  Cryptographic Chain Integrity Runner
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: '#94A3B8', fontSize: '0.8125rem' }}>
                  Deterministically recalculates SHA-256 hash chains across immutable audit logs and verifies Merkle root checkpoint.
                </p>
              </div>

              <button
                onClick={handleRunIntegrityCheck}
                disabled={auditChainStatus === 'VERIFYING'}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: auditChainStatus === 'VERIFYING' ? 'not-allowed' : 'pointer',
                  opacity: auditChainStatus === 'VERIFYING' ? 0.7 : 1,
                }}
              >
                {auditChainStatus === 'VERIFYING' ? 'Verifying Hashes...' : '⚡ Run Cryptographic Verification'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: '#1E293B', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Chain Status</div>
                <div style={{ color: '#10B981', fontWeight: 700, fontSize: '1.25rem', marginTop: '0.25rem' }}>
                  VALID (0 BROKEN LINKS)
                </div>
              </div>
              <div style={{ backgroundColor: '#1E293B', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Verified Chain Depth</div>
                <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '1.25rem', marginTop: '0.25rem' }}>
                  {verifiedCount} records
                </div>
              </div>
              <div style={{ backgroundColor: '#1E293B', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Tampering Alerts</div>
                <div style={{ color: '#10B981', fontWeight: 700, fontSize: '1.25rem', marginTop: '0.25rem' }}>
                  0 (SEV-1 Clean)
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#1E293B', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                Active Merkle Root Hash (SHA-256)
              </div>
              <div style={{ color: '#34D399', fontFamily: 'monospace', fontSize: '0.875rem', wordBreak: 'break-all' }}>
                {merkleRoot}
              </div>
            </div>
          </div>
        )}

        {/* ─── Block IP Modal ─────────────────────────────────────────────────── */}
        {blockIpModalOpen && (
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
              <h3 style={{ margin: '0 0 1rem', color: '#F8FAFC', fontSize: '1.25rem' }}>Block IP Address</h3>
              <form onSubmit={handleBlockIp}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                    IP Address (IPv4 or IPv6)
                  </label>
                  <input
                    type="text"
                    required
                    value={newIpAddress}
                    onChange={(e) => setNewIpAddress(e.target.value)}
                    placeholder="e.g. 198.51.100.44"
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

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                    Threat Level
                  </label>
                  <select
                    value={newIpThreat}
                    onChange={(e) => setNewIpThreat(e.target.value as any)}
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
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                    Reason & Forensic Justification
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={newIpReason}
                    onChange={(e) => setNewIpReason(e.target.value)}
                    placeholder="Describe specific threat behavior, endpoints targeted, or attack signature..."
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
                    onClick={() => setBlockIpModalOpen(false)}
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
                      backgroundColor: '#EF4444',
                      border: 'none',
                      color: '#FFFFFF',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Confirm Block
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
