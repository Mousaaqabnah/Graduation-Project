const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { MongoClient, ObjectId } = require('mongodb');
const { authenticate, requireRole } = require('../middleware/auth');
const { isMongoObjectIdString, mongoUserSetFields } = require('../lib/mongoUserWrite');
const { mongoFieldUpdateAndFetch, mongoFieldGetByIdPublicDetail } = require('../lib/mongoFieldWrite');

const router = express.Router();
const prisma = new PrismaClient();

// All admin routes require authentication and ADMIN role
router.use(authenticate);
router.use(requireRole('ADMIN'));

// Get dashboard stats
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
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: sevenDaysAgo } }
      }),
      prisma.user.count({
        where: {
          role: 'OWNER',
          verificationStatus: 'APPROVED'
        }
      }),
      prisma.user.count({
        where: {
          role: 'OWNER',
          verificationStatus: 'PENDING'
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

    const rev7 = totalRevenue._sum.totalCost || 0;
    const revPrev = revenueLastWeek._sum.totalCost || 0;
    const bookingsPercent = bookingsLastWeek > 0
      ? Math.round(((recentBookings - bookingsLastWeek) / bookingsLastWeek) * 100)
      : recentBookings > 0 ? 100 : 0;

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

// Verify owner
router.put('/verify-owner/:userId', [
  body('verificationStatus').isIn(['APPROVED', 'REJECTED']),
  body('reason').optional()
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { verificationStatus, reason } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const idTrim = typeof userId === 'string' ? userId.trim() : '';
    if (!isMongoObjectIdString(idTrim)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const matched = await mongoUserSetFields(idTrim, {
      verification_status: verificationStatus,
      verified_at: verificationStatus === 'APPROVED' ? new Date() : null
    });
    if (!matched) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: idTrim },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        verificationStatus: true,
        verifiedAt: true
      }
    });

    res.json({ message: 'Owner verification updated', user });
  } catch (error) {
    console.error('Verify owner error:', error);
    res.status(500).json({ error: 'Failed to verify owner' });
  }
});

// Get pending verifications
router.get('/verifications', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: 'OWNER',
          verificationStatus: 'PENDING'
        },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          location: true,
          idFrontUrl: true,
          idBackUrl: true,
          verificationStatus: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({
        where: {
          role: 'OWNER',
          verificationStatus: 'PENDING'
        }
      })
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
    console.error('Get verifications error:', error);
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

