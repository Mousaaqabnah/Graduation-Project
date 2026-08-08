const { prisma } = require('./prisma');

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generatePlayerCodeValue() {
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return `PLR-${suffix}`;
}

async function createUniquePlayerCode() {
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

async function ensurePlayerCodeForUser(userId) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true, role: true, playerCode: true }
  });
  if (!user) return null;
  if (user.playerCode) return user.playerCode;
  if (user.role !== 'PLAYER') return user.playerCode || null;

  const code = await createUniquePlayerCode();
  await prisma.user.update({
    where: { id: user.id },
    data: { playerCode: code }
  });
  return code;
}

let backfillPromise = null;

async function backfillMissingPlayerCodes() {
  // playerCode is required+default in Postgres schema; keep no-op for callers.
  if (!backfillPromise) {
    backfillPromise = Promise.resolve();
  }
  return backfillPromise;
}

function normalizePlayerCodeQuery(query) {
  const trimmed = String(query || '').trim();
  if (/^plr-/i.test(trimmed)) return trimmed.toUpperCase();
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
