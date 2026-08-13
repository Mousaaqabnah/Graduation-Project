const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { isUuid } = require('../lib/ids');
const { createUserNotification } = require('../lib/notifications');
const { writeAuditLog } = require('../lib/audit');
const { serializeField, adminFieldSerializer } = require('../lib/serializers');
const { toMajor } = require('../lib/money');
const { createUniqueUsername } = require('../lib/username');
const { createUniquePlayerCode } = require('../lib/playerCode');
const { buildBookingRegionStats } = require('../lib/bookingRegionStats');
const { openPrivateObject } = require('../lib/storage');
const { isStoredDataUrl } = require('../lib/secureStorage');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('ADMIN'));

const REPLY_TITLE = 'Reply from MatchField Support';

const AUDIENCE_TO_ENUM = {
  all: 'ALL',
  players: 'PLAYERS',
  owners: 'OWNERS',
  admins: 'ADMINS',
  private: 'PRIVATE'
};

const AUDIENCE_FROM_ENUM = {
  ALL: 'all',
  PLAYERS: 'players',
  OWNERS: 'owners',
  ADMINS: 'admins',
  PRIVATE: 'private'
};

const CHANNEL_TO_ENUM = {
  'in-app': 'IN_APP',
  inapp: 'IN_APP',
  email: 'EMAIL',
  push: 'PUSH'
};

const fieldListInclude = {
  images: { orderBy: { displayOrder: 'asc' } },
  amenities: true,
  highlights: true,
  openingHours: true,
  owner: { select: { id: true, fullName: true, email: true, avatarUrl: true, phone: true } }
};

function normalizeFieldModerationStatusFromQuery(q) {
  const s = String(q || '').toLowerCase().trim();
  if (s === 'pending') return 'PENDING';
  if (s === 'approved') return 'APPROVED';
  if (s === 'rejected') return 'REJECTED';
  if (s === 'suspended') return 'SUSPENDED';
  if (s === 'draft') return 'DRAFT';
  return null;
}

function serializeAdminNotification(notification) {
  const channels = Array.isArray(notification.channels)
    ? notification.channels.map((row) => {
        const ch = row.channel || row;
        if (ch === 'IN_APP') return 'in-app';
        if (ch === 'EMAIL') return 'email';
        if (ch === 'PUSH') return 'push';
        return String(ch).toLowerCase();
      })
    : ['in-app'];

  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    audience: AUDIENCE_FROM_ENUM[notification.audience] || String(notification.audience || '').toLowerCase(),
    channels: channels.length ? channels : ['in-app'],
    createdAt: notification.createdAt,
    sentById: notification.createdById || null
  };
}

function serializeSupportMessage(row) {
  return {
    id: row.id,
    content: row.message,
    createdAt: row.createdAt,
    readAt: null,
    sender: row.sender
      ? {
          id: row.sender.id,
          fullName: row.sender.fullName,
          avatar: row.sender.avatarUrl || null,
          role: row.sender.role
        }
      : {
          id: null,
          fullName: 'Guest',
          avatar: null,
          role: null
        }
  };
}

function mapTicketToSubmissionBacklog(ticket) {
  const fullName =
    ticket.requester?.fullName ||
    (ticket.email ? String(ticket.email).split('@')[0] : 'User');

  return {
    id: ticket.id,
    fullName,
    email: ticket.requester?.email || ticket.email || '',
    phone: null,
    topic: ticket.subject,
    message: ticket.message,
    userId: ticket.requesterId,
    createdAt: ticket.createdAt,
    adminSeenAt: ticket.status === 'OPEN' ? null : ticket.createdAt
  };
}

async function findSupportTicket(ticketId) {
  return prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      requester: { select: { id: true, fullName: true, email: true } }
    }
  });
}

async function notifySupportRequester(ticket, adminId, content) {
  if (!ticket?.requesterId) return;
  try {
    await createUserNotification({
      title: REPLY_TITLE,
      message: content,
      type: 'SUPPORT',
      audience: 'PRIVATE',
      targetUserId: ticket.requesterId,
      sentById: adminId
    });
  } catch (err) {
    console.warn('Admin support notify error:', err);
  }
}

