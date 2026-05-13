const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { isMongoObjectIdString, mongoUserSetFields } = require('../lib/mongoUserWrite');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all users (Admin only)
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      // Note: MongoDB with Prisma uses case-sensitive contains
      // For case-insensitive, consider using toLowerCase() on both search term and stored values
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          location: true,
          role: true,
          status: true,
          avatar: true,
          verificationStatus: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Search users (must be before /:id so "search" is not treated as an id)
router.get('/search/users', authenticate, async (req, res) => {
  try {
    const { q, playersOnly } = req.query;
    const restrictToPlayers = playersOnly === '1' || String(playersOnly || '').toLowerCase() === 'true';

    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { fullName: { contains: q } },
          { email: { contains: q } }
        ],
        ...(restrictToPlayers ? { role: 'PLAYER' } : {})
      },
      take: 10,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatar: true,
        role: true
      }
    });

    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Submit owner ID verification (must be before /:id)
router.post(
  '/me/verification',
  authenticate,
  requireRole('OWNER'),
  [
    body('idFrontUrl').trim().notEmpty(),
    body('idBackUrl').trim().notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { idFrontUrl, idBackUrl } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { verificationStatus: true, role: true }
      });

      if (!user || user.role !== 'OWNER') {
        return res.status(403).json({ error: 'Only field owners can submit verification' });
      }

      if (user.verificationStatus === 'PENDING') {
        return res.status(400).json({ error: 'Verification is already pending review' });
      }

      if (user.verificationStatus === 'APPROVED') {
        return res.status(400).json({ error: 'Account is already verified' });
      }

      await mongoUserSetFields(req.user.id, {
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        verification_status: 'PENDING'
      });

      const updated = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          verificationStatus: true,
          idFrontUrl: true,
          idBackUrl: true
        }
      });

      res.json({ message: 'Verification submitted', user: updated });
    } catch (error) {
      console.error('Submit verification error:', error);
      res.status(500).json({ error: 'Failed to submit verification' });
    }
  }
);

const OWNER_PREF_KEYS = new Set([
  'emailNotifications',
  'twoFactorAuth',
  'bookingNotifications',
  'paymentNotifications',
  'fieldUpdates',
  'marketingEmails',
  'dataSharing',
  'profileVisibility',
  'language',
  'currency',
  'timezone'
]);

const PLAYER_PREF_KEYS = new Set([
  'emailNotifications',
  'twoFactorAuth',
  'bookingConfirmations',
  'reminders',
  'venueUpdates',
  'marketingEmails',
  'dataSharing',
  'profileVisibility',
  'language',
  'currency',
  'timezone'
]);

const ADMIN_PREF_KEYS = new Set([
  'emailNotifications',
  'twoFactorAuth',
  'userRegistrationAlerts',
  'verificationRequests',
  'systemErrors',
  'securityAlerts',
  'sessionTimeout',
  'ipWhitelist',
  'auditLogAccess',
  'language',
  'timezone',
  'dateFormat',
  'itemsPerPage'
]);

const STRING_PREF_KEYS = new Set([
  'profileVisibility',
  'language',
  'currency',
  'timezone',
  'sessionTimeout',
  'dateFormat',
  'itemsPerPage'
]);

function sanitizePrefsSlice(body, allowedKeys) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out = {};
  for (const k of Object.keys(body)) {
    if (!allowedKeys.has(k)) continue;
    const v = body[k];
    if (typeof v === 'boolean') {
      out[k] = v;
    } else if (STRING_PREF_KEYS.has(k)) {
      if (v != null && typeof v === 'string' && v.length < 200) out[k] = v;
    }
  }
  return out;
}

// Get current user's saved UI preferences (owner, player, admin slices)
router.get('/me/preferences', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true }
    });
    const raw = user && user.preferences && typeof user.preferences === 'object' ? user.preferences : {};
    const owner = raw.owner && typeof raw.owner === 'object' && !Array.isArray(raw.owner) ? raw.owner : {};
    const player = raw.player && typeof raw.player === 'object' && !Array.isArray(raw.player) ? raw.player : {};
    const admin = raw.admin && typeof raw.admin === 'object' && !Array.isArray(raw.admin) ? raw.admin : {};
    res.json({ owner, player, admin });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to load preferences' });
  }
});

