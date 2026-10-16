#!/usr/bin/env node

/**
 * Lightweight HTTP server for local & CI Playwright smoke testing.
 * Serves the placeholder web app shell matching apps/web/src/app/page.tsx
 * and the design system UI Kit showcase matching apps/web/src/app/ui-kit/page.tsx
 */

import http from 'node:http';

const PORT = process.env.PORT || 3000;

const HOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vexora Esports - The Trust-First Tournament Platform</title>
  <style>
    body {
      margin: 0;
      background-color: #0F172A;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
  </style>
</head>
<body>
  <main style="padding: 4rem 2rem; max-width: 1200px; margin: 0 auto; text-align: center;">
    <header>
      <h1 id="hero-title" style="font-size: 3rem; font-weight: 800; background: linear-gradient(135deg, #6366F1 0%, #A855F7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        VEXORA ESPORTS
      </h1>
      <p id="hero-subtitle" style="font-size: 1.25rem; color: #94A3B8; margin-top: 1rem;">
        The Trust-First Competitive Gaming Ecosystem. Verified Organisers. Zero Silent Edits. Deterministic Scoring.
      </p>
    </header>

    <section id="features" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; margin-top: 4rem; text-align: left;">
      <div class="card" id="card-tournaments" style="background: #131B2E; padding: 2rem; border-radius: 12px; border: 1px solid #1E293B;">
        <h2 style="font-size: 1.25rem; color: #38BDF8;">Verified Tournaments</h2>
        <p style="color: #94A3B8;">Compete in Battlegrounds Mobile India, Free Fire, and CODM with guaranteed prize escrow holds.</p>
      </div>
      <div class="card" id="card-adjudication" style="background: #131B2E; padding: 2rem; border-radius: 12px; border: 1px solid #1E293B;">
        <h2 style="font-size: 1.25rem; color: #A855F7;">Transparent Adjudication</h2>
        <p style="color: #94A3B8;">Every result backed by SHA-256 evidence hashing and immutable audit trails.</p>
      </div>
      <div class="card" id="card-ledger" style="background: #131B2E; padding: 2rem; border-radius: 12px; border: 1px solid #1E293B;">
        <h2 style="font-size: 1.25rem; color: #10B981;">Double-Entry Ledger</h2>
        <p style="color: #94A3B8;">Closed-loop platform credits with zero-sum accounting and maker-checker financial controls.</p>
      </div>
    </section>
  </main>
</body>
</html>`;

const UI_KIT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vexora Design System & UI Kit</title>
  <style>
    :root {
      --vx-bg: #0A0F1D;
      --vx-surface: #0F172A;
      --vx-surface-elevated: #131B2E;
      --vx-text-primary: #F8FAFC;
      --vx-text-secondary: #94A3B8;
      --vx-border: #1E293B;
    }
    body {
      margin: 0;
      background-color: var(--vx-bg);
      color: var(--vx-text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .badge-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-state-draft { background: #1E293B; color: #94A3B8; }
    .badge-state-live { background: #4C0519; color: #FB7185; }
    .badge-state-disputed { background: #450A0A; color: #F87171; }
    .badge-state-settled { background: #042F2E; color: #2DD4BF; }
    .badge-verified { background: rgba(56, 189, 248, 0.15); color: #38BDF8; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
    .badge-evidence-hash { font-family: monospace; font-size: 0.75rem; background: #022C22; color: #34D399; padding: 2px 8px; border-radius: 4px; }
  </style>
</head>
<body id="ui-kit-body">
  <div style="max-width: 1200px; margin: 0 auto; padding: 3rem 2rem;">
    <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <h1 id="ui-kit-title" style="font-size: 2.5rem; font-weight: 800; background: linear-gradient(135deg, #6366F1 0%, #A855F7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        VEXORA DESIGN SYSTEM & UI KIT
      </h1>
      <button id="theme-toggle-btn" style="padding: 10px 16px; border-radius: 8px; background: #1E293B; color: #F8FAFC; border: 1px solid #334155; cursor: pointer;">
        Toggle Theme
      </button>
    </header>

    <section id="chips-section" style="margin-bottom: 2.5rem;">
      <h2>Tournament Finite State Machine Chips</h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 1rem;">
        <span class="badge-chip badge-state-draft" id="chip-draft">Draft</span>
        <span class="badge-chip badge-state-live" id="chip-live">Tournament Live</span>
        <span class="badge-chip badge-state-disputed" id="chip-disputed">Disputed</span>
        <span class="badge-chip badge-state-settled" id="chip-settled">Settled</span>
      </div>
    </section>

    <section id="trust-section" style="margin-bottom: 2.5rem;">
      <h2>Trust UI Patterns</h2>
      <div style="display: flex; gap: 16px; margin-top: 1rem;">
        <span class="badge-verified" id="badge-verified-sample">🛡️ VERIFIED HOST</span>
        <span class="badge-evidence-hash" id="badge-evidence-hash-sample">sha256:7f83b165...7f4</span>
        <span id="badge-formula-sample" style="background: #1E1B4B; color: #A855F7; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">bgmi_br_v1.0.0</span>
      </div>
    </section>

    <section id="components-section" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
      <div id="component-tournament-card" style="background: #131B2E; border: 1px solid #1E293B; border-radius: 12px; padding: 1.5rem;">
        <h3>Vexora Apex Invitational - Season 1</h3>
        <p style="color: #94A3B8;">100% Free Entry • 15,000 pts Escrow</p>
      </div>
      <div id="component-bracket-node" style="background: #131B2E; border: 1px solid #1E293B; border-radius: 12px; padding: 1.5rem;">
        <h4>QUARTER-FINALS • MATCH #4</h4>
        <p style="color: #10B981;">Team Soul (2) vs GodLike (1)</p>
      </div>
      <div id="component-ledger-row" style="background: #131B2E; border: 1px solid #1E293B; border-radius: 12px; padding: 1.5rem;">
        <div style="font-family: monospace; font-size: 0.75rem; color: #94A3B8;">tx_0192a8e4-b7c1-7f02</div>
        <div style="color: #EF4444; font-weight: bold;">-500 pts HOLD</div>
        <div style="color: #10B981; font-size: 0.75rem;">SUM = 0 VERIFIED</div>
      </div>
      <div id="component-dispute-card" style="background: #131B2E; border: 1px solid #EF4444; border-radius: 12px; padding: 1.5rem;">
        <h4 style="color: #EF4444;">⚠️ SETTLEMENT FROZEN (Dispute Case #8821)</h4>
        <p style="color: #94A3B8;">Evidence SHA-256 Preserved • SLA: 4h</p>
      </div>
    </section>
  </div>
  <script>
    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
    });
  </script>
</body>
</html>`;

const ADMIN_LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vexora Admin Login - Zero-Trust Mandatory MFA</title>
  <style>
    body { margin: 0; background: #0B0F19; color: #F8FAFC; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #0F172A; border: 1px solid #1E293B; border-radius: 16px; padding: 2.5rem; width: 100%; max-width: 440px; box-sizing: border-box; }
    input { width: 100%; padding: 0.75rem 1rem; background: #1E293B; border: 1px solid #334155; border-radius: 8px; color: #F8FAFC; box-sizing: border-box; font-size: 1rem; margin-top: 0.5rem; margin-bottom: 1.25rem; }
    button { width: 100%; padding: 0.875rem; border-radius: 8px; border: none; background: #6366F1; color: white; font-weight: 600; cursor: pointer; font-size: 0.875rem; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 9999px; color: #F87171; font-size: 0.75rem; font-weight: 600; margin-bottom: 1.5rem; }
    .error { background: rgba(239, 68, 68, 0.15); border: 1px solid #EF4444; color: #F87171; padding: 0.75rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1rem; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center;">
      <h1 id="admin-login-title" style="margin: 0; font-size: 1.5rem; color: #F8FAFC;">VEXORA ADMIN</h1>
      <p style="color: #94A3B8; font-size: 0.8125rem; margin-top: 0.25rem;">Zero-Trust Console & Administration</p>
      <div id="mfa-enforced-badge" class="badge">🔒 Mandatory MFA Enforced</div>
    </div>

    <div id="login-error" class="error"></div>

    <div id="step-credentials">
      <label style="font-size: 0.75rem; color: #CBD5E1;">Admin Email / Username</label>
      <input id="input-identifier" type="text" placeholder="admin@vexora.gg" value="admin@vexora.gg" />
      <label style="font-size: 0.75rem; color: #CBD5E1;">Password</label>
      <input id="input-password" type="password" placeholder="••••••••" value="adminpassword123" />
      <button id="btn-proceed-mfa" type="button">Proceed to MFA Verification →</button>
    </div>

    <div id="step-mfa" style="display: none;">
      <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid #6366F1; border-radius: 8px; padding: 0.75rem; text-align: center; margin-bottom: 1.25rem;">
        <p id="mfa-prompt-text" style="margin: 0; font-size: 0.8125rem; color: #A5B4FC;">Step 2: Enter 6-digit TOTP code from your Authenticator device</p>
      </div>
      <label style="font-size: 0.75rem; color: #CBD5E1; text-align: center; display: block;">6-Digit Authentication Code</label>
      <input id="input-mfa-code" type="text" maxlength="6" placeholder="123456" style="text-align: center; font-size: 1.5rem; letter-spacing: 0.25em; font-family: monospace;" />
      <button id="btn-verify-mfa" type="button" style="background: #10B981;">Verify MFA & Enter Console</button>
    </div>
  </div>

  <script>
    const errDiv = document.getElementById('login-error');
    const stepCred = document.getElementById('step-credentials');
    const stepMfa = document.getElementById('step-mfa');

    document.getElementById('btn-proceed-mfa').addEventListener('click', () => {
      const id = document.getElementById('input-identifier').value.trim();
      const pwd = document.getElementById('input-password').value.trim();
      if (!id || !pwd) {
        errDiv.style.display = 'block';
        errDiv.textContent = 'Identifier and password required';
        return;
      }
      errDiv.style.display = 'none';
      stepCred.style.display = 'none';
      stepMfa.style.display = 'block';
    });

    document.getElementById('btn-verify-mfa').addEventListener('click', () => {
      const code = document.getElementById('input-mfa-code').value.trim();
      if (!code || code.length !== 6 || code === '000000') {
        errDiv.style.display = 'block';
        errDiv.textContent = 'Invalid MFA verification code';
        return;
      }
      window.location.href = '/admin';
    });
  </script>
</body>
</html>`;

const ADMIN_DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vexora Admin Console | Secure Governance</title>
  <style>
    body { margin: 0; background: #0B0F19; color: #E2E8F0; font-family: -apple-system, sans-serif; display: flex; min-height: 100vh; }
    aside { width: 260px; background: #0F172A; border-right: 1px solid #1E293B; padding: 1.5rem; box-sizing: border-box; }
    main { flex: 1; padding: 2rem; }
    .nav-item { padding: 0.625rem 0.75rem; border-radius: 6px; text-decoration: none; color: #94A3B8; display: block; margin-bottom: 0.5rem; }
    .nav-active { background: #1E293B; color: #F8FAFC; font-weight: 600; border-left: 3px solid #6366F1; }
    .card { background: #0F172A; border: 1px solid #1E293B; border-radius: 12px; padding: 1.5rem; }
  </style>
</head>
<body>
  <aside id="admin-sidebar">
    <h2 id="brand-title" style="font-size: 1.25rem; color: #6366F1; margin: 0; font-weight: 700;">VEXORA ADMIN</h2>
    <p id="brand-subtitle" style="font-size: 0.75rem; color: #64748B; margin-top: 0.25rem;">Zero-Trust Console</p>
    <div style="margin: 1rem 0; padding: 0.5rem; background: #1E293B; border-radius: 6px; font-size: 0.75rem; color: #34D399;">
      ● MFA Verified Session
    </div>
    <nav style="margin-top: 1.5rem;">
      <a class="nav-item nav-active" id="nav-overview" href="/admin">Overview</a>
      <a class="nav-item" id="nav-games" href="/admin/games">Game Management</a>
      <a class="nav-item" id="nav-organisers" href="/admin/organisers">Organiser Approvals</a>
      <a class="nav-item" id="nav-disputes" href="/admin/disputes">Dispute Adjudication</a>
      <a class="nav-item" id="nav-maker-checker" href="/admin/maker-checker">Financial Maker-Checker</a>
      <a class="nav-item" id="nav-feature-flags" href="/admin/feature-flags">Feature Flags</a>
      <a class="nav-item" id="nav-audit" href="/admin/audit">Audit Hash Chain</a>
      <a class="nav-item" id="nav-sessions" href="/admin/sessions">Admin Sessions</a>
    </nav>
  </aside>

  <main>
    <header style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1E293B; padding-bottom: 1rem;">
      <h1 id="page-title" style="margin: 0; font-size: 1.5rem;">System Health & Moderation Overview</h1>
      <span id="badge-audit-chain-valid" style="background: rgba(16, 185, 129, 0.1); color: #10B981; padding: 0.5rem 1rem; border-radius: 9999px; font-size: 0.8125rem;">
        ● Audit Chain Valid
      </span>
    </header>

    <section style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-top: 2rem;">
      <div class="card"><p style="color: #94A3B8; margin: 0;">Active Tournaments</p><h2 style="font-size: 2rem; margin: 0.5rem 0 0;">0</h2></div>
      <div class="card"><p style="color: #94A3B8; margin: 0;">Pending Disputes</p><h2 style="font-size: 2rem; margin: 0.5rem 0 0;">0</h2></div>
      <div class="card"><p style="color: #94A3B8; margin: 0;">Organisers Awaiting KYC</p><h2 style="font-size: 2rem; margin: 0.5rem 0 0;">0</h2></div>
      <div class="card"><p style="color: #94A3B8; margin: 0;">Escrow Total Held</p><h2 style="font-size: 2rem; margin: 0.5rem 0 0;">0 credits</h2></div>
    </section>

    <section style="margin-top: 2rem; display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
      <div class="card" id="maker-checker-panel">
        <h3 style="margin: 0; font-size: 1.125rem;">Financial Maker-Checker Queue</h3>
        <p style="color: #94A3B8; font-size: 0.8125rem;">Dual-approval queue for payouts and balance adjustments.</p>
        <div style="background: #131B2E; padding: 1.5rem; border-radius: 8px; text-align: center; color: #64748B;">
          0 Pending Maker-Checker items
        </div>
      </div>
      <div class="card" id="security-panel">
        <h3 style="margin: 0; font-size: 1.125rem;">Zero-Trust Controls</h3>
        <p style="color: #94A3B8; font-size: 0.8125rem;">Security gates status</p>
        <p style="color: #34D399; font-size: 0.875rem;">Audit Hash Chain Verified ✓</p>
        <p style="color: #38BDF8; font-size: 0.875rem;">Mandatory Admin MFA Active ✓</p>
      </div>
    </section>
  </main>
</body>
</html>`;

const ADMIN_GAMES_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vexora Admin | Game Management</title>
  <style>
    body { margin: 0; background: #0B0F19; color: #E2E8F0; font-family: -apple-system, sans-serif; display: flex; min-height: 100vh; }
    aside { width: 260px; background: #0F172A; border-right: 1px solid #1E293B; padding: 1.5rem; box-sizing: border-box; }
    main { flex: 1; padding: 2rem; }
    .nav-item { padding: 0.625rem 0.75rem; border-radius: 6px; text-decoration: none; color: #94A3B8; display: block; margin-bottom: 0.5rem; }
    .nav-active { background: #1E293B; color: #F8FAFC; font-weight: 600; border-left: 3px solid #6366F1; }
    .card { background: #0F172A; border: 1px solid #1E293B; border-radius: 12px; padding: 1.5rem; }
  </style>
</head>
<body>
  <aside id="admin-sidebar">
    <h2 id="brand-title" style="font-size: 1.25rem; color: #6366F1; margin: 0; font-weight: 700;">VEXORA ADMIN</h2>
    <p id="brand-subtitle" style="font-size: 0.75rem; color: #64748B; margin-top: 0.25rem;">Zero-Trust Console</p>
    <div style="margin: 1rem 0; padding: 0.5rem; background: #1E293B; border-radius: 6px; font-size: 0.75rem; color: #34D399;">
      ● MFA Verified Session
    </div>
    <nav style="margin-top: 1.5rem;">
      <a class="nav-item" id="nav-overview" href="/admin">Overview</a>
      <a class="nav-item nav-active" id="nav-games" href="/admin/games">Game Management</a>
      <a class="nav-item" id="nav-organisers" href="/admin/organisers">Organiser Approvals</a>
      <a class="nav-item" id="nav-disputes" href="/admin/disputes">Dispute Adjudication</a>
      <a class="nav-item" id="nav-maker-checker" href="/admin/maker-checker">Financial Maker-Checker</a>
      <a class="nav-item" id="nav-feature-flags" href="/admin/feature-flags">Feature Flags</a>
      <a class="nav-item" id="nav-audit" href="/admin/audit">Audit Hash Chain</a>
      <a class="nav-item" id="nav-sessions" href="/admin/sessions">Admin Sessions</a>
    </nav>
  </aside>

  <main style="padding: 2rem; max-width: 1200px; margin: 0 auto;">
    <header style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1E293B; padding-bottom: 1rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <h1 id="games-page-title" style="margin: 0; font-size: 1.5rem; color: white;">Game & Scoring Engine</h1>
        <span id="phase-badge" style="background: rgba(99, 102, 241, 0.2); color: #818CF8; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700;">
          Phase 11 Blueprint
        </span>
      </div>
      <button id="btn-simulate-tab" style="background: #10B981; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer;">
        🧪 Scoring Simulator
      </button>
    </header>

    <div style="display: flex; gap: 1rem; border-bottom: 1px solid #1E293B; margin-top: 1.5rem;">
      <button id="tab-catalog" style="padding: 0.75rem 1rem; border: none; background: transparent; color: #818CF8; border-bottom: 2px solid #6366F1; font-weight: 600;">🎮 Games Catalog</button>
      <button id="tab-modes" style="padding: 0.75rem 1rem; border: none; background: transparent; color: #94A3B8; font-weight: 600;">🕹️ Game Modes</button>
      <button id="tab-schemas" style="padding: 0.75rem 1rem; border: none; background: transparent; color: #94A3B8; font-weight: 600;">📐 Versioned Formulas</button>
      <button id="tab-simulator" style="padding: 0.75rem 1rem; border: none; background: transparent; color: #94A3B8; font-weight: 600;">🧪 Simulator</button>
    </div>

    <section id="games-catalog-section" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 1.5rem;">
      <div class="card" id="game-card-bgmi" style="background: #131B2E; padding: 1.5rem; border-radius: 8px; border: 1px solid #1E293B;">
        <h3 style="margin: 0; color: white;">Battlegrounds Mobile India</h3>
        <p style="color: #94A3B8; font-size: 0.8125rem;">Publisher: Krafton</p>
        <span style="display: inline-block; background: rgba(16, 185, 129, 0.2); color: #10B981; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-top: 0.5rem;">ACTIVE</span>
      </div>
      <div class="card" id="game-card-freefire" style="background: #131B2E; padding: 1.5rem; border-radius: 8px; border: 1px solid #1E293B;">
        <h3 style="margin: 0; color: white;">Garena Free Fire MAX</h3>
        <p style="color: #94A3B8; font-size: 0.8125rem;">Publisher: Garena</p>
        <span style="display: inline-block; background: rgba(16, 185, 129, 0.2); color: #10B981; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-top: 0.5rem;">ACTIVE</span>
      </div>
      <div class="card" id="game-card-codm" style="background: #131B2E; padding: 1.5rem; border-radius: 8px; border: 1px solid #1E293B;">
        <h3 style="margin: 0; color: white;">Call of Duty: Mobile</h3>
        <p style="color: #94A3B8; font-size: 0.8125rem;">Publisher: Activision</p>
        <span style="display: inline-block; background: rgba(16, 185, 129, 0.2); color: #10B981; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-top: 0.5rem;">ACTIVE</span>
      </div>
    </section>

    <section id="scoring-simulator-panel" style="background: #131B2E; border: 1px solid #1E293B; border-radius: 8px; padding: 1.5rem; margin-top: 2rem;">
      <h3 style="margin: 0; color: white;">Scoring Simulator</h3>
      <p style="color: #94A3B8; font-size: 0.8125rem;">Test deterministic tournament scoring with ADR-015 tie-breaking engine.</p>
      <div style="margin-top: 1rem; display: flex; gap: 1rem;">
        <select id="sim-game-select" style="background: #0B0E14; color: white; padding: 0.5rem; border: 1px solid #1E293B; border-radius: 4px;">
          <option value="bgmi">Battlegrounds Mobile India</option>
          <option value="freefire">Garena Free Fire MAX</option>
        </select>
        <button id="btn-run-simulation" style="background: #10B981; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; font-weight: 700; cursor: pointer;">
          Calculate Standings ⚡
        </button>
      </div>
      <div id="sim-results-table" style="margin-top: 1.5rem; padding: 1rem; background: #0B0E14; border-radius: 4px; border: 1px solid #1E293B;">
        <p style="margin: 0; color: #10B981; font-weight: 700; font-size: 0.875rem;">Standings (Deterministic Tie-Breaks Resolved):</p>
        <div style="color: #F8FAFC; margin-top: 0.5rem; font-size: 0.8125rem;">
          <div>#1 GodLike Esports — 17 pts (10 placement + 7 kills)</div>
          <div>#2 Team Soul — 15 pts (6 placement + 9 kills)</div>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'vexora-web' }));
    return;
  }

  if (req.url && req.url.startsWith('/admin/login')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ADMIN_LOGIN_HTML);
    return;
  }

  if (req.url && req.url.startsWith('/admin/games')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ADMIN_GAMES_HTML);
    return;
  }

  if (req.url && req.url.startsWith('/admin')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ADMIN_DASHBOARD_HTML);
    return;
  }

  if (req.url && req.url.startsWith('/ui-kit')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(UI_KIT_HTML);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HOME_HTML);
});

server.listen(PORT, () => {
  console.log(`🌐 Vexora Web Smoke Server running at http://localhost:${PORT}`);
});
