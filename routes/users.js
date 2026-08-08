const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../lib/prisma');
const { isUuid } = require('../lib/ids');
const {
  backfillMissingPlayerCodes,
  normalizePlayerCodeQuery,
  isHexIdQuery,
  isPlayerCodeQuery,
  getSearchMinLength
} = require('../lib/playerCode');
const { authenticate, requireRole } = require('../middleware/auth');
const { serializeUser } = require('../lib/serializers');
const { writeAuditLog } = require('../lib/audit');
const { persistIncomingFile, isStoredDataUrl } = require('../lib/secureStorage');

const router = express.Router();

router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query;
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;

    const where = { deletedAt: null };
    if (role) where.role = String(role).toUpperCase();
    if (status) where.status = String(status).toUpperCase();
    if (search) {
      const s = String(search);
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { username: { contains: s, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        include: { ownerProfile: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users: users.map((u) => serializeUser(u, { includePrivate: true })),
      pagination: {
        page: Math.max(1, parseInt(page, 10) || 1),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/search/users', authenticate, async (req, res) => {
  try {
    const { q, playersOnly } = req.query;
    const restrictToPlayers = playersOnly === '1' || String(playersOnly || '').toLowerCase() === 'true';
    const qTrim = typeof q === 'string' ? normalizePlayerCodeQuery(q) : '';
    const minLen = getSearchMinLength(qTrim);
    if (!qTrim || qTrim.length < minLen) {
      return res.json({ users: [] });
    }

    if (restrictToPlayers) {
      await backfillMissingPlayerCodes();
    }

    const orFilters = [
      { fullName: { contains: qTrim, mode: 'insensitive' } },
      { email: { contains: qTrim, mode: 'insensitive' } },
      { username: { contains: qTrim, mode: 'insensitive' } }
    ];

    if (isPlayerCodeQuery(qTrim)) {
      orFilters.push({ playerCode: { equals: qTrim, mode: 'insensitive' } });
      if (qTrim.length > 4) {
        orFilters.push({ playerCode: { contains: qTrim, mode: 'insensitive' } });
      }
    } else if (qTrim.length >= 4) {
      orFilters.push({ playerCode: { contains: qTrim, mode: 'insensitive' } });
    }

    if (isUuid(qTrim)) {
      orFilters.push({ id: qTrim });
    }

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: orFilters,
        ...(restrictToPlayers ? { role: 'PLAYER' } : {})
      },
      take: 10,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        playerCode: true
      }
    });

    res.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        avatar: u.avatarUrl,
        role: u.role,
        playerCode: u.playerCode
      }))
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

router.post(
  '/me/verification',
  authenticate,
  requireRole('OWNER'),
  [body('idFrontUrl').trim().notEmpty(), body('idBackUrl').trim().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { idFrontUrl, idBackUrl } = req.body;
      let profile = await prisma.ownerProfile.findUnique({ where: { userId: req.user.id } });
      if (!profile) {
        profile = await prisma.ownerProfile.create({
          data: { userId: req.user.id, verificationStatus: 'NOT_SUBMITTED' }
        });
      }

      if (profile.verificationStatus === 'PENDING') {
        return res.status(400).json({ error: 'Verification is already pending review' });
      }
      if (profile.verificationStatus === 'APPROVED') {
        return res.status(400).json({ error: 'Account is already verified' });
      }

      const frontSaved = persistIncomingFile(idFrontUrl, { kind: 'verification' });
      const backSaved = persistIncomingFile(idBackUrl, { kind: 'verification' });
      if (
        !frontSaved ||
        !backSaved ||
        isStoredDataUrl(frontSaved.storagePath) ||
        isStoredDataUrl(backSaved.storagePath)
      ) {
        return res.status(400).json({ error: 'Invalid verification document upload' });
      }

      await prisma.$transaction(async (tx) => {
        await tx.ownerProfile.update({
          where: { userId: req.user.id },
          data: { verificationStatus: 'PENDING' }
        });

        return tx.ownerVerification.create({
          data: {
            ownerId: req.user.id,
            status: 'PENDING',
            documents: {
              create: [
                {
                  type: 'ID_FRONT',
                  storagePath: frontSaved.storagePath,
                  mimeType: frontSaved.mimeType,
                  sizeBytes: frontSaved.sizeBytes
                },
                {
                  type: 'ID_BACK',
                  storagePath: backSaved.storagePath,
                  mimeType: backSaved.mimeType,
                  sizeBytes: backSaved.sizeBytes
                }
              ]
            }
          }
        });
      });

      const updated = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { ownerProfile: true }
      });

      res.json({
        message: 'Verification submitted',
        user: {
          id: updated.id,
          verificationStatus: updated.ownerProfile?.verificationStatus,
          idFrontUrl: null,
          idBackUrl: null,
          verificationDocumentsSubmitted: true
        }
      });
    } catch (error) {
      console.error('Submit verification error:', error);
      res.status(error.status || 500).json({ error: error.message || 'Failed to submit verification' });
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
    if (typeof v === 'boolean') out[k] = v;
    else if (STRING_PREF_KEYS.has(k) && v != null && typeof v === 'string' && v.length < 200) {
      out[k] = v;
    }
  }
  return out;
}

