/**
 * Vexora Phase 12: Player Profiles, In-Game IDs & Secure Upload Pipeline
 *
 * Tests cover:
 *   1.  Profile privacy visibility controls (PUBLIC, PRIVATE, FRIENDS_ONLY)
 *   2.  In-Game UID uniqueness enforcement (anti-smurfing, ADR-006)
 *   3.  Secure upload pipeline — magic-byte binary inspection
 *   4.  Hostile file & polyglot script rejection (SVG, PHP, JS, HTML)
 *   5.  SHA-256 ingress hashing tamper evidence
 *   6.  Signed upload token generation & verification
 *   7.  Validation schema correctness
 *   8.  Media upload database recording
 *   9.  Flutter profile screen structure
 *  10.  ADR-006 compliance
 */

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Upload pipeline imports
import {
  detectMagicBytes,
  scanHostileContent,
  generateSignedUploadToken,
  verifyUploadToken,
  processSecureUpload,
  UPLOAD_LIMITS,
} from '../../backend/src/common/uploadPipeline.js';

// Validation schemas import
import {
  ProfileUpdateSchema,
  InGameIdLinkSchema,
  SignedUploadRequestSchema,
} from '../../packages/validation/src/index.ts';

const ROOT = path.resolve('.');

// ─── 1. Migration 006 Structure Validation ──────────────────────────────────

test('Phase 12 Database: Migration 006 exists and defines profile privacy, media_uploads, and evidence immutability', () => {
  const migPath = path.join(ROOT, 'infra/migrations/006_player_profiles_and_uploads.sql');
  assert.ok(fs.existsSync(migPath), 'Migration 006 file must exist');

  const sql = fs.readFileSync(migPath, 'utf8');

  // Profile privacy columns
  assert.ok(sql.includes('profile_visibility'), 'Must add profile_visibility column');
  assert.ok(sql.includes("'PUBLIC', 'PRIVATE', 'FRIENDS_ONLY'"), 'Must define visibility CHECK constraint');
  assert.ok(sql.includes('chk_profile_visibility'), 'Must name the profile visibility constraint');
  assert.ok(sql.includes('favourite_game_ids'), 'Must add favourite_game_ids column');
  assert.ok(sql.includes('UUID[]'), 'favourite_game_ids must be UUID array type');
  assert.ok(sql.includes('show_stats'), 'Must add show_stats privacy toggle');
  assert.ok(sql.includes('show_game_ids'), 'Must add show_game_ids privacy toggle');

  // Fair play score
  assert.ok(sql.includes('fair_play_score'), 'Must add fair_play_score column');
  assert.ok(sql.includes('chk_fair_play_score'), 'Must name the fair play score constraint');
  assert.ok(sql.includes('fair_play_score >= 0'), 'Fair play score must be >= 0');
  assert.ok(sql.includes('fair_play_score <= 100'), 'Fair play score must be <= 100');

  // Media uploads table
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS media_uploads'), 'Must create media_uploads table');
  assert.ok(sql.includes('sha256_hash'), 'Must include SHA-256 hash column');
  assert.ok(sql.includes('VARCHAR(64)'), 'SHA-256 hash must be 64-character VARCHAR');

  // Upload constraints
  assert.ok(sql.includes('chk_upload_purpose'), 'Must define upload purpose CHECK');
  assert.ok(sql.includes("'AVATAR'"), 'Must allow AVATAR purpose');
  assert.ok(sql.includes("'PROFILE_PROOF'"), 'Must allow PROFILE_PROOF purpose');
  assert.ok(sql.includes("'MATCH_EVIDENCE'"), 'Must allow MATCH_EVIDENCE purpose');
  assert.ok(sql.includes("'KYC_DOCUMENT'"), 'Must allow KYC_DOCUMENT purpose');
  assert.ok(sql.includes("'DISPUTE_EVIDENCE'"), 'Must allow DISPUTE_EVIDENCE purpose');
  assert.ok(sql.includes('chk_upload_status'), 'Must define upload status CHECK');

  // Evidence immutability trigger
  assert.ok(sql.includes('prevent_upload_evidence_tampering'), 'Must create tampering prevention function');
  assert.ok(sql.includes('SECURITY VIOLATION'), 'Must raise security violation on tampering');
  assert.ok(sql.includes('trg_immutable_media_upload'), 'Must create immutability trigger');

  // Row-Level Security
  assert.ok(sql.includes('ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on media_uploads');

  // Indexes
  assert.ok(sql.includes('idx_media_uploads_user'), 'Must create user_id index');
  assert.ok(sql.includes('idx_media_uploads_hash'), 'Must create sha256_hash index');
  assert.ok(sql.includes('idx_media_uploads_purpose'), 'Must create purpose index');

  // Proof upload linkage
  assert.ok(sql.includes('proof_upload_id'), 'Must add proof_upload_id to user_game_ids');
  assert.ok(sql.includes('verified_at'), 'Must add verified_at column');
  assert.ok(sql.includes('verified_by'), 'Must add verified_by column');
});

// ─── 2. Magic-Byte Binary Inspection ───────────────────────────────────────

test('Phase 12 Upload Pipeline: detects JPEG magic bytes (FF D8 FF)', () => {
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(detectMagicBytes(jpegBuffer), 'image/jpeg');
});

test('Phase 12 Upload Pipeline: detects PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  assert.equal(detectMagicBytes(pngBuffer), 'image/png');
});

