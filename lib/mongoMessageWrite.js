const { MongoClient, ObjectId } = require('mongodb');

function isMongoObjectIdString(s) {
  return typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(String(s).trim());
}

function mapSenderDoc(senderDoc) {
  if (!senderDoc || !senderDoc._id) return null;
  return {
    id: senderDoc._id.toString(),
    fullName: senderDoc.full_name || 'User',
    avatar: senderDoc.avatar ?? null
  };
}

function mapMessageDoc(messageDoc, senderDoc) {
  if (!messageDoc || !messageDoc._id) return null;
  return {
    id: messageDoc._id.toString(),
    conversationId: messageDoc.conversation_id.toString(),
    senderId: messageDoc.sender_id.toString(),
    content: messageDoc.content,
    createdAt: messageDoc.created_at,
    readAt: messageDoc.read_at ?? null,
    sender: mapSenderDoc(senderDoc)
  };
}

/**
 * Insert a message and touch conversation.updated_at.
 * Uses native Mongo driver to avoid Prisma transactions on standalone mongod.
 */
async function mongoCreateMessageAndTouchConversation(conversationIdHex, senderIdHex, content) {
  const conversationId = String(conversationIdHex || '').trim();
  const senderId = String(senderIdHex || '').trim();
  if (!isMongoObjectIdString(conversationId) || !isMongoObjectIdString(senderId)) {
    throw new Error('Invalid conversation or sender id');
  }

  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const now = new Date();
    const conversationOid = new ObjectId(conversationId);
    const senderOid = new ObjectId(senderId);

    const inserted = await db.collection('messages').insertOne({
      conversation_id: conversationOid,
      sender_id: senderOid,
      content: String(content || ''),
      created_at: now,
      read_at: null
    });

    await db.collection('conversations').updateOne(
      { _id: conversationOid },
      { $set: { updated_at: now } }
    );

    const [messageDoc, senderDoc] = await Promise.all([
      db.collection('messages').findOne({ _id: inserted.insertedId }),
      db.collection('users').findOne(
        { _id: senderOid },
        { projection: { full_name: 1, avatar: 1 } }
      )
    ]);

    return mapMessageDoc(messageDoc, senderDoc);
  } finally {
    await client.close();
  }
}

module.exports = {
  isMongoObjectIdString,
  mongoCreateMessageAndTouchConversation
};
