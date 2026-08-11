/**
 * Environment validation and allowed-origin policy for Express + Socket.IO.
 */

const WEAK_JWT_SECRETS = new Set([
  '',
  'secret',
  'jwt_secret',
  'changeme',
  'your-super-secret-jwt-key-change-this-in-production',
  'your-secret-key'
]);

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function validateEnvOrExit() {
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const secret = String(process.env.JWT_SECRET);
  if (isProduction()) {
    if (WEAK_JWT_SECRETS.has(secret.toLowerCase()) || secret.length < 32) {
      console.error(
        'JWT_SECRET is missing, weak, or too short for production (min 32 characters). Refusing to start.'
      );
      process.exit(1);
    }
    if (!process.env.ALLOWED_ORIGINS || !String(process.env.ALLOWED_ORIGINS).trim()) {
      console.error('ALLOWED_ORIGINS must be set in production (comma-separated https origins).');
      process.exit(1);
    }
  } else if (WEAK_JWT_SECRETS.has(secret.toLowerCase()) || secret.length < 16) {
    console.warn('Warning: JWT_SECRET looks weak; use a long random value before production.');
  }

  if (!process.env.DIRECT_URL) {
    console.warn('Warning: DIRECT_URL is not set (recommended for Prisma migrations)');
  }
}

function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw && String(raw).trim()) {
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (isProduction()) return [];
  // Development defaults
  const port = process.env.PORT || 3000;
  return [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ];
}

function isOriginAllowed(origin, allowedList = parseAllowedOrigins()) {
  if (!origin) return false;
  return allowedList.includes(String(origin));
}

/**
 * CORS origin callback:
 * - browser requests with Origin must match allowlist
 * - no Origin (curl, server tools, same-origin navigation) is allowed without reflecting *
 */
function corsOriginDelegate(origin, callback) {
  const allowed = parseAllowedOrigins();
  if (!origin) {
    return callback(null, true);
  }
  if (isOriginAllowed(origin, allowed)) {
    return callback(null, true);
  }
  return callback(new Error('CORS origin not allowed'));
}

function socketIoCorsConfig() {
  const allowed = parseAllowedOrigins();
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (isOriginAllowed(origin, allowed)) return callback(null, true);
      return callback(new Error('Socket.IO origin not allowed'), false);
    },
    credentials: true
  };
}

module.exports = {
  isProduction,
  validateEnvOrExit,
  parseAllowedOrigins,
  isOriginAllowed,
  corsOriginDelegate,
  socketIoCorsConfig,
  WEAK_JWT_SECRETS
};
