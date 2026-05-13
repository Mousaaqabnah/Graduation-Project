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
  const attachments = Array.isArray(messageDoc.attachments) ? messageDoc.attachments : null;
  return {
    id: messageDoc._id.toString(),
    conversationId: messageDoc.conversation_id.toString(),
    senderId: messageDoc.sender_id.toString(),
    content: messageDoc.content != null ? String(messageDoc.content) : '',
    attachments,
    createdAt: messageDoc.created_at,
    readAt: messageDoc.read_at ?? null,
    sender: mapSenderDoc(senderDoc)
  };
}

/**
 * Insert a message and touch conversation.updated_at.
 * attachments: [{ url, mimeType, originalName, size }]
 */
async function mongoCreateMessageAndTouchConversation(conversationIdHex, senderIdHex, content, attachments = null) {
  const conversationId = String(conversationIdHex || '').trim();
  const senderId = String(senderIdHex || '').trim();
  if (!isMongoObjectIdString(conversationId) || !isMongoObjectIdString(senderId)) {
    throw new Error('Invalid conversation or sender id');
  }

  const text = String(content || '').trim();
  const att = Array.isArray(attachments) && attachments.length > 0 ? attachments : null;
  if (!text && !att) {
    throw new Error('Message must have text or attachments');
  }

  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const now = new Date();
    const conversationOid = new ObjectId(conversationId);
    const senderOid = new ObjectId(senderId);

    const doc = {
      conversation_id: conversationOid,
      sender_id: senderOid,
      content: text,
      created_at: now,
      read_at: null
    };
    if (att) doc.attachments = att;

    const inserted = await db.collection('messages').insertOne(doc);

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

async function mongoUnreadCount(conversationIdHex, viewerUserIdHex) {
  const cid = String(conversationIdHex || '').trim();
  const vid = String(viewerUserIdHex || '').trim();
  if (!isMongoObjectIdString(cid) || !isMongoObjectIdString(vid)) return 0;
  const viewerOid = new ObjectId(vid);
  const convOid = new ObjectId(cid);

  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    return await db.collection('messages').countDocuments({
      conversation_id: convOid,
      sender_id: { $ne: viewerOid },
      read_at: null
    });
  } finally {
    await client.close();
  }
}

async function mongoMarkMessageRead(messageIdHex, conversationIdHex, readerUserIdHex) {
  const mid = String(messageIdHex || '').trim();
  const cid = String(conversationIdHex || '').trim();
  const rid = String(readerUserIdHex || '').trim();
  if (!isMongoObjectIdString(mid) || !isMongoObjectIdString(cid) || !isMongoObjectIdString(rid)) {
    return { ok: false, reason: 'invalid_ids' };
  }

  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const msg = await db.collection('messages').findOne({ _id: new ObjectId(mid) });
    if (!msg || msg.conversation_id.toString() !== cid) return { ok: false, reason: 'not_found' };
    const senderStr = msg.sender_id.toString();
    if (senderStr === rid) return { ok: true, skipped: true };

    await db.collection('messages').updateOne(
      { _id: new ObjectId(mid) },
      { $set: { read_at: new Date() } }
    );
    return { ok: true };
  } finally {
    await client.close();
  }
}

async function mongoMarkAllUnreadAsRead(conversationIdHex, readerUserIdHex) {
  const cid = String(conversationIdHex || '').trim();
  const rid = String(readerUserIdHex || '').trim();
  if (!isMongoObjectIdString(cid) || !isMongoObjectIdString(rid)) return 0;

  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const now = new Date();
    const readerOid = new ObjectId(rid);
    const convOid = new ObjectId(cid);

    const result = await db.collection('messages').updateMany(
      {
        conversation_id: convOid,
        sender_id: { $ne: readerOid },
        read_at: null
      },
      { $set: { read_at: now } }
    );
    return result.modifiedCount || 0;
  } finally {
    await client.close();
  }
}

/**
 * True when Mongo has blocked_at (admin spam/block on support inbox).
 * Does not require is_support_thread so messaging stays locked even if that flag was missing on the document.
 */
async function mongoConversationGlobalBlockActive(conversationIdHex) {
  const cid = String(conversationIdHex || '').trim();
  if (!isMongoObjectIdString(cid)) return false;
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const conv = await client.db().collection('conversations').findOne(
      { _id: new ObjectId(cid) },
      { projection: { blocked_at: 1 } }
    );
    return !!(conv && conv.blocked_at);
  } finally {
    await client.close();
  }
}

async function mongoConversationViewerMeta(conversationIdHex, viewerUserIdHex) {
  const cid = String(conversationIdHex || '').trim();
  const vid = String(viewerUserIdHex || '').trim();
  if (!isMongoObjectIdString(cid) || !isMongoObjectIdString(vid)) {
    return { starredAt: null, blockedAt: null };
  }
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const conv = await db.collection('conversations').findOne(
      { _id: new ObjectId(cid) },
      { projection: { starred_by: 1, blocked_by: 1, blocked_at: 1 } }
    );
    const starredAt = conv && conv.starred_by ? conv.starred_by[vid] || null : null;
    let blockedAt = conv && conv.blocked_by ? conv.blocked_by[vid] || null : null;
    // Legacy fallback for older docs that only had global blocked_at.
    if (!blockedAt && conv && conv.blocked_at) blockedAt = conv.blocked_at;
    return { starredAt, blockedAt };
  } finally {
    await client.close();
  }
}

async function mongoConversationSetStarred(conversationIdHex, actorUserIdHex, starred) {
  const cid = String(conversationIdHex || '').trim();
  const uid = String(actorUserIdHex || '').trim();
  if (!isMongoObjectIdString(cid) || !isMongoObjectIdString(uid)) throw new Error('Invalid conversation/user id');
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const nowIso = new Date().toISOString();
    const setPath = `starred_by.${uid}`;
    if (starred) {
      await db.collection('conversations').updateOne(
        { _id: new ObjectId(cid) },
        { $set: { [setPath]: nowIso, updated_at: new Date(), starred_at: null } }
      );
    } else {
      await db.collection('conversations').updateOne(
        { _id: new ObjectId(cid) },
        { $unset: { [setPath]: '' }, $set: { updated_at: new Date(), starred_at: null } }
      );
    }
  } finally {
    await client.close();
  }
}

async function mongoConversationSetBlocked(conversationIdHex, actorUserIdHex, blocked) {
  const cid = String(conversationIdHex || '').trim();
  const uid = String(actorUserIdHex || '').trim();
  if (!isMongoObjectIdString(cid) || !isMongoObjectIdString(uid)) throw new Error('Invalid conversation/user id');
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const nowIso = new Date().toISOString();
    const setPath = `blocked_by.${uid}`;
    if (blocked) {
      await db.collection('conversations').updateOne(
        { _id: new ObjectId(cid) },
        {
          $set: { [setPath]: nowIso, blocked_at: null, updated_at: new Date() }
        }
      );
    } else {
      await db.collection('conversations').updateOne(
        { _id: new ObjectId(cid) },
        { $unset: { [setPath]: '' }, $set: { blocked_at: null, updated_at: new Date() } }
      );
    }
  } finally {
    await client.close();
  }
}

module.exports = {
  isMongoObjectIdString,
  mongoCreateMessageAndTouchConversation,
  mongoUnreadCount,
  mongoMarkMessageRead,
  mongoMarkAllUnreadAsRead,
  mongoConversationViewerMeta,
  mongoConversationGlobalBlockActive,
  mongoConversationSetStarred,
  mongoConversationSetBlocked,
  mapMessageDoc
};