async function createAdminSupportReply(ticketId, adminId, content) {
  const ticket = await findSupportTicket(ticketId);
  if (!ticket) return null;

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.supportMessage.create({
      data: {
        ticketId,
        senderId: adminId,
        message: String(content),
        isInternal: false
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } }
      }
    });

    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedToId: adminId,
        status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
        updatedAt: new Date()
      }
    });

    return created;
  });

  await notifySupportRequester(ticket, adminId, content);
  return serializeSupportMessage(message);
}

// GET /stats
router.get('/stats', async (req, res) => {
  try {
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      usersThisWeek,
      activeOwners,
      pendingVerifications,
      recentBookings,
      bookingsLastWeek,
      totalRevenue,
      revenueLastWeek
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } }
      }),
      prisma.user.count({
        where: {
          role: 'OWNER',
          deletedAt: null,
          ownerProfile: { verificationStatus: 'APPROVED' }
        }
      }),
      prisma.user.count({
        where: {
          role: 'OWNER',
          deletedAt: null,
          ownerProfile: { verificationStatus: 'PENDING' }
        }
      }),
      prisma.booking.count({
        where: { createdAt: { gte: sevenDaysAgo } }
      }),
      prisma.booking.count({
        where: {
          createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }
        }
      }),
      prisma.booking.aggregate({
        where: {
          createdAt: { gte: sevenDaysAgo },
          status: { in: ['CONFIRMED', 'COMPLETED'] }
        },
        _sum: { totalCost: true }
      }),
      prisma.booking.aggregate({
        where: {
          createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
          status: { in: ['CONFIRMED', 'COMPLETED'] }
        },
        _sum: { totalCost: true }
      })
    ]);

    const rev7 = toMajor(totalRevenue._sum.totalCost || 0);
    const revPrev = toMajor(revenueLastWeek._sum.totalCost || 0);
    const bookingsPercent =
      bookingsLastWeek > 0
        ? Math.round(((recentBookings - bookingsLastWeek) / bookingsLastWeek) * 100)
        : recentBookings > 0
          ? 100
          : 0;

    res.json({
      stats: {
        totalUsers,
        usersThisWeek,
        activeOwners,
        pendingVerifications,
        recentBookings,
        bookingsPercent,
        totalRevenue: rev7,
        revenueLastWeek: revPrev
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /bookings/region-stats
router.get('/bookings/region-stats', async (req, res) => {
  try {
    const grouped = await prisma.booking.groupBy({
      by: ['fieldId'],
      _count: { _all: true }
    });
    const fieldIds = grouped.map((g) => g.fieldId).filter(Boolean);
    const fields = fieldIds.length
      ? await prisma.field.findMany({
          where: { id: { in: fieldIds } },
          select: { id: true, city: true, district: true, location: true }
        })
      : [];
    const fieldById = new Map(fields.map((f) => [f.id, f]));
    // Expand to the shape buildBookingRegionStats expects (one entry per booking count)
    const bookings = [];
    for (const g of grouped) {
      for (let i = 0; i < g._count._all; i += 1) {
        bookings.push({ fieldId: g.fieldId });
      }
    }
    const { total, rows } = buildBookingRegionStats(bookings, fieldById);
    res.json({ total, rows });
  } catch (error) {
    console.error('Booking region stats error:', error);
    res.status(500).json({ error: 'Failed to load region stats' });
  }
});

// PUT /verify-owner/:userId
router.put(
  '/verify-owner/:userId',
  [body('verificationStatus').isIn(['APPROVED', 'REJECTED']), body('reason').optional()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
      if (!isUuid(userId)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }

      const { verificationStatus, reason } = req.body;

      const owner = await prisma.user.findFirst({
        where: { id: userId, role: 'OWNER', deletedAt: null },
        include: { ownerProfile: true }
      });

      if (!owner || !owner.ownerProfile) {
        return res.status(404).json({ error: 'Owner not found' });
      }

      if (owner.ownerProfile.verificationStatus !== 'PENDING') {
        return res.status(400).json({ error: 'Only pending owner verifications can be reviewed' });
      }

      const latestVerification = await prisma.ownerVerification.findFirst({
        where: { ownerId: userId, status: 'PENDING' },
        orderBy: { submittedAt: 'desc' }
      });

      const now = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.ownerProfile.update({
          where: { userId },
          data: {
            verificationStatus,
            verifiedAt: verificationStatus === 'APPROVED' ? now : null
          }
        });

        if (latestVerification) {
          await tx.ownerVerification.update({
            where: { id: latestVerification.id },
            data: {
              status: verificationStatus,
              reviewedById: req.user.id,
              reviewedAt: now,
              rejectionReason: verificationStatus === 'REJECTED' ? (reason || null) : null
            }
          });
        }
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { ownerProfile: true }
      });

      await writeAuditLog({
        actorId: req.user.id,
        action: verificationStatus === 'APPROVED' ? 'APPROVE' : 'REJECT',
        entityType: 'OwnerProfile',
        entityId: userId,
        metadata: { verificationStatus, reason: reason || null },
        req
      });

      try {
        const ownerName = user?.fullName || 'Owner';
        const title =
          verificationStatus === 'APPROVED'
            ? 'Owner verification approved'
            : 'Owner verification rejected';
        const message =
          verificationStatus === 'APPROVED'
            ? `Hi ${ownerName}, your owner account has been verified. You can now fully use owner features.`
            : `Hi ${ownerName}, your owner verification was rejected.${reason ? ` Reason: ${String(reason)}` : ''}`;

        await createUserNotification({
          title,
          message,
          type: 'VERIFICATION',
          audience: 'PRIVATE',
          targetUserId: userId,
          sentById: req.user.id
        });
      } catch (notifyErr) {
        console.warn('Could not notify owner after verification review:', notifyErr);
      }

      res.json({
        message: 'Owner verification updated',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          verificationStatus: user.ownerProfile?.verificationStatus || verificationStatus,
          verifiedAt: user.ownerProfile?.verifiedAt || null
        }
      });
    } catch (error) {
      console.error('Verify owner error:', error);
      res.status(500).json({ error: 'Failed to verify owner' });
    }
  }
);

