/**
 * OAuth state + exchange-ticket handling.
 *
 * State cookie: AES-256-GCM sealed (key derived from OAUTH_STATE_SECRET), so it is both
 * confidential and tamper-evident. HttpOnly, SameSite=Lax, Secure in production,
 * Path=/api/auth/google, ~10 minutes, single-use (consumed states are remembered until
 * they expire).
 *
 * Exchange ticket: random 256-bit id in an HttpOnly SameSite=Strict cookie scoped to
 * the exchange endpoint; only its SHA-256 hash is kept server-side, for ~60 seconds,
 * and it is deleted on first use.
 *
 * Stores are in-memory (single process), matching lib/security/rateLimit.js.
 * Never log cookie values, states, nonces, verifiers, or signatures.
 */

const crypto = require('crypto');

const STATE_COOKIE = 'mf_oauth_state';
const STATE_COOKIE_PATH = '/api/auth/google';
const STATE_TTL_MS = 10 * 60 * 1000;

const EXCHANGE_COOKIE = 'mf_oauth_exchange';
const EXCHANGE_COOKIE_PATH = '/api/auth/google/exchange';
const EXCHANGE_TTL_MS = 60 * 1000;

const MAX_STORE_ENTRIES = 10000;
const SEAL_AAD = Buffer.from('matchfield-oauth-state-v1', 'utf8');
const KEY_INFO = Buffer.from('matchfield-oauth-state-cookie', 'utf8');
const IV_BYTES = 12;
const TAG_BYTES = 16;

const consumedStates = new Map();
const exchangeTickets = new Map();

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(s + '='.repeat((4 - (s.length % 4)) % 4), 'base64');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function sealingKey() {
  const secret = String(process.env.OAUTH_STATE_SECRET || '');
  if (secret.length < 32) throw new Error('OAuth state secret unavailable');
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.alloc(0), KEY_INFO, 32));
}

function seal(plaintext) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', sealingKey(), iv);
  cipher.setAAD(SEAL_AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return base64url(Buffer.concat([iv, cipher.getAuthTag(), ciphertext]));
}

