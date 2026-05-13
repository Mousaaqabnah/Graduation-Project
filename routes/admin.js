const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { MongoClient, ObjectId } = require('mongodb');
const { authenticate, requireRole } = require('../middleware/auth');
const { isMongoObjectIdString, mongoUserSetFields } = require('../lib/mongoUserWrite');
const { mongoFieldUpdateAndFetch, mongoFieldGetByIdPublicDetail } = require('../lib/mongoFieldWrite');
const { mongoCreateMessageAndTouchConversation, mongoMarkMessageRead } = require('../lib/mongoMessageWrite');
const { mongoCreateUserNotification } = require('../lib/mongoNotificationWrite');

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

    const currentUser = await prisma.user.findUnique({
      where: { id: idTrim },
      select: {
        id: true,
        role: true,
        fullName: true,
        verificationStatus: true
      }
    });
    if (!currentUser || String(currentUser.role || '').toUpperCase() !== 'OWNER') {
      return res.status(404).json({ error: 'Owner not found' });
    }
    if (String(currentUser.verificationStatus || '').toUpperCase() !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending owner verifications can be reviewed' });
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

    // Notify owner about verification decision (best effort).
    try {
      if (isMongoObjectIdString(String(idTrim)) && isMongoObjectIdString(String(req.user.id))) {
        const mongo = new MongoClient(process.env.DATABASE_URL);
        await mongo.connect();
        try {
          const db = mongo.db();
          const notificationsCol = db.collection('notifications');
          const userNotificationsCol = db.collection('user_notifications');
          const now = new Date();
          const ownerName = (user && user.fullName) || (currentUser && currentUser.fullName) || 'Owner';
          const title = verificationStatus === 'APPROVED'
            ? 'Owner verification approved'
            : 'Owner verification rejected';
          const message = verificationStatus === 'APPROVED'
            ? `Hi ${ownerName}, your owner account has been verified. You can now fully use owner features.`
            : `Hi ${ownerName}, your owner verification was rejected.${reason ? ` Reason: ${String(reason)}` : ''}`;

          const inserted = await notificationsCol.insertOne({
            title,
            message,
            audience: 'private',
            channels: ['in-app'],
            target_user_id: new ObjectId(String(idTrim)),
            sent_by_id: new ObjectId(String(req.user.id)),
            created_at: now
          });

          await userNotificationsCol.insertOne({
            user_id: new ObjectId(String(idTrim)),
            notification_id: inserted.insertedId,
            read_at: null,
            created_at: now
          });
        } finally {
          await mongo.close();
        }
      }
    } catch (notifyErr) {
      console.warn('Could not notify owner after verification review:', notifyErr);
    }

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
// Excludes user-to-user chat alerts: those reuse the same collection with sentById = non-admin sender (see routes/messages.js)
const REPLY_TITLE = 'Reply from MatchField Support';
router.get('/notifications', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const take = parseInt(limit) || 20;
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true }
    });
    const adminIds = admins.map((a) => a.id);
    const notifications = await prisma.notification.findMany({
      where: {
        title: { not: REPLY_TITLE },
        OR: [{ sentById: null }, { sentById: { in: adminIds } }]
      },
      orderBy: { createdAt: 'desc' },
      take
    });
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

async function notifyInAppSupportRecipient(conv, adminId, content) {
  const recipients = [String(conv.user1Id), String(conv.user2Id)].filter((id) => id !== String(adminId));
  const recipientId = recipients[0];
  if (!recipientId) return;
  try {
    await mongoCreateUserNotification({
      title: 'Reply from MatchField Support',
      message: content,
      targetUserId: recipientId,
      sentById: adminId
    });
  } catch (e) {
    console.warn('Admin support notify error:', e);
  }
}

async function mongoFindOrCreateSupportConversation(userId, adminId) {
  const userIdStr = String(userId || '').trim();
  const adminIdStr = String(adminId || '').trim();
  if (!isMongoObjectIdString(userIdStr) || !isMongoObjectIdString(adminIdStr)) {
    throw new Error('Invalid user or admin id');
  }

  const userOid = new ObjectId(userIdStr);
  const adminOid = new ObjectId(adminIdStr);
  const mongo = new MongoClient(process.env.DATABASE_URL);
  await mongo.connect();
  try {
    const db = mongo.db();
    const conversations = db.collection('conversations');
    const now = new Date();
    let doc = await conversations.findOne({
      $or: [
        { user1_id: userOid, user2_id: adminOid },
        { user1_id: adminOid, user2_id: userOid }
      ]
    });

    if (!doc) {
      const inserted = await conversations.insertOne({
        user1_id: userOid,
        user2_id: adminOid,
        is_support_thread: true,
        created_at: now,
        updated_at: now,
        blocked_at: null,
        starred_at: null
      });
      doc = await conversations.findOne({ _id: inserted.insertedId });
    } else if (doc.is_support_thread !== true) {
      await conversations.updateOne(
        { _id: doc._id },
        { $set: { is_support_thread: true, updated_at: now } }
      );
      doc = await conversations.findOne({ _id: doc._id });
    }

    return {
      id: String(doc._id),
      user1Id: String(doc.user1_id),
      user2Id: String(doc.user2_id),
      isSupportThread: doc.is_support_thread === true
    };
  } finally {
    await mongo.close();
  }
}

