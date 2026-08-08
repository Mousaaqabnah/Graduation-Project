const jwt = require('jsonwebtoken');
const { prisma } = require('./prisma');
const { isUuid } = require('./ids');
const { isParticipant } = require('./chatService');

/** socket.id -> userId */
const socketUser = new Map();
/** userId -> Set of socket ids */
const onlineByUser = new Map();

function addOnline(userId, socketId) {
  let set = onlineByUser.get(userId);
  if (!set) {
    set = new Set();
    onlineByUser.set(userId, set);
  }
  const wasEmpty = set.size === 0;
  set.add(socketId);
  return wasEmpty;
}

function removeOnline(userId, socketId) {
  const set = onlineByUser.get(userId);
  if (!set) return false;
  set.delete(socketId);
  const nowEmpty = set.size === 0;
  if (nowEmpty) onlineByUser.delete(userId);
  return nowEmpty;
}

async function verifySocketToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        avatarUrl: true,
        deletedAt: true,
        ownerProfile: { select: { verificationStatus: true } }
      }
    });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') return null;
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      avatar: user.avatarUrl,
      verificationStatus: user.ownerProfile?.verificationStatus || null
    };
  } catch (_) {
    return null;
  }
}

function broadcastPresence(io, userId, online) {
  io.emit('presence:update', { userId, online });
}

function attachSocketChat(io) {
  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      (socket.handshake.headers.authorization &&
        String(socket.handshake.headers.authorization).replace(/^Bearer\s+/i, ''));
    const user = await verifySocketToken(token);
    if (!user) {
      return next(new Error('Unauthorized'));
    }
    socket.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socketUser.set(socket.id, userId);

    socket.join(`user:${userId}`);
    const becameOnline = addOnline(userId, socket.id);
    if (becameOnline) {
      broadcastPresence(io, userId, true);
    }

    socket.emit('presence:self', { onlineUsers: [...onlineByUser.keys()] });

    socket.on('conversation:join', async ({ conversationId }, cb) => {
      try {
        if (!conversationId || typeof conversationId !== 'string' || !isUuid(conversationId)) {
          if (typeof cb === 'function') cb({ ok: false, error: 'Invalid conversation' });
          return;
        }
        const allowed = await isParticipant(conversationId, userId);
        if (!allowed) {
          if (typeof cb === 'function') cb({ ok: false, error: 'Access denied' });
          return;
        }
        socket.join(`conv:${conversationId}`);
        if (typeof cb === 'function') cb({ ok: true });
      } catch (e) {
        if (typeof cb === 'function') cb({ ok: false, error: e.message });
      }
    });

    socket.on('conversation:leave', ({ conversationId }) => {
      if (conversationId) socket.leave(`conv:${conversationId}`);
    });

    socket.on('typing:start', async ({ conversationId }) => {
      if (!conversationId || !isUuid(conversationId)) return;
      if (!(await isParticipant(conversationId, userId))) return;
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        userId,
        fullName: socket.user.fullName
      });
    });

    socket.on('typing:stop', async ({ conversationId }) => {
      if (!conversationId || !isUuid(conversationId)) return;
      if (!(await isParticipant(conversationId, userId))) return;
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId
      });
    });

    socket.on('disconnect', () => {
      socketUser.delete(socket.id);
      const wentOffline = removeOnline(userId, socket.id);
      if (wentOffline) {
        broadcastPresence(io, userId, false);
      }
    });
  });
}

module.exports = { attachSocketChat, isUserOnline: (id) => !!(onlineByUser.get(id)?.size) };
