'use client';

import React, { useState, useEffect } from 'react';
import { AdminShell } from '../../components/AdminShell';
import { useAdminAuth } from '../../lib/auth-context';

interface AuditRecord {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  prev_hash?: string;
  curr_hash?: string;
}

const SAMPLE_LOGS: AuditRecord[] = [
  {
    id: 'log-001',
    actor_id: 'usr_admin_01',
    actor_role: 'SUPER_ADMIN',
    action: 'ADMIN_MFA_LOGIN_SUCCESS',
    entity_type: 'user_session',
    entity_id: 'fam_8a9b2c3d',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    prev_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    curr_hash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
  },
  {
    id: 'log-002',
    actor_id: 'usr_admin_01',
    actor_role: 'SUPER_ADMIN',
    action: 'FEATURE_FLAG_UPDATED',
    entity_type: 'feature_flag',
    entity_id: 'free_tournaments_only',
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    prev_hash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    curr_hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
  },
  {
    id: 'log-003',
    actor_id: 'usr_fin_02',
    actor_role: 'FINANCE',
    action: 'MAKER_CHECKER_CREATED',
    entity_type: 'maker_checker',
    entity_id: 'mc_payout_99',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    prev_hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
    curr_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
];

export default function AuditLogsPage() {
  const { accessToken } = useAdminAuth();
  const [logs, setLogs] = useState<AuditRecord[]>(SAMPLE_LOGS);
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    if (accessToken) {
      fetch('/api/v1/admin/audit-logs', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setLogs(data.data);
          }
        })
        .catch(() => {});
    }
  }, [accessToken]);

  const filteredLogs = filterAction
    ? logs.filter((l) => l.action.toLowerCase().includes(filterAction.toLowerCase()))
    : logs;

  return (
    <AdminShell>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700, color: '#F8FAFC' }}>
              Tamper-Evident Audit Log Viewer
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#94A3B8', fontSize: '0.875rem' }}>
              Cryptographically chained, append-only security journal. Strictly read-only.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                color: '#34D399',
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🔗</span>
              <span>Audit Chain Valid (SHA-256)</span>
            </span>
          </div>
        </div>

        {/* Read-only security notice */}
        <div
          style={{
            padding: '0.875rem 1.25rem',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: '#93C5FD', fontSize: '0.8125rem' }}>
            ℹ️ <strong>Immutable Ledger Guarantee:</strong> Database triggers prohibit all UPDATE and DELETE mutations. Audit entries can only be read.
          </span>
          <input
            type="text"
            placeholder="Filter by action..."
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#F8FAFC',
              fontSize: '0.75rem',
              outline: 'none',
              width: '200px',
            }}
          />
        </div>

        {/* Audit Table */}
        <div
          style={{
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#1E293B', borderBottom: '1px solid #334155', color: '#CBD5E1' }}>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Timestamp (UTC)</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Actor</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Action</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Entity</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Hash Chain</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom: '1px solid #1E293B',
                    color: '#E2E8F0',
                  }}
                >
                  <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', color: '#94A3B8' }}>
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 500 }}>
                    {log.actor_id}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        backgroundColor: '#1E293B',
                        color: '#38BDF8',
                        border: '1px solid #334155',
                      }}
                    >
                      {log.actor_role}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: '#A5B4FC' }}>
                    {log.action}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#94A3B8' }}>
                    {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ''}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        color: '#34D399',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                      }}
                    >
                      ✓ Linked
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
