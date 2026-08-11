/**
 * In-memory rate limiter (swap store later for Redis).
 * Keyed by IP + optional user id. Does not authenticate by IP.
 */

const buckets = new Map();

function clientIp(req) {
  // Trust proxy must be configured for X-Forwarded-For to be meaningful
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim().slice(0, 64);
  }
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

function rateLimitKey(req, bucket) {
  const uid = req.user?.id ? String(req.user.id) : '';
  return `${bucket}:${clientIp(req)}:${uid}`;
}

function pruneExpired(now) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

/**
 * @param {{ windowMs: number, max: number, bucket: string, message?: string }} opts
 */
function createRateLimiter(opts) {
  const windowMs = opts.windowMs || 15 * 60 * 1000;
  const max = opts.max || 100;
  const bucket = opts.bucket || 'default';
  const message = opts.message || 'Too many requests. Please try again later.';

  return function rateLimitMiddleware(req, res, next) {
    if (process.env.RATE_LIMIT_DISABLED === '1') return next();

    const now = Date.now();
    pruneExpired(now);
    const key = rateLimitKey(req, bucket);
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message });
    }
    return next();
  };
}

/** Test helper */
function _resetRateLimitBuckets() {
  buckets.clear();
}

module.exports = {
  createRateLimiter,
  clientIp,
  _resetRateLimitBuckets
};
