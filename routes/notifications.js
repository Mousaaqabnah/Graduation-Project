const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authenticate, async (req, res) => {
  try {
    const rows = await prisma.userNotification.findMany({
      where: {
        userId: req.user.id,
        archivedAt: null
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
    });

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
      }))
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
