import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const WEB_DIR = path.resolve('apps/web');

test('Web App Smoke: Next.js configuration and entry points exist', () => {
  assert.ok(fs.existsSync(path.join(WEB_DIR, 'package.json')), 'apps/web/package.json must exist');
  assert.ok(fs.existsSync(path.join(WEB_DIR, 'src/app/layout.tsx')), 'apps/web/src/app/layout.tsx must exist');
  assert.ok(fs.existsSync(path.join(WEB_DIR, 'src/app/page.tsx')), 'apps/web/src/app/page.tsx must exist');

  const pkg = JSON.parse(fs.readFileSync(path.join(WEB_DIR, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@vexora/web');
  assert.ok(pkg.dependencies.next, 'Next.js dependency must be declared');
  assert.ok(pkg.dependencies.react, 'React dependency must be declared');
});

test('Web App Smoke: Page content contains Vexora Esports branding', () => {
  const pageContent = fs.readFileSync(path.join(WEB_DIR, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageContent.includes('VEXORA ESPORTS'), 'Page must contain brand title');
  assert.ok(pageContent.includes('Verified Tournaments'), 'Page must display verified tournaments feature');
});
