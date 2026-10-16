import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ADMIN_DIR = path.resolve('apps/admin');

test('Admin App Smoke: Next.js admin configuration and console exist', () => {
  assert.ok(fs.existsSync(path.join(ADMIN_DIR, 'package.json')), 'apps/admin/package.json must exist');
  assert.ok(fs.existsSync(path.join(ADMIN_DIR, 'src/app/layout.tsx')), 'apps/admin/src/app/layout.tsx must exist');
  assert.ok(fs.existsSync(path.join(ADMIN_DIR, 'src/app/page.tsx')), 'apps/admin/src/app/page.tsx must exist');

  const pkg = JSON.parse(fs.readFileSync(path.join(ADMIN_DIR, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@vexora/admin');
  assert.ok(pkg.dependencies.next, 'Next.js dependency must be declared');
});

test('Admin App Smoke: Console implements Zero-Trust and Maker-Checker elements', () => {
  const pageContent = fs.readFileSync(path.join(ADMIN_DIR, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageContent.includes('VEXORA ADMIN'), 'Must display Vexora Admin header');
  assert.ok(pageContent.includes('Zero-Trust Console'), 'Must display zero-trust status');
  assert.ok(pageContent.includes('Maker-Checker'), 'Must feature Maker-Checker authorization queue');
  assert.ok(pageContent.includes('Audit Hash Chain'), 'Must monitor audit hash chain integrity');
});