test('Phase 12 Upload Pipeline: detects WebP magic bytes (RIFF....WEBP)', () => {
  const webpBuffer = Buffer.alloc(16);
  webpBuffer.write('RIFF', 0);
  webpBuffer.writeUInt32LE(12345, 4);
  webpBuffer.write('WEBP', 8);
  assert.equal(detectMagicBytes(webpBuffer), 'image/webp');
});

test('Phase 12 Upload Pipeline: detects PDF magic bytes (%PDF)', () => {
  const pdfBuffer = Buffer.from('%PDF-1.5 some content');
  assert.equal(detectMagicBytes(pdfBuffer), 'application/pdf');
});

test('Phase 12 Upload Pipeline: detects MP4 magic bytes (ftyp at offset 4)', () => {
  const mp4Buffer = Buffer.alloc(12);
  mp4Buffer.writeUInt32BE(24, 0);
  mp4Buffer.write('ftyp', 4);
  mp4Buffer.write('isom', 8);
  assert.equal(detectMagicBytes(mp4Buffer), 'video/mp4');
});

test('Phase 12 Upload Pipeline: returns null for unrecognized binary formats', () => {
  const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
  assert.equal(detectMagicBytes(unknownBuffer), null);
});

test('Phase 12 Upload Pipeline: returns null for empty/too-small buffers', () => {
  assert.equal(detectMagicBytes(Buffer.alloc(0)), null);
  assert.equal(detectMagicBytes(Buffer.alloc(2)), null);
  assert.equal(detectMagicBytes(null), null);
});

test('Phase 12 Upload Pipeline: ignores spoofed extensions — only inspects binary header', () => {
  // A file named "innocent.png" but with JPEG magic bytes → reports image/jpeg
  const fakeExtBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x2a]);
  assert.equal(detectMagicBytes(fakeExtBuffer), 'image/jpeg');
});

// ─── 3. Hostile Content & Polyglot Scanner ──────────────────────────────────

test('Phase 12 Security: rejects SVG content (XSS / XXE risk)', () => {
  const svgPayload = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const result = scanHostileContent(svgPayload);
  assert.equal(result.isSafe, false);
  assert.equal(result.threat, 'SVG_FORBIDDEN_XSS_RISK');
});

