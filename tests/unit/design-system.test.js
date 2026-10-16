import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Design System: Tokens package defines complete brand, theme, and 11 state chips', () => {
  const tokensPath = path.join(ROOT, 'packages/design-tokens/tokens.json');
  assert.ok(fs.existsSync(tokensPath), 'packages/design-tokens/tokens.json must exist');

  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

  // Brand tokens
  assert.equal(tokens.brand.name, 'Vexora');
  assert.ok(tokens.brand.primary, 'Primary brand color must exist');
  assert.ok(tokens.brand.secondary, 'Secondary brand color must exist');

  // Themes
  assert.ok(tokens.theme.dark, 'Dark theme tokens must be defined');
  assert.ok(tokens.theme.light, 'Light theme tokens must be defined');
  assert.equal(tokens.theme.dark.bg, '#0A0F1D', 'Obsidian navy dark background');

  // 11 Tournament States
  const expectedStates = [
    'DRAFT', 'PENDING_REVIEW', 'SCHEDULED', 'REGISTRATION_OPEN',
    'CHECK_IN', 'LIVE', 'RESULT_PENDING', 'DISPUTED',
    'COMPLETED', 'SETTLED', 'ARCHIVED'
  ];

  for (const st of expectedStates) {
    assert.ok(tokens.stateMachine[st], `Missing state machine token for ${st}`);
    assert.ok(tokens.stateMachine[st].color, `Missing color for state ${st}`);
  }

  // Trust Tokens
  assert.ok(tokens.trust.verifiedBadge, 'Verified badge token required');
  assert.ok(tokens.trust.hashCheckTick, 'Hash check tick token required');
});

test('Design System: Web and Admin stylesheets import design token variables', () => {
  const webCss = fs.readFileSync(path.join(ROOT, 'apps/web/src/app/globals.css'), 'utf8');
  const adminCss = fs.readFileSync(path.join(ROOT, 'apps/admin/src/app/globals.css'), 'utf8');

  assert.ok(webCss.includes('--vx-brand-primary'), 'Web CSS must define --vx-brand-primary');
  assert.ok(webCss.includes('.badge-state-live'), 'Web CSS must include live state badge class');
  assert.ok(adminCss.includes('--vx-status-pending'), 'Admin CSS must define maker-checker tokens');
});

test('Design System: Flutter ThemeData exports match design tokens', () => {
  const flutterThemePath = path.join(ROOT, 'apps/mobile/lib/theme/vexora_theme.dart');
  assert.ok(fs.existsSync(flutterThemePath), 'Flutter theme file must exist');

  const content = fs.readFileSync(flutterThemePath, 'utf8');
  assert.ok(content.includes('class VexoraColors'), 'Must define VexoraColors');
  assert.ok(content.includes('class VexoraTheme'), 'Must define VexoraTheme');
  assert.ok(content.includes('darkTheme'), 'Must export darkTheme');
  assert.ok(content.includes('lightTheme'), 'Must export lightTheme');
});