router.get('/me/preferences', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true }
    });
    const raw = user?.preferences && typeof user.preferences === 'object' ? user.preferences : {};
    res.json({
      owner: raw.owner && typeof raw.owner === 'object' ? raw.owner : {},
      player: raw.player && typeof raw.player === 'object' ? raw.player : {},
      admin: raw.admin && typeof raw.admin === 'object' ? raw.admin : {}
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to load preferences' });
  }
});

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
    if (!Object.keys(slice).length) {
      return res.status(400).json({ error: 'No valid preference fields to save' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true }
    });
    const raw = user?.preferences && typeof user.preferences === 'object' ? user.preferences : {};
    const next = {
      ...raw,
      owner: roleKey === 'owner' ? { ...(raw.owner || {}), ...slice } : raw.owner || {},
      player: roleKey === 'player' ? { ...(raw.player || {}), ...slice } : raw.player || {},
      admin: roleKey === 'admin' ? { ...(raw.admin || {}), ...slice } : raw.admin || {}
    };

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { preferences: next },
      select: { preferences: true }
    });
    const p = updated.preferences && typeof updated.preferences === 'object' ? updated.preferences : {};
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

router.get('/:id', authenticate, async (req, res) => {
  try {
    const idTrim = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!isUuid(idTrim)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const isSelf = String(req.user.id) === String(idTrim);
    const isAdmin = req.user.role === 'ADMIN';

    if (isSelf || isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: idTrim },
        include: { ownerProfile: true }
      });
      if (!user || user.deletedAt) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ user: serializeUser(user, { includePrivate: true }) });
    }

    if (req.user.role === 'OWNER') {
      const target = await prisma.user.findUnique({
        where: { id: idTrim },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          status: true,
          createdAt: true,
          location: true,
          deletedAt: true
        }
      });
      if (!target || target.deletedAt || target.role !== 'PLAYER') {
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
          avatar: target.avatarUrl,
          role: target.role,
          status: target.status,
          createdAt: target.createdAt,
          location: target.location
        },
        playerChatSummary: { totalBookings }
      });
    }

    return res.status(403).json({ error: 'Access denied' });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.put('/:id/avatar', authenticate, async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!isUuid(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (String(req.user.id) !== String(id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const avatar = req.body && (req.body.avatar || req.body.avatarUrl);
    if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
      return res.status(400).json({
        error: 'Invalid image: expected a data URL (data:image/jpeg;base64,...)'
      });
    }
    if (avatar.length > 4_000_000) {
      return res.status(400).json({ error: 'Image data is too large; use a smaller photo' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { avatarUrl: avatar },
      include: { ownerProfile: true }
    });

    res.json({
      message: 'Avatar updated successfully',
      user: serializeUser(user, { includePrivate: true })
    });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

router.put(
  '/:id',
  authenticate,
  [
    body('fullName').optional().trim(),
    body('phone').optional({ nullable: true }),
    body('dateOfBirth').optional({ nullable: true }),
    body('gender').optional({ nullable: true }),
    body('location').optional({ nullable: true }),
    body('avatar').optional(),
    body('avatarUrl').optional()
  ],
  async (req, res) => {
    try {
      const idTrim = typeof req.params.id === 'string' ? req.params.id.trim() : '';
      if (!isUuid(idTrim)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      if (String(req.user.id) !== String(idTrim) && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fullName, phone, dateOfBirth, gender, location } = req.body;
      const avatar = req.body.avatarUrl || req.body.avatar;
      const data = {};
      if (fullName !== undefined && String(fullName).trim()) data.fullName = String(fullName).trim();
      if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
      if (dateOfBirth !== undefined) {
        data.dateOfBirth = dateOfBirth && String(dateOfBirth).trim() ? new Date(dateOfBirth) : null;
      }
      if (gender !== undefined) data.gender = gender || null;
      if (location !== undefined) data.location = location ? String(location).trim() : null;
      if (avatar !== undefined && typeof avatar === 'string') data.avatarUrl = avatar;

      if (!Object.keys(data).length) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const user = await prisma.user.update({
        where: { id: idTrim },
        data,
        include: { ownerProfile: true }
      });

      res.json({
        message: 'Profile updated successfully',
        user: serializeUser(user, { includePrivate: true })
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

router.put(
  '/:id/status',
  authenticate,
  requireRole('ADMIN'),
  [body('status').isIn(['ACTIVE', 'SUSPENDED', 'DEACTIVATED'])],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const idTrim = typeof req.params.id === 'string' ? req.params.id.trim() : '';
      if (!isUuid(idTrim)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }

      const user = await prisma.user.update({
        where: { id: idTrim },
        data: { status: req.body.status },
        select: { id: true, email: true, fullName: true, status: true }
      });

      await writeAuditLog({
        actorId: req.user.id,
        action: req.body.status === 'SUSPENDED' ? 'SUSPEND' : 'UPDATE',
        entityType: 'User',
        entityId: user.id,
        metadata: { status: req.body.status },
        req
      });

      res.json({
        message: 'User status updated',
        user: { ...user, avatar: null }
      });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  }
);

module.exports = router;
