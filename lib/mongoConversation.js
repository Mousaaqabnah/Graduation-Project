const { MongoClient, ObjectId } = require('mongodb');

function isMongoObjectIdString(s) {
  return typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(String(s).trim());
}

function mapUserDoc(doc) {
  if (!doc || !doc._id) return null;
  return {
    id: doc._id.toString(),
    fullName: doc.full_name,
    avatar: doc.avatar ?? null,
    role: doc.role
  };
}

function mapConversationDoc(convDoc, u1, u2) {
  return {
    id: convDoc._id.toString(),
    user1Id: convDoc.user1_id.toString(),
    user2Id: convDoc.user2_id.toString(),
    createdAt: convDoc.created_at,
    updatedAt: convDoc.updated_at,
    blockedAt: convDoc.blocked_at ?? null,
    starredAt: convDoc.starred_at ?? null,
    user1: mapUserDoc(u1),
    user2: mapUserDoc(u2)
  };
}

/**
 * Find or create a 1:1 conversation (same shape as Prisma GET /messages/conversation/:userId).
 * Uses the driver only — avoids Prisma transactions on standalone mongod (P2031).
 */
async function mongoGetOrCreateConversation(meIdHex, otherIdHex) {
  const me = String(meIdHex).trim();
  const other = String(otherIdHex).trim();
  if (!isMongoObjectIdString(me) || !isMongoObjectIdString(other)) {
    return { ok: false, status: 400, error: 'Invalid user id' };
  }
  if (me === other) {
    return { ok: false, status: 400, error: 'Cannot create conversation with yourself' };
  }

  const meOid = new ObjectId(me);
  const otherOid = new ObjectId(other);
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const usersCol = db.collection('users');
    const convCol = db.collection('conversations');

    const otherExists = await usersCol.findOne({ _id: otherOid }, { projection: { _id: 1 } });
    if (!otherExists) {
      return { ok: false, status: 404, error: 'User not found' };
    }

    let doc = await convCol.findOne({
      $or: [
        { user1_id: meOid, user2_id: otherOid },
        { user1_id: otherOid, user2_id: meOid }
      ]
    });

    const now = new Date();
    if (!doc) {
      try {
        const ins = await convCol.insertOne({
          user1_id: meOid,
          user2_id: otherOid,
          created_at: now,
          updated_at: now
        });
        doc = await convCol.findOne({ _id: ins.insertedId });
      } catch (e) {
        if (e && e.code === 11000) {
          doc = await convCol.findOne({
            $or: [
              { user1_id: meOid, user2_id: otherOid },
              { user1_id: otherOid, user2_id: meOid }
            ]
          });
        } else {
          throw e;
        }
      }
    }

    if (!doc) {
      return { ok: false, status: 500, error: 'Failed to create conversation' };
    }

    const id1 = doc.user1_id instanceof ObjectId ? doc.user1_id : new ObjectId(String(doc.user1_id));
    const id2 = doc.user2_id instanceof ObjectId ? doc.user2_id : new ObjectId(String(doc.user2_id));

    const [u1, u2] = await Promise.all([
      usersCol.findOne({ _id: id1 }, { projection: { full_name: 1, avatar: 1, role: 1 } }),
      usersCol.findOne({ _id: id2 }, { projection: { full_name: 1, avatar: 1, role: 1 } })
    ]);

    return {
      ok: true,
      conversation: mapConversationDoc(doc, u1, u2)
    };
  } finally {
    await client.close();
  }
}

module.exports = {
  isMongoObjectIdString,
  mongoGetOrCreateConversation
};
