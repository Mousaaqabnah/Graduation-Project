/**
 * Storage architecture regression (no destructive live bucket operations).
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');

const { buildObjectKey, assertSafeObjectKey, classifyVisibility } = require('../lib/storage/keys');
const { readStorageConfig } = require('../lib/storage/config');
const { persistIncomingFile, sniffMime, isForbiddenActiveContent } = require('../lib/secureStorage');
const { isSupabaseRef, encodeSupabaseRef, parseSupabaseRef } = require('../lib/storage/refs');
const { resetStorageCache, currentProviderName, signedUrlTtlSeconds } = require('../lib/storage');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.API_BASE || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

const STORAGE_ENV_KEYS = [
  'NODE_ENV',
  'STORAGE_PROVIDER',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PUBLIC_BUCKET',
  'SUPABASE_PRIVATE_BUCKET',
  'SIGNED_URL_TTL_SECONDS'
];

function snapshotEnv(keys) {
  const snap = {};
  for (const key of keys) {
    snap[key] = Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined;
  }
  return snap;
}

function restoreEnv(snap) {
  for (const [key, value] of Object.entries(snap)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

let passed = 0;
let failed = 0;

function record(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log('PASS', name);
  } else {
    failed += 1;
    console.log('FAIL', name, detail || '');
  }
}

function tinyJpegDataUrl() {
  return `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;
}

function req(method, urlPath, token) {
  return new Promise((resolve) => {
    const u = new URL(urlPath, BASE);
    const r = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: Object.assign(
          { Accept: 'application/json' },
          token ? { Authorization: `Bearer ${token}` } : {}
        ),
        timeout: 8000
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    r.on('error', (e) => resolve({ status: 0, body: String(e.message || e) }));
    r.end();
  });
}

function walkFrontend(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walkFrontend(abs, acc);
    else if (/\.(html|js|css)$/.test(name)) acc.push(abs);
  }
  return acc;
}

async function main() {
  console.log('\n=== Storage architecture tests ===\n');
  resetStorageCache();

  const cfg = readStorageConfig();
  record('provider configuration validates', cfg.provider === 'local' || cfg.provider === 'supabase');
  record('development/test local provider still works', currentProviderName() === 'local' || cfg.provider === 'supabase');

  const envSnap = snapshotEnv(STORAGE_ENV_KEYS);
  let prodThrew = false;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.STORAGE_PROVIDER;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    resetStorageCache();
    try {
      readStorageConfig();
    } catch (e) {
      prodThrew = e && e.code === 'STORAGE_CONFIG';
    }
    record('production does not silently fall back to local', prodThrew);
  } finally {
    restoreEnv(envSnap);
    resetStorageCache();
  }

  const fieldId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const galleryKey = buildObjectKey('public-image', 'image/jpeg', { fieldId, purpose: 'gallery' });
  const avatarKey = buildObjectKey('public-image', 'image/jpeg', { userId, purpose: 'avatar' });
  const ownKey = buildObjectKey('field-doc', 'application/pdf', { fieldId, docType: 'OWNERSHIP_DOCUMENT' });
  record('gallery key is namespaced', galleryKey.startsWith('fields/' + fieldId + '/gallery/'));
  record('avatar key is namespaced', avatarKey.startsWith('avatars/' + userId + '/'));
  record('ownership key is namespaced', ownKey.includes('/documents/ownership/'));
  let traverseThrew = false;
  try {
    assertSafeObjectKey('../etc/passwd');
  } catch {
    traverseThrew = true;
  }
  record('generated object keys cannot traverse paths', traverseThrew && !galleryKey.includes('..'));
  record('public/private classification', classifyVisibility('public-image') === 'public' && classifyVisibility('field-doc') === 'private');

  const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  record('MIME/magic-byte jpeg sniff', sniffMime(jpegBuf) === 'image/jpeg');
  record('SVG rejected as active content', isForbiddenActiveContent('image/svg+xml'));
  record('HTML rejected as active content', isForbiddenActiveContent('text/html'));
  let svgRejected = false;
  try {
    persistIncomingFile('data:image/svg+xml;base64,PHN2Zy8+', { kind: 'public-image' });
  } catch {
    svgRejected = true;
  }
  record('SVG upload rejected by persist helper', svgRejected);
  let htmlRejected = false;
  try {
    persistIncomingFile('data:text/html;base64,PGh0bWw+', { kind: 'field-doc' });
  } catch {
    htmlRejected = true;
  }
  record('HTML upload rejected by persist helper', htmlRejected);

  const local = persistIncomingFile(tinyJpegDataUrl(), { kind: 'field-doc' });
  record('local provider still writes private disk paths', local && String(local.storagePath).startsWith('storage/private/'));

  const ref = encodeSupabaseRef('matchfield-private', 'fields/' + fieldId + '/documents/ownership/x.jpg');
  record('supabase refs encode/parse', isSupabaseRef(ref) && parseSupabaseRef(ref).bucket === 'matchfield-private');
  record('signed URL TTL is short', signedUrlTtlSeconds() >= 30 && signedUrlTtlSeconds() <= 600);

  const serializers = fs.readFileSync(path.join(ROOT, 'lib', 'serializers.js'), 'utf8');
  record(
    'public serializers do not emit private object paths',
    serializers.includes('documentApiUrl') &&
      serializers.includes('ownershipDocumentUrl: null') &&
      !/ownershipDocumentUrl:\s*doc\.storagePath/.test(serializers)
  );

  const someUuid = '00000000-0000-4000-8000-000000000000';
  const anon = await req('GET', `/api/fields/${someUuid}/documents/OWNERSHIP_DOCUMENT`);
  record('unauthorized private document access denied', anon.status === 401 || anon.status === 404, String(anon.status));

  const frontendFiles = walkFrontend(path.join(ROOT, 'pages'), []).concat(
    walkFrontend(path.join(ROOT, 'scripts'), []).filter((f) => !f.includes('test-') && !f.includes('migrate-'))
  );
  let secretHit = null;
  for (const file of frontendFiles) {
    const src = fs.readFileSync(file, 'utf8');
    if (/SUPABASE_SERVICE_ROLE_KEY|service_role|JWT_SECRET\s*=/.test(src)) {
      secretHit = path.relative(ROOT, file);
      break;
    }
  }
  record('no service-role key in frontend files', !secretHit, secretHit);

  const health = await req('GET', '/health');
  record('health JSON has no service-role key', health.status === 200 && !/service_role|SUPABASE_SERVICE_ROLE/.test(health.body));

  const migrateSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'migrate-storage-to-supabase.js'), 'utf8');
  record(
    'migration dry-run is default and does not apply without --apply',
    migrateSrc.includes('const APPLY = process.argv.includes(\'--apply\')') &&
      migrateSrc.includes('const DRY = !APPLY')
  );

  console.log('\n---');
  console.log(`PASS ${passed} / FAIL ${failed}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
