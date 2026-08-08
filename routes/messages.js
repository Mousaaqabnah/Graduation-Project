const express = require('express');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { isUuid } = require('../lib/ids');
const {
  getOrCreateDirectConversation,
  mapConversationLegacy,
  mapMessageLegacy,
  createMessage,
  unreadCount,
  markAllRead,
  setStarred,
  setBlockedGlobal,
  viewerMeta,
  isParticipant
} = require('../lib/chatService');
const { createUserNotification } = require('../lib/notifications');
const {
  emitMessageNew,
  emitConversationUpdate,
  emitMessageRead,
  emitToUser
} = require('../lib/chatEvents');

const router = express.Router();

function denyChatForUnverifiedOwner(req, res) {
  if (!req.user) return false;
  const role = String(req.user.role || '').toUpperCase();
  const verificationStatus = String(req.user.verificationStatus || '').toUpperCase();
  if (role === 'OWNER' && verificationStatus !== 'APPROVED') {
    res.status(403).json({ error: 'Owner verification required to use chat' });
    return true;
  }
  return false;
}

async function enrichConversations(conversations, viewerId) {
  if (!conversations.length) return [];
  const ids = conversations.map((c) => c.id);
  const metas = await prisma.conversationParticipant.findMany({
    where: { userId: viewerId, conversationId: { in: ids } },
    select: { conversationId: true, lastReadAt: true, joinedAt: true, starredAt: true }
  });
  const metaByConv = new Map(metas.map((m) => [m.conversationId, m]));

  const unreadCounts = await Promise.all(
    conversations.map(async (c) => {
      const meta = metaByConv.get(c.id);
      if (!meta) return [c.id, 0];
      const since = meta.lastReadAt || meta.joinedAt;
      const count = await prisma.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: viewerId },
          deletedAt: null,
          createdAt: { gt: since }
        }
      });
      return [c.id, count];
    })
  );
  const unreadById = new Map(unreadCounts);

  return conversations.map((c) => {
    const meta = metaByConv.get(c.id) || {};
    return {
      ...c,
      unreadCount: unreadById.get(c.id) || 0,
      starredAt: meta.starredAt || null,
      blockedAt: c.blockedAt || null
    };
  });
}

