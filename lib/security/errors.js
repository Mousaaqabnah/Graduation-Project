/**
 * Centralized safe error responses. Never leak stack/SQL/paths in production.
 */

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function mapPrismaError(err) {
  if (!err || !err.code) return null;
  if (err.code === 'P2002') {
    return { status: 409, error: 'A conflicting record already exists.' };
  }
  if (err.code === 'P2025') {
    return { status: 404, error: 'Record not found.' };
  }
  if (err.code === 'P2003') {
    return { status: 400, error: 'Invalid related record reference.' };
  }
  return { status: 400, error: 'Database request could not be completed.' };
}

function safeErrorHandler(err, req, res, _next) {
  if (res.headersSent) return;

  const prismaMapped = mapPrismaError(err);
  if (prismaMapped) {
    console.error('Prisma error:', err.code, err.meta || '');
    return res.status(prismaMapped.status).json({ error: prismaMapped.error });
  }

  if (err && err.message === 'CORS origin not allowed') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const status = err.status || err.statusCode || 500;
  const publicMessage =
    status >= 500
      ? 'Internal server error'
      : err.publicMessage || err.message || 'Request failed';

  if (status >= 500) {
    console.error('Unhandled error:', err && err.message ? err.message : err);
  } else {
    console.warn('Request error:', status, err && err.message ? err.message : err);
  }

  const body = { error: publicMessage };
  if (!isProduction() && status >= 500 && err && err.stack) {
    body.stack = err.stack;
  }
  return res.status(status).json(body);
}

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
}

module.exports = {
  safeErrorHandler,
  mapPrismaError,
  setNoStore
};
