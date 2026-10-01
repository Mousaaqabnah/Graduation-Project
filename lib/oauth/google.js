/**
 * Google OAuth 2.0 / OpenID Connect helper (Authorization Code + PKCE S256).
 *
 * - Client secret stays server-side; it is only sent to Google's token endpoint.
 * - Google access/refresh tokens are never returned or persisted; only the verified
 *   ID token claims needed by MatchField (sub, email, name) leave this module.
 * - Never log codes, tokens, verifier errors, or claim payloads (library error
 *   messages can embed token contents).
 */

const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const GOOGLE_SCOPES = ['openid', 'email', 'profile'];
const MIN_STATE_SECRET_LENGTH = 32;
const CLOCK_SKEW_SECS = 300;

class GoogleOAuthError extends Error {
  /** @param {string} code one of the fixed OAuth error codes */
  constructor(code) {
    super(`Google OAuth failed: ${code}`);
    this.name = 'GoogleOAuthError';
    this.oauthCode = code;
  }
}

function readGoogleConfig() {
  const flag = String(process.env.GOOGLE_OAUTH_ENABLED || '').trim().toLowerCase();
  return {
    enabled: flag === 'true' || flag === '1',
    clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    redirectUri: String(process.env.GOOGLE_REDIRECT_URI || '').trim(),
    stateSecret: String(process.env.OAUTH_STATE_SECRET || ''),
    appBaseUrl: String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '')
  };
}

/**
 * Validate Google OAuth configuration. Returns variable NAMES only, never values.
 * @returns {{ enabled: boolean, errors: string[] }}
 */
function validateGoogleConfig(cfg = readGoogleConfig()) {
  const errors = [];
  if (!cfg.enabled) return { enabled: false, errors };

  const missing = [];
  if (!cfg.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!cfg.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!cfg.redirectUri) missing.push('GOOGLE_REDIRECT_URI');
  if (!cfg.stateSecret) missing.push('OAUTH_STATE_SECRET');
  if (missing.length) errors.push(`missing: ${missing.join(', ')}`);

  if (cfg.stateSecret && cfg.stateSecret.length < MIN_STATE_SECRET_LENGTH) {
    errors.push(`OAUTH_STATE_SECRET must be at least ${MIN_STATE_SECRET_LENGTH} characters`);
  }

  if (cfg.redirectUri) {
    let parsed = null;
    try {
      parsed = new URL(cfg.redirectUri);
    } catch {
      errors.push('GOOGLE_REDIRECT_URI is not a valid absolute URL');
    }
    if (parsed) {
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        errors.push('GOOGLE_REDIRECT_URI must use http or https');
      }
      if (isProduction() && parsed.protocol !== 'https:') {
        errors.push('GOOGLE_REDIRECT_URI must use HTTPS in production');
      }
      if (parsed.pathname !== '/api/auth/google/callback') {
        errors.push('GOOGLE_REDIRECT_URI path must be /api/auth/google/callback');
      }
      if (parsed.search || parsed.hash) {
        errors.push('GOOGLE_REDIRECT_URI must not contain a query string or fragment');
      }
    }
  }

  if (isProduction() && !cfg.appBaseUrl) {
    errors.push('APP_BASE_URL is required in production when GOOGLE_OAUTH_ENABLED=true');
  }

  return { enabled: true, errors };
}

/** True only when the flag is on AND configuration is complete. */
function isGoogleOAuthEnabled() {
  const result = validateGoogleConfig();
  return result.enabled && result.errors.length === 0;
}

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function randomToken(bytes = 32) {
  return base64url(crypto.randomBytes(bytes));
}

/** RFC 7636 verifier (43–128 chars of unreserved characters). */
function createPkcePair() {
  const codeVerifier = randomToken(48);
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier, 'ascii').digest());
  return { codeVerifier, codeChallenge, codeChallengeMethod: 'S256' };
}

