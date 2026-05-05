const { MongoClient, ObjectId } = require('mongodb');

function isMongoObjectIdString(s) {
  return typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(String(s).trim());
}

/**
 * Insert one booking document with BSON keys matching Prisma @map.
 * Avoids prisma.booking.create on standalone MongoDB (Prisma uses transactions → replica set required).
 */
async function mongoBookingInsertOne(doc) {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const now = new Date();
    const insertDoc = {
      field_id: new ObjectId(String(doc.fieldId).trim()),
      organizer_id: new ObjectId(String(doc.organizerId).trim()),
      date: doc.date instanceof Date ? doc.date : new Date(doc.date),
      time_slot_start: doc.timeSlotStart,
      time_slot_end: doc.timeSlotEnd,
      time_slot_ranges: doc.timeSlotRanges != null ? doc.timeSlotRanges : null,
      total_cost: doc.totalCost,
      payment_method: doc.paymentMethod,
      status: 'PENDING',
      organizer_payment_status: doc.organizerPaymentStatus != null ? doc.organizerPaymentStatus : null,
      mixed_payment_distribution: doc.mixedPaymentDistribution != null ? doc.mixedPaymentDistribution : null,
      team_size: doc.teamSize != null ? doc.teamSize : 1,
      created_at: now,
      confirmed_at: null
    };
    const result = await db.collection('bookings').insertOne(insertDoc);
    return result.insertedId.toString();
  } finally {
    await client.close();
  }
}

/**
 * $set on bookings using BSON keys as in Mongo (Prisma @map / seed snake_case).
 * Avoids prisma.booking.update on standalone MongoDB (Prisma uses transactions → replica set required).
 */
async function mongoBookingSetFields(idHex, $set) {
  const id = String(idHex).trim();
  if (!isMongoObjectIdString(id)) {
    throw new Error('Invalid booking id');
  }
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const result = await db.collection('bookings').updateOne({ _id: new ObjectId(id) }, { $set });
    return result.matchedCount > 0;
  } finally {
    await client.close();
  }
}

module.exports = { isMongoObjectIdString, mongoBookingInsertOne, mongoBookingSetFields };
