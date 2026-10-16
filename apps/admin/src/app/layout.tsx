import React from 'react';
import './globals.css';
import { Providers } from '../components/Providers';

export const metadata = {
  title: 'Vexora Admin Console | Secure Governance & Adjudication',
  description: 'Desktop-first administration console with strict RBAC, mandatory MFA, and Maker-Checker authorization.',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ margin: 0, backgroundColor: '#0B0F19', color: '#E2E8F0', fontFamily: 'Inter, sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
