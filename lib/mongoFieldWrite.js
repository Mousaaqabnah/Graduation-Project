const { MongoClient, ObjectId } = require('mongodb');

function isMongoObjectIdString(s) {
  return typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(String(s).trim());
}

/**
 * Prisma Field model → BSON keys (see schema @map).
 */
function fieldUpdateToMongoSet(prismaShape) {
  const d = prismaShape || {};
  const $set = { updated_at: new Date() };
  if (d.name !== undefined) $set.name = d.name;
  if (d.sport !== undefined) $set.sport = d.sport;
  if (d.description !== undefined) $set.description = d.description;
  if (d.type !== undefined) $set.type = d.type;
  if (d.location !== undefined) $set.location = d.location;
  if (d.address !== undefined) $set.address = d.address;
  if (d.phone !== undefined) $set.phone = d.phone;
  if (d.pricePerHour !== undefined) $set.price_per_hour = d.pricePerHour;
  if (d.features !== undefined) $set.features = d.features;
  if (d.images !== undefined) $set.images = d.images;
  if (d.isActive !== undefined) $set.is_active = d.isActive;
  if (d.latitude !== undefined) $set.latitude = d.latitude;
  if (d.longitude !== undefined) $set.longitude = d.longitude;
  return $set;
}

function mapFieldDocAndOwner(doc, ownerDoc) {
  if (!doc) return null;
  let owner = null;
  if (ownerDoc && ownerDoc._id) {
    owner = {
      id: ownerDoc._id.toString(),
      fullName: ownerDoc.full_name,
      avatar: ownerDoc.avatar
    };
  }
  return {
    id: doc._id.toString(),
    name: doc.name,
    sport: doc.sport,
    description: doc.description ?? null,
    type: doc.type,
    location: doc.location,
    address: doc.address ?? null,
    latitude: doc.latitude ?? null,
    longitude: doc.longitude ?? null,
    phone: doc.phone ?? null,
    pricePerHour: doc.price_per_hour,
    features: doc.features || [],
    images: doc.images || [],
    rating: doc.rating ?? null,
    reviewCount: doc.review_count ?? 0,
    isActive: doc.is_active !== false,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    ownerId: doc.owner_id && doc.owner_id.toString ? doc.owner_id.toString() : String(doc.owner_id),
    owner
  };
}

/** Owner id only — avoids Prisma on standalone MongoDB (no replica set). */
async function mongoFieldGetOwnerId(idHex) {
  const id = String(idHex).trim();
  if (!isMongoObjectIdString(id)) return null;
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const doc = await db.collection('fields').findOne(
      { _id: new ObjectId(id) },
      { projection: { owner_id: 1 } }
    );
    if (!doc || doc.owner_id == null) return null;
    return doc.owner_id.toString();
  } finally {
    await client.close();
  }
}

/**
 * $set then read field + owner in one connection. No Prisma (avoids P2031 / transactions on standalone mongod).
 */
async function mongoFieldUpdateAndFetch(idHex, prismaUpdateData) {
  const id = String(idHex).trim();
  if (!isMongoObjectIdString(id)) {
    throw new Error('Invalid field id');
  }
  const oid = new ObjectId(id);
  const $set = fieldUpdateToMongoSet(prismaUpdateData);
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const result = await db.collection('fields').updateOne({ _id: oid }, { $set });
    if (result.matchedCount === 0) {
      return { matched: false, field: null };
    }
    const doc = await db.collection('fields').findOne({ _id: oid });
    if (!doc) {
      return { matched: true, field: null };
    }
    let ownerDoc = null;
    if (doc.owner_id) {
      const ownerOid = doc.owner_id instanceof ObjectId ? doc.owner_id : new ObjectId(String(doc.owner_id));
      ownerDoc = await db.collection('users').findOne(
        { _id: ownerOid },
        { projection: { full_name: 1, avatar: 1 } }
      );
    }
    return { matched: true, field: mapFieldDocAndOwner(doc, ownerDoc) };
  } finally {
    await client.close();
  }
}

async function mongoFieldSetFields(idHex, prismaUpdateData) {
  const id = String(idHex).trim();
  if (!isMongoObjectIdString(id)) {
    throw new Error('Invalid field id');
  }
  const $set = fieldUpdateToMongoSet(prismaUpdateData);
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const result = await db.collection('fields').updateOne({ _id: new ObjectId(id) }, { $set });
    return result.matchedCount > 0;
  } finally {
    await client.close();
  }
}

/**
 * Remove blocked-day row(s) for a field in the UTC day range (same logic as Prisma route).
 */
async function mongoFieldUnavailableDeleteInRange(fieldIdHex, rangeStart, rangeEnd) {
  const id = String(fieldIdHex).trim();
  if (!isMongoObjectIdString(id)) {
    throw new Error('Invalid field id');
  }
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const result = await db.collection('field_unavailable_dates').deleteMany({
      field_id: new ObjectId(id),
      date: { $gte: rangeStart, $lte: rangeEnd }
    });
    return result.deletedCount;
  } finally {
    await client.close();
  }
}

