/**
 * Google OAuth security suite.
 *
 * Runs the real routes/auth.js in-process on an ephemeral port with Google fully mocked:
 * ID tokens are signed locally with a throwaway RSA key and verified through the same
 * google-auth-library code path used in production. No network calls to Google.
 *
 * Requires DATABASE_URL + JWT_SECRET (like the other suites). Google credentials from
 * .env are overridden in-process with throwaway test values and never printed.
 *
 * Run: npm run test:oauth
 */
'use strict';

require('dotenv').config();

const crypto = require('crypto');
const http = require('http');

// ---------------------------------------------------------------------------
// Test-only configuration (throwaway values; override anything from .env)
// ---------------------------------------------------------------------------
const TEST_CLIENT_ID = 'matchfield-test-client.apps.googleusercontent.com';
const TEST_CLIENT_SECRET = `test-secret-${crypto.randomBytes(24).toString('hex')}`;
const TEST_STATE_SECRET = crypto.randomBytes(48).toString('hex');
const TEST_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
const TEST_APP_BASE = 'http://localhost:3000';

process.env.GOOGLE_OAUTH_ENABLED = 'true';
process.env.GOOGLE_CLIENT_ID = TEST_CLIENT_ID;
process.env.GOOGLE_CLIENT_SECRET = TEST_CLIENT_SECRET;
process.env.GOOGLE_REDIRECT_URI = TEST_REDIRECT_URI;
process.env.OAUTH_STATE_SECRET = TEST_STATE_SECRET;
process.env.APP_BASE_URL = TEST_APP_BASE;
process.env.RATE_LIMIT_DISABLED = '1';
if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') process.env.NODE_ENV = 'test';
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

// ---------------------------------------------------------------------------
// Output capture (to assert no secrets/tokens are ever logged)
// ---------------------------------------------------------------------------
const captured = [];
for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  const orig = console[level].bind(console);
  console[level] = (...args) => {
    captured.push(args.map((a) => (typeof a === 'string' ? a : (() => {
      try { return a instanceof Error ? `${a.name}: ${a.message}\n${a.stack}` : JSON.stringify(a); } catch { return String(a); }
    })())).join(' '));
    orig(...args);
  };
}

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { safeErrorHandler } = require('../lib/security/errors');
const google = require('../lib/oauth/google');
const oauthState = require('../lib/oauth/stateCookie');
const { createUniqueUsername } = require('../lib/username');
const { createUniquePlayerCode } = require('../lib/playerCode');
const { validateGoogleConfig } = google;

const PASS = 'PASS';
const FAIL = 'FAIL';
const SKIP = 'SKIP';
const results = [];
let dbOk = false;

/** Runs a DB-backed section, or records a SKIP when the database is unreachable. */
async function dbSection(name, fn) {
  if (!dbOk) {
    results.push({ name, status: SKIP });
    console.log(`${SKIP}  ${name} — database unreachable`);
    return;
  }
  await fn();
}
const sensitive = new Set();
const RUN = crypto.randomBytes(4).toString('hex');
const EMAIL_DOMAIN = 'oauth-test.matchfield.local';
const cleanupUserIds = new Set();

function record(name, ok, detail) {
  const st = ok ? PASS : FAIL;
  results.push({ name, status: st });
  console.log(`${st}  ${name}${detail != null && detail !== '' ? ` — ${detail}` : ''}`);
}

function remember(...values) {
  for (const v of values) if (v && typeof v === 'string' && v.length >= 8) sensitive.add(v);
}

// ---------------------------------------------------------------------------
// Fake Google
// ---------------------------------------------------------------------------
const KID = `test-kid-${RUN}`;
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
let nextClaims = null;
let lastExchange = null;
let exchangeShouldThrow = false;

function signIdToken(claims) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://accounts.google.com',
    aud: TEST_CLIENT_ID,
    iat: now,
    exp: now + 3600,
    email_verified: true,
    ...claims
  };
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
  return jwt.sign(payload, privateKey, { algorithm: 'RS256', keyid: KID });
}

google._setGoogleTestDriver({
  exchangeCode: async ({ code, codeVerifier, redirectUri }) => {
    lastExchange = { code, codeVerifier, redirectUri };
    if (exchangeShouldThrow) throw new Error('simulated token endpoint failure');
    const idToken = signIdToken(nextClaims || {});
    remember(idToken);
    return idToken;
  },
  getCerts: async () => ({ [KID]: publicKey })
});

// ---------------------------------------------------------------------------
// In-process server + HTTP helpers
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/auth'));
app.use(safeErrorHandler);
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

let BASE = '';

