const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireRole('OWNER'));

// Dashboard stats for the authenticated field owner
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const fieldWhere = { ownerId: userId };

    const [fields, totalFields, activeFields] = await Promise.all([
      prisma.field.findMany({
        where: fieldWhere,
        select: { id: true }
      }),
      prisma.field.count({ where: fieldWhere }),
      prisma.field.count({ where: { ...fieldWhere, isActive: true } })
    ]);

    const fieldIds = fields.map((f) => f.id);

    if (fieldIds.length === 0) {
      return res.json({
        stats: {
          totalFields: 0,
          activeFields: 0,
          pendingBookings: 0,
          upcomingBookings: 0,
          todayBookings: 0,
          revenueThisWeek: 0,
          revenueLastWeek: 0
        },
        fields: []
      });
    }

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const bookingBase = { fieldId: { in: fieldIds } };

    const [
      pendingBookings,
      upcomingBookings,
      todayBookings,
      revenueThisWeek,
      revenueLastWeek
    ] = await Promise.all([
      prisma.booking.count({
        where: {
          ...bookingBase,
          status: 'PENDING'
        }
      }),
      prisma.booking.count({
        where: {
          ...bookingBase,
          status: { in: ['UPCOMING', 'CONFIRMED'] },
          date: { gte: startOfToday }
        }
      }),
      prisma.booking.count({
        where: {
          ...bookingBase,
          status: { not: 'CANCELLED' },
          date: { gte: startOfToday, lte: endOfToday }
        }
      }),
      prisma.booking.aggregate({
        where: {
          ...bookingBase,
          createdAt: { gte: sevenDaysAgo },
          status: { in: ['CONFIRMED', 'COMPLETED'] }
        },
        _sum: { totalCost: true }
      }),
      prisma.booking.aggregate({
        where: {
          ...bookingBase,
          createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
          status: { in: ['CONFIRMED', 'COMPLETED'] }
        },
        _sum: { totalCost: true }
      })
    ]);

    const rev7 = revenueThisWeek._sum.totalCost || 0;
    const revPrev = revenueLastWeek._sum.totalCost || 0;
    const revenuePercent = revPrev > 0 ? Math.round(((rev7 - revPrev) / revPrev) * 100) : rev7 > 0 ? 100 : 0;

    res.json({
      stats: {
        totalFields,
        activeFields,
        pendingBookings,
        upcomingBookings,
        todayBookings,
        revenueThisWeek: rev7,
        revenueLastWeek: revPrev,
        revenueChangePercent: revenuePercent
      },
      fieldIds
    });
  } catch (error) {
    console.error('Owner stats error:', error);
    res.status(500).json({ error: 'Failed to load owner stats' });
  }
});

module.exports = router;