router.get('/conversations', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * take;

    const where = {
      participants: { some: { userId: req.user.id, leftAt: null } }
    };
    const [rows, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, fullName: true, email: true, avatarUrl: true, role: true }
              }
            }
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: { select: { id: true, fullName: true, avatarUrl: true } },
              attachments: true
            }
          }
        }
      }),
      prisma.conversation.count({ where })
    ]);

    const mapped = rows.map((c) => mapConversationLegacy(c, req.user.id));
    const enriched = await enrichConversations(mapped, req.user.id);
    res.json({
      conversations: enriched,
      pagination: { page, limit: take, total, pages: Math.ceil(total / take) || 1 }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/conversation/:userId', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const otherId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
    const result = await getOrCreateDirectConversation(req.user.id, otherId);
    if (!result.ok) {
      return res.status(result.status || 500).json({ error: result.error || 'Failed to get conversation' });
    }
    const [count, meta] = await Promise.all([
      unreadCount(result.conversation.id, req.user.id),
      viewerMeta(result.conversation.id, req.user.id)
    ]);
    res.json({
      conversation: {
        ...result.conversation,
        unreadCount: count,
        starredAt: meta.starredAt || null
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

router.get('/conversation/:conversationId/messages', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const { conversationId } = req.params;
    if (!isUuid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    if (!(await isParticipant(conversationId, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { page = 1, limit = 50, before } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 100);

    let messages;
    let total;

    if (before && isUuid(before)) {
      const cursorMsg = await prisma.message.findFirst({
        where: { id: before, conversationId }
      });
      if (!cursorMsg) {
        return res.status(400).json({ error: 'Invalid before cursor' });
      }
      messages = await prisma.message.findMany({
        where: {
          conversationId,
          deletedAt: null,
          createdAt: { lt: cursorMsg.createdAt }
        },
        take,
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true } },
          attachments: true
        },
        orderBy: { createdAt: 'desc' }
      });
      messages.reverse();
      total = await prisma.message.count({ where: { conversationId, deletedAt: null } });
    } else {
      const skip = (parseInt(page, 10) - 1) * take;
      total = await prisma.message.count({ where: { conversationId, deletedAt: null } });
      messages = await prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        skip,
        take,
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true } },
          attachments: true
        },
        orderBy: { createdAt: 'desc' }
      });
      messages.reverse();
    }

    res.json({
      messages: messages.map(mapMessageLegacy),
      pagination: {
        page: before ? null : parseInt(page, 10),
        limit: take,
        total,
        pages: Math.ceil(total / take),
        hasMoreBefore: messages.length === take
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/conversation/:conversationId/messages', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const { conversationId } = req.params;
    if (!isUuid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }

    const content = req.body.content != null ? String(req.body.content).trim() : '';
    const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : null;
    if (!content && (!attachments || !attachments.length)) {
      return res.status(400).json({ error: 'Message text or attachments required' });
    }

    if (!(await isParticipant(conversationId, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true }
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    if (String(req.user.role || '').toUpperCase() !== 'ADMIN' && conversation.blockedAt) {
      return res.status(403).json({
        error:
          'This conversation has been restricted by support. You cannot send new messages here.'
      });
    }

    const sanitizedAttachments =
      attachments &&
      attachments
        .slice(0, 5)
        .map((a) => ({
          url: String(a.url || a.storagePath || '').slice(0, 2048),
          mimeType: String(a.mimeType || '').slice(0, 128),
          originalName: String(a.originalName || 'file').slice(0, 255),
          size: typeof a.size === 'number' ? a.size : parseInt(a.size, 10) || 0
        }))
        .filter(
          (a) =>
            a.url.startsWith('/api/messages/files/') ||
            a.url.startsWith('/uploads/chat/') ||
            a.url.startsWith('storage/private/chat/')
        );

    const message = await createMessage({
      conversationId,
      senderId: req.user.id,
      content,
      attachments: sanitizedAttachments
    });

    const recipientIds = conversation.participants
      .map((p) => p.userId)
      .filter((id) => String(id) !== String(req.user.id));

    const previewText =
      content || (sanitizedAttachments && sanitizedAttachments.length ? 'Attachment' : '');

    for (const recipientId of recipientIds) {
      try {
        await createUserNotification({
          title: `New message from ${req.user.fullName || 'MatchField'}`,
          message: previewText.slice(0, 500),
          type: 'MESSAGE',
          targetUserId: recipientId,
          sentById: req.user.id
        });
      } catch (notifErr) {
        console.warn('Could not create in-app notification for reply:', notifErr);
      }
      emitToUser(recipientId, 'message:new', { conversationId, message });
    }

    const payload = { conversationId, message };
    emitMessageNew(conversationId, payload);
    emitToUser(req.user.id, 'message:new', payload);
    emitConversationUpdate(
      conversation.participants.map((p) => p.userId),
      { conversationId, type: 'message', message }
    );

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.patch('/conversation/:conversationId/star', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const { conversationId } = req.params;
    if (!isUuid(conversationId) || !(await isParticipant(conversationId, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await setStarred(conversationId, req.user.id, !!req.body.starred);
    emitToUser(req.user.id, 'conversation:update', {
      conversationId,
      type: 'starred',
      starred: !!req.body.starred
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Star conversation error:', error);
    res.status(500).json({ error: 'Failed to update star status' });
  }
});

router.patch('/conversation/:conversationId/block', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const { conversationId } = req.params;
    if (!isUuid(conversationId) || !(await isParticipant(conversationId, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // User-level mute via mutedUntil; global block for admins uses blockedAt
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId: req.user.id }
      },
      data: { mutedUntil: req.body.blocked ? new Date('2099-01-01') : null }
    });
    if (req.user.role === 'ADMIN') {
      await setBlockedGlobal(conversationId, !!req.body.blocked);
    }
    emitToUser(req.user.id, 'conversation:update', {
      conversationId,
      type: 'blocked',
      blocked: !!req.body.blocked
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Block conversation error:', error);
    res.status(500).json({ error: 'Failed to update block status' });
  }
});

router.put('/conversation/:conversationId/messages/read-all', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const { conversationId } = req.params;
    if (!isUuid(conversationId) || !(await isParticipant(conversationId, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const modified = await markAllRead(conversationId, req.user.id);
    emitMessageRead(conversationId, {
      conversationId,
      readerId: req.user.id,
      all: true,
      modified
    });
    res.json({ success: true, modified });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

router.put(
  '/conversation/:conversationId/messages/:messageId/read',
  authenticate,
  async (req, res) => {
    try {
      if (denyChatForUnverifiedOwner(req, res)) return;
      const { conversationId, messageId } = req.params;
      if (!isUuid(conversationId) || !isUuid(messageId)) {
        return res.status(400).json({ error: 'Invalid id' });
      }
      if (!(await isParticipant(conversationId, req.user.id))) {
        return res.status(403).json({ error: 'Access denied' });
      }
      await markAllRead(conversationId, req.user.id);
      const readAt = new Date().toISOString();
      emitMessageRead(conversationId, {
        conversationId,
        messageId,
        readAt,
        readerId: req.user.id
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Mark message read error:', error);
      res.status(500).json({ error: 'Failed to mark message as read' });
    }
  }
);

router.get('/files/:filename', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename || filename !== req.params.filename || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const conversationId = String(req.query.conversationId || '').trim();
    if (!conversationId || !isUuid(conversationId)) {
      return res.status(400).json({ error: 'conversationId is required' });
    }
    if (!(await isParticipant(conversationId, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const abs = path.join(__dirname, '..', 'storage', 'private', 'chat', filename);
    const root = path.resolve(path.join(__dirname, '..', 'storage', 'private', 'chat'));
    const resolved = path.resolve(abs);
    if (!resolved.startsWith(root + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(resolved);
  } catch (error) {
    console.error('Chat file download error:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

module.exports = router;
