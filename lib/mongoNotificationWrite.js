const { MongoClient, ObjectId } = require('mongodb');

function isMongoObjectIdString(s) {
  return typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(String(s).trim());
}

/**
 * Create in-app notification + user_notifications link without Prisma.
 * Avoids Prisma transaction requirements on standalone mongod.
 */
async function mongoCreateUserNotification({ title, message, targetUserId, sentById }) {
  const targetId = String(targetUserId || '').trim();
  const senderId = sentById == null ? '' : String(sentById).trim();
  if (!isMongoObjectIdString(targetId)) {
    throw new Error('Invalid target user id');
  }
  if (senderId && !isMongoObjectIdString(senderId)) {
    throw new Error('Invalid sender user id');
  }

  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const now = new Date();

    const notificationDoc = {
      title: String(title || 'Notification'),
      message: String(message || ''),
      audience: 'private',
      channels: ['in-app'],
      target_user_id: new ObjectId(targetId),
      sent_by_id: senderId ? new ObjectId(senderId) : null,
      created_at: now
    };

    const notifInsert = await db.collection('notifications').insertOne(notificationDoc);

    await db.collection('user_notifications').insertOne({
      user_id: new ObjectId(targetId),
      notification_id: notifInsert.insertedId,
      read_at: null,
      created_at: now
    });
  } finally {
    await client.close();
  }
}

module.exports = {
  isMongoObjectIdString,
  mongoCreateUserNotification
};