// Merge UI preferences for the current user's role (ADMIN → admin, OWNER → owner, else player)
router.patch('/me/preferences', authenticate, async (req, res) => {
  try {
    let roleKey;
    let allowed;
    if (req.user.role === 'ADMIN') {
      roleKey = 'admin';
      allowed = ADMIN_PREF_KEYS;
    } else if (req.user.role === 'OWNER') {
      roleKey = 'owner';
      allowed = OWNER_PREF_KEYS;
    } else {
      roleKey = 'player';
      allowed = PLAYER_PREF_KEYS;
    }
    const slice = sanitizePrefsSlice(req.body, allowed);
    if (Object.keys(slice).length === 0) {
      return res.status(400).json({ error: 'No valid preference fields to save' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true }
    });
    const raw = user && user.preferences && typeof user.preferences === 'object' ? user.preferences : {};
    const owner = raw.owner && typeof raw.owner === 'object' && !Array.isArray(raw.owner) ? raw.owner : {};
    const player = raw.player && typeof raw.player === 'object' && !Array.isArray(raw.player) ? raw.player : {};
    const admin = raw.admin && typeof raw.admin === 'object' && !Array.isArray(raw.admin) ? raw.admin : {};
    const next = {
      ...raw,
      owner: roleKey === 'owner' ? { ...owner, ...slice } : owner,
      player: roleKey === 'player' ? { ...player, ...slice } : player,
      admin: roleKey === 'admin' ? { ...admin, ...slice } : admin
    };

    const matched = await mongoUserSetFields(req.user.id, { preferences: next });
    if (!matched) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updated = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true }
    });
    const p = updated && updated.preferences && typeof updated.preferences === 'object' ? updated.preferences : {};
    res.json({
      preferences: {
        owner: p.owner && typeof p.owner === 'object' ? p.owner : {},
        player: p.player && typeof p.player === 'object' ? p.player : {},
        admin: p.admin && typeof p.admin === 'object' ? p.admin : {}
      }
    });
  } catch (error) {
    console.error('Patch preferences error:', error);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const idTrim = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!isMongoObjectIdString(idTrim)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const isSelf = String(req.user.id) === String(idTrim);
    const isAdmin = req.user.role === 'ADMIN';

    if (isSelf || isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: idTrim },
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
          createdAt: true
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ user });
    }

    // Field owners may load a limited player profile for the owner chat sidebar (no email / phone).
    if (req.user.role === 'OWNER') {
      const target = await prisma.user.findUnique({
        where: { id: idTrim },
        select: {
          id: true,
          fullName: true,
          avatar: true,
          role: true,
          status: true,
          createdAt: true,
          location: true
        }
      });

      if (!target || target.role !== 'PLAYER') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const totalBookings = await prisma.booking.count({
        where: {
          status: { not: 'CANCELLED' },
          OR: [
            { organizerId: idTrim },
            { participants: { some: { userId: idTrim } } }
          ]
        }
      });

      return res.json({
        user: {
          id: target.id,
          fullName: target.fullName,
          avatar: target.avatar,
          role: target.role,
          status: target.status,
          createdAt: target.createdAt,
          location: target.location
        },
        playerChatSummary: {
          totalBookings
        }
      });
    }

    return res.status(403).json({ error: 'Access denied' });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Avatar only — large base64 body; Prisma Mongo can fail on some updates, so use native $set.
router.put('/:id/avatar', authenticate, async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!isMongoObjectIdString(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (String(req.user.id) !== String(id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const avatar = req.body && req.body.avatar;
    if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
      return res.status(400).json({
        error: 'Invalid image: expected a data URL (data:image/jpeg;base64,...)'
      });
    }
    if (avatar.length > 4_000_000) {
      return res.status(400).json({ error: 'Image data is too large; use a smaller photo' });
    }

    const matched = await mongoUserSetFields(id, { avatar });
    if (!matched) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
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
        updatedAt: true
      }
    });

    res.json({ message: 'Avatar updated successfully', user });
  } catch (error) {
    console.error('Update avatar error:', error);
    const details =
      process.env.NODE_ENV !== 'production' && error && error.message
        ? { details: error.message }
        : {};
    res.status(500).json({ error: 'Failed to update avatar', ...details });
  }
});

// Update user profile
router.put('/:id', authenticate, [
  body('fullName').optional().trim(),
  body('phone').optional({ nullable: true }),
  body('dateOfBirth').optional({ nullable: true }),
  body('gender').optional({ nullable: true }),
  body('location').optional({ nullable: true }),
  body('avatar').optional()
], async (req, res) => {
  try {
    const { id } = req.params;
    const idTrim = typeof id === 'string' ? id.trim() : '';

    // Users can only update their own profile unless they're admin
    if (String(req.user.id) !== String(idTrim) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!isMongoObjectIdString(idTrim)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, phone, dateOfBirth, gender, location, avatar } = req.body;

    const $set = {};
    if (fullName !== undefined && String(fullName).trim()) $set.full_name = String(fullName).trim();
    if (phone !== undefined) $set.phone = phone ? String(phone).trim() : null;
    if (dateOfBirth !== undefined) {
      $set.date_of_birth =
        dateOfBirth && String(dateOfBirth).trim() ? new Date(dateOfBirth) : null;
    }
    if (gender !== undefined) $set.gender = gender ? String(gender).trim() : null;
    if (location !== undefined) $set.location = location ? String(location).trim() : null;
    if (avatar !== undefined && typeof avatar === 'string') $set.avatar = avatar;

    if (Object.keys($set).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const matched = await mongoUserSetFields(idTrim, $set);
    if (!matched) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: idTrim },
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
        updatedAt: true
      }
    });

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Update user error:', error);
    const details =
      process.env.NODE_ENV !== 'production' && error && error.message
        ? { details: error.message }
        : {};
    res.status(500).json({ error: 'Failed to update profile', ...details });
  }
});

// Update user status (Admin only)
router.put('/:id/status', authenticate, requireRole('ADMIN'), [
  body('status').isIn(['ACTIVE', 'SUSPENDED'])
], async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const idTrim = typeof id === 'string' ? id.trim() : '';
    if (!isMongoObjectIdString(idTrim)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const matched = await mongoUserSetFields(idTrim, { status });
    if (!matched) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: idTrim },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true
      }
    });

    res.json({ message: 'User status updated', user });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

module.exports = router;

