const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const { prisma } = require('./lib/prisma');
const { setChatIo } = require('./lib/chatEvents');
const { attachSocketChat } = require('./lib/socketChat');

// Load environment variables
dotenv.config();

// Fail fast if required env vars are missing
if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in .env');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}
if (!process.env.DIRECT_URL) {
  console.warn('Warning: DIRECT_URL is not set (recommended for Prisma migrations)');
}

const app = express();
const PORT = process.env.PORT || 3000;

const faviconPath = path.join(__dirname, 'assets', 'images', 'favicon.png');
app.get('/favicon.ico', (req, res) => {
  res.type('image/png');
  res.sendFile(faviconPath);
});

// Middleware
app.use(cors());
// Field creation sends base64 documents + images; default 5mb truncates and ownership URLs never reach the DB.
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Uploaded chat files (local disk)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Tells the browser the real HTTP port when PORT≠3000 (must be before express.static('/scripts')).
app.get('/scripts/utils/runtime-api-port.js', (req, res) => {
  res.type('application/javascript; charset=utf-8');
  res.set('Cache-Control', 'no-store, max-age=0');
  const numericPort = Number(PORT);
  const safePort = Number.isFinite(numericPort) && numericPort > 0 ? numericPort : 3000;
  res.send(`window.__API_PORT__=${JSON.stringify(safePort)};`);
});

// Serve static files with paths that match HTML (../../styles/... → /styles/...)
app.use('/pages', express.static('pages'));
app.use('/styles', express.static('styles'));
app.use('/scripts', express.static('scripts'));
app.use('/assets', express.static('assets'));
app.use('/lib', express.static(path.join(__dirname, 'lib')));
app.use('/logo', express.static('logo'));

// Root: redirect to login page (under /pages so CSS/JS paths work)
app.get('/', (req, res) => {
  res.redirect('/pages/auth/login.html');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MatchField API is running' });
});

// API Routes — chat upload routes must register before generic /messages routes
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  console.warn('404 Route not found:', req.method, req.originalUrl);
  res.status(404).json({ error: 'Route not found' });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true
  }
});

setChatIo(io);
attachSocketChat(io);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT} (and http://127.0.0.1:${PORT})`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`📄 Open app: http://localhost:${PORT}/pages/auth/login.html`);
  console.log(`🔌 Socket.IO enabled`);
});

// Graceful shutdown
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