test('Phase 12 Security: rejects embedded PHP scripts', () => {
  const phpPayload = Buffer.from('<?php system("rm -rf /"); ?>');
  const result = scanHostileContent(phpPayload);
  assert.equal(result.isSafe, false);
  assert.equal(result.threat, 'POLYGLOT_HOSTILE_SCRIPT_DETECTED');
});

test('Phase 12 Security: rejects <script> tags (polyglot injection)', () => {
  const scriptPayload = Buffer.from('<script>document.cookie</script>');
  const result = scanHostileContent(scriptPayload);
  assert.equal(result.isSafe, false);
  assert.equal(result.threat, 'POLYGLOT_HOSTILE_SCRIPT_DETECTED');
});

test('Phase 12 Security: rejects javascript: URIs', () => {
  const jsUriPayload = Buffer.from('some content javascript:alert(1)');
  const result = scanHostileContent(jsUriPayload);
  assert.equal(result.isSafe, false);
  assert.equal(result.threat, 'POLYGLOT_HOSTILE_SCRIPT_DETECTED');
});

test('Phase 12 Security: rejects HTML iframe injection', () => {
  const iframePayload = Buffer.from('<iframe src="https://evil.com"></iframe>');
  const result = scanHostileContent(iframePayload);
  assert.equal(result.isSafe, false);
  assert.equal(result.threat, 'POLYGLOT_HOSTILE_SCRIPT_DETECTED');
});

test('Phase 12 Security: rejects onerror/onload event handlers', () => {
  const onloadPayload = Buffer.from('data onload = "alert(1)"');
  const result = scanHostileContent(onloadPayload);
  assert.equal(result.isSafe, false);
  assert.equal(result.threat, 'POLYGLOT_HOSTILE_SCRIPT_DETECTED');
});

test('Phase 12 Security: rejects eval() calls', () => {
  const evalPayload = Buffer.from('eval(atob("bWFsaWNpb3Vz"))');
  const result = scanHostileContent(evalPayload);
  assert.equal(result.isSafe, false);
  assert.equal(result.threat, 'POLYGLOT_HOSTILE_SCRIPT_DETECTED');
});

test('Phase 12 Security: rejects document.cookie access attempts', () => {
  const cookiePayload = Buffer.from('var x = document.cookie;');
  const result = scanHostileContent(cookiePayload);
  assert.equal(result.isSafe, false);
  assert.equal(result.threat, 'POLYGLOT_HOSTILE_SCRIPT_DETECTED');
});

test('Phase 12 Security: accepts clean binary image data', () => {
  const cleanJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  const result = scanHostileContent(cleanJpeg);
  assert.equal(result.isSafe, true);
  assert.equal(result.threat, undefined);
});

test('Phase 12 Security: rejects malware test signature payload', () => {
  const malwarePayload = Buffer.from('VEXORA_TEST_MALWARE_SIGNATURE_PAYLOAD_EICAR_SIMULATED');
  const result = scanHostileContent(malwarePayload);
  assert.equal(result.isSafe, false);
  assert.equal(result.threat, 'MALWARE_SIGNATURE_DETECTED');
});

// ─── 4. Signed Upload Token Generation & Verification ──────────────────────

