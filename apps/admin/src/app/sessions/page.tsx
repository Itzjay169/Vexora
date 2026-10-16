'use client';

import React, { useState, useEffect } from 'react';
import { AdminShell } from '../../components/AdminShell';
import { useAdminAuth } from '../../lib/auth-context';

interface AdminSession {
  id: string;
  username: string;
  role: string;
  deviceInfo?: {
    platform?: string;
    userAgent?: string;
    model?: string;
  };
  ipHash: string;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}

const SAMPLE_SESSIONS: AdminSession[] = [
  {
    id: 'ses_cur_01',
    username: 'admin@vexora.gg',
    role: 'SUPER_ADMIN',
    deviceInfo: {
      platform: 'Desktop / macOS',
      userAgent: 'Chrome 129 / Zero-Trust Admin App',
    },
    ipHash: '5e8c6172a7b2d05d9d086caea4199e49',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    isCurrent: true,
  },
  {
    id: 'ses_aux_02',
    username: 'admin@vexora.gg',
    role: 'SUPER_ADMIN',
    deviceInfo: {
      platform: 'Mobile / iPadOS',
      userAgent: 'Safari Mobile / Secure Keystore',
    },
    ipHash: 'b519bb7e-9679-48ce-81b6-005f5ed2',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    isCurrent: false,
  },
];

export default function AdminSessionsPage() {
  const { accessToken } = useAdminAuth();
  const [sessions, setSessions] = useState<AdminSession[]>(SAMPLE_SESSIONS);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) {
      fetch('/api/v1/admin/sessions', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setSessions(data.data);
          }
        })
        .catch(() => {});
    }
  }, [accessToken]);

  const handleRevoke = async (sessionId: string) => {
    try {
      if (accessToken) {
        await fetch(`/api/v1/admin/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setMessage(`Session ${sessionId} successfully revoked.`);
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage('Failed to revoke session.');
    }
  };

  const handleForceLogoutAll = async () => {
    try {
      if (accessToken) {
        await fetch('/api/v1/admin/sessions/force-logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      // Retain only current session
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setMessage('All other active admin sessions have been revoked.');
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage('Failed to force logout all sessions.');
    }
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700, color: '#F8FAFC' }}>
              Active Admin Sessions
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#94A3B8', fontSize: '0.875rem' }}>
              Multi-device session list with instant revocation and force-logout controls.
            </p>
          </div>

          <button
            onClick={handleForceLogoutAll}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#F87171',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>⚠️</span>
            <span>Force Logout All Other Sessions</span>
          </button>
        </div>

        {message && (
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
            ✓ {message}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                backgroundColor: '#0F172A',
                border: session.isCurrent ? '1px solid #6366F1' : '1px solid #1E293B',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '1.125rem' }}>{session.isCurrent ? '💻' : '📱'}</span>
                  <strong style={{ color: '#F8FAFC', fontSize: '0.9375rem' }}>
                    {session.deviceInfo?.platform || 'Desktop Browser'}
                  </strong>
                  {session.isCurrent && (
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid #6366F1',
                        borderRadius: '9999px',
                        color: '#A5B4FC',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      CURRENT SESSION
                    </span>
                  )}
                </div>

                <p style={{ margin: '0 0 0.5rem', color: '#64748B', fontSize: '0.75rem' }}>
                  {session.deviceInfo?.userAgent || 'Standard Session Token'}
                </p>

                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                  <span>
                    IP Hash: <code style={{ color: '#CBD5E1' }}>{session.ipHash.slice(0, 12)}...</code>
                  </span>
                  <span>
                    Started: {new Date(session.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  onClick={() => handleRevoke(session.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#F87171',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
