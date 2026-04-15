const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateAllowSuspended } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateAllowSuspended);

router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const userNotifications = await prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        notification: {
          select: {
            id: true,
            title: true,
            message: true,
            audience: true,
            channels: true,
            createdAt: true
          }
        }
      }
    });

    const notifications = userNotifications.map((un) => ({
      id: un.id,
      notificationId: un.notificationId,
      title: un.notification.title,
      message: un.notification.message,
      audience: un.notification.audience,
      channels: un.notification.channels,
      readAt: un.readAt,
      createdAt: un.createdAt
    }));

    res.json({ notifications });
  } catch (error) {
    console.error('Get my notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.delete('/me', async (req, res) => {
  try {
    const userId = req.user.id;
    await prisma.userNotification.deleteMany({ where: { userId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

module.exports = router;
