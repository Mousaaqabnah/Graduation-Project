const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { MongoClient } = require('mongodb');
const { authenticate } = require('../middleware/auth');
const { mongoUserSetFields } = require('../lib/mongoUserWrite');

const router = express.Router();
const prisma = new PrismaClient();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

async function createUserWithNativeMongo(data) {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const now = new Date();
    const roleValue = data.role || 'PLAYER';
    const userDoc = {
      email: data.email,
      password_hash: data.passwordHash,
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

// Get current user
router.get('/me', authenticate, async (req, res) => {
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

module.exports = router;

