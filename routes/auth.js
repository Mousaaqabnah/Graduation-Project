const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../lib/prisma');
const { authenticate, authenticateAllowSuspended } = require('../middleware/auth');
const { ensurePlayerCodeForUser, createUniquePlayerCode } = require('../lib/playerCode');
const { createUniqueUsername } = require('../lib/username');
const { serializeUser } = require('../lib/serializers');
const { writeAuditLog } = require('../lib/audit');
const { invalidateUserSessions, revokeAllRefreshTokens } = require('../lib/session');
const { createRateLimiter } = require('../lib/security/rateLimit');
const { setNoStore } = require('../lib/security/errors');
const { strongPassword, strongNewPassword } = require('../lib/security/validate');
const {
  GoogleOAuthError,
  isGoogleOAuthEnabled,
  randomToken,
  createPkcePair,
  buildAuthorizationUrl,
  exchangeAndVerify
} = require('../lib/oauth/google');
const oauthState = require('../lib/oauth/stateCookie');

const router = express.Router();

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || '1h';
const REFRESH_TOKEN_TTL_MS = Number(process.env.JWT_REFRESH_TTL_MS) || 30 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_BYTES = 32;
const RESET_EXPIRY_MS = 60 * 60 * 1000;
const BCRYPT_ROUNDS = Math.min(15, Math.max(10, Number(process.env.BCRYPT_ROUNDS) || 12));

const authStrictLimiter = createRateLimiter({
  bucket: 'auth-strict',
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 80,
  message: 'Too many authentication attempts. Please try again later.'
});
const authRefreshLimiter = createRateLimiter({
  bucket: 'auth-refresh',
  windowMs: Number(process.env.RATE_LIMIT_REFRESH_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_REFRESH_MAX) || 60,
  message: 'Too many refresh attempts. Please try again later.'
});

function generateAccessToken(userId, sessionVersion = 0) {
  return jwt.sign(
    { userId, typ: 'access', sv: Number(sessionVersion) || 0 },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256' }
  );
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw), 'utf8').digest('hex');
}

async function issueRefreshToken(userId, req) {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      userAgent: req.get?.('user-agent') || null,
      ipAddress: String(req.ip || '').slice(0, 64) || null,
      expiresAt
    }
  });
  return raw;
}

function appBaseUrl(req) {
  const fromEnv = process.env.APP_BASE_URL && String(process.env.APP_BASE_URL).trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
  const proto = req.protocol || 'http';
  return `${proto}://${host}`;
}

async function userPayload(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { ownerProfile: true }
  });
  return serializeUser(user, { includePrivate: true });
}

