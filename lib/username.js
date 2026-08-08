const crypto = require('crypto');

function slugifyUsernameBase(input) {
  const raw = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
  return raw || 'user';
}

async function createUniqueUsername(prisma, seed) {
  const base = slugifyUsernameBase(seed);
  for (let i = 0; i < 20; i += 1) {
    const suffix = i === 0 ? '' : `_${crypto.randomBytes(2).toString('hex')}`;
    const candidate = `${base}${suffix}`.slice(0, 40);
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true }
    });
    if (!existing) return candidate;
  }
  return `user_${crypto.randomBytes(6).toString('hex')}`.slice(0, 40);
}

module.exports = { createUniqueUsername, slugifyUsernameBase };
