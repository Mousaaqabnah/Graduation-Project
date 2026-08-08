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

const router = express.Router();

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || '1h';
const REFRESH_TOKEN_TTL_MS = Number(process.env.JWT_REFRESH_TTL_MS) || 30 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_BYTES = 32;
const RESET_EXPIRY_MS = 60 * 60 * 1000;

function generateAccessToken(userId, sessionVersion = 0) {
  return jwt.sign(
    { userId, typ: 'access', sv: Number(sessionVersion) || 0 },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
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

// Register
router.post(
  '/register',
  [
    body('email').trim().isEmail(),
    body('password').isLength({ min: 8 }),
    body('fullName').trim().notEmpty(),
    body('role').isIn(['PLAYER', 'OWNER']).optional(),
    body('username').optional().trim().isLength({ min: 3, max: 40 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const email = String(req.body.email).trim().toLowerCase();
      const { password, fullName, phone, dateOfBirth, gender, location } = req.body;
      const role = req.body.role === 'OWNER' ? 'OWNER' : 'PLAYER';

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

      const passwordHash = await bcrypt.hash(password, 10);
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
  [body('email').trim().isEmail(), body('password').notEmpty()],
  async (req, res) => {
    try {
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
  [body('refreshToken').trim().notEmpty()],
  async (req, res) => {
    try {
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
  [body('email').trim().isEmail()],
  async (req, res) => {
    try {
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
  [body('token').trim().isLength({ min: 32 }), body('newPassword').isLength({ min: 8 })],
  async (req, res) => {
    try {
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

      const passwordHash = await bcrypt.hash(newPassword, 10);
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
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 8 })],
  async (req, res) => {
    try {
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
        return res.status(400).json({ error: 'Account has no password on file.' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
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
          error: 'Account has no password on file. Unable to verify account deletion request.'
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

module.exports = router;
