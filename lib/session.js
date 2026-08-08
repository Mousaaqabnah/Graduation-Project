const { prisma } = require('./prisma');

/**
 * Bump sessionVersion and revoke all refresh tokens (access JWTs become invalid on next request).
 */
async function invalidateUserSessions(userId, client) {
  const db = client || prisma;
  await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } }
  });
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

async function revokeAllRefreshTokens(userId, client) {
  const db = client || prisma;
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

module.exports = {
  invalidateUserSessions,
  revokeAllRefreshTokens
};
