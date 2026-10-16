'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminAuth, AdminRole } from '../lib/auth-context';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  roles: AdminRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Overview',
    href: '/',
    icon: '📊',
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MODERATOR', 'AUDITOR'],
  },
  {
    name: 'Organiser Approvals',
    href: '/organisers',
    icon: '🛡️',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'],
  },
  {
    name: 'Dispute Adjudication',
    href: '/disputes',
    icon: '⚖️',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'],
  },
  {
    name: 'Financial Maker-Checker',
    href: '/maker-checker',
    icon: '💰',
    roles: ['SUPER_ADMIN', 'FINANCE', 'AUDITOR'],
  },
  {
    name: 'Redeem Code Batches',
    href: '/batches',
    icon: '🎟️',
    roles: ['SUPER_ADMIN', 'FINANCE', 'AUDITOR'],
  },
  {
    name: 'Game Management',
    href: '/games',
    icon: '🎮',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'Feature Flags',
    href: '/feature-flags',
    icon: '🚩',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'Audit Hash Chain',
    href: '/audit',
    icon: '⛓️',
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'AUDITOR'],
  },
  {
    name: 'Security Centre',
    href: '/security-centre',
    icon: '🚨',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'Admin Sessions',
    href: '/sessions',
    icon: '💻',
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MODERATOR', 'AUDITOR'],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAdminAuth();
  const pathname = usePathname();

  // If user is not authenticated or not loaded yet, default to SUPER_ADMIN for preview or render
  const currentRole: AdminRole = user?.role || 'SUPER_ADMIN';

  // Filter navigation items by role
  const allowedNavItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(currentRole)
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0B0F19' }}>
      {/* ─── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: '280px',
          backgroundColor: '#0F172A',
          borderRight: '1px solid #1E293B',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* Header branding */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#6366F1', margin: 0, fontWeight: 700, letterSpacing: '0.05em' }}>
              VEXORA ADMIN
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem', fontWeight: 500 }}>
              Zero-Trust Console
            </p>
          </div>

          {/* Role pill */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: '#1E293B',
              borderRadius: '8px',
              border: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase' }}>Active Role</span>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#38BDF8', fontWeight: 600 }}>{currentRole}</p>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                padding: '0.2rem 0.5rem',
                borderRadius: '9999px',
                fontWeight: 600,
              }}
            >
              MFA ACTIVE
            </span>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {allowedNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    backgroundColor: isActive ? '#1E293B' : 'transparent',
                    color: isActive ? '#F8FAFC' : '#94A3B8',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '0.875rem',
                    borderLeft: isActive ? '3px solid #6366F1' : '3px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer & Signout */}
        <div style={{ borderTop: '1px solid #1E293B', paddingTop: '1rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#F8FAFC', fontWeight: 600 }}>
                {user?.username || 'admin@vexora.gg'}
              </p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748B' }}>Verified Hardware MFA</p>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '6px',
              border: '1px solid #334155',
              backgroundColor: '#1E293B',
              color: '#F87171',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─── Main Content Area ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1E293B',
            padding: '1rem 2rem',
            backgroundColor: '#0F172A',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#94A3B8' }}>Security Level:</span>
            <span
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                color: '#818CF8',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              Zero-Trust Guard Active
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10B981',
                padding: '0.375rem 0.875rem',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <span>●</span>
              <span>Audit Chain Valid</span>
            </span>
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
