const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * take;
    const where = {
      userId: req.user.id,
      archivedAt: null
    };
    const [rows, total] = await Promise.all([
      prisma.userNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          notification: {
            select: {
              id: true,
              title: true,
              message: true,
              type: true,
              link: true,
              createdAt: true,
              createdById: true
            }
          }
        }
      }),
      prisma.userNotification.count({ where })
    ]);

    res.json({
      notifications: rows.map((r) => ({
        id: r.notification.id,
        title: r.notification.title,
        message: r.notification.message,
        type: r.notification.type,
        link: r.notification.link,
        createdAt: r.notification.createdAt,
        readAt: r.readAt,
        sentById: r.notification.createdById
      })),
      pagination: { page, limit: take, total, pages: Math.ceil(total / take) || 1 }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/me/mark-read', authenticate, async (req, res) => {
  try {
    await prisma.userNotification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

router.delete('/me', authenticate, async (req, res) => {
  try {
    await prisma.userNotification.updateMany({
      where: { userId: req.user.id, archivedAt: null },
      data: { archivedAt: new Date(), readAt: new Date() }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

module.exports = router;