// GET /verifications
router.get('/verifications', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const where = {
      role: 'OWNER',
      deletedAt: null,
      OR: [
        { ownerProfile: { verificationStatus: 'PENDING' } },
        { verificationRequests: { some: { status: 'PENDING' } } }
      ]
    };

    const [owners, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          location: true,
          status: true,
          createdAt: true,
          ownerProfile: { select: { verificationStatus: true } },
          verificationRequests: {
            where: { status: 'PENDING' },
            orderBy: { submittedAt: 'desc' },
            take: 1,
            include: { documents: true }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    const users = owners.map((owner) => {
      const verification = owner.verificationRequests[0] || null;
      const front = verification?.documents?.find((d) => d.type === 'ID_FRONT');
      const back = verification?.documents?.find((d) => d.type === 'ID_BACK');

      return {
        id: owner.id,
        email: owner.email,
        fullName: owner.fullName,
        phone: owner.phone,
        location: owner.location,
        status: owner.status,
        verificationStatus: owner.ownerProfile?.verificationStatus || 'PENDING',
        idFrontUrl: front
          ? `/api/admin/verifications/${owner.id}/documents/ID_FRONT`
          : null,
        idBackUrl: back
          ? `/api/admin/verifications/${owner.id}/documents/ID_BACK`
          : null,
        createdAt: owner.createdAt
      };
    });

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

router.get('/verifications/:userId/documents/:docType', async (req, res) => {
  try {
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
    const docType = String(req.params.docType || '').toUpperCase();
    if (!isUuid(userId)) return res.status(400).json({ error: 'Invalid user id' });
    if (!['ID_FRONT', 'ID_BACK'].includes(docType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    const verification = await prisma.ownerVerification.findFirst({
      where: { ownerId: userId },
      orderBy: { submittedAt: 'desc' },
      include: { documents: true }
    });
    const doc = verification?.documents?.find((d) => d.type === docType);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (isStoredDataUrl(doc.storagePath)) {
      return res.status(409).json({ error: 'Document is still stored as legacy base64' });
    }

    const opened = await openPrivateObject(doc.storagePath);
    if (!opened || !opened.stream) {
      return res.status(404).json({ error: 'Document file missing' });
    }
    res.setHeader('Content-Type', doc.mimeType || opened.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${docType.toLowerCase()}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    opened.stream.pipe(res);
  } catch (error) {
    console.error('Get verification document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// GET /notifications
router.get('/notifications', async (req, res) => {
  try {
    const take = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true }
    });
    const adminIds = admins.map((a) => a.id);

    const notifications = await prisma.notification.findMany({
      where: {
        title: { not: REPLY_TITLE },
        OR: [{ createdById: null }, { createdById: { in: adminIds } }]
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: { channels: true }
    });

    res.json({ notifications: notifications.map(serializeAdminNotification) });
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /notifications/send
router.post(
  '/notifications/send',
  [
    body('title').trim().notEmpty(),
    body('message').trim().notEmpty(),
    body('audience').isIn(['all', 'players', 'owners', 'admins', 'private']),
    body('channels').optional().isArray(),
    body('targetUserId').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, message, audience, channels = ['in-app'], targetUserId } = req.body;
      const audienceEnum = AUDIENCE_TO_ENUM[audience];
      let userIds = [];

      if (audience === 'private') {
        const targetId = typeof targetUserId === 'string' ? targetUserId.trim() : '';
        if (!isUuid(targetId)) {
          return res.status(400).json({ error: 'Valid targetUserId is required for private notifications' });
        }
        const user = await prisma.user.findFirst({
          where: { id: targetId, deletedAt: null },
          select: { id: true }
        });
        if (!user) {
          return res.status(404).json({ error: 'Target user not found' });
        }
        userIds = [user.id];
      } else {
        const roleMap = {
          all: null,
          players: 'PLAYER',
          owners: 'OWNER',
          admins: 'ADMIN'
        };
        const role = roleMap[audience];
        // Cap audience fan-out; large broadcasts should be chunked by job later
        const users = await prisma.user.findMany({
          where: {
            deletedAt: null,
            status: 'ACTIVE',
            ...(role ? { role } : {})
          },
          select: { id: true },
          take: 5000
        });
        userIds = users.map((u) => u.id);
      }

      if (userIds.length === 0) {
        return res.status(400).json({ error: 'No users found for the selected audience' });
      }

      const channelsArray = Array.isArray(channels) ? channels : ['in-app'];
      const useInApp = channelsArray.some((c) => String(c).toLowerCase().replace(/_/g, '-') === 'in-app');

      if (!useInApp) {
        return res.status(400).json({
          error: 'In-app notification is required. Email channel is not implemented.'
        });
      }

      const deliveryChannels = [...new Set(channelsArray.map((c) => CHANNEL_TO_ENUM[String(c).toLowerCase()] || 'IN_APP'))];
      const now = new Date();

      const notification = await prisma.$transaction(async (tx) => {
        const created = await tx.notification.create({
          data: {
            type: 'SYSTEM',
            audience: audienceEnum,
            title: String(title).slice(0, 180),
            message: String(message),
            createdById: req.user.id,
            channels: {
              create: deliveryChannels.map((channel) => ({
                channel,
                status: 'DELIVERED',
                attemptedAt: now,
                deliveredAt: now
              }))
            },
            recipients: {
              create: userIds.map((userId) => ({ userId }))
            }
          },
          include: { channels: true }
        });
        return created;
      });

      res.status(201).json({
        success: true,
        notification: {
          ...serializeAdminNotification(notification),
          recipientCount: userIds.length
        }
      });
    } catch (error) {
      console.error('Send notification error:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  }
);

// POST /invite-admin
router.post(
  '/invite-admin',
  [
    body('email').trim().isEmail(),
    body('fullName').optional().trim().isLength({ min: 1, max: 200 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const email = String(req.body.email).trim().toLowerCase();
      const fullName = (req.body.fullName && String(req.body.fullName).trim()) || 'Admin';

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const tempPassword = Array.from({ length: 12 }, () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');

      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const username = await createUniqueUsername(prisma, email.split('@')[0] || fullName);
      const playerCode = await createUniquePlayerCode();

      const user = await prisma.user.create({
        data: {
          email,
          username,
          passwordHash,
          fullName,
          role: 'ADMIN',
          status: 'ACTIVE',
          playerCode
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true
        }
      });

      await writeAuditLog({
        actorId: req.user.id,
        action: 'CREATE',
        entityType: 'User',
        entityId: user.id,
        metadata: { role: 'ADMIN', invited: true },
        req
      });

      res.status(201).json({
        message: 'Admin account created',
        user,
        tempPassword
      });
    } catch (error) {
      console.error('Invite admin error:', error);
      res.status(500).json({ error: 'Failed to invite admin' });
    }
  }
);

// GET /fields
router.get('/fields', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const take = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * take;
    const { status, sport, search } = req.query;

    const where = { deletedAt: null };
    const statusNorm = normalizeFieldModerationStatusFromQuery(status);
    if (statusNorm) {
      where.moderationStatus = statusNorm;
    }
    if (sport) {
      where.sport = String(sport);
    }
    if (search) {
      const s = String(search);
      where.AND = (where.AND || []).concat([
        {
          OR: [
            { name: { contains: s, mode: 'insensitive' } },
            { location: { contains: s, mode: 'insensitive' } },
            { owner: { fullName: { contains: s, mode: 'insensitive' } } },
            { owner: { email: { contains: s, mode: 'insensitive' } } }
          ]
        }
      ]);
    }

    const [fields, total] = await Promise.all([
      prisma.field.findMany({
        where,
        skip,
        take,
        include: fieldListInclude,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.field.count({ where })
    ]);

    res.json({
      fields: fields.map((field) => adminFieldSerializer(field)),
      pagination: {
        page,
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Admin list fields error:', error);
    res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

// PUT /fields/:fieldId/moderation
router.put(
  '/fields/:fieldId/moderation',
  [
    body('status').isIn(['APPROVED', 'REJECTED']),
    body('reason').optional().isString().isLength({ max: 500 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const fieldId = typeof req.params.fieldId === 'string' ? req.params.fieldId.trim() : '';
      if (!isUuid(fieldId)) {
        return res.status(400).json({ error: 'Invalid field id' });
      }

      const status = req.body.status;
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
      const now = new Date();

      const current = await prisma.field.findFirst({
        where: { id: fieldId, deletedAt: null },
        select: { id: true, name: true, ownerId: true, moderationStatus: true, isActive: true }
      });

      if (!current) {
        return res.status(404).json({ error: 'Field not found' });
      }

      const field = await prisma.field.update({
        where: { id: fieldId },
        data: {
          moderationStatus: status,
          moderationReason: status === 'REJECTED' ? reason || null : null,
          moderatedAt: now,
          moderatedById: req.user.id,
          isActive: status === 'APPROVED' ? true : false
        },
        include: fieldListInclude
      });

      await writeAuditLog({
        actorId: req.user.id,
        action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
        entityType: 'Field',
        entityId: fieldId,
        metadata: { status, reason: reason || null },
        req
      });

      try {
        const title = status === 'APPROVED' ? 'Your field was approved' : 'Your field was rejected';
        const notifyMessage =
          status === 'APPROVED'
            ? `Your field "${field.name}" is now visible to players.`
            : `Your field "${field.name}" was rejected.${reason ? ` Reason: ${reason}` : ''}`;

        await createUserNotification({
          title,
          message: notifyMessage,
          type: 'FIELD_MODERATION',
          audience: 'PRIVATE',
          targetUserId: field.ownerId,
          sentById: req.user.id
        });
      } catch (notifyErr) {
        console.warn('Could not notify field owner:', notifyErr);
      }

      res.json({
        message: 'Field moderation updated',
        field: adminFieldSerializer(field)
      });
    } catch (error) {
      console.error('Admin moderate field error:', error);
      res.status(500).json({ error: 'Failed to update field status' });
    }
  }
);

// ------------------------
// Support inbox (SupportTicket)
// ------------------------

// GET /support/conversations
router.get('/support/conversations', async (req, res) => {
  try {
    const legacyLimit = parseInt(req.query.limit, 10);
    const subTake = Math.min(
      200,
      Math.max(
        1,
        parseInt(req.query.submissionTake, 10) ||
          (Number.isFinite(legacyLimit) ? legacyLimit : 80)
      )
    );

    const tickets = await prisma.supportTicket.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      take: subTake,
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, fullName: true, email: true } }
      }
    });

    res.json({
      conversations: [],
      submissionBacklog: tickets.map(mapTicketToSubmissionBacklog)
    });
  } catch (error) {
    console.error('Admin support conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch support conversations' });
  }
});

// PATCH /support/submission/:submissionId/seen
router.patch('/support/submission/:submissionId/seen', async (req, res) => {
  try {
    const submissionId =
      typeof req.params.submissionId === 'string' ? req.params.submissionId.trim() : '';
    if (!isUuid(submissionId)) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id: submissionId } });
    if (!ticket) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (ticket.status === 'OPEN') {
      await prisma.supportTicket.update({
        where: { id: submissionId },
        data: {
          status: 'IN_PROGRESS',
          assignedToId: req.user.id
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Admin support submission seen error:', error);
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

// GET /support/conversation/:conversationId/messages
router.get('/support/conversation/:conversationId/messages', async (req, res) => {
  try {
    const conversationId =
      typeof req.params.conversationId === 'string' ? req.params.conversationId.trim() : '';
    if (!isUuid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const take = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * take;

    const ticket = await prisma.supportTicket.findUnique({ where: { id: conversationId } });
    if (!ticket) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const [messages, total] = await Promise.all([
      prisma.supportMessage.findMany({
        where: { ticketId: conversationId, isInternal: false },
        skip,
        take,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } }
        }
      }),
      prisma.supportMessage.count({
        where: { ticketId: conversationId, isInternal: false }
      })
    ]);

    res.json({
      messages: messages.map(serializeSupportMessage),
      pagination: {
        page,
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Admin support get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /support/conversation/:conversationId/messages
router.post(
  '/support/conversation/:conversationId/messages',
  [body('content').trim().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const conversationId =
        typeof req.params.conversationId === 'string' ? req.params.conversationId.trim() : '';
      if (!isUuid(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversation id' });
      }

      const { content } = req.body;
      const messageObj = await createAdminSupportReply(conversationId, req.user.id, content);
      if (!messageObj) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.status(201).json({ message: 'Message sent', messageObj });
    } catch (error) {
      console.error('Admin support send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// POST /support/submission/:submissionId/reply
router.post(
  '/support/submission/:submissionId/reply',
  [body('content').trim().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const submissionId =
        typeof req.params.submissionId === 'string' ? req.params.submissionId.trim() : '';
      if (!isUuid(submissionId)) {
        return res.status(400).json({ error: 'Invalid submission id' });
      }

      const { content } = req.body;
      const messageObj = await createAdminSupportReply(submissionId, req.user.id, content);
      if (!messageObj) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      res.status(201).json({
        message: 'Reply sent',
        conversationId: submissionId,
        messageObj
      });
    } catch (error) {
      console.error('Admin support submission reply error:', error);
      res.status(500).json({ error: 'Failed to send reply' });
    }
  }
);

// PUT /support/conversation/:conversationId/messages/:messageId/read
router.put('/support/conversation/:conversationId/messages/:messageId/read', async (req, res) => {
  res.json({ success: true });
});

// PATCH /support/conversation/:conversationId/star
// Compatibility no-op (tickets do not persist per-admin star). Still validate IDs.
router.patch('/support/conversation/:conversationId/star', async (req, res) => {
  try {
    const conversationId =
      typeof req.params.conversationId === 'string' ? req.params.conversationId.trim() : '';
    if (!isUuid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: conversationId },
      select: { id: true }
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Admin support star error:', error);
    res.status(500).json({ error: 'Failed to update star status' });
  }
});

// PATCH /support/conversation/:conversationId/block
router.patch('/support/conversation/:conversationId/block', async (req, res) => {
  try {
    const conversationId =
      typeof req.params.conversationId === 'string' ? req.params.conversationId.trim() : '';
    if (!isUuid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }

    const blocked = req.body.blocked !== false;
    if (!blocked) {
      return res.json({ success: true });
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id: conversationId } });
    if (!ticket) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await prisma.supportTicket.update({
      where: { id: conversationId },
      data: {
        status: 'CLOSED',
        closedAt: new Date()
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin support block error:', error);
    res.status(500).json({ error: 'Failed to update block status' });
  }
});

module.exports = router;
