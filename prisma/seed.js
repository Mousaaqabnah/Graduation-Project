/**
 * MatchField - Database seed script
 * Creates collections in MongoDB by inserting initial data.
 * Run with: npm run db:seed
 *
 * Uses the native mongodb driver for inserts because Prisma MongoDB writes use
 * transactions, which require a replica set (Atlas has one; local standalone does not).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const USERS = 'users';
const FIELDS = 'fields';

function now() {
  return new Date();
}

/**
 * Inserts match Prisma's @map field names in MongoDB (snake_case where mapped).
 */
async function ensureUser(collection, { email, plainPassword, fullName, role, verificationStatus }) {
  const password_hash = await bcrypt.hash(plainPassword, 10);
  const t = now();
  const existing = await collection.findOne({ email });

  if (existing) {
    const $set = {
      password_hash,
      full_name: fullName,
      role,
      status: 'ACTIVE',
      updated_at: t
    };
    if (verificationStatus !== undefined && verificationStatus !== null) {
      $set.verification_status = verificationStatus;
    }
    await collection.updateOne({ _id: existing._id }, { $set });
    return collection.findOne({ email });
  }

  const doc = {
    email,
    password_hash,
    full_name: fullName,
    role,
    status: 'ACTIVE',
    created_at: t,
    updated_at: t
  };
  if (verificationStatus !== undefined && verificationStatus !== null) {
    doc.verification_status = verificationStatus;
  }
  await collection.insertOne(doc);
  return collection.findOne({ email });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Missing DATABASE_URL in .env');
    process.exit(1);
  }

  console.log('Seeding database...');

  const client = new MongoClient(url);
  await client.connect();
  const db = client.db();

  try {
    const users = db.collection(USERS);

    const admin = await ensureUser(users, {
      email: 'admin@matchfield.com',
      plainPassword: 'Admin123!',
      fullName: 'Admin User',
      role: 'ADMIN',
    });
    console.log('Admin user:', admin.email);

    const owner = await ensureUser(users, {
      email: 'owner@matchfield.com',
      plainPassword: 'Owner123!',
      fullName: 'Field Owner',
      role: 'OWNER',
      verificationStatus: 'APPROVED',
    });
    console.log('Owner user:', owner.email);

    const player = await ensureUser(users, {
      email: 'player@matchfield.com',
      plainPassword: 'Player123!',
      fullName: 'Sample Player',
      role: 'PLAYER',
    });
    console.log('Player user:', player.email);

    const fields = db.collection(FIELDS);

    /** Insert one sample field if no document with this name exists for this owner. */
    async function ensureField(ownerOid, name, doc) {
      const existing = await fields.findOne({ name, owner_id: ownerOid });
      if (existing) {
        console.log('Field already exists for owner:', name);
        return;
      }
      const t = now();
      await fields.insertOne({
        ...doc,
        name,
        created_at: t,
        updated_at: t,
        owner_id: ownerOid,
      });
      console.log('Created sample field:', name);
    }

    /** Add the three demo fields to any OWNER who has zero fields (covers self-registered owners). */
    async function seedSampleFieldsForOwnerIfEmpty(ownerDoc) {
      const ownerOid =
        ownerDoc._id instanceof ObjectId ? ownerDoc._id : new ObjectId(ownerDoc._id);
      const count = await fields.countDocuments({ owner_id: ownerOid });
      if (count > 0) {
        console.log('Owner', ownerDoc.email, 'already has', count, 'field(s); skipping samples.');
        return;
      }
      console.log('Seeding 3 sample fields for owner:', ownerDoc.email);

      await ensureField(ownerOid, 'Central Sports Arena — Pitch 1', {
        sport: 'Football',
        description:
          'Full-size outdoor football pitch with floodlights, quality turf, and team benches. Ideal for 11v11 or small-sided games.',
        type: 'OUTDOOR',
        location: 'Üsküdar, Istanbul',
        address: 'Bağlarbaşı Cad. No:12',
        phone: '+90 216 000 00 01',
        latitude: 41.0234,
        longitude: 29.0123,
        price_per_hour: 1600,
        features: ['Parking', 'Changing Rooms', 'Water Station', 'Floodlights'],
        images: [
          'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80',
          'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80',
        ],
        rating: 4.8,
        review_count: 12,
        is_active: true,
      });

      await ensureField(ownerOid, 'Indoor Futsal Court — Avcılar', {
        sport: 'Futsal',
        description:
          'Professional indoor futsal court with shock-absorbing floor, LED lighting, and climate control.',
        type: 'INDOOR',
        location: 'Avcılar, Istanbul',
        address: 'Merkez Mah. Spor Sok. No:4',
        phone: '+90 212 000 00 02',
        latitude: 41.0213,
        longitude: 28.7256,
        price_per_hour: 1100,
        features: ['Changing Rooms', 'Showers', 'Parking', 'Wi-Fi'],
        images: ['https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80'],
        rating: 4.9,
        review_count: 28,
        is_active: true,
      });

      await ensureField(ownerOid, 'Padel Court — Sunset Club', {
        sport: 'Padel',
        description:
          'Glass-walled padel court with artificial turf, booking-friendly lighting and equipment rental on site.',
        type: 'OUTDOOR',
        location: 'Beşiktaş, Istanbul',
        address: 'Sinanpaşa Mah. 1',
        phone: '+90 212 000 00 03',
        latitude: 41.0422,
        longitude: 29.0089,
        price_per_hour: 900,
        features: ['Parking', 'Equipment rental', 'Café'],
        images: ['https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80'],
        rating: 4.6,
        review_count: 8,
        is_active: true,
      });
    }

    const allOwners = await users.find({ role: 'OWNER' }).toArray();
    for (const o of allOwners) {
      await seedSampleFieldsForOwnerIfEmpty(o);
    }

    console.log('\n--- Login (all roles) ---');
    console.log('ADMIN:  admin@matchfield.com  / Admin123!');
    console.log('OWNER:  owner@matchfield.com  / Owner123!');
    console.log('PLAYER: player@matchfield.com / Player123!');
    console.log('Seed completed. Collections created: users, fields.');
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
