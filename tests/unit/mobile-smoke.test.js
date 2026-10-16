import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const MOBILE_DIR = path.resolve('apps/mobile');

test('Mobile App Smoke: Flutter project configuration exists and has lint rules', () => {
  const pubspecPath = path.join(MOBILE_DIR, 'pubspec.yaml');
  const analysisOptionsPath = path.join(MOBILE_DIR, 'analysis_options.yaml');

  assert.ok(fs.existsSync(pubspecPath), 'apps/mobile/pubspec.yaml must exist');
  assert.ok(fs.existsSync(analysisOptionsPath), 'apps/mobile/analysis_options.yaml must exist');

  const pubspecContent = fs.readFileSync(pubspecPath, 'utf8');
  assert.ok(pubspecContent.includes('name: vexora_mobile'), 'App name must be vexora_mobile');
  assert.ok(pubspecContent.includes('flutter_lints'), 'Must declare flutter_lints dev dependency');
  assert.ok(pubspecContent.includes('firebase_auth'), 'Must declare firebase_auth dependency');
  assert.ok(pubspecContent.includes('firebase_messaging'), 'Must declare firebase_messaging dependency');
});

test('Mobile App Smoke: Main entry point and smoke widget test exist', () => {
  const mainDartPath = path.join(MOBILE_DIR, 'lib/main.dart');
  const widgetTestPath = path.join(MOBILE_DIR, 'test/widget_test.dart');

  assert.ok(fs.existsSync(mainDartPath), 'apps/mobile/lib/main.dart must exist');
  assert.ok(fs.existsSync(widgetTestPath), 'apps/mobile/test/widget_test.dart must exist');

  const mainContent = fs.readFileSync(mainDartPath, 'utf8');
  assert.ok(mainContent.includes('class VexoraApp extends StatelessWidget'), 'Must define VexoraApp');
  assert.ok(mainContent.includes('Brightness.dark'), 'Must default to dark theme');
  assert.ok(mainContent.includes('0xFF6366F1'), 'Must use Vexora Electric Indigo brand color');

  const testContent = fs.readFileSync(widgetTestPath, 'utf8');
  assert.ok(testContent.includes('testWidgets'), 'Must contain widget test');
  assert.ok(testContent.includes('VexoraApp'), 'Must test VexoraApp widget');
});