async function mongoMessageCountForConversation(conversationId) {
  const id = String(conversationId || '').trim();
  if (!isMongoObjectIdString(id)) throw new Error('Invalid conversation id');
  const mongo = new MongoClient(process.env.DATABASE_URL);
  await mongo.connect();
  try {
    return await mongo.db().collection('messages').countDocuments({
      conversation_id: new ObjectId(id)
    });
  } finally {
    await mongo.close();
  }
}

// List support conversations (shared inbox) + Contact form rows not yet linked to a thread
router.get('/support/conversations', async (req, res) => {
  try {
    const legacyLimit = parseInt(req.query.limit, 10);
    const convTake = Math.min(
      300,
      Math.max(1, parseInt(req.query.conversationTake, 10) || (Number.isFinite(legacyLimit) ? legacyLimit : 80))
    );
    const subTake = Math.min(200, Math.max(1, parseInt(req.query.submissionTake, 10) || 80));

    const conversations = await prisma.conversation.findMany({
      where: { isSupportThread: true },
      take: convTake,
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
            sender: { select: { id: true, fullName: true, avatar: true, role: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true }
    });

    let submissionBacklog = [];
    try {
      const mongo = new MongoClient(process.env.DATABASE_URL);
      await mongo.connect();
      try {
        const col = mongo.db().collection('support_contact_submissions');
        const docs = await col
          .find({
            $or: [{ prisma_conversation_id: null }, { prisma_conversation_id: { $exists: false } }]
          })
          .sort({ created_at: -1 })
          .limit(subTake)
          .toArray();

        const maxRepair = 40;
        let repaired = 0;
        for (const d of docs) {
          let skipPush = false;
          const userIdStr = d.user_id ? String(d.user_id) : null;
          if (userIdStr && admin && repaired < maxRepair) {
            const conv = await prisma.conversation.findFirst({
              where: {
                isSupportThread: true,
                OR: [
                  { user1Id: userIdStr, user2Id: admin.id },
                  { user1Id: admin.id, user2Id: userIdStr }
                ]
              }
            });
            if (conv) {
              const n = await prisma.message.count({ where: { conversationId: conv.id } });
              if (n > 0) {
                const existingContactMessage = await mongo.db().collection('messages').findOne({
                  conversation_id: new ObjectId(String(conv.id)),
                  sender_id: new ObjectId(userIdStr),
                  content: { $regex: String(d.message || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
                });
                if (!existingContactMessage) {
                  const contentParts = [];
                  if (d.topic) contentParts.push(`Topic: ${d.topic}`);
                  contentParts.push(String(d.message || ''));
                  if (d.phone) contentParts.push(`Phone: ${d.phone}`);
                  contentParts.push(`From: ${d.full_name} <${d.email}> (via Contact form)`);
                  await mongoCreateMessageAndTouchConversation(conv.id, userIdStr, contentParts.join('\n\n'));
                }
                await col.updateOne(
                  { _id: d._id },
                  { $set: { prisma_conversation_id: String(conv.id) } }
                );
                skipPush = true;
                repaired += 1;
              }
            }
          }
          if (skipPush) continue;

          submissionBacklog.push({
            id: String(d._id),
            fullName: d.full_name,
            email: d.email,
            phone: d.phone || null,
            topic: d.topic || null,
            message: d.message,
            userId: userIdStr,
            createdAt: d.created_at || null,
            adminSeenAt: d.admin_seen_at || null
          });
        }
      } finally {
        await mongo.close();
      }
    } catch (e) {
      console.warn('Admin support: submission backlog load failed:', e);
    }

    res.json({ conversations, submissionBacklog });
  } catch (error) {
    console.error('Admin support conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch support conversations' });
  }
});

// Mark a Contact form backlog row as seen (no reply required)
router.patch('/support/submission/:submissionId/seen', async (req, res) => {
  try {
    const { submissionId } = req.params;
    if (!ObjectId.isValid(submissionId)) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }
    const mongo = new MongoClient(process.env.DATABASE_URL);
    await mongo.connect();
    try {
      const r = await mongo.db().collection('support_contact_submissions').updateOne(
        { _id: new ObjectId(submissionId) },
        { $set: { admin_seen_at: new Date() } }
      );
      if (r.matchedCount === 0) {
        return res.status(404).json({ error: 'Submission not found' });
      }
    } finally {
      await mongo.close();
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Admin support submission seen error:', error);
    res.status(500).json({ error: 'Failed to update submission' });
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

    const message = await mongoCreateMessageAndTouchConversation(conversationId, req.user.id, content);

    await notifyInAppSupportRecipient(conv, req.user.id, content);

    res.status(201).json({ message: 'Message sent', messageObj: message });
  } catch (error) {
    console.error('Admin support send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// First reply on a Contact form row that never reached Prisma (still in admin backlog)
router.post('/support/submission/:submissionId/reply', [
  body('content').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { submissionId } = req.params;
    const { content } = req.body;

    if (!ObjectId.isValid(submissionId)) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }

    const mongo = new MongoClient(process.env.DATABASE_URL);
    await mongo.connect();
    let doc;
    try {
      doc = await mongo.db().collection('support_contact_submissions').findOne({ _id: new ObjectId(submissionId) });
    } finally {
      await mongo.close();
    }

    if (!doc) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (doc.prisma_conversation_id) {
      const convId = String(doc.prisma_conversation_id);
      const conv = await prisma.conversation.findUnique({ where: { id: convId } });
      if (!conv || !conv.isSupportThread) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      const message = await mongoCreateMessageAndTouchConversation(convId, req.user.id, content);
      await notifyInAppSupportRecipient(conv, req.user.id, content);
      return res.status(201).json({ message: 'Message sent', conversationId: convId, messageObj: message });
    }

    const userId = doc.user_id ? String(doc.user_id) : null;
    if (!userId) {
      return res.status(400).json({
        error:
          'This contact was not linked to a logged-in account, so a chat thread cannot be started. Use email or phone from the submission.'
      });
    }

    const adminId = req.user.id;

    const conversation = await mongoFindOrCreateSupportConversation(userId, adminId);

    const msgCount = await mongoMessageCountForConversation(conversation.id);
    if (msgCount === 0) {
      const contentParts = [];
      if (doc.topic) contentParts.push(`Topic: ${doc.topic}`);
      contentParts.push(String(doc.message));
      if (doc.phone) contentParts.push(`Phone: ${doc.phone}`);
      contentParts.push(`From: ${doc.full_name} <${doc.email}> (via Contact form)`);
      await mongoCreateMessageAndTouchConversation(conversation.id, userId, contentParts.join('\n\n'));
    }

    const adminMsg = await mongoCreateMessageAndTouchConversation(conversation.id, adminId, content);

    const mongo2 = new MongoClient(process.env.DATABASE_URL);
    await mongo2.connect();
    try {
      await mongo2.db().collection('support_contact_submissions').updateOne(
        { _id: new ObjectId(submissionId) },
        { $set: { prisma_conversation_id: String(conversation.id) } }
      );
    } finally {
      await mongo2.close();
    }

    await notifyInAppSupportRecipient(conversation, adminId, content);

    res.status(201).json({
      message: 'Reply sent',
      conversationId: conversation.id,
      messageObj: adminMsg
    });
  } catch (error) {
    console.error('Admin support submission reply error:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Mark a message read (native Mongo only — Prisma reads/writes can throw P2031 on standalone MongoDB)
router.put('/support/conversation/:conversationId/messages/:messageId/read', async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    if (!ObjectId.isValid(conversationId) || !ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid conversation or message id' });
    }

    const mongo = new MongoClient(process.env.DATABASE_URL);
    await mongo.connect();
    try {
      const convDoc = await mongo.db().collection('conversations').findOne(
        { _id: new ObjectId(conversationId) },
        { projection: { is_support_thread: 1 } }
      );
      if (!convDoc || convDoc.is_support_thread === false) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } finally {
      await mongo.close();
    }

    const result = await mongoMarkMessageRead(messageId, conversationId, req.user.id);
    if (!result.ok && result.reason === 'not_found') {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (!result.ok) {
      return res.status(400).json({ error: 'Invalid message or conversation' });
    }

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
    if (!ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    const mongo = new MongoClient(process.env.DATABASE_URL);
    await mongo.connect();
    try {
      const result = await mongo.db().collection('conversations').updateOne(
        { _id: new ObjectId(conversationId), is_support_thread: true },
        { $set: { starred_at: starred ? new Date() : null, updated_at: new Date() } }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    } finally {
      await mongo.close();
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Admin support star error:', error);
    res.status(500).json({ error: 'Failed to update star status' });
  }
});

// Block/unblock support conversation (native Mongo write — Prisma updates need a replica set on MongoDB; see P2031)
router.patch('/support/conversation/:conversationId/block', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { blocked } = req.body;
    if (!ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }

    const existing = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { user1Id: true, user2Id: true, isSupportThread: true }
    });
    if (!existing || !existing.isSupportThread) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const mongo = new MongoClient(process.env.DATABASE_URL);
    await mongo.connect();
    try {
      const result = await mongo.db().collection('conversations').updateOne(
        { _id: new ObjectId(conversationId) },
        {
          $set: {
            blocked_at: blocked ? new Date() : null,
            updated_at: new Date(),
            is_support_thread: true
          }
        }
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } finally {
      await mongo.close();
    }

    const { emitConversationUpdate } = require('../lib/chatEvents');
    emitConversationUpdate([existing.user1Id, existing.user2Id], {
      conversationId,
      type: 'support-blocked',
      blocked: !!blocked
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin support block error:', error);
    res.status(500).json({ error: 'Failed to update block status' });
  }
});

module.exports = router;