function request(method, urlPath, { token, body, cookies } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${BASE}${urlPath}`);
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      // Node does not chunk DELETE bodies by default; without a length the server rejects the request.
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookies && Object.keys(cookies).length) {
      headers.Cookie = Object.entries(cookies)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('; ');
    }
    const r = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function setCookies(res) {
  const list = res.headers['set-cookie'] || [];
  return list.map((line) => {
    const [pair, ...attrs] = line.split(';').map((s) => s.trim());
    const idx = pair.indexOf('=');
    const attrMap = {};
    for (const a of attrs) {
      const i = a.indexOf('=');
      attrMap[(i === -1 ? a : a.slice(0, i)).toLowerCase()] = i === -1 ? true : a.slice(i + 1);
    }
    return {
      name: pair.slice(0, idx),
      value: decodeURIComponent(pair.slice(idx + 1)),
      attrs: attrMap,
      raw: line
    };
  });
}

function findCookie(res, name) {
  return setCookies(res).filter((c) => c.name === name).pop() || null;
}

function errorCodeOf(location) {
  if (!location) return null;
  const u = new URL(location, TEST_APP_BASE);
  if (u.pathname !== '/pages/auth/login.html') return null;
  return u.searchParams.get('oauth_error');
}

const ALLOWED_ERROR_CODES = new Set([
  'cancelled', 'state_mismatch', 'email_unverified', 'account_exists',
  'no_account', 'suspended', 'not_allowed', 'generic'
]);
const allRedirects = [];

async function start({ intent = 'login', role = 'PLAYER', terms = true } = {}) {
  const qs = new URLSearchParams();
  if (intent != null) qs.set('intent', intent);
  if (role != null) qs.set('role', role);
  if (intent === 'signup' && terms) qs.set('terms', 'accepted');
  const res = await request('GET', `/api/auth/google/start?${qs.toString()}`);
  const location = res.headers.location || '';
  allRedirects.push(location);
  let params = null;
  if (location.startsWith(google.GOOGLE_AUTH_ENDPOINT)) {
    params = new URL(location).searchParams;
    remember(params.get('state'), params.get('nonce'), params.get('code_challenge'));
  }
  const stateCookie = findCookie(res, oauthState.STATE_COOKIE);
  if (stateCookie) remember(stateCookie.value);
  return { res, location, params, stateCookie };
}

async function callback({ query, stateCookieValue }) {
  const qs = new URLSearchParams(query);
  const res = await request('GET', `/api/auth/google/callback?${qs.toString()}`, {
    cookies: stateCookieValue ? { [oauthState.STATE_COOKIE]: stateCookieValue } : {}
  });
  const location = res.headers.location || '';
  allRedirects.push(location);
  const exchangeCookie = findCookie(res, oauthState.EXCHANGE_COOKIE);
  if (exchangeCookie && exchangeCookie.value) remember(exchangeCookie.value);
  return { res, location, exchangeCookie, errorCode: errorCodeOf(location) };
}

/** Full happy-path style flow with optional tampering. */
async function flow({ intent = 'login', role = 'PLAYER', claims = {}, mutate } = {}) {
  const s = await start({ intent, role });
  if (!s.params || !s.stateCookie) throw new Error('start did not redirect to Google');
  const code = `test-code-${crypto.randomBytes(12).toString('hex')}`;
  remember(code);
  nextClaims = { nonce: s.params.get('nonce'), ...claims };
  const ctx = {
    query: { code, state: s.params.get('state') },
    stateCookieValue: s.stateCookie.value
  };
  if (mutate) mutate(ctx, s);
  const cb = await callback(ctx);
  return { s, cb, code };
}

async function exchange(cookieValue) {
  const res = await request('POST', '/api/auth/google/exchange', {
    cookies: cookieValue ? { [oauthState.EXCHANGE_COOKIE]: cookieValue } : {},
    body: {}
  });
  if (res.body && typeof res.body === 'object') remember(res.body.token, res.body.refreshToken);
  return res;
}

// ---------------------------------------------------------------------------
// DB fixtures
// ---------------------------------------------------------------------------
function testEmail(label) {
  return `${label}-${RUN}@${EMAIL_DOMAIN}`;
}

function testSub(label) {
  return `sub-${label}-${RUN}-${crypto.randomBytes(4).toString('hex')}`;
}

async function createUser({ label, role = 'PLAYER', status = 'ACTIVE', password, googleSub, deleted = false }) {
  const email = testEmail(label);
  const user = await prisma.user.create({
    data: {
      email: deleted ? `deleted_${RUN}_${label}@deleted.local` : email,
      username: await createUniqueUsername(prisma, `oauth_${label}_${RUN}`),
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      fullName: `OAuth ${label}`,
      role,
      status,
      deletedAt: deleted ? new Date() : null,
      playerCode: await createUniquePlayerCode(),
      ownerProfile: role === 'OWNER' ? { create: { verificationStatus: 'NOT_SUBMITTED' } } : undefined,
      authAccounts: googleSub
        ? { create: { provider: 'GOOGLE', providerAccountId: googleSub, providerEmail: email } }
        : undefined
    }
  });
  cleanupUserIds.add(user.id);
  return { user, email };
}

let cleanupDone = false;
const cleanupErrors = [];

/**
 * Only rows carrying this run's markers may be deleted:
 * - emails created by this run (`<label>-<RUN>@<test domain>`)
 * - pre-deleted fixtures (`deleted_<RUN>_<label>@deleted.local`)
 * - tracked fixtures soft-deleted through DELETE /me (`deleted_<id>@deleted.local`)
 */
function isOwnedByThisRun(user) {
  const email = String(user.email || '');
  return (
    email.endsWith(`-${RUN}@${EMAIL_DOMAIN}`) ||
    (email.startsWith(`deleted_${RUN}_`) && email.endsWith('@deleted.local')) ||
    email === `deleted_${user.id}@deleted.local`
  );
}

/**
 * Idempotent cleanup of data created by this run only. User deletion cascades to
 * refresh tokens, AuthAccount, ownerProfile, owner verifications, favorites, and
 * user notifications. Audit rows (SetNull on delete) written for these users are
 * removed explicitly. Restrict relations (bookings, payments, reviews, fields) are
 * never created by this suite; if one blocks a delete it is reported, not hidden.
 */
async function cleanup() {
  if (cleanupDone) return;
  cleanupDone = true;

  const discovered = await prisma.user.findMany({
    where: { email: { endsWith: `-${RUN}@${EMAIL_DOMAIN}` } },
    select: { id: true }
  });
  for (const u of discovered) cleanupUserIds.add(u.id);
  const trackedIds = [...cleanupUserIds];
  if (!trackedIds.length) return;

  const existing = await prisma.user.findMany({
    where: { id: { in: trackedIds } },
    select: { id: true, email: true }
  });
  const ownedIds = [];
  for (const u of existing) {
    if (isOwnedByThisRun(u)) ownedIds.push(u.id);
    else cleanupErrors.push(`refused to delete user ${u.id}: not created by this test run`);
  }
  if (!ownedIds.length) return;

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: ownedIds } },
        { entityType: 'User', entityId: { in: ownedIds } }
      ]
    }
  });

  for (const id of ownedIds) {
    try {
      await prisma.user.delete({ where: { id } });
    } catch (err) {
      if (err && err.code === 'P2025') continue; // already gone: nothing to clean
      cleanupErrors.push(`user ${id}: ${(err && (err.code || err.name)) || 'unknown error'}`);
    }
  }

  const [usersLeft, accountsLeft, tokensLeft, profilesLeft] = await Promise.all([
    prisma.user.count({ where: { id: { in: ownedIds } } }),
    prisma.authAccount.count({ where: { userId: { in: ownedIds } } }),
    prisma.refreshToken.count({ where: { userId: { in: ownedIds } } }),
    prisma.ownerProfile.count({ where: { userId: { in: ownedIds } } })
  ]);
  if (usersLeft || accountsLeft || tokensLeft || profilesLeft) {
    cleanupErrors.push(
      `leftovers: users=${usersLeft} authAccounts=${accountsLeft} refreshTokens=${tokensLeft} ownerProfiles=${profilesLeft}`
    );
  }
}

async function runCleanupAndReport() {
  if (!dbOk || cleanupDone) return;
  try {
    await cleanup();
  } catch (err) {
    cleanupErrors.push(`cleanup aborted: ${(err && (err.code || err.name)) || 'unknown error'}`);
  }
  record(
    'CLEANUP removed all test-created data (and nothing else)',
    cleanupErrors.length === 0,
    cleanupErrors.join('; ')
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
async function main() {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  BASE = `http://127.0.0.1:${server.address().port}`;
  console.log('Google OAuth suite (in-process, Google mocked)\n');

  const probe = new (require('@prisma/client').PrismaClient)({ log: [] });
  dbOk = await probe.user.count().then(() => true).catch(() => false);
  await probe.$disconnect().catch(() => {});
  console.log(dbOk ? 'Database reachable\n' : 'Database UNREACHABLE — DB-backed sections will be skipped\n');

  try {
    // ----- CONFIG VALIDATION -----
    {
      const okCfg = validateGoogleConfig();
      record('CONFIG valid test configuration accepted', okCfg.enabled && okCfg.errors.length === 0);
      const weak = validateGoogleConfig({ ...google.readGoogleConfig(), stateSecret: 'short' });
      record('CONFIG weak OAUTH_STATE_SECRET rejected', weak.errors.some((e) => e.includes('OAUTH_STATE_SECRET')));
      const missing = validateGoogleConfig({ ...google.readGoogleConfig(), clientSecret: '' });
      record('CONFIG missing GOOGLE_CLIENT_SECRET rejected', missing.errors.some((e) => e.includes('GOOGLE_CLIENT_SECRET')));
      process.env.NODE_ENV = 'production';
      const prodHttp = validateGoogleConfig({ ...google.readGoogleConfig(), appBaseUrl: '' });
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
      record(
        'CONFIG production requires HTTPS redirect URI and APP_BASE_URL',
        prodHttp.errors.some((e) => e.includes('HTTPS')) && prodHttp.errors.some((e) => e.includes('APP_BASE_URL'))
      );
      const errorText = [...weak.errors, ...missing.errors, ...prodHttp.errors].join(' ');
      record(
        'CONFIG validation messages contain names only (no values)',
        !errorText.includes(TEST_CLIENT_SECRET) && !errorText.includes(TEST_STATE_SECRET) && !errorText.includes(TEST_CLIENT_ID)
      );
    }

    // ----- FEATURE FLAG -----
    {
      process.env.GOOGLE_OAUTH_ENABLED = 'false';
      const r1 = await request('GET', '/api/auth/google/start?intent=login&role=PLAYER');
      const r2 = await request('GET', '/api/auth/google/callback?code=x&state=y');
      const r3 = await request('POST', '/api/auth/google/exchange', { body: {} });
      const r4 = await request('GET', '/api/auth/google/config');
      process.env.GOOGLE_OAUTH_ENABLED = 'true';
      record(
        'FLAG disabled -> all Google routes return 404',
        [r1, r2, r3, r4].every((r) => r.status === 404),
        [r1, r2, r3, r4].map((r) => r.status).join(',')
      );
      const r5 = await request('GET', '/api/auth/google/config');
      record('FLAG enabled -> config reports enabled', r5.status === 200 && r5.body && r5.body.enabled === true);
    }

    // ----- START -----
    {
      const s = await start({ intent: 'login', role: 'PLAYER' });
      const p = s.params;
      record('START redirects to Google authorization endpoint', s.res.status === 302 && !!p);
      record('START includes state', !!(p && p.get('state') && p.get('state').length >= 32));
      record('START includes nonce', !!(p && p.get('nonce') && p.get('nonce').length >= 32));
      record(
        'START uses PKCE S256',
        !!(p && p.get('code_challenge_method') === 'S256' && /^[A-Za-z0-9_-]{43}$/.test(p.get('code_challenge') || ''))
      );
      record('START uses exact configured redirect URI', !!(p && p.get('redirect_uri') === TEST_REDIRECT_URI));
      record(
        'START requests only openid email profile',
        !!(p && p.get('scope').split(' ').sort().join(' ') === 'email openid profile')
      );
      record('START uses prompt=select_account', !!(p && p.get('prompt') === 'select_account'));
      record('START uses configured client_id', !!(p && p.get('client_id') === TEST_CLIENT_ID));
      record(
        'START URL contains no client secret / state secret / JWT secret',
        !s.location.includes(TEST_CLIENT_SECRET) &&
          !s.location.includes(TEST_STATE_SECRET) &&
          !(process.env.JWT_SECRET && s.location.includes(process.env.JWT_SECRET)) &&
          !/client_secret/i.test(s.location)
      );
      const c = s.stateCookie;
      record('START state cookie is HttpOnly', !!(c && c.attrs.httponly));
      record('START state cookie SameSite=Lax', !!(c && String(c.attrs.samesite).toLowerCase() === 'lax'));
      record('START state cookie Path=/api/auth/google', !!(c && c.attrs.path === '/api/auth/google'));
      record('START state cookie ~10 minute lifetime', !!(c && Number(c.attrs['max-age']) === 600));
      record('START state cookie not Secure outside production', !!(c && !c.attrs.secure));
      record(
        'START state cookie does not expose state/nonce/verifier',
        !!(c && p && !c.value.includes(p.get('state')) && !c.value.includes(p.get('nonce')) &&
          !Buffer.from(c.value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8').includes(p.get('nonce')))
      );
      record('START responses are no-store', /no-store/.test(String(s.res.headers['cache-control'] || '')));

      process.env.NODE_ENV = 'production';
      process.env.GOOGLE_REDIRECT_URI = 'https://matchfield.example/api/auth/google/callback';
      const prod = await start({ intent: 'login', role: 'PLAYER' });
      process.env.GOOGLE_REDIRECT_URI = TEST_REDIRECT_URI;
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
      record('START state cookie Secure in production', !!(prod.stateCookie && prod.stateCookie.attrs.secure));

      process.env.NODE_ENV = 'production';
      const prodHttp = await request('GET', '/api/auth/google/start?intent=login&role=PLAYER');
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
      record('START disabled in production when redirect URI is not HTTPS', prodHttp.status === 404);

      // Ignore Host header / arbitrary returnTo for redirect URI
      const hostile = await request(
        'GET',
        '/api/auth/google/start?intent=login&role=PLAYER&redirect_uri=https://evil.example/cb&returnTo=https://evil.example'
      );
      const hp = hostile.headers.location ? new URL(hostile.headers.location).searchParams : null;
      record(
        'START ignores frontend-supplied redirect_uri/returnTo',
        !!(hp && hp.get('redirect_uri') === TEST_REDIRECT_URI && !hostile.headers.location.includes('evil.example'))
      );
    }

    // ----- ROLE / INTENT VALIDATION -----
    {
      const admin = await start({ intent: 'signup', role: 'ADMIN' });
      record('ROLE ADMIN rejected at start', errorCodeOf(admin.location) === 'not_allowed' && !admin.stateCookie);
      const adminLogin = await start({ intent: 'login', role: 'ADMIN' });
      record('ROLE ADMIN rejected for login intent too', errorCodeOf(adminLogin.location) === 'not_allowed');
      const bogus = await start({ intent: 'signup', role: 'SUPERUSER' });
      record('ROLE invalid role rejected', errorCodeOf(bogus.location) === 'not_allowed');
      const noRole = await start({ intent: 'signup', role: null });
      record('ROLE signup without role rejected', errorCodeOf(noRole.location) === 'not_allowed');
      const badIntent = await start({ intent: 'link', role: 'PLAYER' });
      record('INTENT invalid intent rejected', errorCodeOf(badIntent.location) === 'not_allowed');
      const noTerms = await start({ intent: 'signup', role: 'PLAYER', terms: false });
      record('SIGNUP without terms acceptance rejected', errorCodeOf(noTerms.location) === 'not_allowed');
    }

    // ----- STATE SECURITY -----
    {
      const missingState = await flow({ mutate: (ctx) => { delete ctx.query.state; } });
      record('STATE missing state rejected', missingState.cb.errorCode === 'state_mismatch');

      const mismatched = await flow({ mutate: (ctx) => { ctx.query.state = 'x'.repeat(43); } });
      record('STATE mismatched state rejected', mismatched.cb.errorCode === 'state_mismatch');

      const noCookie = await flow({ mutate: (ctx) => { ctx.stateCookieValue = null; } });
      record('STATE missing state cookie rejected', noCookie.cb.errorCode === 'state_mismatch');

      const tampered = await flow({
        mutate: (ctx) => {
          const buf = Buffer.from(ctx.stateCookieValue.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
          buf[buf.length - 5] ^= 0x01;
          ctx.stateCookieValue = buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
      });
      record('STATE tampered cookie (flipped ciphertext bit) rejected', tampered.cb.errorCode === 'state_mismatch');

      const badTag = await flow({
        mutate: (ctx) => { ctx.stateCookieValue = ctx.stateCookieValue.slice(0, -4) + 'AAAA'; }
      });
      record('STATE corrupted authentication tag rejected', badTag.cb.errorCode === 'state_mismatch');

      const forgedRole = await flow({
        intent: 'signup',
        mutate: (ctx, s) => {
          const realSecret = process.env.OAUTH_STATE_SECRET;
          process.env.OAUTH_STATE_SECRET = crypto.randomBytes(48).toString('hex');
          ctx.stateCookieValue = oauthState.createStateCookieValue({
            state: s.params.get('state'),
            nonce: s.params.get('nonce'),
            codeVerifier: 'v'.repeat(64),
            intent: 'signup',
            role: 'ADMIN'
          });
          process.env.OAUTH_STATE_SECRET = realSecret;
        },
        claims: { sub: testSub('forged'), email: testEmail('forged') }
      });
      record('STATE cookie forged with another key (role ADMIN) rejected', forgedRole.cb.errorCode === 'state_mismatch');
      record(
        'STATE cookie payload is encrypted (no readable JSON)',
        (() => {
          const raw = Buffer.from(forgedRole.s.stateCookie.value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
          return !raw.includes('"cv"') && !raw.includes('PLAYER') && !raw.includes('signup');
        })()
      );

      // Reuse: first use consumes the state (login, unknown account -> no_account), replay is rejected
      const s = await start({ intent: 'login' });
      nextClaims = { nonce: s.params.get('nonce'), sub: testSub('reuse'), email: testEmail('reuse') };
      const q = { code: 'reuse-code-1234567890', state: s.params.get('state') };
      remember(q.code);
      const first = await callback({ query: q, stateCookieValue: s.stateCookie.value });
      const replay = await callback({ query: q, stateCookieValue: s.stateCookie.value });
      if (dbOk) record('STATE first use processed', first.errorCode === 'no_account', first.errorCode);
      record('STATE reused state rejected', replay.errorCode === 'state_mismatch');
      record(
        'STATE cookie cleared on callback',
        (() => {
          const c = findCookie(first.res, oauthState.STATE_COOKIE);
          return !!(c && c.value === '' && Number(c.attrs['max-age']) === 0);
        })()
      );

      // Expired state cookie
      const expiredValue = oauthState.createStateCookieValue(
        { state: 'expired-state-value-0123456789abcdef', nonce: 'n'.repeat(40), codeVerifier: 'v'.repeat(64), intent: 'login', role: 'PLAYER' },
        Date.now() - 11 * 60 * 1000
      );
      const expired = await callback({
        query: { code: 'expired-code-123456', state: 'expired-state-value-0123456789abcdef' },
        stateCookieValue: expiredValue
      });
      record('STATE expired cookie rejected', expired.errorCode === 'state_mismatch');

      const cancelled = await flow({ mutate: (ctx) => { delete ctx.query.code; ctx.query.error = 'access_denied'; } });
      record('CALLBACK user cancel -> cancelled', cancelled.cb.errorCode === 'cancelled');

      const missingCode = await flow({ mutate: (ctx) => { delete ctx.query.code; } });
      record('CALLBACK missing authorization code rejected', missingCode.cb.errorCode === 'generic');

      exchangeShouldThrow = true;
      const tokenFail = await flow({ claims: { sub: testSub('tf'), email: testEmail('tf') } });
      exchangeShouldThrow = false;
      record('CALLBACK token endpoint failure -> generic', tokenFail.cb.errorCode === 'generic');
    }

    // ----- PKCE -----
    {
      const r = await flow({ claims: { sub: testSub('pkce'), email: testEmail('pkce') } });
      const challenge = r.s.params.get('code_challenge');
      record(
        'PKCE verifier sent to token exchange matches S256 challenge',
        !!(lastExchange && google.pkceChallengeFor(lastExchange.codeVerifier) === challenge)
      );
      record('PKCE token exchange uses exact redirect URI', !!(lastExchange && lastExchange.redirectUri === TEST_REDIRECT_URI));
      if (lastExchange) remember(lastExchange.codeVerifier);
    }

    // ----- ID TOKEN VALIDATION -----
    {
      const sub = testSub('idt');
      const email = testEmail('idt');
      const now = Math.floor(Date.now() / 1000);
      const helperNonce = google.randomToken(32);
      nextClaims = { sub, email: email.toUpperCase(), name: '  Valid User  ', nonce: helperNonce };
      const identity = await google
        .exchangeAndVerify({ code: 'helper-code-123456', codeVerifier: 'v'.repeat(64), expectedNonce: helperNonce })
        .catch(() => null);
      record(
        'IDTOKEN valid token accepted; only sub/email/name returned',
        !!identity && identity.sub === sub && identity.email === email && identity.name === 'Valid User' &&
          Object.keys(identity).sort().join() === 'email,name,sub'
      );
      const wrongAud = await flow({ claims: { sub, email, aud: 'someone-else.apps.googleusercontent.com' } });
      record('IDTOKEN wrong audience rejected', wrongAud.cb.errorCode === 'generic');
      const wrongIss = await flow({ claims: { sub, email, iss: 'https://evil.example' } });
      record('IDTOKEN wrong issuer rejected', wrongIss.cb.errorCode === 'generic');
      const wrongNonce = await flow({ claims: { sub, email, nonce: 'not-the-right-nonce-value-xxxxxxxx' } });
      record('IDTOKEN wrong nonce rejected', wrongNonce.cb.errorCode === 'generic');
      const missingNonce = await flow({ claims: { sub, email, nonce: undefined } });
      record('IDTOKEN missing nonce rejected', missingNonce.cb.errorCode === 'generic');
      const expired = await flow({ claims: { sub, email, iat: now - 7200, exp: now - 3600 } });
      record('IDTOKEN expired token rejected', expired.cb.errorCode === 'generic');
      const unverified = await flow({ intent: 'signup', claims: { sub, email, email_verified: false } });
      record('IDTOKEN email_verified=false rejected', unverified.cb.errorCode === 'email_unverified', unverified.cb.errorCode);
      const forged = await (async () => {
        const s = await start({ intent: 'signup' });
        const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
          publicKeyEncoding: { type: 'spki', format: 'pem' }
        });
        const forgedToken = jwt.sign(
          { iss: 'https://accounts.google.com', aud: TEST_CLIENT_ID, sub, email, email_verified: true, nonce: s.params.get('nonce'), iat: now, exp: now + 3600 },
          otherKey,
          { algorithm: 'RS256', keyid: KID }
        );
        remember(forgedToken);
        const prev = nextClaims;
        google._setGoogleTestDriver({
          exchangeCode: async () => forgedToken,
          getCerts: async () => ({ [KID]: publicKey })
        });
        const cb = await callback({ query: { code: 'forged-code-123456', state: s.params.get('state') }, stateCookieValue: s.stateCookie.value });
        google._setGoogleTestDriver({
          exchangeCode: async ({ code, codeVerifier, redirectUri }) => {
            lastExchange = { code, codeVerifier, redirectUri };
            if (exchangeShouldThrow) throw new Error('simulated token endpoint failure');
            const idToken = signIdToken(nextClaims || {});
            remember(idToken);
            return idToken;
          },
          getCerts: async () => ({ [KID]: publicKey })
        });
        nextClaims = prev;
        return cb;
      })();
      record('IDTOKEN invalid signature rejected', forged.errorCode === 'generic');
      if (dbOk) {
        const created = await prisma.user.findUnique({ where: { email } });
        record('IDTOKEN failures created no user', !created);
      }
    }

    // ----- ACCOUNT LINKING SAFETY -----
    await dbSection('LINK + email/password REGRESSION', async () => {
      const pw = 'OauthPw!2026-Strong';
      const { user, email } = await createUser({ label: 'pwuser', password: pw });
      const sub = testSub('pwuser');
      const loginTry = await flow({ intent: 'login', claims: { sub, email } });
      const signupTry = await flow({ intent: 'signup', role: 'OWNER', claims: { sub, email } });
      record('LINK existing password account NOT linked on login -> account_exists', loginTry.cb.errorCode === 'account_exists');
      record('LINK existing password account NOT linked on signup -> account_exists', signupTry.cb.errorCode === 'account_exists');
      const links = await prisma.authAccount.count({ where: { OR: [{ userId: user.id }, { providerAccountId: sub }] } });
      record('LINK no AuthAccount created for existing email', links === 0);
      const after = await prisma.user.findUnique({ where: { id: user.id } });
      record('LINK existing account role/password untouched', after.role === 'PLAYER' && !!after.passwordHash);
      const upper = await flow({ intent: 'signup', claims: { sub: testSub('pwupper'), email: email.toUpperCase() } });
      record('LINK email match is case-insensitive (no duplicate account)', upper.cb.errorCode === 'account_exists');

      // Email/password regression on the same account
      const login = await request('POST', '/api/auth/login', { body: { email, password: pw } });
      remember(login.body && login.body.token, login.body && login.body.refreshToken);
      record('REGRESSION email/password login unchanged', login.status === 200 && !!login.body.token && !!login.body.refreshToken && login.body.user.email === email);
      const badLogin = await request('POST', '/api/auth/login', { body: { email, password: 'wrong-password' } });
      record('REGRESSION wrong password still 401', badLogin.status === 401);
      const refreshed = await request('POST', '/api/auth/refresh', { body: { refreshToken: login.body.refreshToken } });
      remember(refreshed.body && refreshed.body.token, refreshed.body && refreshed.body.refreshToken);
      record('REGRESSION refresh unchanged (rotates)', refreshed.status === 200 && !!refreshed.body.refreshToken && refreshed.body.refreshToken !== login.body.refreshToken);
      const reuse = await request('POST', '/api/auth/refresh', { body: { refreshToken: login.body.refreshToken } });
      record('REGRESSION rotated refresh token cannot be reused', reuse.status === 401);
      const logout = await request('POST', '/api/auth/logout', { token: refreshed.body.token, body: { refreshToken: refreshed.body.refreshToken } });
      const afterLogout = await request('POST', '/api/auth/refresh', { body: { refreshToken: refreshed.body.refreshToken } });
      record('REGRESSION logout unchanged (revokes refresh token)', logout.status === 200 && afterLogout.status === 401);
    });

    // ----- REGISTRATION REGRESSION -----
    await dbSection('REGRESSION registration', async () => {
      const regEmail = testEmail('register');
      const reg = await request('POST', '/api/auth/register', {
        body: { email: regEmail, password: 'Register!2026-Strong', fullName: 'Register Test', role: 'PLAYER' }
      });
      if (reg.body && reg.body.user) cleanupUserIds.add(reg.body.user.id);
      remember(reg.body && reg.body.token, reg.body && reg.body.refreshToken);
      record('REGRESSION registration unchanged', reg.status === 201 && !!reg.body.token && reg.body.user.role === 'PLAYER');
      const regAdmin = await request('POST', '/api/auth/register', {
        body: { email: testEmail('registeradmin'), password: 'Register!2026-Strong', fullName: 'Nope', role: 'ADMIN' }
      });
      record('REGRESSION registration still rejects ADMIN', regAdmin.status === 400);
    });

    // ----- LOGIN -----
    await dbSection('LOGIN + SESSION', async () => {
      const unknown = await flow({ intent: 'login', claims: { sub: testSub('unknown'), email: testEmail('unknown') } });
      record('LOGIN unknown Google account -> no_account', unknown.cb.errorCode === 'no_account');
      const none = await prisma.user.findUnique({ where: { email: testEmail('unknown') } });
      record('LOGIN unknown account does not create a user', !none);

      const sub = testSub('linked');
      const { user } = await createUser({ label: 'linked', googleSub: sub });
      const r = await flow({ intent: 'login', claims: { sub, email: testEmail('linked') } });
      record('LOGIN existing Google account redirects to callback page', r.cb.location === `${TEST_APP_BASE}/pages/auth/oauth-callback.html`);
      const ex = await exchange(r.cb.exchangeCookie && r.cb.exchangeCookie.value);
      record('LOGIN exchange returns token/refreshToken/user', ex.status === 200 && !!ex.body.token && !!ex.body.refreshToken && ex.body.user.id === user.id);
      record('LOGIN exchange user role comes from database', ex.body.user && ex.body.user.role === 'PLAYER');
      const me = await request('GET', '/api/auth/me', { token: ex.body.token });
      record('SESSION Google-issued access token works with /auth/me', me.status === 200 && me.body.user.id === user.id);

      // Linked by sub even if Google email changed later
      const renamed = await flow({ intent: 'login', claims: { sub, email: testEmail('linked-renamed') } });
      record('LOGIN matches by Google sub, not email', !!renamed.cb.exchangeCookie && !renamed.cb.errorCode);
      await exchange(renamed.cb.exchangeCookie && renamed.cb.exchangeCookie.value);

      await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
      const stale = await request('GET', '/api/auth/me', { token: ex.body.token });
      record('SESSION sessionVersion bump invalidates Google-issued token', stale.status === 401);

      const r2 = await flow({ intent: 'login', claims: { sub, email: testEmail('linked') } });
      const ex2 = await exchange(r2.cb.exchangeCookie && r2.cb.exchangeCookie.value);
      const la = await request('POST', '/api/auth/logout-all', { token: ex2.body.token });
      const afterLa = await request('GET', '/api/auth/me', { token: ex2.body.token });
      const refreshAfterLa = await request('POST', '/api/auth/refresh', { body: { refreshToken: ex2.body.refreshToken } });
      record('SESSION logout-all invalidates Google-issued tokens', la.status === 200 && afterLa.status === 401 && refreshAfterLa.status === 401);

      // sessionVersion changed between callback and exchange -> exchange rejected
      const r3 = await flow({ intent: 'login', claims: { sub, email: testEmail('linked') } });
      await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
      const ex3 = await exchange(r3.cb.exchangeCookie && r3.cb.exchangeCookie.value);
      record('SESSION exchange rejected if sessions were revoked after callback', ex3.status === 401);
    });

    // ----- SIGNUP -----
    await dbSection('SIGNUP + OWNER SIGNUP + PASSWORD/DELETE edge cases', async () => {
      const sub = testSub('player');
      const email = testEmail('player');
      const r = await flow({ intent: 'signup', role: 'PLAYER', claims: { sub, email, name: 'Google Player' } });
      const ex = await exchange(r.cb.exchangeCookie && r.cb.exchangeCookie.value);
      const u = await prisma.user.findUnique({ where: { email }, include: { authAccounts: true, ownerProfile: true } });
      if (u) cleanupUserIds.add(u.id);
      record('SIGNUP PLAYER creates User', !!u && u.role === 'PLAYER');
      record('SIGNUP PLAYER has null passwordHash', !!u && u.passwordHash === null);
      record('SIGNUP PLAYER emailVerifiedAt set', !!u && u.emailVerifiedAt instanceof Date);
      record(
        'SIGNUP PLAYER AuthAccount created (GOOGLE, sub, email)',
        !!u && u.authAccounts.length === 1 && u.authAccounts[0].provider === 'GOOGLE' &&
          u.authAccounts[0].providerAccountId === sub && u.authAccounts[0].providerEmail === email
      );
      record('SIGNUP PLAYER has no ownerProfile', !!u && !u.ownerProfile);
      record('SIGNUP PLAYER exchange returns PLAYER session', ex.status === 200 && ex.body.user.role === 'PLAYER' && ex.body.isNewUser === true);
      record('SIGNUP uses Google name for fullName', !!u && u.fullName === 'Google Player');

      const pwChange = await request('PUT', '/api/auth/password', {
        token: ex.body.token,
        body: { currentPassword: 'whatever', newPassword: 'NewPass!2026-Strong' }
      });
      record('PASSWORD Google-only user PUT /password -> safe 400 NO_PASSWORD', pwChange.status === 400 && pwChange.body.code === 'NO_PASSWORD');
      const del = await request('DELETE', '/api/auth/me', { token: ex.body.token, body: { currentPassword: 'whatever' } });
      record(
        'DELETE Google-only user cannot bypass password check (Phase 2)',
        del.status === 400 && !!del.body && del.body.code === 'NO_PASSWORD',
        `status ${del.status}, content-type ${del.headers['content-type'] || 'none'}, body bytes ${del.raw.length}`
      );

      const again = await flow({ intent: 'signup', role: 'OWNER', claims: { sub, email } });
      const exAgain = await exchange(again.cb.exchangeCookie && again.cb.exchangeCookie.value);
      record('SIGNUP repeat with linked Google account logs in (no role change)', exAgain.status === 200 && exAgain.body.user.role === 'PLAYER');

      const oSub = testSub('owner');
      const oEmail = testEmail('owner');
      const o = await flow({ intent: 'signup', role: 'OWNER', claims: { sub: oSub, email: oEmail } });
      const oEx = await exchange(o.cb.exchangeCookie && o.cb.exchangeCookie.value);
      const ou = await prisma.user.findUnique({ where: { email: oEmail }, include: { authAccounts: true, ownerProfile: true } });
      if (ou) cleanupUserIds.add(ou.id);
      record('OWNER SIGNUP creates User with role OWNER', !!ou && ou.role === 'OWNER');
      record('OWNER SIGNUP creates ownerProfile NOT_SUBMITTED', !!ou && !!ou.ownerProfile && ou.ownerProfile.verificationStatus === 'NOT_SUBMITTED');
      record('OWNER SIGNUP AuthAccount created', !!ou && ou.authAccounts.length === 1 && ou.authAccounts[0].providerAccountId === oSub);
      record('OWNER SIGNUP passwordHash null', !!ou && ou.passwordHash === null);
      record('OWNER SIGNUP emailVerifiedAt set', !!ou && ou.emailVerifiedAt instanceof Date);
      record('OWNER SIGNUP exchange returns OWNER session', oEx.status === 200 && oEx.body.user.role === 'OWNER');

      // Account deletion removes AuthAccount rows (simulate with a password-holding Google user)
      const dSub = testSub('delete');
      const { user: dUser } = await createUser({ label: 'delete', password: 'Delete!2026-Strong', googleSub: dSub });
      const dLogin = await request('POST', '/api/auth/login', { body: { email: testEmail('delete'), password: 'Delete!2026-Strong' } });
      remember(dLogin.body && dLogin.body.token, dLogin.body && dLogin.body.refreshToken);
      const dRes = await request('DELETE', '/api/auth/me', { token: dLogin.body.token, body: { currentPassword: 'Delete!2026-Strong' } });
      const dLinks = await prisma.authAccount.count({ where: { userId: dUser.id } });
      record('DELETE /me removes AuthAccount rows', dRes.status === 200 && dLinks === 0);
      const dAfter = await flow({ intent: 'login', claims: { sub: dSub, email: testEmail('delete') } });
      record('DELETE deleted user cannot sign in with Google afterwards', dAfter.cb.errorCode === 'no_account');
    });

    // ----- ADMIN + ACCOUNT STATUS -----
    await dbSection('ADMIN block + ACCOUNT STATUS', async () => {
      const aSub = testSub('admin');
      await createUser({ label: 'admin', role: 'ADMIN', googleSub: aSub });
      const a = await flow({ intent: 'login', claims: { sub: aSub, email: testEmail('admin') } });
      record('ROLE existing ADMIN Google login blocked', a.cb.errorCode === 'not_allowed' && !a.cb.exchangeCookie);

      const sSub = testSub('susp');
      await createUser({ label: 'susp', status: 'SUSPENDED', googleSub: sSub });
      const s = await flow({ intent: 'login', claims: { sub: sSub, email: testEmail('susp') } });
      record('STATUS suspended user rejected', s.cb.errorCode === 'suspended');

      const dSub = testSub('deact');
      await createUser({ label: 'deact', status: 'DEACTIVATED', googleSub: dSub });
      const d = await flow({ intent: 'login', claims: { sub: dSub, email: testEmail('deact') } });
      record('STATUS deactivated user rejected', d.cb.errorCode === 'not_allowed');

      const xSub = testSub('deleted');
      await createUser({ label: 'deleted', status: 'DEACTIVATED', googleSub: xSub, deleted: true });
      const x = await flow({ intent: 'login', claims: { sub: xSub, email: testEmail('deleted') } });
      record('STATUS deleted user rejected', x.cb.errorCode === 'not_allowed');

      // Suspended between callback and exchange
      const lSub = testSub('latesusp');
      const { user: lUser } = await createUser({ label: 'latesusp', googleSub: lSub });
      const l = await flow({ intent: 'login', claims: { sub: lSub, email: testEmail('latesusp') } });
      await prisma.user.update({ where: { id: lUser.id }, data: { status: 'SUSPENDED' } });
      const lEx = await exchange(l.cb.exchangeCookie && l.cb.exchangeCookie.value);
      record('STATUS user suspended before exchange cannot redeem', lEx.status === 401);
    });

    // ----- EXCHANGE -----
    await dbSection('EXCHANGE', async () => {
      const sub = testSub('exch');
      await createUser({ label: 'exch', googleSub: sub });
      const r = await flow({ intent: 'login', claims: { sub, email: testEmail('exch') } });
      const cookie = r.cb.exchangeCookie;
      record('EXCHANGE cookie HttpOnly', !!(cookie && cookie.attrs.httponly));
      record('EXCHANGE cookie SameSite=Strict', !!(cookie && String(cookie.attrs.samesite).toLowerCase() === 'strict'));
      record('EXCHANGE cookie scoped to exchange path', !!(cookie && cookie.attrs.path === '/api/auth/google/exchange'));
      record('EXCHANGE cookie ~60s lifetime', !!(cookie && Number(cookie.attrs['max-age']) === 60));
      const ok = await exchange(cookie && cookie.value);
      record('EXCHANGE succeeds once', ok.status === 200 && !!ok.body.token);
      record('EXCHANGE response is no-store', /no-store/.test(String(ok.headers['cache-control'] || '')));
      const cleared = findCookie(ok, oauthState.EXCHANGE_COOKIE);
      record('EXCHANGE clears its cookie', !!(cleared && cleared.value === '' && Number(cleared.attrs['max-age']) === 0));
      const replay = await exchange(cookie && cookie.value);
      record('EXCHANGE replay rejected (single-use)', replay.status === 401 && !replay.body.token);
      record('EXCHANGE replay returns safe error', replay.body && typeof replay.body.error === 'string' && !/stack|prisma|sql/i.test(JSON.stringify(replay.body)));
      const none = await exchange(null);
      record('EXCHANGE without cookie rejected', none.status === 401);
      const garbage = await exchange('not-a-real-ticket-value-0123456789');
      record('EXCHANGE forged ticket rejected', garbage.status === 401);

      const r2 = await flow({ intent: 'login', claims: { sub, email: testEmail('exch') } });
      oauthState._expireExchangeTicketsForTest();
      const late = await exchange(r2.cb.exchangeCookie && r2.cb.exchangeCookie.value);
      record('EXCHANGE expired ticket rejected', late.status === 401);
    });

    // ----- URL / LOG SAFETY -----
    {
      const urls = allRedirects.filter(Boolean);
      const frontendRedirects = urls.filter((u) => !u.startsWith(google.GOOGLE_AUTH_ENDPOINT));
      const tokenish = /eyJ[A-Za-z0-9_-]{10,}\.|token=|refresh|id_token|access_token|code=|state=|nonce=/i;
      record('URL no JWT / token / code / state in frontend redirects', frontendRedirects.every((u) => !tokenish.test(u)));
      record(
        'URL frontend redirects go only to login error page or callback page',
        frontendRedirects.every((u) => {
          const p = new URL(u, TEST_APP_BASE);
          return p.origin === TEST_APP_BASE &&
            (p.pathname === '/pages/auth/oauth-callback.html' && !p.search ||
              p.pathname === '/pages/auth/login.html' && [...p.searchParams.keys()].join() === 'oauth_error');
        })
      );
      record(
        'URL only fixed OAuth error codes appear in redirects',
        frontendRedirects.map(errorCodeOf).filter((c) => c !== null).every((c) => ALLOWED_ERROR_CODES.has(c))
      );
      const leakedSensitive = frontendRedirects.some((u) => [...sensitive].some((s) => u.includes(s)));
      record('URL no collected token/code/state values in frontend redirects', !leakedSensitive);
      record('URL no email or Google sub in redirects', frontendRedirects.every((u) => !u.includes(EMAIL_DOMAIN) && !u.includes('sub-')));

      const logText = captured.join('\n');
      const secrets = [TEST_CLIENT_SECRET, TEST_STATE_SECRET, process.env.JWT_SECRET].filter(Boolean);
      record('LOGS contain no client/state/JWT secrets', secrets.every((s) => !logText.includes(s)));
      const leakedToken = [...sensitive].find((s) => logText.includes(s));
      record(
        'LOGS contain no state/nonce/code_verifier/code/ID token/access/refresh tokens',
        !leakedToken,
        leakedToken ? 'a collected sensitive value appeared in output' : ''
      );
      record('LOGS contain no test identity emails', !logText.includes(`@${EMAIL_DOMAIN}`));
    }
  } finally {
    await runCleanupAndReport();
    await new Promise((r) => server.close(r));
    await prisma.$disconnect().catch(() => {});
  }

  const passed = results.filter((r) => r.status === PASS).length;
  const failed = results.filter((r) => r.status === FAIL).length;
  const skipped = results.filter((r) => r.status === SKIP).length;
  console.log('\n---');
  console.log(`PASS ${passed} / FAIL ${failed} / SKIP ${skipped}`);
  if (skipped) console.log('Incomplete: database-backed sections were skipped (database unreachable).');
  process.exit(failed || skipped ? 1 : 0);
}

main().catch(async (err) => {
  const frames = String((err && err.stack) || '')
    .split('\n')
    .filter((l) => l.includes('test-google-oauth.js'))
    .map((l) => l.trim().replace(/^.*[\\/]scripts[\\/]/, 'scripts/'))
    .slice(0, 3);
  const message = err instanceof TypeError ? err.message : '';
  console.error('Suite crashed:', err && err.name ? err.name : 'unknown error', message, frames.join(' <- '));
  await runCleanupAndReport();
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
