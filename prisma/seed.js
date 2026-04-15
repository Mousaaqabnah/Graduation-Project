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
const BOOKINGS = 'bookings';

/** Marks rows inserted by seed so re-running `npm run db:seed` can replace them safely. */
const DEMO_BOOKING_MARKER = 'matchfield_demo_booking';

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

    /**
     * Sample bookings for API / UI testing (owner dashboard, player bookings, stats).
     * Uses native driver. Organizer = seeded player; fields = seeded owner fields.
     */
    async function seedDemoBookings(db, usersCol, fieldsCol) {
      const bookingsCol = db.collection(BOOKINGS);
      await bookingsCol.deleteMany({ seed_marker: DEMO_BOOKING_MARKER });

      const ownerDoc = await usersCol.findOne({ email: 'owner@matchfield.com' });
      const playerDoc = await usersCol.findOne({ email: 'player@matchfield.com' });
      if (!ownerDoc || !playerDoc) {
        console.log('Skipping demo bookings: owner or player user missing.');
        return;
      }

      const ownerOid = ownerDoc._id instanceof ObjectId ? ownerDoc._id : new ObjectId(ownerDoc._id);
      const playerOid = playerDoc._id instanceof ObjectId ? playerDoc._id : new ObjectId(playerDoc._id);

      const fieldDocs = await fieldsCol.find({ owner_id: ownerOid }).limit(5).toArray();
      if (fieldDocs.length === 0) {
        console.log('Skipping demo bookings: no fields for owner@matchfield.com.');
        return;
      }

      const pick = (i) => fieldDocs[Math.min(i, fieldDocs.length - 1)];
      const pph = (f) => Number(f.price_per_hour) || 1000;

      const n = new Date();
      const todayNoon = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0);
      const addDays = (d, days) => {
        const x = new Date(d.getTime());
        x.setDate(x.getDate() + days);
        return x;
      };

      const t = now();
      const base = (overrides) => ({
        time_slot_ranges: null,
        mixed_payment_distribution: null,
        team_size: 6,
        created_at: t,
        seed_marker: DEMO_BOOKING_MARKER,
        ...overrides
      });

      const rows = [
        base({
          field_id: pick(0)._id,
          organizer_id: playerOid,
          date: todayNoon,
          time_slot_start: '18:00',
          time_slot_end: '20:00',
          total_cost: pph(pick(0)) * 2,
          payment_method: 'ORGANIZER',
          status: 'PENDING',
          organizer_payment_status: 'PENDING',
          confirmed_at: null
        }),
        base({
          field_id: pick(0)._id,
          organizer_id: playerOid,
          date: addDays(todayNoon, 1),
          time_slot_start: '10:00',
          time_slot_end: '11:00',
          total_cost: pph(pick(0)) * 1,
          payment_method: 'SPLIT',
          status: 'UPCOMING',
          organizer_payment_status: null,
          confirmed_at: addDays(t, -1)
        }),
        base({
          field_id: pick(1)._id,
          organizer_id: playerOid,
          date: addDays(todayNoon, 3),
          time_slot_start: '14:00',
          time_slot_end: '16:00',
          total_cost: pph(pick(1)) * 2,
          payment_method: 'ORGANIZER',
          status: 'CONFIRMED',
          organizer_payment_status: 'PAID',
          confirmed_at: addDays(t, -2)
        }),
        base({
          field_id: pick(1)._id,
          organizer_id: playerOid,
          date: addDays(todayNoon, -4),
          time_slot_start: '09:00',
          time_slot_end: '10:00',
          total_cost: pph(pick(1)) * 1,
          payment_method: 'ORGANIZER',
          status: 'COMPLETED',
          organizer_payment_status: 'PAID',
          confirmed_at: addDays(t, -10)
        }),
        base({
          field_id: pick(2)._id,
          organizer_id: playerOid,
          date: addDays(todayNoon, 5),
          time_slot_start: '20:00',
          time_slot_end: '22:00',
          total_cost: pph(pick(2)) * 2,
          payment_method: 'MIXED',
          status: 'PENDING',
          organizer_payment_status: null,
          confirmed_at: null
        }),
        base({
          field_id: pick(2)._id,
          organizer_id: playerOid,
          date: addDays(todayNoon, 7),
          time_slot_start: '16:00',
          time_slot_end: '17:00',
          total_cost: pph(pick(2)) * 1,
          payment_method: 'ORGANIZER',
          status: 'CANCELLED',
          organizer_payment_status: 'PENDING',
          confirmed_at: null
        })
      ];

      await bookingsCol.insertMany(rows);
      console.log('Seeded', rows.length, 'demo bookings for player → owner fields.');
    }

    const allOwners = await users.find({ role: 'OWNER' }).toArray();
    for (const o of allOwners) {
      await seedSampleFieldsForOwnerIfEmpty(o);
    }

    await seedDemoBookings(db, users, fields);

    console.log('\n--- Login (all roles) ---');
    console.log('ADMIN:  admin@matchfield.com  / Admin123!');
    console.log('OWNER:  owner@matchfield.com  / Owner123!');
    console.log('PLAYER: player@matchfield.com / Player123!');
    console.log(
      '\nDemo bookings: organizer = player@matchfield.com on owner fields (PENDING / UPCOMING / CONFIRMED / COMPLETED / CANCELLED).'
    );
    console.log('Re-run seed to refresh demo bookings only (rows with seed marker).');
    console.log('Seed completed. Collections: users, fields, bookings (demo).');
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
