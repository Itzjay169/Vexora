import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Vulnerability Disclosure & Security | Vexora Esports',
  description: 'Vexora coordinated vulnerability disclosure policy, bug bounty guidelines, safe harbor, and RFC 9116 security contact.',
};

export default function SecurityPage() {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3rem 1.25rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '1rem', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
          <span>🛡️</span> ZERO-TRUST SECURITY ARCHITECTURE
        </div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--vx-text-primary, #F8FAFC)', margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>
          Vulnerability Disclosure & Trust Policy
        </h1>
        <p style={{ color: 'var(--vx-text-secondary, #94A3B8)', fontSize: '1rem', lineHeight: 1.6, margin: 0 }}>
          Vexora maintains an immutable, double-entry financial ledger and deterministic tournament execution. We welcome independent security researchers to audit our systems under coordinated disclosure guidelines.
        </p>
      </div>

      {/* RFC 9116 Quick Reference Card */}
      <div style={{ backgroundColor: 'var(--vx-surface-elevated, #131B2E)', border: '1px solid var(--vx-border, #334155)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38BDF8', margin: 0 }}>
            RFC 9116 Standard Disclosure Channels
          </h2>
          <a
            href="/.well-known/security.txt"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.75rem', fontWeight: 600, color: '#818CF8', textDecoration: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)' }}
          >
            View Raw security.txt ↗
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: 'var(--vx-text-muted, #64748B)', display: 'block', fontSize: '0.75rem' }}>Security Contact:</span>
            <code style={{ color: '#F8FAFC', fontWeight: 600 }}>security@vexora.gg</code>
          </div>
          <div>
            <span style={{ color: 'var(--vx-text-muted, #64748B)', display: 'block', fontSize: '0.75rem' }}>Grievance Officer (IT Rules):</span>
            <code style={{ color: '#F8FAFC', fontWeight: 600 }}>grievance-officer@vexora.gg</code>
          </div>
          <div>
            <span style={{ color: 'var(--vx-text-muted, #64748B)', display: 'block', fontSize: '0.75rem' }}>Preferred Languages:</span>
            <span style={{ color: '#F8FAFC' }}>English, Hindi, Odia</span>
          </div>
          <div>
            <span style={{ color: 'var(--vx-text-muted, #64748B)', display: 'block', fontSize: '0.75rem' }}>Encryption:</span>
            <span style={{ color: '#10B981' }}>PGP 4096-bit (Available on request)</span>
          </div>
        </div>
      </div>

      {/* Safe Harbor Policy */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--vx-text-primary, #F8FAFC)', marginBottom: '1rem' }}>
          Safe Harbor Guarantee
        </h2>
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '1.25rem', color: 'var(--vx-text-secondary, #94A3B8)', fontSize: '0.875rem', lineHeight: 1.6 }}>
          If you conduct research in good faith according to this policy, we will not initiate or support legal action against you under the Information Technology Act 2000 (India) or international computer misuse statutes. We consider activities conducted under this policy to be authorized.
        </div>
      </section>

      {/* Scope Table */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--vx-text-primary, #F8FAFC)', marginBottom: '1rem' }}>
          Assessment Scope
        </h2>
        <div className="vx-table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--vx-surface, #0F172A)', borderBottom: '1px solid var(--vx-border, #334155)' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--vx-text-primary, #F8FAFC)' }}>Target Surface</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--vx-text-primary, #F8FAFC)' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--vx-text-primary, #F8FAFC)' }}>Scope Specifics</th>
              </tr>
            </thead>
            <tbody style={{ color: 'var(--vx-text-secondary, #94A3B8)' }}>
              <tr style={{ borderBottom: '1px solid var(--vx-border-subtle, #1E293B)' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#F8FAFC' }}>Vexora REST API</td>
                <td style={{ padding: '0.75rem 1rem', color: '#10B981' }}>IN-SCOPE</td>
                <td style={{ padding: '0.75rem 1rem' }}>Auth, Double-Entry Ledger, Tournament States, Webhooks, RLS</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--vx-border-subtle, #1E293B)' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#F8FAFC' }}>Web Portal & Admin Console</td>
                <td style={{ padding: '0.75rem 1rem', color: '#10B981' }}>IN-SCOPE</td>
                <td style={{ padding: '0.75rem 1rem' }}>XSS, CSRF, IDOR, Session management, Role boundary enforcement</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--vx-border-subtle, #1E293B)' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#F8FAFC' }}>Android Native App</td>
                <td style={{ padding: '0.75rem 1rem', color: '#10B981' }}>IN-SCOPE</td>
                <td style={{ padding: '0.75rem 1rem' }}>Secure Storage, Certificate Pinning, Biometric bypass, Deep-link security</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#F8FAFC' }}>DDoS & Infrastructure Flooding</td>
                <td style={{ padding: '0.75rem 1rem', color: '#EF4444' }}>OUT-OF-SCOPE</td>
                <td style={{ padding: '0.75rem 1rem' }}>Volumetric layer 3/4 flooding, physical attacks, social engineering</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Remediation SLAs */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--vx-text-primary, #F8FAFC)', marginBottom: '1rem' }}>
          Vulnerability Response SLAs
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--vx-surface-elevated, #131B2E)', border: '1px solid var(--vx-border, #334155)', borderRadius: '10px', padding: '1rem' }}>
            <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '0.85rem' }}>Critical (CVSS 9.0–10.0)</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F8FAFC', margin: '0.25rem 0' }}>24 Hours</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--vx-text-muted, #64748B)' }}>Emergency fix & hotfix release</span>
          </div>
          <div style={{ backgroundColor: 'var(--vx-surface-elevated, #131B2E)', border: '1px solid var(--vx-border, #334155)', borderRadius: '10px', padding: '1rem' }}>
            <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.85rem' }}>High (CVSS 7.0–8.9)</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F8FAFC', margin: '0.25rem 0' }}>72 Hours</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--vx-text-muted, #64748B)' }}>Expedited patch validation</span>
          </div>
          <div style={{ backgroundColor: 'var(--vx-surface-elevated, #131B2E)', border: '1px solid var(--vx-border, #334155)', borderRadius: '10px', padding: '1rem' }}>
            <span style={{ color: '#38BDF8', fontWeight: 700, fontSize: '0.85rem' }}>Medium (CVSS 4.0–6.9)</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F8FAFC', margin: '0.25rem 0' }}>14 Days</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--vx-text-muted, #64748B)' }}>Sprint remediation window</span>
          </div>
        </div>
      </section>

      {/* Reporting Submission */}
      <section style={{ backgroundColor: 'var(--vx-surface, #0F172A)', border: '1px solid var(--vx-border, #334155)', borderRadius: '12px', padding: '1.75rem', textAlign: 'center' }}>
        <h3 style={{ color: '#F8FAFC', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Found a Vulnerability?</h3>
        <p style={{ color: 'var(--vx-text-secondary, #94A3B8)', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
          Please email a detailed report including reproduction steps, video evidence, and CVSS impact estimate to our security team.
        </p>
        <a
          href="mailto:security@vexora.gg?subject=Vulnerability%20Report%20-%20Vexora"
          style={{ display: 'inline-block', backgroundColor: '#6366F1', color: '#FFFFFF', padding: '0.65rem 1.5rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}
        >
          Submit Security Report
        </a>
      </section>
    </div>
  );
}
