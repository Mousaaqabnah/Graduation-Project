/**
 * MatchField - Database seed script
 * Creates collections in MongoDB by inserting initial data.
 * Run with: npm run db:seed
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user (creates "users" collection)
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@matchfield.com' },
    update: {},
    create: {
      email: 'admin@matchfield.com',
      passwordHash,
      fullName: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('Created admin user:', admin.email);

  // Create sample owner (if you want a field)
  const ownerHash = await bcrypt.hash('Owner123!', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@matchfield.com' },
    update: {},
    create: {
      email: 'owner@matchfield.com',
      passwordHash: ownerHash,
      fullName: 'Field Owner',
      role: 'OWNER',
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
    },
  });
  console.log('Created owner user:', owner.email);

  // Create sample field (creates "fields" collection)
  const existingField = await prisma.field.findFirst();
  const field = existingField
    ? existingField
    : await prisma.field.create({
        data: {
          name: 'Central Sports Arena - Pitch 1',
          sport: 'Football',
          description: 'Full-size outdoor football pitch with floodlights.',
          type: 'OUTDOOR',
          location: 'Istanbul',
          address: 'Sample Street 1',
          phone: '+90 212 000 00 00',
          pricePerHour: 50000, // 500 TRY in kuruş
          features: ['Parking', 'Changing Rooms', 'Water Station'],
          images: [],
          ownerId: owner.id,
        },
      });
  console.log(existingField ? 'Sample field already exists' : 'Created sample field:', field.name);

  console.log('Seed completed. Collections created: users, fields.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
