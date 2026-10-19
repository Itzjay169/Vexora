'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const pathname = usePathname();

  useEffect(() => {
    // Check saved theme or system preference
    const saved = localStorage.getItem('vx-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('vx-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const navLinks = [
    { label: 'Discover', href: '/', icon: '🏆' },
    { label: 'Live Matches', href: '/live', icon: '📡' },
    { label: 'Leaderboard', href: '/leaderboard', icon: '🥇' },
    { label: 'Player Hub', href: '/dashboard', icon: '🎮' },
    { label: 'Organiser Hub', href: '/organiser', icon: '🛡️' },
    { label: 'Inbox', href: '/inbox', icon: '🔔' },
    { label: 'Rulebook & Trust', href: '/verify', icon: '📜' },
  ];

  return (
    <>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(12px)',
          backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          borderBottom: `1px solid ${theme === 'dark' ? '#1E293B' : '#E2E8F0'}`,
          padding: '0.75rem 1.25rem',
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
        aria-label="Main Navigation"
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* Brand Logo */}
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.875rem',
                letterSpacing: '1px',
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)',
              }}
            >
              VEXORA
            </div>
            <span
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
                letterSpacing: '-0.02em',
                display: 'inline-block',
              }}
            >
              ESPORTS
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div
            className="vx-desktop-nav"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {navLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    textDecoration: 'none',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: active ? 600 : 500,
                    color: active
                      ? (theme === 'dark' ? '#818CF8' : '#4F46E5')
                      : (theme === 'dark' ? '#94A3B8' : '#475569'),
                    backgroundColor: active
                      ? (theme === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)')
                      : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ marginRight: '0.35rem' }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Action Buttons & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle visual theme"
              style={{
                background: theme === 'dark' ? '#1E293B' : '#F1F5F9',
                border: `1px solid ${theme === 'dark' ? '#334155' : '#CBD5E1'}`,
                color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
                padding: '0.45rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.95rem',
                lineHeight: 1,
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Quick Admin Link */}
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: 'none',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#38BDF8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title="Open Vexora Admin Console"
            >
              <span>🔒</span> Admin
            </a>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="vx-mobile-toggle"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
              style={{
                background: theme === 'dark' ? '#1E293B' : '#F1F5F9',
                border: `1px solid ${theme === 'dark' ? '#334155' : '#CBD5E1'}`,
                color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                display: 'none',
              }}
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Drawer */}
        {mobileMenuOpen && (
          <div
            className="vx-mobile-drawer"
            style={{
              paddingTop: '1rem',
              marginTop: '0.75rem',
              borderTop: `1px solid ${theme === 'dark' ? '#1E293B' : '#E2E8F0'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {navLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    textDecoration: 'none',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: active ? 600 : 500,
                    color: active
                      ? (theme === 'dark' ? '#818CF8' : '#4F46E5')
                      : (theme === 'dark' ? '#F8FAFC' : '#0F172A'),
                    backgroundColor: active
                      ? (theme === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)')
                      : (theme === 'dark' ? '#111827' : '#F8FAFC'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}
