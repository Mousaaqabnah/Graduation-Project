/**
 * Seed MatchField PostgreSQL database with demo users and one sample field.
 * Run: npm run db:seed
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { toMinor } = require('../lib/money');

const prisma = new PrismaClient();

async function upsertUser({ email, username, password, fullName, role, verificationStatus }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        fullName,
        role,
        status: 'ACTIVE',
        deletedAt: null
      }
    });
    if (role === 'OWNER') {
      await prisma.ownerProfile.upsert({
        where: { userId: updated.id },
        create: {
          userId: updated.id,
          verificationStatus: verificationStatus || 'APPROVED',
          verifiedAt: verificationStatus === 'APPROVED' || !verificationStatus ? new Date() : null
        },
        update: {
          verificationStatus: verificationStatus || 'APPROVED',
          verifiedAt: verificationStatus === 'APPROVED' || !verificationStatus ? new Date() : null
        }
      });
    }
    return updated;
  }

  return prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      fullName,
      role,
      status: 'ACTIVE',
      ownerProfile:
        role === 'OWNER'
          ? {
              create: {
                verificationStatus: verificationStatus || 'APPROVED',
                verifiedAt: new Date()
              }
            }
          : undefined
    }
  });
}

async function main() {
  const admin = await upsertUser({
    email: 'admin@matchfield.com',
    username: 'admin',
    password: 'Admin123!',
    fullName: 'MatchField Admin',
    role: 'ADMIN'
  });

  const owner = await upsertUser({
    email: 'owner@matchfield.com',
    username: 'owner_demo',
    password: 'Owner123!',
    fullName: 'Demo Owner',
    role: 'OWNER',
    verificationStatus: 'APPROVED'
  });

  const player = await upsertUser({
    email: 'player@matchfield.com',
    username: 'player_demo',
    password: 'Player123!',
    fullName: 'Demo Player',
    role: 'PLAYER'
  });

  const existingField = await prisma.field.findFirst({
    where: { ownerId: owner.id, name: 'Demo Football Field' }
  });

  if (!existingField) {
    await prisma.field.create({
      data: {
        ownerId: owner.id,
        name: 'Demo Football Field',
        sport: 'Football',
        description: 'A sample field for local development.',
        capacity: 10,
        type: 'OUTDOOR',
        location: 'Ramallah, Palestine',
        city: 'Ramallah',
        district: 'Al-Bireh',
        latitude: 31.9038,
        longitude: 35.2034,
        pricePerHour: toMinor(150),
        currency: 'ILS',
        bookingType: 'instant',
        moderationStatus: 'APPROVED',
        isActive: true,
        moderatedById: admin.id,
        moderatedAt: new Date(),
        images: {
          create: [
            {
              storagePath:
                'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop',
              publicUrl:
                'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop',
              displayOrder: 0,
              isPrimary: true
            }
          ]
        },
        amenities: {
          create: [{ name: 'Parking' }, { name: 'Lights' }, { name: 'Changing rooms' }]
        },
        openingHours: {
          create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
            dayOfWeek,
            opensAtMinute: 9 * 60,
            closesAtMinute: 22 * 60,
            isClosed: false
          }))
        }
      }
    });
  }

  console.log('Seed complete:');
  console.log('  Admin :', admin.email, '/ Admin123!');
  console.log('  Owner :', owner.email, '/ Owner123!');
  console.log('  Player:', player.email, '/ Player123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