function toObjectId(v) {
  if (v instanceof ObjectId) return v;
  return new ObjectId(String(v));
}

/**
 * Same JSON shape as Prisma GET /fields/:id (owner + reviews + _count). No Prisma — works on standalone mongod.
 */
async function mongoFieldGetByIdPublicDetail(idHex) {
  const id = String(idHex).trim();
  if (!isMongoObjectIdString(id)) return null;
  const oid = toObjectId(id);
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const doc = await db.collection('fields').findOne({ _id: oid });
    if (!doc) return null;

    let ownerDoc = null;
    if (doc.owner_id) {
      const ownerOid = toObjectId(doc.owner_id);
      ownerDoc = await db.collection('users').findOne(
        { _id: ownerOid },
        { projection: { full_name: 1, avatar: 1, phone: 1 } }
      );
    }

    const reviewDocs = await db
      .collection('field_reviews')
      .find({ field_id: oid })
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    const userIdSet = new Set();
    for (const rv of reviewDocs) {
      if (rv.user_id) userIdSet.add(toObjectId(rv.user_id).toString());
    }
    const userOids = [...userIdSet].map((s) => new ObjectId(s));
    const userMap = new Map();
    if (userOids.length) {
      const users = await db
        .collection('users')
        .find({ _id: { $in: userOids } }, { projection: { full_name: 1, avatar: 1 } })
        .toArray();
      for (const u of users) {
        userMap.set(u._id.toString(), u);
      }
    }

    const [reviewCount, bookingCount] = await Promise.all([
      db.collection('field_reviews').countDocuments({ field_id: oid }),
      db.collection('bookings').countDocuments({ field_id: oid })
    ]);

    const base = mapFieldDocAndOwner(doc, ownerDoc);
    if (ownerDoc && ownerDoc._id) {
      base.owner = {
        id: ownerDoc._id.toString(),
        fullName: ownerDoc.full_name,
        avatar: ownerDoc.avatar,
        phone: ownerDoc.phone ?? null
      };
    }

    base.reviews = reviewDocs.map((rv) => {
      const uidStr = rv.user_id ? toObjectId(rv.user_id).toString() : '';
      const ud = uidStr ? userMap.get(uidStr) : null;
      return {
        id: rv._id.toString(),
        rating: rv.rating,
        reviewText: rv.review_text,
        context: rv.context ?? null,
        createdAt: rv.created_at,
        fieldId: rv.field_id ? toObjectId(rv.field_id).toString() : id,
        userId: uidStr,
        user: ud
          ? {
              id: ud._id.toString(),
              fullName: ud.full_name,
              avatar: ud.avatar
            }
          : { id: uidStr || '', fullName: 'Player', avatar: null }
      };
    });

    base._count = {
      reviews: reviewCount,
      bookings: bookingCount
    };

    return base;
  } finally {
    await client.close();
  }
}

/** Prisma-shaped rows for GET unavailable-dates */
async function mongoFieldUnavailableListForField(fieldIdHex) {
  const id = String(fieldIdHex).trim();
  if (!isMongoObjectIdString(id)) return [];
  const oid = toObjectId(id);
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const rows = await db
      .collection('field_unavailable_dates')
      .find({ field_id: oid })
      .sort({ date: 1 })
      .toArray();
    return rows.map((d) => ({
      id: d._id.toString(),
      date: d.date,
      fieldId: id,
      createdAt: d.created_at
    }));
  } finally {
    await client.close();
  }
}

/**
 * Insert one blocked day (date = UTC day start, same as Prisma route). Returns row or null if duplicate.
 */
async function mongoFieldUnavailableInsertDayStart(fieldIdHex, dayStartUtc) {
  const id = String(fieldIdHex).trim();
  if (!isMongoObjectIdString(id)) {
    throw new Error('Invalid field id');
  }
  const oid = toObjectId(id);
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const now = new Date();
    try {
      const result = await db.collection('field_unavailable_dates').insertOne({
        field_id: oid,
        date: dayStartUtc,
        created_at: now
      });
      return {
        id: result.insertedId.toString(),
        date: dayStartUtc,
        fieldId: id,
        createdAt: now
      };
    } catch (e) {
      if (e && e.code === 11000) return null;
      throw e;
    }
  } finally {
    await client.close();
  }
}

module.exports = {
  isMongoObjectIdString,
  fieldUpdateToMongoSet,
  mongoFieldSetFields,
  mongoFieldGetOwnerId,
  mongoFieldUpdateAndFetch,
  mongoFieldUnavailableDeleteInRange,
  mongoFieldGetByIdPublicDetail,
  mongoFieldUnavailableListForField,
  mongoFieldUnavailableInsertDayStart
};
