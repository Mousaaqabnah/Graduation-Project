const { MongoClient, ObjectId } = require('mongodb');

function isMongoObjectIdString(s) {
  return typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(s.trim());
}

/** Avoid prisma.user.update on standalone MongoDB (Prisma uses transactions → replica set required). */
async function mongoUserSetFields(idHex, fields) {
  const id = String(idHex).trim();
  if (!isMongoObjectIdString(id)) {
    throw new Error('Invalid user id');
  }
  const $set = { ...fields, updated_at: new Date() };
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const result = await db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set });
    return result.matchedCount > 0;
  } finally {
    await client.close();
  }
}

/** Read owner verification without Prisma (same standalone-Mongo rationale as field writes). */
async function mongoUserGetVerificationStatus(idHex) {
  const id = String(idHex).trim();
  if (!isMongoObjectIdString(id)) return null;
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const doc = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { verification_status: 1 } }
    );
    if (!doc) return null;
    return doc.verification_status != null ? doc.verification_status : null;
  } finally {
    await client.close();
  }
}

module.exports = {
  isMongoObjectIdString,
  mongoUserSetFields,
  mongoUserGetVerificationStatus
};
