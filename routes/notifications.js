const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { MongoClient, ObjectId } = require('mongodb');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// Mark all in-app notifications read for current user (native Mongo — avoids Prisma txn/replica-set issues on standalone mongod)
router.post('/me/mark-read', async (req, res) => {
  const mongo = new MongoClient(process.env.DATABASE_URL);
  try {
    const userId = req.user.id;
    await mongo.connect();
    const col = mongo.db().collection('user_notifications');
    await col.updateMany(
      {
        user_id: new ObjectId(String(userId)),
        $or: [{ read_at: null }, { read_at: { $exists: false } }]
      },
      { $set: { read_at: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({
      error: 'Failed to mark notifications as read',
      details: error && error.message ? String(error.message) : undefined
    });
  } finally {
    try {
      await mongo.close();
    } catch (_) {}
  }
});

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

// Clear all in-app notifications for current user (native Mongo — avoids Prisma txn/replica-set issues)
router.delete('/me', async (req, res) => {
  const mongo = new MongoClient(process.env.DATABASE_URL);
  try {
    const userId = req.user.id;
    const userOid = new ObjectId(String(userId));
    await mongo.connect();
    await mongo.db().collection('user_notifications').deleteMany({ user_id: userOid });
    res.json({ success: true });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({
      error: 'Failed to clear notifications',
      details: error && error.message ? String(error.message) : undefined
    });
  } finally {
    try {
      await mongo.close();
    } catch (_) {}
  }
});

module.exports = router;