// Register — public registration can never create ADMIN
router.post(
  '/register',
  authStrictLimiter,
  [
    body('email').trim().isEmail().isLength({ max: 254 }),
    strongPassword,
    body('fullName').trim().notEmpty().isLength({ max: 120 }),
    body('role').optional().isIn(['PLAYER', 'OWNER']),
    body('username').optional().trim().isLength({ min: 3, max: 40 })
  ],
  async (req, res) => {
    try {
      setNoStore(res);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const requestedRole = String(req.body.role || '').toUpperCase();
      if (requestedRole === 'ADMIN') {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const email = String(req.body.email).trim().toLowerCase();
      const { password, fullName, phone, dateOfBirth, gender, location } = req.body;
      const role = requestedRole === 'OWNER' ? 'OWNER' : 'PLAYER';

      const genderMap = {
        male: 'MALE',
        female: 'FEMALE',
        other: 'OTHER',
        prefer_not_to_say: 'PREFER_NOT_TO_SAY',
        'prefer not to say': 'PREFER_NOT_TO_SAY'
      };
      const genderRaw = gender != null ? String(gender).trim() : '';
      const genderNormalized = genderRaw
        ? genderMap[genderRaw.toLowerCase()] ||
          (['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(genderRaw.toUpperCase())
            ? genderRaw.toUpperCase()
            : null)
        : null;
      if (genderRaw && !genderNormalized) {
        return res.status(400).json({ error: 'Invalid gender value' });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const usernameSeed = req.body.username || email.split('@')[0] || fullName;
      const username = await createUniqueUsername(prisma, usernameSeed);
      const playerCode = await createUniquePlayerCode();

      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            username,
            passwordHash,
            fullName: String(fullName).trim(),
            phone: phone ? String(phone).trim() : null,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            gender: genderNormalized,
            location: location ? String(location).trim() : null,
            role,
            playerCode,
            ownerProfile:
              role === 'OWNER'
                ? { create: { verificationStatus: 'NOT_SUBMITTED' } }
                : undefined
          },
          include: { ownerProfile: true }
        });
        return created;
      });

      const token = generateAccessToken(user.id, user.sessionVersion ?? 0);
      const refreshToken = await issueRefreshToken(user.id, req);

      await writeAuditLog({
        actorId: user.id,
        action: 'CREATE',
        entityType: 'User',
        entityId: user.id,
        req
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: serializeUser(user, { includePrivate: true }),
        token,
        refreshToken
      });
    } catch (error) {
      if (error && (error.code === 'P2002' || String(error.message || '').includes('Unique'))) {
        return res.status(400).json({ error: 'Email or username already registered' });
      }
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login
router.post(
  '/login',
  authStrictLimiter,
  [body('email').trim().isEmail(), body('password').notEmpty().isLength({ max: 128 })],
  async (req, res) => {
    try {
      setNoStore(res);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const email = String(req.body.email).trim().toLowerCase();
      const { password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: { ownerProfile: true }
      });

      if (!user || user.deletedAt) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
        return res.status(403).json({
          error:
            user.status === 'SUSPENDED'
              ? 'Account is suspended'
              : 'Account is deactivated'
        });
      }
      if (!user.passwordHash) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (user.role === 'PLAYER') {
        await ensurePlayerCodeForUser(user.id);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      const token = generateAccessToken(user.id, user.sessionVersion);
      const refreshToken = await issueRefreshToken(user.id, req);
      const userData = await userPayload(user.id);

      await writeAuditLog({
        actorId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
        req
      });

      res.json({
        message: 'Login successful',
        user: userData,
        token,
        refreshToken
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Refresh access token
router.post(
  '/refresh',
  authRefreshLimiter,
  [body('refreshToken').trim().notEmpty().isLength({ max: 512 })],
  async (req, res) => {
    try {
      setNoStore(res);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const raw = String(req.body.refreshToken).trim();
      const tokenHash = hashToken(raw);
      const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      const user = await prisma.user.findUnique({ where: { id: stored.userId } });
      if (!user || user.deletedAt) {
        return res.status(401).json({ error: 'User not found' });
      }
      if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
        await prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() }
        });
        return res.status(403).json({
          error:
            user.status === 'SUSPENDED'
              ? 'Account is suspended'
              : 'Account is deactivated'
        });
      }

      // Rotate refresh token
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() }
      });
      const refreshToken = await issueRefreshToken(user.id, req);
      const token = generateAccessToken(user.id, user.sessionVersion);

      res.json({ token, refreshToken });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  }
);

// Logout (revoke refresh token); without body token, revokes all refresh tokens
router.post('/logout', authenticateAllowSuspended, async (req, res) => {
  try {
    const raw = req.body?.refreshToken ? String(req.body.refreshToken).trim() : '';
    if (raw) {
      const tokenHash = hashToken(raw);
      await prisma.refreshToken.updateMany({
        where: { userId: req.user.id, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    } else {
      await revokeAllRefreshTokens(req.user.id);
    }
    await writeAuditLog({
      actorId: req.user.id,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: req.user.id,
      req
    });
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Revoke all refresh tokens and bump sessionVersion (invalidates access JWTs)
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    await invalidateUserSessions(req.user.id);
    await writeAuditLog({
      actorId: req.user.id,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: req.user.id,
      metadata: { scope: 'all' },
      req
    });
    res.json({ message: 'Logged out of all sessions' });
  } catch (error) {
    console.error('Logout-all error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.post(
  '/forgot-password',
  authStrictLimiter,
  [body('email').trim().isEmail().isLength({ max: 254 })],
  async (req, res) => {
    try {
      setNoStore(res);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const email = String(req.body.email).trim().toLowerCase();
      const generic = {
        message:
          'If an account exists for that email, you will receive password reset instructions shortly.'
      };

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, passwordHash: true }
      });

      if (!user || !user.passwordHash) {
        return res.json(generic);
      }

      const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt
        }
      });

      const resetPath = `/pages/auth/reset-password.html?token=${encodeURIComponent(rawToken)}`;
      const resetUrl = `${appBaseUrl(req)}${resetPath}`;

      if (process.env.NODE_ENV !== 'production') {
        return res.json({
          ...generic,
          devResetUrl: resetUrl,
          devNote:
            'Email is not configured. Use devResetUrl to complete reset (development only; omitted in production).'
        });
      }

      res.json(generic);
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Could not process reset request' });
    }
  }
);

