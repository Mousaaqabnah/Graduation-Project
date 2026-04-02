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
  const existing = await collection.findOne({ email });
  if (existing) return existing;

  const password_hash = await bcrypt.hash(plainPassword, 10);
  const t = now();
  const doc = {
    email,
    password_hash,
    full_name: fullName,
    role,
    status: 'ACTIVE',
    created_at: t,
    updated_at: t,
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

    const ownerId = owner._id instanceof ObjectId ? owner._id : new ObjectId(owner._id);
    const fields = db.collection(FIELDS);
    const existingField = await fields.findOne({});

    if (!existingField) {
      const t = now();
      await fields.insertOne({
        name: 'Central Sports Arena - Pitch 1',
        sport: 'Football',
        description: 'Full-size outdoor football pitch with floodlights.',
        type: 'OUTDOOR',
        location: 'Istanbul',
        address: 'Sample Street 1',
        phone: '+90 212 000 00 00',
        price_per_hour: 50000,
        features: ['Parking', 'Changing Rooms', 'Water Station'],
        images: [],
        rating: 0,
        review_count: 0,
        is_active: true,
        created_at: t,
        updated_at: t,
        owner_id: ownerId,
      });
      console.log('Created sample field: Central Sports Arena - Pitch 1');
    } else {
      console.log('Sample field already exists');
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