// Get notifications sent by admin (for Recent notifications)
// Excludes Contact Us / Messages reply notifications - only shows broadcast notifications from Send notification
const REPLY_TITLE = 'Reply from MatchField Support';
router.get('/notifications', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const all = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: (parseInt(limit) || 20) * 2
    });
    const notifications = all.filter((n) => n.title !== REPLY_TITLE).slice(0, parseInt(limit) || 20);
    res.json({ notifications });
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Send notification to users (in-app; one-way, no reply)
router.post('/notifications/send', [
  body('title').trim().notEmpty(),
  body('message').trim().notEmpty(),
  body('audience').isIn(['all', 'players', 'owners', 'admins', 'private']),
  body('channels').optional().isArray(),
  body('targetUserId').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, message, audience, channels = ['in-app'], targetUserId } = req.body;

    let userIds = [];

    if (audience === 'private') {
      if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId is required for private notifications' });
      }
      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
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
      const where = role ? { role } : {};
      const users = await prisma.user.findMany({
        where,
        select: { id: true }
      });
      userIds = users.map((u) => u.id);
    }

    if (userIds.length === 0) {
      return res.status(400).json({ error: 'No users found for the selected audience' });
    }

    const channelsArray = Array.isArray(channels) ? channels : ['in-app'];
    const useInApp = channelsArray.some((c) => String(c).toLowerCase() === 'in-app');

    if (!useInApp) {
      return res.status(400).json({
        error: 'In-app notification is required. Email channel is not implemented.'
      });
    }

    // Use native Mongo writes to avoid Prisma Mongo transaction/replica-set requirement (P2031)
    const mongo = new MongoClient(process.env.DATABASE_URL);
    await mongo.connect();
    const db = mongo.db();
    const notificationsCol = db.collection('notifications');
    const userNotificationsCol = db.collection('user_notifications');

    const now = new Date();
    const notificationDoc = {
      title,
      message,
      audience,
      channels: channelsArray,
      target_user_id: audience === 'private' && targetUserId ? new ObjectId(String(targetUserId)) : null,
      sent_by_id: req.user && req.user.id ? new ObjectId(String(req.user.id)) : null,
      created_at: now
    };

    const inserted = await notificationsCol.insertOne(notificationDoc);
    const notificationId = inserted.insertedId;

    if (userIds.length > 0) {
      const userNotificationDocs = userIds.map((userId) => ({
        user_id: new ObjectId(String(userId)),
        notification_id: notificationId,
        read_at: null,
        created_at: now
      }));
      await userNotificationsCol.insertMany(userNotificationDocs, { ordered: false });
    }

    await mongo.close();

    res.status(201).json({
      success: true,
      notification: {
        id: String(notificationId),
        title,
        message,
        audience,
        channels: channelsArray,
        recipientCount: userIds.length
      }
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Invite a new admin (creates account + returns temporary password)
router.post('/invite-admin', [
  body('email').trim().isEmail(),
  body('fullName').optional().trim().isLength({ min: 1, max: 200 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const email = String(req.body.email).trim().toLowerCase();
    const fullName = (req.body.fullName && String(req.body.fullName).trim()) || 'Admin';

    // Use native Mongo driver for create to avoid Prisma Mongo transaction/replica-set limitations
    const mongo = new MongoClient(process.env.DATABASE_URL);
    await mongo.connect();
    const db = mongo.db();
    const usersCol = db.collection('users');

    const existing = await usersCol.findOne({ email });
    if (existing) {
      await mongo.close();
      return res.status(400).json({ error: 'Email already registered' });
    }

    // 12 chars, no confusing chars, easy to type
    const tempPassword = Array.from({ length: 12 }, () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      return chars[Math.floor(Math.random() * chars.length)];
    }).join('');

    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const now = new Date();
    const insertResult = await usersCol.insertOne({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      role: 'ADMIN',
      status: 'ACTIVE',
      verification_status: null,
      created_at: now,
      updated_at: now
    });

    const insertedId = insertResult.insertedId;
    const createdDoc = await usersCol.findOne(
      { _id: insertedId },
      {
        projection: {
          _id: 1,
          email: 1,
          full_name: 1,
          role: 1,
          status: 1,
          created_at: 1
        }
      }
    );

    await mongo.close();

    const user = {
      id: String(createdDoc._id),
      email: createdDoc.email,
      fullName: createdDoc.full_name || fullName,
      role: createdDoc.role || 'ADMIN',
      status: createdDoc.status || 'ACTIVE',
      createdAt: createdDoc.created_at || now
    };

    res.status(201).json({
      message: 'Admin account created',
      user,
      tempPassword
    });
  } catch (error) {
    console.error('Invite admin error:', error);
    res.status(500).json({ error: 'Failed to invite admin' });
  }
});

// ------------------------
// Fields moderation (Admin)
// ------------------------

function normalizeFieldModerationStatusFromQuery(q) {
  const s = String(q || '').toLowerCase().trim();
  if (s === 'pending') return 'PENDING';
  if (s === 'approved') return 'APPROVED';
  if (s === 'rejected') return 'REJECTED';
  return null;
}

// List fields (includes pending/approved/rejected)
router.get('/fields', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, sport, search } = req.query;
    const take = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const skip = (Math.max(1, parseInt(page) || 1) - 1) * take;

    const where = {};
    const statusNorm = normalizeFieldModerationStatusFromQuery(status);
    if (statusNorm) {
      // moderationStatus is optional; treat old data (null) as APPROVED if active
      if (statusNorm === 'APPROVED') {
        where.OR = [
          { moderationStatus: 'APPROVED' },
          { moderationStatus: null, isActive: true }
        ];
      } else if (statusNorm === 'PENDING') {
        where.OR = [
          { moderationStatus: 'PENDING' },
          { moderationStatus: null, isActive: false }
        ];
      } else {
        where.moderationStatus = statusNorm;
      }
    }
    if (sport) where.sport = String(sport);
    if (search) {
      const s = String(search);
      where.AND = (where.AND || []).concat([{
        OR: [
          { name: { contains: s } },
          { location: { contains: s } },
          { owner: { fullName: { contains: s } } },
          { owner: { email: { contains: s } } }
        ]
      }]);
    }

    const [fields, total] = await Promise.all([
      prisma.field.findMany({
        where,
        skip,
        take,
        include: {
          owner: {
            select: { id: true, fullName: true, email: true, avatar: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.field.count({ where })
    ]);

    res.json({
      fields,
      pagination: {
        page: Math.max(1, parseInt(page) || 1),
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

// Approve/reject a field
router.put('/fields/:fieldId/moderation', [
  body('status').isIn(['APPROVED', 'REJECTED']),
  body('reason').optional().isString().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const fieldId = typeof req.params.fieldId === 'string' ? req.params.fieldId.trim() : '';
    if (!isMongoObjectIdString(fieldId)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }

    const status = req.body.status;
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

    const current = await mongoFieldGetByIdPublicDetail(fieldId);
    if (!current) {
      return res.status(404).json({ error: 'Field not found' });
    }
    const pendingChanges =
      current.pendingChanges && typeof current.pendingChanges === 'object'
        ? current.pendingChanges
        : null;
    const hasPendingChanges = !!(pendingChanges && Object.keys(pendingChanges).length > 0);

    const apply = {
      moderationStatus: status,
      moderationReason: status === 'REJECTED' ? (reason || null) : null,
      moderatedAt: new Date(),
      moderatedById: req.user.id
    };

    if (status === 'APPROVED') {
      if (hasPendingChanges) {
        Object.assign(apply, pendingChanges);
      }
      apply.pendingChanges = null;
      apply.pendingChangeRequestedAt = null;
      apply.isActive = true;
    } else if (status === 'REJECTED') {
      apply.pendingChanges = null;
      apply.pendingChangeRequestedAt = null;
      // If this was an edit request on an already-live field, keep it active.
      apply.isActive = hasPendingChanges ? current.isActive !== false : false;
    }

    const updateResult = await mongoFieldUpdateAndFetch(fieldId, apply);
    if (!updateResult || !updateResult.matched || !updateResult.field) {
      return res.status(404).json({ error: 'Field not found' });
    }
    const field = updateResult.field;

    // Notify owner (native Mongo writes to avoid Prisma P2031 on standalone MongoDB)
    try {
      const title = status === 'APPROVED' ? 'Your field was approved' : 'Your field was rejected';
      const message = status === 'APPROVED'
        ? `Your field "${field.name}" is now visible to players.`
        : `Your field "${field.name}" was rejected.${reason ? ` Reason: ${reason}` : ''}`;

      if (isMongoObjectIdString(String(field.ownerId)) && isMongoObjectIdString(String(req.user.id))) {
        const mongo = new MongoClient(process.env.DATABASE_URL);
        await mongo.connect();
        try {
          const db = mongo.db();
          const notificationsCol = db.collection('notifications');
          const userNotificationsCol = db.collection('user_notifications');
          const now = new Date();

          const inserted = await notificationsCol.insertOne({
            title,
            message,
            audience: 'private',
            channels: ['in-app'],
            target_user_id: new ObjectId(String(field.ownerId)),
            sent_by_id: new ObjectId(String(req.user.id)),
            created_at: now
          });

          await userNotificationsCol.insertOne({
            user_id: new ObjectId(String(field.ownerId)),
            notification_id: inserted.insertedId,
            read_at: null,
            created_at: now
          });
        } finally {
          await mongo.close();
        }
      }
    } catch (e) {
      console.warn('Could not notify field owner:', e);
    }

    res.json({ message: 'Field moderation updated', field });
  } catch (error) {
    console.error('Admin moderate field error:', error);
    res.status(500).json({ error: 'Failed to update field status' });
  }
});

// ------------------------
// Support inbox (Admin team)
// ------------------------

// List support conversations (shared inbox)
router.get('/support/conversations', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const take = Math.min(500, Math.max(1, parseInt(limit) || 100));

    const conversations = await prisma.conversation.findMany({
      where: { isSupportThread: true },
      take,
      include: {
        user1: { select: { id: true, fullName: true, email: true, avatar: true, role: true } },
        user2: { select: { id: true, fullName: true, email: true, avatar: true, role: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            readAt: true,
            sender: { select: { id: true, fullName: true, avatar: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Admin support conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch support conversations' });
  }
});

// Get messages for a support conversation
router.get('/support/conversation/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const take = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const skip = (Math.max(1, parseInt(page) || 1) - 1) * take;

    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || !conv.isSupportThread) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        skip,
        take,
        include: { sender: { select: { id: true, fullName: true, avatar: true, role: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.message.count({ where: { conversationId } })
    ]);

    res.json({
      messages: messages.reverse(),
      pagination: {
        page: Math.max(1, parseInt(page) || 1),
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

// Send reply in support conversation
router.post('/support/conversation/:conversationId/messages', [
  body('content').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { conversationId } = req.params;
    const { content } = req.body;

    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || !conv.isSupportThread) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const message = await prisma.message.create({
      data: { conversationId, senderId: req.user.id, content },
      include: { sender: { select: { id: true, fullName: true, avatar: true, role: true } } }
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    // notify the non-admin side (best effort)
    const recipients = [String(conv.user1Id), String(conv.user2Id)].filter((id) => id !== String(req.user.id));
    const recipientId = recipients[0];
    if (recipientId) {
      try {
        const notification = await prisma.notification.create({
          data: {
            title: 'Reply from MatchField Support',
            message: content,
            audience: 'private',
            channels: ['in-app'],
            targetUserId: recipientId,
            sentById: req.user.id
          }
        });
        await prisma.userNotification.create({
          data: { userId: recipientId, notificationId: notification.id }
        });
      } catch (e) {
        console.warn('Admin support notify error:', e);
      }
    }

    res.status(201).json({ message: 'Message sent', messageObj: message });
  } catch (error) {
    console.error('Admin support send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark a message as read (global flag on message)
router.put('/support/conversation/:conversationId/messages/:messageId/read', async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const msg = await prisma.message.findFirst({
      where: { id: messageId, conversationId },
      include: { conversation: true }
    });
    if (!msg || !msg.conversation || !msg.conversation.isSupportThread) {
      return res.status(404).json({ error: 'Message not found' });
    }
    await prisma.message.update({ where: { id: messageId }, data: { readAt: new Date() } });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin support mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Star/unstar support conversation
router.patch('/support/conversation/:conversationId/star', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { starred } = req.body;
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || !conv.isSupportThread) return res.status(404).json({ error: 'Conversation not found' });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { starredAt: starred ? new Date() : null }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin support star error:', error);
    res.status(500).json({ error: 'Failed to update star status' });
  }
});

// Block/unblock support conversation
router.patch('/support/conversation/:conversationId/block', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { blocked } = req.body;
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || !conv.isSupportThread) return res.status(404).json({ error: 'Conversation not found' });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { blockedAt: blocked ? new Date() : null }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin support block error:', error);
    res.status(500).json({ error: 'Failed to update block status' });
  }
});

module.exports = router;

