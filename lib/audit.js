const { prisma } = require('./prisma');

/**
 * Best-effort audit log. Never throws to callers.
 */
async function writeAuditLog({
  actorId = null,
  action,
  entityType,
  entityId = null,
  metadata = null,
  req = null
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action,
        entityType: String(entityType || 'unknown').slice(0, 100),
        entityId: entityId != null ? String(entityId).slice(0, 100) : null,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
        ipAddress: req ? String(req.ip || req.headers['x-forwarded-for'] || '').slice(0, 64) : null,
        userAgent: req ? String(req.get?.('user-agent') || '').slice(0, 2000) : null
      }
    });
  } catch (err) {
    console.warn('Audit log write failed:', err && err.message ? err.message : err);
  }
}

module.exports = { writeAuditLog };