router.post(
  '/reset-password',
  authStrictLimiter,
  [body('token').trim().isLength({ min: 32, max: 256 }), strongNewPassword],
  async (req, res) => {
    try {
      setNoStore(res);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const rawToken = String(req.body.token).trim();
      const { newPassword } = req.body;
      const tokenHash = hashToken(rawToken);

      const user = await prisma.user.findFirst({
        where: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: { gt: new Date() }
        }
      });

      if (!user) {
        return res.status(400).json({
          error: 'Reset link is invalid or has expired. Request a new one from the login page.'
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
            sessionVersion: { increment: 1 }
          }
        });
        await tx.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      });

      res.json({ message: 'Password reset successfully. You can log in with your new password.' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Could not reset password' });
    }
  }
);

router.get('/me', authenticateAllowSuspended, async (req, res) => {
  try {
    if (req.user.role === 'PLAYER') {
      await ensurePlayerCodeForUser(req.user.id);
    }
    const user = await userPayload(req.user.id);
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

router.put(
  '/password',
  authenticate,
  [body('currentPassword').notEmpty().isLength({ max: 128 }), strongNewPassword],
  async (req, res) => {
    try {
      setNoStore(res);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;
      if (String(currentPassword) === String(newPassword)) {
        return res.status(400).json({
          error: 'New password must be different from current password'
        });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.passwordHash) {
        return res.status(400).json({ error: 'Account has no password on file.', code: 'NO_PASSWORD' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash, sessionVersion: { increment: 1 } }
        });
        await tx.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      });

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Password update error:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  }
);

router.delete(
  '/me',
  authenticate,
  [body('currentPassword').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.passwordHash) {
        return res.status(400).json({
          error: 'Account has no password on file. Unable to verify account deletion request.',
          code: 'NO_PASSWORD'
        });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          deletedAt: new Date(),
          status: 'DEACTIVATED',
          email: `deleted_${user.id}@deleted.local`,
          username: `deleted_${user.id}`.slice(0, 40)
        }
      });
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await prisma.authAccount.deleteMany({ where: { userId: user.id } });

      await writeAuditLog({
        actorId: user.id,
        action: 'DELETE',
        entityType: 'User',
        entityId: user.id,
        req
      });

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  }
);

// ---------------------------------------------------------------------------
// Google OAuth (Authorization Code + PKCE). All routes 404 unless enabled.
// Never log codes, tokens, state, nonce, verifier, cookies, or Google identity data.
// ---------------------------------------------------------------------------

const OAUTH_ERROR_CODES = new Set([
  'cancelled',
  'state_mismatch',
  'email_unverified',
  'account_exists',
  'no_account',
  'suspended',
  'not_allowed',
  'generic'
]);
const OAUTH_INTENTS = new Set(['login', 'signup']);
const OAUTH_SIGNUP_ROLES = new Set(['PLAYER', 'OWNER']);
const OAUTH_EXCHANGE_FAILED = 'Google sign-in session expired. Please try again.';

function frontendUrl(pathname) {
  const base = String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
  return `${base}${pathname}`;
}

function redirectOAuthError(res, code) {
  const safeCode = OAUTH_ERROR_CODES.has(code) ? code : 'generic';
  setNoStore(res);
  return res.redirect(302, frontendUrl(`/pages/auth/login.html?oauth_error=${safeCode}`));
}

