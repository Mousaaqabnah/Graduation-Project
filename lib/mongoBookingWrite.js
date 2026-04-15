const { MongoClient, ObjectId } = require('mongodb');

function isMongoObjectIdString(s) {
  return typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(String(s).trim());
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

module.exports = { isMongoObjectIdString, mongoBookingSetFields };