function pkceChallengeFor(codeVerifier) {
  return base64url(crypto.createHash('sha256').update(String(codeVerifier), 'ascii').digest());
}

/**
 * Build the Google authorization URL. Uses only the configured redirect URI.
 */
function buildAuthorizationUrl({ state, nonce, codeChallenge }) {
  const cfg = readGoogleConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    access_type: 'online',
    include_granted_scopes: 'false'
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

let testDriver = null;

/**
 * Test-only hook to replace network calls (token exchange + Google signing certs).
 * Ignored in production.
 * @param {{ exchangeCode?: Function, getCerts?: Function } | null} driver
 */
function _setGoogleTestDriver(driver) {
  if (isProduction()) {
    throw new Error('Google OAuth test driver cannot be installed in production');
  }
  testDriver = driver || null;
}

function activeDriver() {
  return !isProduction() && testDriver ? testDriver : null;
}

function createClient() {
  const cfg = readGoogleConfig();
  return new OAuth2Client({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    redirectUri: cfg.redirectUri
  });
}

async function exchangeCodeForIdToken(client, code, codeVerifier) {
  const driver = activeDriver();
  if (driver && typeof driver.exchangeCode === 'function') {
    return driver.exchangeCode({ code, codeVerifier, redirectUri: readGoogleConfig().redirectUri });
  }
  const { tokens } = await client.getToken({
    code,
    codeVerifier,
    redirect_uri: readGoogleConfig().redirectUri
  });
  return tokens && tokens.id_token ? tokens.id_token : null;
}

async function getSigningCerts(client) {
  const driver = activeDriver();
  if (driver && typeof driver.getCerts === 'function') {
    return driver.getCerts();
  }
  const { certs } = await client.getFederatedSignonCertsAsync();
  return certs;
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Exchange the authorization code and verify the Google ID token.
 * @returns {Promise<{ sub: string, email: string, name: string | null }>}
 * @throws {GoogleOAuthError}
 */
async function exchangeAndVerify({ code, codeVerifier, expectedNonce }) {
  const cfg = readGoogleConfig();
  const client = createClient();

  let idToken;
  try {
    idToken = await exchangeCodeForIdToken(client, code, codeVerifier);
  } catch {
    throw new GoogleOAuthError('generic');
  }
  if (!idToken || typeof idToken !== 'string') throw new GoogleOAuthError('generic');

  let payload;
  try {
    const certs = await getSigningCerts(client);
    const ticket = await client.verifySignedJwtWithCertsAsync(
      idToken,
      certs,
      cfg.clientId,
      GOOGLE_ISSUERS
    );
    payload = ticket.getPayload();
  } catch {
    throw new GoogleOAuthError('generic');
  }
  if (!payload) throw new GoogleOAuthError('generic');

  // Defense in depth on top of the library checks.
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(cfg.clientId)) throw new GoogleOAuthError('generic');
  if (!GOOGLE_ISSUERS.includes(payload.iss)) throw new GoogleOAuthError('generic');
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECS < now) {
    throw new GoogleOAuthError('generic');
  }
  if (!safeEqual(payload.nonce, expectedNonce)) throw new GoogleOAuthError('generic');

  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!sub || sub.length > 255) throw new GoogleOAuthError('generic');

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new GoogleOAuthError('email_unverified');
  }
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new GoogleOAuthError('email_unverified');
  }

  const name = typeof payload.name === 'string' && payload.name.trim()
    ? payload.name.trim().slice(0, 120)
    : null;

  return { sub, email, name };
}

module.exports = {
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_ISSUERS,
  GOOGLE_SCOPES,
  MIN_STATE_SECRET_LENGTH,
  GoogleOAuthError,
  readGoogleConfig,
  validateGoogleConfig,
  isGoogleOAuthEnabled,
  randomToken,
  createPkcePair,
  pkceChallengeFor,
  buildAuthorizationUrl,
  exchangeAndVerify,
  safeEqual,
  _setGoogleTestDriver
};
