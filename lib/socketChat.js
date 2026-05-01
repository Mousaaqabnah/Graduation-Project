const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

function isUserOnline(userId) {
  const set = onlineByUser.get(userId);
  return !!(set && set.size > 0);
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
        avatar: true,
        verificationStatus: true
      }
    });
    if (!user || user.status !== 'ACTIVE') return null;
    return user;
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
        if (!conversationId || typeof conversationId !== 'string') {
          if (typeof cb === 'function') cb({ ok: false, error: 'Invalid conversation' });
          return;
        }
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { user1Id: true, user2Id: true }
        });
        if (!conv || (conv.user1Id !== userId && conv.user2Id !== userId)) {
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

    socket.on('typing:start', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        userId,
        fullName: socket.user.fullName
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId
      });
    });

    socket.on('disconnect', () => {
      const uid = socketUser.get(socket.id);
      socketUser.delete(socket.id);
      if (uid) {
        const wentOffline = removeOnline(uid, socket.id);
        if (wentOffline) {
          broadcastPresence(io, uid, false);
        }
      }
    });
  });
}

module.exports = {
  attachSocketChat,
  isUserOnline
};
