require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { ensurePlayerCodeForUser } = require('../lib/playerCode');

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { role: 'PLAYER' },
      select: { id: true, playerCode: true }
    });

    let updated = 0;
    for (const user of users) {
      if (!user.playerCode) {
        await ensurePlayerCodeForUser(prisma, user.id);
        updated += 1;
      }
    }

    console.log(`Backfilled player codes for ${updated} player(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
