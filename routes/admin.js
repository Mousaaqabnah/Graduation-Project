const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

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

    const updateData = {
      verificationStatus,
      verifiedAt: verificationStatus === 'APPROVED' ? new Date() : null
    };

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        audience,
        channels: channelsArray,
        targetUserId: audience === 'private' ? targetUserId : null,
        sentById: req.user.id
      }
    });

    await prisma.userNotification.createMany({
      data: userIds.map((userId) => ({
        userId,
        notificationId: notification.id
      }))
    });

    res.status(201).json({
      success: true,
      notification: {
        id: notification.id,
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

module.exports = router;