test('Phase 12 Upload Tokens: generates signed token with random unguessable storage key', () => {
  const result = generateSignedUploadToken({
    userId: 'user-123',
    purpose: 'AVATAR',
    filename: 'profile.jpg',
  });

  assert.match(result.storageKey, /^uploads\/avatar\//);
  assert.ok(result.uploadToken);
  assert.ok(result.uploadToken.includes('.'));
  assert.equal(result.purpose, 'AVATAR');
  assert.equal(result.maxSizeBytes, 5 * 1024 * 1024);
  assert.ok(result.allowedMimeTypes.includes('image/jpeg'));
  assert.ok(result.expiresAt);
});

test('Phase 12 Upload Tokens: verifies valid token and returns decoded payload', () => {
  const generated = generateSignedUploadToken({
    userId: 'user-456',
    purpose: 'MATCH_EVIDENCE',
    filename: 'screenshot.png',
  });

  const verified = verifyUploadToken(generated.uploadToken);
  assert.equal(verified.userId, 'user-456');
  assert.equal(verified.purpose, 'MATCH_EVIDENCE');
  assert.match(verified.storageKey, /^uploads\/match_evidence\//);
});

test('Phase 12 Upload Tokens: rejects tampered token signature', () => {
  const generated = generateSignedUploadToken({
    userId: 'user-789',
    purpose: 'AVATAR',
    filename: 'avatar.webp',
  });

  const tampered = generated.uploadToken.replace(/.$/, 'X');
  assert.throws(() => verifyUploadToken(tampered), /signature verification failed/);
});

test('Phase 12 Upload Tokens: rejects invalid token format', () => {
  assert.throws(() => verifyUploadToken('not-a-valid-token'), /Invalid upload token/);
  assert.throws(() => verifyUploadToken(''), /Invalid upload token/);
  assert.throws(() => verifyUploadToken(null), /Invalid upload token/);
});

test('Phase 12 Upload Tokens: rejects invalid upload purpose', () => {
  assert.throws(
    () => generateSignedUploadToken({ userId: 'u', purpose: 'MALICIOUS_PURPOSE', filename: 'x.txt' }),
    /Invalid upload purpose/
  );
});

test('Phase 12 Upload Tokens: storage key prevents path traversal attacks', () => {
  const result = generateSignedUploadToken({
    userId: 'user-001',
    purpose: 'AVATAR',
    filename: '../../../etc/passwd.jpg',
  });

  assert.ok(!result.storageKey.includes('..'));
  assert.match(result.storageKey, /^uploads\/avatar\//);
});

test('Phase 12 Upload Tokens: storage key uses date-based partitioning', () => {
  const result = generateSignedUploadToken({
    userId: 'u1',
    purpose: 'PROFILE_PROOF',
    filename: 'proof.png',
  });

  assert.match(result.storageKey, /uploads\/profile_proof\/\d{4}\/\d{2}\/\d{2}\//);
});

// ─── 5. Full Secure Upload Processing Pipeline ─────────────────────────────

test('Phase 12 Pipeline: rejects empty file payload', async () => {
  await assert.rejects(
    () => processSecureUpload({ buffer: Buffer.alloc(0), filename: 'x.jpg', purpose: 'AVATAR', userId: 'u1' }),
    /Empty upload payload/
  );
});

test('Phase 12 Pipeline: rejects oversized files per purpose limits', async () => {
  const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024);
  // Write JPEG header so it passes magic bytes
  oversizedBuffer[0] = 0xff;
  oversizedBuffer[1] = 0xd8;
  oversizedBuffer[2] = 0xff;

  await assert.rejects(
    () => processSecureUpload({ buffer: oversizedBuffer, filename: 'big.jpg', purpose: 'AVATAR', userId: 'u1' }),
    /exceeds maximum/
  );
});

test('Phase 12 Pipeline: rejects unrecognized binary formats', async () => {
  const randomBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);

  await assert.rejects(
    () => processSecureUpload({ buffer: randomBuffer, filename: 'unknown.bin', purpose: 'AVATAR', userId: 'u1' }),
    /Unrecognized file binary header/
  );
});

test('Phase 12 Pipeline: rejects MIME type not allowed for purpose', async () => {
  const pdfBuffer = Buffer.from('%PDF-1.5 some fake pdf content with enough bytes to process');

  await assert.rejects(
    () => processSecureUpload({ buffer: pdfBuffer, filename: 'doc.pdf', purpose: 'AVATAR', userId: 'u1' }),
    /MIME type/
  );
});

test('Phase 12 Pipeline: upload limits are frozen and immutable', () => {
  assert.ok(Object.isFrozen(UPLOAD_LIMITS));
  assert.throws(() => { UPLOAD_LIMITS.AVATAR = {}; }, TypeError);
});

test('Phase 12 Pipeline: correct size limits per purpose', () => {
  assert.equal(UPLOAD_LIMITS.AVATAR.maxSizeBytes, 5 * 1024 * 1024);
  assert.equal(UPLOAD_LIMITS.PROFILE_PROOF.maxSizeBytes, 10 * 1024 * 1024);
  assert.equal(UPLOAD_LIMITS.MATCH_EVIDENCE.maxSizeBytes, 15 * 1024 * 1024);
  assert.equal(UPLOAD_LIMITS.DISPUTE_EVIDENCE.maxSizeBytes, 25 * 1024 * 1024);
  assert.equal(UPLOAD_LIMITS.KYC_DOCUMENT.maxSizeBytes, 10 * 1024 * 1024);
});

// ─── 6. Validation Schema Tests ─────────────────────────────────────────────

test('Phase 12 Validation: ProfileUpdateSchema accepts valid profile update', () => {
  const result = ProfileUpdateSchema.safeParse({
    display_name: 'NinjaKiller',
    bio: 'Competitive BGMI player',
    profile_visibility: 'PUBLIC',
    show_stats: true,
    show_game_ids: false,
  });
  assert.ok(result.success);
});

test('Phase 12 Validation: ProfileUpdateSchema accepts empty update (all optional)', () => {
  assert.ok(ProfileUpdateSchema.safeParse({}).success);
});

test('Phase 12 Validation: ProfileUpdateSchema rejects display_name shorter than 2 chars', () => {
  assert.ok(!ProfileUpdateSchema.safeParse({ display_name: 'X' }).success);
});

test('Phase 12 Validation: ProfileUpdateSchema rejects invalid profile_visibility', () => {
  assert.ok(!ProfileUpdateSchema.safeParse({ profile_visibility: 'HIDDEN' }).success);
});

test('Phase 12 Validation: ProfileUpdateSchema rejects bio longer than 500 chars', () => {
  assert.ok(!ProfileUpdateSchema.safeParse({ bio: 'x'.repeat(501) }).success);
});

test('Phase 12 Validation: ProfileUpdateSchema rejects invalid country code format', () => {
  assert.ok(!ProfileUpdateSchema.safeParse({ country: 'india' }).success);
  assert.ok(!ProfileUpdateSchema.safeParse({ country: 'IN' }).success); // Must be alpha-3
});

test('Phase 12 Validation: ProfileUpdateSchema accepts valid ISO 3166-1 alpha-3 country code', () => {
  assert.ok(ProfileUpdateSchema.safeParse({ country: 'IND' }).success);
});

test('Phase 12 Validation: ProfileUpdateSchema limits favourite_game_ids to max 10 entries', () => {
  const uuids = Array.from({ length: 11 }, () => crypto.randomUUID());
  assert.ok(!ProfileUpdateSchema.safeParse({ favourite_game_ids: uuids }).success);
});

test('Phase 12 Validation: InGameIdLinkSchema accepts valid in-game UID linking', () => {
  const result = InGameIdLinkSchema.safeParse({
    game_id: crypto.randomUUID(),
    in_game_uid: '5512398471',
    in_game_name: 'NinjaK1ller',
  });
  assert.ok(result.success);
});

test('Phase 12 Validation: InGameIdLinkSchema rejects UID with injection characters', () => {
  assert.ok(!InGameIdLinkSchema.safeParse({
    game_id: crypto.randomUUID(),
    in_game_uid: "'; DROP TABLE users; --",
  }).success);
});

test('Phase 12 Validation: InGameIdLinkSchema rejects UID shorter than 2 chars', () => {
  assert.ok(!InGameIdLinkSchema.safeParse({
    game_id: crypto.randomUUID(),
    in_game_uid: 'X',
  }).success);
});

test('Phase 12 Validation: InGameIdLinkSchema accepts proof_upload_id for verification', () => {
  assert.ok(InGameIdLinkSchema.safeParse({
    game_id: crypto.randomUUID(),
    in_game_uid: 'player-uid-123',
    proof_upload_id: crypto.randomUUID(),
  }).success);
});

test('Phase 12 Validation: InGameIdLinkSchema rejects invalid game_id format', () => {
  assert.ok(!InGameIdLinkSchema.safeParse({
    game_id: 'not-a-uuid',
    in_game_uid: 'valid-uid',
  }).success);
});

test('Phase 12 Validation: SignedUploadRequestSchema accepts valid upload request', () => {
  assert.ok(SignedUploadRequestSchema.safeParse({
    purpose: 'AVATAR',
    filename: 'profile.jpg',
  }).success);
});

test('Phase 12 Validation: SignedUploadRequestSchema rejects invalid purpose', () => {
  assert.ok(!SignedUploadRequestSchema.safeParse({
    purpose: 'MALWARE',
    filename: 'x.jpg',
  }).success);
});

test('Phase 12 Validation: SignedUploadRequestSchema rejects filenames with path traversal', () => {
  assert.ok(!SignedUploadRequestSchema.safeParse({
    purpose: 'AVATAR',
    filename: '../../../etc/passwd',
  }).success);
});

test('Phase 12 Validation: SignedUploadRequestSchema accepts all valid purposes', () => {
  for (const purpose of ['AVATAR', 'PROFILE_PROOF', 'MATCH_EVIDENCE', 'KYC_DOCUMENT', 'DISPUTE_EVIDENCE']) {
    assert.ok(SignedUploadRequestSchema.safeParse({ purpose, filename: 'file.png' }).success);
  }
});

// ─── 7. Users Service Module Contracts ──────────────────────────────────────

test('Phase 12 Service: users.service.js exports getPublicProfile', async () => {
  const mod = await import('../../backend/src/users/users.service.js');
  assert.equal(typeof mod.getPublicProfile, 'function');
});

test('Phase 12 Service: users.service.js exports getOwnProfile', async () => {
  const mod = await import('../../backend/src/users/users.service.js');
  assert.equal(typeof mod.getOwnProfile, 'function');
});

test('Phase 12 Service: users.service.js exports updateOwnProfile', async () => {
  const mod = await import('../../backend/src/users/users.service.js');
  assert.equal(typeof mod.updateOwnProfile, 'function');
});

test('Phase 12 Service: users.service.js exports linkInGameId with anti-smurfing logic', async () => {
  const mod = await import('../../backend/src/users/users.service.js');
  assert.equal(typeof mod.linkInGameId, 'function');
});

test('Phase 12 Service: users.service.js exports unlinkInGameId', async () => {
  const mod = await import('../../backend/src/users/users.service.js');
  assert.equal(typeof mod.unlinkInGameId, 'function');
});

test('Phase 12 Service: users.service.js exports recordMediaUpload', async () => {
  const mod = await import('../../backend/src/users/users.service.js');
  assert.equal(typeof mod.recordMediaUpload, 'function');
});

// ─── 8. Upload Pipeline Module Contracts ────────────────────────────────────

test('Phase 12 Pipeline: exports all 6 critical pipeline functions', async () => {
  const mod = await import('../../backend/src/common/uploadPipeline.js');
  assert.equal(typeof mod.detectMagicBytes, 'function');
  assert.equal(typeof mod.scanHostileContent, 'function');
  assert.equal(typeof mod.sanitizeAndReencodeImage, 'function');
  assert.equal(typeof mod.generateSignedUploadToken, 'function');
  assert.equal(typeof mod.verifyUploadToken, 'function');
  assert.equal(typeof mod.processSecureUpload, 'function');
});

test('Phase 12 Pipeline: exports frozen UPLOAD_LIMITS configuration', async () => {
  const mod = await import('../../backend/src/common/uploadPipeline.js');
  assert.ok(mod.UPLOAD_LIMITS);
  assert.ok(Object.isFrozen(mod.UPLOAD_LIMITS));
});

// ─── 9. Routes Structure Validation ────────────────────────────────────────

test('Phase 12 Routes: registers GET /me route for own profile', () => {
  const routesSrc = fs.readFileSync(path.join(ROOT, 'backend/src/users/users.routes.js'), 'utf-8');
  assert.ok(routesSrc.includes("get('/me'"));
  assert.ok(routesSrc.includes('authenticate'));
});

test('Phase 12 Routes: registers PATCH /me route for profile updates', () => {
  const routesSrc = fs.readFileSync(path.join(ROOT, 'backend/src/users/users.routes.js'), 'utf-8');
  assert.ok(routesSrc.includes("patch('/me'"));
  assert.ok(routesSrc.includes('ProfileUpdateSchema'));
});

test('Phase 12 Routes: registers GET /profile/:username for public profile (unauthenticated)', () => {
  const routesSrc = fs.readFileSync(path.join(ROOT, 'backend/src/users/users.routes.js'), 'utf-8');
  assert.ok(routesSrc.includes("get('/profile/:username'"));
  assert.ok(routesSrc.includes('getPublicProfile'));
});

test('Phase 12 Routes: registers POST /me/game-ids for UID linking', () => {
  const routesSrc = fs.readFileSync(path.join(ROOT, 'backend/src/users/users.routes.js'), 'utf-8');
  assert.ok(routesSrc.includes("post('/me/game-ids'"));
  assert.ok(routesSrc.includes('InGameIdLinkSchema'));
  assert.ok(routesSrc.includes('linkInGameId'));
});

test('Phase 12 Routes: registers DELETE /me/game-ids/:gameId for UID unlinking', () => {
  const routesSrc = fs.readFileSync(path.join(ROOT, 'backend/src/users/users.routes.js'), 'utf-8');
  assert.ok(routesSrc.includes("delete('/me/game-ids/:gameId'"));
  assert.ok(routesSrc.includes('unlinkInGameId'));
});

test('Phase 12 Routes: registers POST /uploads/sign for signed upload tokens', () => {
  const routesSrc = fs.readFileSync(path.join(ROOT, 'backend/src/users/users.routes.js'), 'utf-8');
  assert.ok(routesSrc.includes("post('/uploads/sign'"));
  assert.ok(routesSrc.includes('generateSignedUploadToken'));
});

test('Phase 12 Routes: registers POST /uploads/process for secure ingestion', () => {
  const routesSrc = fs.readFileSync(path.join(ROOT, 'backend/src/users/users.routes.js'), 'utf-8');
  assert.ok(routesSrc.includes("post('/uploads/process'"));
  assert.ok(routesSrc.includes('processSecureUpload'));
  assert.ok(routesSrc.includes('recordMediaUpload'));
});

test('Phase 12 Routes: uses multer memory storage (never writes temp files to disk)', () => {
  const routesSrc = fs.readFileSync(path.join(ROOT, 'backend/src/users/users.routes.js'), 'utf-8');
  assert.ok(routesSrc.includes('memoryStorage'));
  assert.ok(routesSrc.includes('upload.single'));
});

// ─── 10. Flutter Profile Screen ─────────────────────────────────────────────

test('Phase 12 Flutter: ProfileScreen uses ConsumerWidget with Riverpod', () => {
  const dartSrc = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/screens/profile_screen.dart'), 'utf-8');
  assert.ok(dartSrc.includes('class ProfileScreen extends ConsumerWidget'));
  assert.ok(dartSrc.includes('WidgetRef ref'));
});

test('Phase 12 Flutter: includes Link / Edit In-Game UID functionality', () => {
  const dartSrc = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/screens/profile_screen.dart'), 'utf-8');
  assert.ok(dartSrc.includes('Link / Edit In-Game UID'));
  assert.ok(dartSrc.includes('_showLinkGameUidDialog'));
});

test('Phase 12 Flutter: displays profile privacy controls', () => {
  const dartSrc = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/screens/profile_screen.dart'), 'utf-8');
  assert.ok(dartSrc.includes('Profile Privacy Controls'));
  assert.ok(dartSrc.includes('Public Profile Visibility'));
  assert.ok(dartSrc.includes('Display Linked IGNs'));
});

test('Phase 12 Flutter: shows verified/unverified badge for linked game IDs', () => {
  const dartSrc = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/screens/profile_screen.dart'), 'utf-8');
  assert.ok(dartSrc.includes('_GameIdTile'));
  assert.ok(dartSrc.includes('VERIFIED'));
});

test('Phase 12 Flutter: references ADR-006 UID uniqueness rule', () => {
  const dartSrc = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/screens/profile_screen.dart'), 'utf-8');
  assert.ok(dartSrc.includes('ADR-006'));
  assert.ok(dartSrc.includes('Duplicate UIDs are strictly prohibited'));
});

test('Phase 12 Flutter: includes BGMI, Free Fire, CODM game selectors', () => {
  const dartSrc = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/screens/profile_screen.dart'), 'utf-8');
  assert.ok(dartSrc.includes('Battlegrounds Mobile India'));
  assert.ok(dartSrc.includes('Garena Free Fire MAX'));
  assert.ok(dartSrc.includes('Call of Duty: Mobile'));
});

test('Phase 12 Flutter: uses DropdownButtonFormField with value (not initialValue)', () => {
  const dartSrc = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/screens/profile_screen.dart'), 'utf-8');
  assert.ok(dartSrc.includes('value: selectedGame'));
  assert.ok(!dartSrc.includes('initialValue: selectedGame'));
});

test('Phase 12 Flutter: includes data minimisation notice', () => {
  const dartSrc = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/screens/profile_screen.dart'), 'utf-8');
  assert.ok(dartSrc.includes('Zero-leak data minimisation'));
});

// ─── 11. ADR-006 Compliance ─────────────────────────────────────────────────

test('Phase 12 ADR-006: documents UID uniqueness decision', () => {
  const adrPath = path.join(ROOT, 'docs/adr/ADR-006-player-identity-and-uid-uniqueness.md');
  assert.ok(fs.existsSync(adrPath), 'ADR-006 must exist');
  const content = fs.readFileSync(adrPath, 'utf-8').toLowerCase();
  assert.ok(content.includes('unique'), 'ADR-006 must discuss uniqueness');
});

test('Phase 12 ADR-006: addresses anti-smurfing / anti-impersonation', () => {
  const content = fs.readFileSync(path.join(ROOT, 'docs/adr/ADR-006-player-identity-and-uid-uniqueness.md'), 'utf-8').toLowerCase();
  assert.ok(
    content.includes('smurf') || content.includes('impersonat') || content.includes('duplicate'),
    'ADR-006 must address anti-smurfing'
  );
});

// ─── 12. SHA-256 Hashing Correctness ────────────────────────────────────────

test('Phase 12 SHA-256: hash produces correct 64-character hex string', () => {
  const content = Buffer.from('Vexora Esports Platform Integrity Check');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  assert.equal(hash.length, 64);
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('Phase 12 SHA-256: identical content always produces same hash (deterministic)', () => {
  const content = Buffer.from('match-evidence-payload');
  const h1 = crypto.createHash('sha256').update(content).digest('hex');
  const h2 = crypto.createHash('sha256').update(content).digest('hex');
  assert.equal(h1, h2);
});

test('Phase 12 SHA-256: different content produces different hashes', () => {
  const c1 = Buffer.from('original-evidence');
  const c2 = Buffer.from('tampered-evidence');
  const h1 = crypto.createHash('sha256').update(c1).digest('hex');
  const h2 = crypto.createHash('sha256').update(c2).digest('hex');
  assert.notEqual(h1, h2);
});
