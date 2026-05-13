const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { MongoClient, ObjectId } = require('mongodb');
const { authenticate, authenticateAllowSuspended } = require('../middleware/auth');
const { mongoUserSetFields, mongoUserFindByPasswordResetToken } = require('../lib/mongoUserWrite');

const router = express.Router();
const prisma = new PrismaClient();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const RESET_TOKEN_BYTES = 32;
const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function hashPasswordResetToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken), 'utf8').digest('hex');
}

function appBaseUrl(req) {
  const fromEnv = process.env.APP_BASE_URL && String(process.env.APP_BASE_URL).trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
  const proto = req.protocol || 'http';
  return `${proto}://${host}`;
}

async function createUserWithNativeMongo(data) {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const now = new Date();
    const roleValue = data.role || 'PLAYER';
    const userDoc = {
      email: data.email,
      password_hash: data.passwordHash != null && data.passwordHash !== '' ? data.passwordHash : null,
      full_name: data.fullName,
      phone: data.phone || null,
      date_of_birth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender || null,
      location: data.location || null,
      avatar: null,
      role: roleValue,
      status: 'ACTIVE',
      verification_status: roleValue === 'OWNER' ? 'NOT_SUBMITTED' : null,
      created_at: now,
      updated_at: now
    };

    const result = await db.collection('users').insertOne(userDoc);
    return {
      id: String(result.insertedId),
      email: userDoc.email,
      fullName: userDoc.full_name,
      role: userDoc.role,
      status: userDoc.status,
      avatar: userDoc.avatar,
      createdAt: userDoc.created_at
    };
  } finally {
    await client.close();
  }
}

async function deleteUserWithNativeMongo(userId) {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(String(userId)) });
    return result.deletedCount > 0;
  } finally {
    await client.close();
  }
}

// Register new user
router.post('/register', [
  body('email').trim().isEmail(),
  body('password').isLength({ min: 8 }),
  body('fullName').trim().notEmpty(),
  body('role').isIn(['PLAYER', 'OWNER']).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const email = String(req.body.email).trim().toLowerCase();
    const { password, fullName, phone, dateOfBirth, gender, location, role } = req.body;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user via native MongoDB write to support standalone MongoDB (no replica set).
    const user = await createUserWithNativeMongo({
      email,
      passwordHash,
      fullName,
      phone,
      dateOfBirth,
      gender,
      location,
      role
    });

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });
  } catch (error) {
    if (error && (error.code === 11000 || error.code === '11000')) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('email').trim().isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const email = String(req.body.email).trim().toLowerCase();
    const { password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.passwordHash || typeof user.passwordHash !== 'string') {
      console.error('Login: user missing password_hash', email);
      return res.status(500).json({
        error:
          'Account data is incomplete. Run npm run db:seed to repair demo users, or reset your password from Settings.'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user.id);

    // Return user data (without password)
    const userData = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      avatar: user.avatar,
      verificationStatus: user.verificationStatus
    };

    res.json({
      message: 'Login successful',
      user: userData,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Request password reset (stores token; email delivery not wired — see response in non-production)
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

      if (!user || !user.passwordHash || typeof user.passwordHash !== 'string') {
        return res.json(generic);
      }

      const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
      const tokenHash = hashPasswordResetToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);

      await mongoUserSetFields(user.id, {
        password_reset_token_hash: tokenHash,
        password_reset_expires: expiresAt
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

// Complete password reset with token from email (or dev link)
router.post(
  '/reset-password',
  [
    body('token').trim().isLength({ min: 32 }),
    body('newPassword').isLength({ min: 8 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const rawToken = String(req.body.token).trim();
      const { newPassword } = req.body;
      const tokenHash = hashPasswordResetToken(rawToken);

      const user = await mongoUserFindByPasswordResetToken(tokenHash);

      if (!user) {
        return res.status(400).json({
          error: 'Reset link is invalid or has expired. Request a new one from the login page.'
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await mongoUserSetFields(user.id, {
        password_hash: passwordHash,
        password_reset_token_hash: null,
        password_reset_expires: null
      });

      res.json({ message: 'Password reset successfully. You can log in with your new password.' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Could not reset password' });
    }
  }
);

// Get current user (allows SUSPENDED so the app can show contact-only mode)
router.get('/me', authenticateAllowSuspended, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        location: true,
        avatar: true,
        role: true,
        status: true,
        verificationStatus: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Update password
router.put('/password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (String(currentPassword) === String(newPassword)) {
      return res.status(400).json({
        error: 'New password must be different from current password'
      });
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.passwordHash || typeof user.passwordHash !== 'string') {
      return res.status(400).json({
        error:
          'Account has no password on file. Run npm run db:seed if this is a demo account, or contact support.'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await mongoUserSetFields(userId, { password_hash: passwordHash });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Delete current user account
router.delete('/me', authenticate, [
  body('currentPassword').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.passwordHash || typeof user.passwordHash !== 'string') {
      return res.status(400).json({
        error: 'Account has no password on file. Unable to verify account deletion request.'
      });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const deleted = await deleteUserWithNativeMongo(userId);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;

