const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const { prisma } = require('./lib/prisma');
const { setChatIo } = require('./lib/chatEvents');
const { attachSocketChat } = require('./lib/socketChat');
const {
  validateEnvOrExit,
  corsOriginDelegate,
  socketIoCorsConfig,
  isProduction
} = require('./lib/security/env');
const { safeErrorHandler } = require('./lib/security/errors');
const { createRateLimiter } = require('./lib/security/rateLimit');

dotenv.config();
validateEnvOrExit();

const app = express();
const PORT = process.env.PORT || 3000;

// Reverse-proxy awareness (X-Forwarded-For for rate limits). Set TRUST_PROXY=1 behind nginx/etc.
if (process.env.TRUST_PROXY === '1' || isProduction()) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);
}

app.disable('x-powered-by');

const faviconPath = path.join(__dirname, 'assets', 'images', 'favicon.png');
app.get('/favicon.ico', (req, res) => {
  res.type('image/png');
  res.sendFile(faviconPath);
});

// Security headers + CSP (practical allowlist for this app's CDNs/maps/fonts)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        // Inline handlers remain in static HTML; avoid breaking the UI.
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdn-uicons.flaticon.com',
          'https://unpkg.com',
          'https://cdn.jsdelivr.net'
        ],
        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
          'https://cdn-uicons.flaticon.com',
          'data:'
        ],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: [
          "'self'",
          'ws:',
          'wss:',
          'https://unpkg.com',
          'https://cdn.jsdelivr.net',
          'https://*.tile.openstreetmap.org'
        ],
        workerSrc: ["'self'", 'blob:'],
        mediaSrc: ["'self'", 'blob:', 'data:'],
        formAction: ["'self'"],
        ...(isProduction()
          ? { upgradeInsecureRequests: [] }
          : {})
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: isProduction()
      ? { maxAge: 15552000, includeSubDomains: true, preload: false }
      : false
  })
);

app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(), usb=()'
  );
  next();
});

app.use(
  cors({
    origin: corsOriginDelegate,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Public uploads only — never expose storage/private via static
app.use(
  '/uploads/public',
  express.static(path.join(__dirname, 'uploads', 'public'), {
    fallthrough: true,
    index: false
  })
);
// Legacy public image paths under /uploads/... (non-private)
app.use(
  '/uploads',
  (req, res, next) => {
    const p = String(req.path || '');
    if (p.includes('..') || p.toLowerCase().includes('private')) {
      return res.status(404).end();
    }
    next();
  },
  express.static(path.join(__dirname, 'uploads'), {
    index: false,
    // Do not serve anything outside uploads/
    dotfiles: 'deny'
  })
);

app.get('/scripts/utils/runtime-api-port.js', (req, res) => {
  res.type('application/javascript; charset=utf-8');
  res.set('Cache-Control', 'no-store, max-age=0');
  const numericPort = Number(PORT);
  const safePort = Number.isFinite(numericPort) && numericPort > 0 ? numericPort : 3000;
  res.send(`window.__API_PORT__=${JSON.stringify(safePort)};`);
});

app.use('/pages', express.static('pages'));
app.use('/styles', express.static('styles'));
app.use('/scripts', express.static('scripts'));
app.use('/assets', express.static('assets'));
app.use('/logo', express.static('logo'));
// Do NOT expose server-side lib/ (Prisma, secrets helpers, private storage utils)

app.get('/', (req, res) => {
  res.redirect('/pages/auth/login.html');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MatchField API is running' });
});

// Baseline API abuse protection (skip health). Auth routes apply stricter limiters.
const generalApiLimiter = createRateLimiter({
  bucket: 'api-general',
  windowMs: Number(process.env.RATE_LIMIT_API_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_API_MAX) || 600,
  message: 'Too many requests. Please try again later.'
});
app.use('/api', generalApiLimiter);

app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/fields', require('./routes/fields'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/messages', require('./routes/chatUpload'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/support', require('./routes/support'));
app.use('/api/owner', require('./routes/owner'));
app.use('/api/admin', require('./routes/admin'));

app.use(safeErrorHandler);

app.use((req, res) => {
  if (String(req.originalUrl || '').startsWith('/api')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  return res.status(404).send('Not found');
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: socketIoCorsConfig()
});

setChatIo(io);
attachSocketChat(io);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT} (and http://127.0.0.1:${PORT})`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Open app: http://localhost:${PORT}/pages/auth/login.html`);
  console.log('Socket.IO enabled');
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  httpServer.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;
