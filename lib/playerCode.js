const { mongoUserSetFields } = require('./mongoUserWrite');

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generatePlayerCodeValue() {
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return `PLR-${suffix}`;
}

async function createUniquePlayerCode(prisma) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generatePlayerCodeValue();
    const existing = await prisma.user.findFirst({
      where: { playerCode: code },
      select: { id: true }
    });
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique player code');
}

async function ensurePlayerCodeForUser(prisma, userId) {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true, role: true, playerCode: true }
  });

  if (!user || user.role !== 'PLAYER') return user?.playerCode || null;
  if (user.playerCode) return user.playerCode;

  const code = await createUniquePlayerCode(prisma);
  await mongoUserSetFields(user.id, { player_code: code });
  return code;
}

let backfillPromise = null;

async function backfillMissingPlayerCodes(prisma) {
  if (!backfillPromise) {
    backfillPromise = (async () => {
      const users = await prisma.user.findMany({
        where: { role: 'PLAYER', playerCode: null },
        select: { id: true },
        take: 500
      });
      for (const user of users) {
        await ensurePlayerCodeForUser(prisma, user.id);
      }
    })().catch((err) => {
      backfillPromise = null;
      throw err;
    });
  }
  return backfillPromise;
}

function normalizePlayerCodeQuery(query) {
  const trimmed = String(query || '').trim();
  if (/^plr-/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

function isHexIdQuery(query) {
  return /^[a-fA-F0-9]+$/.test(String(query || '').trim());
}

function isPlayerCodeQuery(query) {
  return /^PLR-/i.test(String(query || '').trim());
}

function getSearchMinLength(query) {
  const q = String(query || '').trim();
  if (isPlayerCodeQuery(q)) return 4;
  if (isHexIdQuery(q)) return 4;
  return 2;
}

module.exports = {
  generatePlayerCodeValue,
  createUniquePlayerCode,
  ensurePlayerCodeForUser,
  backfillMissingPlayerCodes,
  normalizePlayerCodeQuery,
  isHexIdQuery,
  isPlayerCodeQuery,
  getSearchMinLength
};