function requireGoogleOAuth(req, res, next) {
  if (!isGoogleOAuthEnabled()) {
    return res.status(404).json({ error: 'Route not found' });
  }
  return next();
}

/** Phase 1: Google sign-in is for active PLAYER/OWNER accounts only. */
function googleLoginBlockReason(user) {
  if (!user || user.deletedAt) return 'not_allowed';
  if (user.status === 'SUSPENDED') return 'suspended';
  if (user.status !== 'ACTIVE') return 'not_allowed';
  if (!OAUTH_SIGNUP_ROLES.has(user.role)) return 'not_allowed';
  return null;
}

/**
 * Account matching rules:
 * A. Linked GOOGLE AuthAccount (by sub) -> log in that user (status/ADMIN checks).
 * B. No link but email belongs to an existing user -> account_exists (never auto-link).
 * C. No link, no user, intent=signup -> create PLAYER/OWNER + AuthAccount transactionally.
 * D. No link, no user, intent=login -> no_account.
 */
async function resolveGoogleAccount(identity, stored, req) {
  const linked = await prisma.authAccount.findUnique({
    where: {
      provider_providerAccountId: { provider: 'GOOGLE', providerAccountId: identity.sub }
    },
    include: { user: true }
  });

  if (linked) {
    const blocked = googleLoginBlockReason(linked.user);
    if (blocked) return { error: blocked };
    if (linked.user.role === 'PLAYER') {
      await ensurePlayerCodeForUser(linked.user.id);
    }
    await prisma.user.update({
      where: { id: linked.user.id },
      data: { lastLoginAt: new Date() }
    });
    await writeAuditLog({
      actorId: linked.user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: linked.user.id,
      metadata: { method: 'google' },
      req
    });
    return { user: linked.user, isNewUser: false };
  }

  const emailOwner = await prisma.user.findUnique({
    where: { email: identity.email },
    select: { id: true }
  });
  if (emailOwner) return { error: 'account_exists' };

  if (stored.intent !== 'signup') return { error: 'no_account' };
  if (!OAUTH_SIGNUP_ROLES.has(stored.role)) return { error: 'not_allowed' };

  const role = stored.role;
  const fullName = identity.name || identity.email.split('@')[0];
  const username = await createUniqueUsername(prisma, identity.email.split('@')[0] || fullName);
  const playerCode = await createUniquePlayerCode();

  let user;
  try {
    user = await prisma.$transaction(async (tx) =>
      tx.user.create({
        data: {
          email: identity.email,
          username,
          passwordHash: null,
          fullName: String(fullName).trim().slice(0, 120),
          role,
          playerCode,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          ownerProfile:
            role === 'OWNER' ? { create: { verificationStatus: 'NOT_SUBMITTED' } } : undefined,
          authAccounts: {
            create: {
              provider: 'GOOGLE',
              providerAccountId: identity.sub,
              providerEmail: identity.email
            }
          }
        }
      })
    );
  } catch (error) {
    if (error && error.code === 'P2002') return { error: 'account_exists' };
    throw error;
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'CREATE',
    entityType: 'User',
    entityId: user.id,
    metadata: { method: 'google' },
    req
  });
  return { user, isNewUser: true };
}

// Lets the frontend show the Google button only when the feature is enabled.
router.get('/google/config', requireGoogleOAuth, (req, res) => {
  setNoStore(res);
  res.json({ enabled: true });
});