function unseal(value) {
  const buf = fromBase64url(value);
  if (buf.length <= IV_BYTES + TAG_BYTES) return null;
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', sealingKey(), iv);
  decipher.setAAD(SEAL_AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function prune(map, now) {
  for (const [k, exp] of map) {
    const expiresAt = typeof exp === 'number' ? exp : exp.expiresAt;
    if (expiresAt <= now) map.delete(k);
  }
}

function boundedSet(map, key, value) {
  const now = Date.now();
  if (map.size >= MAX_STORE_ENTRIES) prune(map, now);
  if (map.size >= MAX_STORE_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

/** Minimal cookie header parser (no dependency). */
function parseCookies(req) {
  const header = req && req.headers ? req.headers.cookie : '';
  const out = {};
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    if (!name || Object.prototype.hasOwnProperty.call(out, name)) continue;
    let value = part.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

function serializeCookie(name, value, { path, maxAgeSec, sameSite }) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
    'HttpOnly',
    `SameSite=${sameSite}`
  ];
  if (maxAgeSec <= 0) parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  if (isProduction()) parts.push('Secure');
  return parts.join('; ');
}

function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', [cookie]);
  else res.setHeader('Set-Cookie', [].concat(prev, cookie));
}

// ---------------------------------------------------------------------------
// State cookie
// ---------------------------------------------------------------------------

/**
 * @param {{ state: string, nonce: string, codeVerifier: string, intent: string, role: string }} data
 */
function createStateCookieValue(data, now = Date.now()) {
  const payload = {
    v: 1,
    s: data.state,
    n: data.nonce,
    cv: data.codeVerifier,
    i: data.intent,
    r: data.role,
    exp: now + STATE_TTL_MS
  };
  return seal(JSON.stringify(payload));
}

/**
 * Authenticate/decrypt + check expiry. Returns null on any failure (never throws, never logs).
 */
function verifyStateCookieValue(raw, now = Date.now()) {
  try {
    if (!raw || typeof raw !== 'string' || raw.length > 4096) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null;
    const plaintext = unseal(raw);
    if (!plaintext) return null;
    const payload = JSON.parse(plaintext);
    if (!payload || payload.v !== 1) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    for (const key of ['s', 'n', 'cv', 'i', 'r']) {
      if (typeof payload[key] !== 'string' || !payload[key]) return null;
    }
    return {
      state: payload.s,
      nonce: payload.n,
      codeVerifier: payload.cv,
      intent: payload.i,
      role: payload.r,
      expiresAt: payload.exp
    };
  } catch {
    return null;
  }
}

function setStateCookie(res, value) {
  appendSetCookie(
    res,
    serializeCookie(STATE_COOKIE, value, {
      path: STATE_COOKIE_PATH,
      maxAgeSec: STATE_TTL_MS / 1000,
      sameSite: 'Lax'
    })
  );
}

function clearStateCookie(res) {
  appendSetCookie(
    res,
    serializeCookie(STATE_COOKIE, '', { path: STATE_COOKIE_PATH, maxAgeSec: 0, sameSite: 'Lax' })
  );
}

function readStateCookie(req) {
  return parseCookies(req)[STATE_COOKIE] || null;
}

/**
 * Mark a state as used. Returns false when it was already consumed (replay).
 */
function consumeState(state, expiresAt) {
  const now = Date.now();
  const key = sha256Hex(state);
  const existing = consumedStates.get(key);
  if (existing && existing > now) return false;
  boundedSet(consumedStates, key, Math.max(expiresAt || 0, now + STATE_TTL_MS));
  return true;
}

// ---------------------------------------------------------------------------
// Exchange tickets
// ---------------------------------------------------------------------------

/**
 * @param {{ userId: string, sessionVersion: number, isNewUser: boolean }} data
 * @returns {string} raw ticket id (only ever placed in an HttpOnly cookie)
 */
function createExchangeTicket(data) {
  const raw = base64url(crypto.randomBytes(32));
  boundedSet(exchangeTickets, sha256Hex(raw), {
    userId: data.userId,
    sessionVersion: Number(data.sessionVersion) || 0,
    isNewUser: !!data.isNewUser,
    expiresAt: Date.now() + EXCHANGE_TTL_MS
  });
  return raw;
}

/**
 * Single-use: the ticket is deleted before validation so a replay always fails.
 */
function consumeExchangeTicket(raw) {
  if (!raw || typeof raw !== 'string' || raw.length > 256) return null;
  const key = sha256Hex(raw);
  const entry = exchangeTickets.get(key);
  exchangeTickets.delete(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry;
}

function setExchangeCookie(res, raw) {
  appendSetCookie(
    res,
    serializeCookie(EXCHANGE_COOKIE, raw, {
      path: EXCHANGE_COOKIE_PATH,
      maxAgeSec: EXCHANGE_TTL_MS / 1000,
      sameSite: 'Strict'
    })
  );
}

function clearExchangeCookie(res) {
  appendSetCookie(
    res,
    serializeCookie(EXCHANGE_COOKIE, '', { path: EXCHANGE_COOKIE_PATH, maxAgeSec: 0, sameSite: 'Strict' })
  );
}

function readExchangeCookie(req) {
  return parseCookies(req)[EXCHANGE_COOKIE] || null;
}

/** Test helpers */
function _resetOAuthStores() {
  consumedStates.clear();
  exchangeTickets.clear();
}

function _expireExchangeTicketsForTest() {
  for (const entry of exchangeTickets.values()) entry.expiresAt = 0;
}

module.exports = {
  STATE_COOKIE,
  STATE_COOKIE_PATH,
  STATE_TTL_MS,
  EXCHANGE_COOKIE,
  EXCHANGE_COOKIE_PATH,
  EXCHANGE_TTL_MS,
  parseCookies,
  timingSafeEqualStr,
  createStateCookieValue,
  verifyStateCookieValue,
  setStateCookie,
  clearStateCookie,
  readStateCookie,
  consumeState,
  createExchangeTicket,
  consumeExchangeTicket,
  setExchangeCookie,
  clearExchangeCookie,
  readExchangeCookie,
  _resetOAuthStores,
  _expireExchangeTicketsForTest
};
