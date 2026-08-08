const { prisma } = require('./prisma');

/**
 * Create an in-app notification for one or many users.
 */
async function createUserNotification({
  title,
  message,
  type = 'SYSTEM',
  audience = 'PRIVATE',
  targetUserId = null,
  targetUserIds = null,
  sentById = null,
  link = null,
  metadata = null,
  channel = 'IN_APP'
}) {
  const ids = [];
  if (targetUserId) ids.push(String(targetUserId));
  if (Array.isArray(targetUserIds)) {
    targetUserIds.forEach((id) => {
      if (id) ids.push(String(id));
    });
  }
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) {
    throw new Error('targetUserId required');
  }

  return prisma.$transaction(async (tx) => {
    const notification = await tx.notification.create({
      data: {
        type,
        audience,
        title: String(title || '').slice(0, 180),
        message: String(message || ''),
        link: link || null,
        metadata: metadata || undefined,
        createdById: sentById || null,
        channels: {
          create: [{ channel, status: 'PENDING' }]
        },
        recipients: {
          create: uniqueIds.map((userId) => ({ userId }))
        }
      },
      include: {
        recipients: true,
        channels: true
      }
    });

    await tx.notificationDelivery.updateMany({
      where: { notificationId: notification.id },
      data: { status: 'DELIVERED', deliveredAt: new Date(), attemptedAt: new Date() }
    });

    return notification;
  });
}

module.exports = { createUserNotification };