router.get('/google/start', requireGoogleOAuth, authStrictLimiter, (req, res) => {
  try {
    setNoStore(res);
    const intent = typeof req.query.intent === 'string' ? req.query.intent : '';
    const roleParam = typeof req.query.role === 'string' ? req.query.role.trim().toUpperCase() : '';

    if (!OAUTH_INTENTS.has(intent)) return redirectOAuthError(res, 'not_allowed');
    if (roleParam && !OAUTH_SIGNUP_ROLES.has(roleParam)) return redirectOAuthError(res, 'not_allowed');
    if (intent === 'signup') {
      if (!roleParam) return redirectOAuthError(res, 'not_allowed');
      if (req.query.terms !== 'accepted') return redirectOAuthError(res, 'not_allowed');
    }

    const state = randomToken(32);
    const nonce = randomToken(32);
    const { codeVerifier, codeChallenge } = createPkcePair();

    oauthState.setStateCookie(
      res,
      oauthState.createStateCookieValue({
        state,
        nonce,
        codeVerifier,
        intent,
        role: intent === 'signup' ? roleParam : 'PLAYER'
      })
    );
    return res.redirect(302, buildAuthorizationUrl({ state, nonce, codeChallenge }));
  } catch {
    console.error('Google OAuth start failed');
    return redirectOAuthError(res, 'generic');
  }
});

router.get('/google/callback', requireGoogleOAuth, authStrictLimiter, async (req, res) => {
  setNoStore(res);
  const stored = oauthState.verifyStateCookieValue(oauthState.readStateCookie(req));
  oauthState.clearStateCookie(res);

  const stateParam = typeof req.query.state === 'string' ? req.query.state : '';
  const stateMatches = !!stored && !!stateParam && oauthState.timingSafeEqualStr(stateParam, stored.state);

  if (typeof req.query.error === 'string' && req.query.error) {
    if (stateMatches) oauthState.consumeState(stored.state, stored.expiresAt);
    return redirectOAuthError(res, req.query.error === 'access_denied' ? 'cancelled' : 'generic');
  }

  if (!stateMatches) return redirectOAuthError(res, 'state_mismatch');
  if (!oauthState.consumeState(stored.state, stored.expiresAt)) {
    return redirectOAuthError(res, 'state_mismatch');
  }
  if (!OAUTH_INTENTS.has(stored.intent) || !OAUTH_SIGNUP_ROLES.has(stored.role)) {
    return redirectOAuthError(res, 'not_allowed');
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!code || code.length > 2048) return redirectOAuthError(res, 'generic');

  let identity;
  try {
    identity = await exchangeAndVerify({
      code,
      codeVerifier: stored.codeVerifier,
      expectedNonce: stored.nonce
    });
  } catch (error) {
    return redirectOAuthError(res, error instanceof GoogleOAuthError ? error.oauthCode : 'generic');
  }

  try {
    const outcome = await resolveGoogleAccount(identity, stored, req);
    if (outcome.error) return redirectOAuthError(res, outcome.error);

    const ticket = oauthState.createExchangeTicket({
      userId: outcome.user.id,
      sessionVersion: outcome.user.sessionVersion ?? 0,
      isNewUser: outcome.isNewUser
    });
    oauthState.setExchangeCookie(res, ticket);
    return res.redirect(302, frontendUrl('/pages/auth/oauth-callback.html'));
  } catch (error) {
    console.error('Google OAuth account resolution failed', error && error.code ? error.code : '');
    return redirectOAuthError(res, 'generic');
  }
});

router.post('/google/exchange', requireGoogleOAuth, authStrictLimiter, async (req, res) => {
  try {
    setNoStore(res);
    const ticket = oauthState.consumeExchangeTicket(oauthState.readExchangeCookie(req));
    oauthState.clearExchangeCookie(res);
    if (!ticket) return res.status(401).json({ error: OAUTH_EXCHANGE_FAILED });

    const user = await prisma.user.findUnique({ where: { id: ticket.userId } });
    if (
      googleLoginBlockReason(user) ||
      Number(user.sessionVersion || 0) !== Number(ticket.sessionVersion || 0)
    ) {
      return res.status(401).json({ error: OAUTH_EXCHANGE_FAILED });
    }

    const token = generateAccessToken(user.id, user.sessionVersion);
    const refreshToken = await issueRefreshToken(user.id, req);
    const userData = await userPayload(user.id);

    res.json({
      message: 'Login successful',
      user: userData,
      token,
      refreshToken,
      isNewUser: ticket.isNewUser
    });
  } catch (error) {
    console.error('Google OAuth exchange failed', error && error.code ? error.code : '');
    res.status(500).json({ error: 'Google sign-in failed' });
  }
});

module.exports = router;
