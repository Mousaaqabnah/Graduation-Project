const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { mongoGetOrCreateConversation } = require('../lib/mongoConversation');
const {
  mongoCreateMessageAndTouchConversation,
  mongoUnreadCount,
  mongoMarkMessageRead,
  mongoMarkAllUnreadAsRead,
  mongoConversationViewerMeta,
  mongoConversationSetStarred,
  mongoConversationSetBlocked
} = require('../lib/mongoMessageWrite');
const { mongoCreateUserNotification } = require('../lib/mongoNotificationWrite');
const {
  emitMessageNew,
  emitConversationUpdate,
  emitMessageRead,
  emitToUser
} = require('../lib/chatEvents');

const router = express.Router();
const prisma = new PrismaClient();

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

async function enrichConversationsWithUnread(conversations, viewerId) {
  const out = [];
  for (const c of conversations) {
    const [unreadCount, viewerMeta] = await Promise.all([
      mongoUnreadCount(c.id, viewerId),
      mongoConversationViewerMeta(c.id, viewerId)
    ]);
    out.push({
      ...c,
      unreadCount,
      starredAt: viewerMeta.starredAt || null,
      blockedAt: viewerMeta.blockedAt || null
    });
  }
  return out;
}

// Get user's conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }]
      },
      take: 500,
      include: {
        user1: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatar: true,
            role: true
          }
        },
        user2: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatar: true,
            role: true
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            attachments: true,
            createdAt: true,
            readAt: true,
            sender: {
              select: {
                id: true,
                fullName: true,
                avatar: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const enriched = await enrichConversationsWithUnread(conversations, req.user.id);
    res.json({ conversations: enriched });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/conversation/:userId', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const otherId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
    const meId = String(req.user.id);

    let result;
    try {
      result = await mongoGetOrCreateConversation(meId, otherId);
    } catch (err) {
      console.error('Get conversation error:', err);
      return res.status(500).json({ error: 'Failed to get conversation' });
    }

    if (!result.ok) {
      return res.status(result.status || 500).json({ error: result.error || 'Failed to get conversation' });
    }

    const [unreadCount, viewerMeta] = await Promise.all([
      mongoUnreadCount(result.conversation.id, meId),
      mongoConversationViewerMeta(result.conversation.id, meId)
    ]);
    res.json({
      conversation: {
        ...result.conversation,
        unreadCount,
        starredAt: viewerMeta.starredAt || null,
        blockedAt: viewerMeta.blockedAt || null
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
    const { page = 1, limit = 50, before } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 100);

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user1Id !== req.user.id && conversation.user2Id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let messages;
    let total;

    if (before && typeof before === 'string' && before.length === 24) {
      const cursorMsg = await prisma.message.findFirst({
        where: { id: before, conversationId }
      });
      if (!cursorMsg) {
        return res.status(400).json({ error: 'Invalid before cursor' });
      }
      messages = await prisma.message.findMany({
        where: {
          conversationId,
          createdAt: { lt: cursorMsg.createdAt }
        },
        take,
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      messages.reverse();
      total = await prisma.message.count({ where: { conversationId } });
    } else {
      const skip = (parseInt(page, 10) - 1) * take;
      total = await prisma.message.count({ where: { conversationId } });
      messages = await prisma.message.findMany({
        where: { conversationId },
        skip,
        take,
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      messages.reverse();
    }

    res.json({
      messages,
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
    const content = req.body.content != null ? String(req.body.content).trim() : '';
    const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : null;

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Message text or attachments required' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user1Id !== req.user.id && conversation.user2Id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const viewerMeta = await mongoConversationViewerMeta(conversationId, req.user.id);
    if (viewerMeta && viewerMeta.blockedAt) {
      return res.status(403).json({ error: 'This conversation is blocked' });
    }

    const sanitizedAttachments =
      attachments &&
      attachments
        .slice(0, 5)
        .map((a) => ({
          url: String(a.url || '').slice(0, 2048),
          mimeType: String(a.mimeType || '').slice(0, 128),
          originalName: String(a.originalName || 'file').slice(0, 255),
          size: typeof a.size === 'number' ? a.size : parseInt(a.size, 10) || 0
        }))
        .filter((a) => a.url.startsWith('/uploads/'));

    const message = await mongoCreateMessageAndTouchConversation(
      conversationId,
      req.user.id,
      content,
      sanitizedAttachments && sanitizedAttachments.length ? sanitizedAttachments : null
    );

    const recipientId =
      conversation.user1Id === req.user.id ? conversation.user2Id : conversation.user1Id;
    const previewText = content || (sanitizedAttachments && sanitizedAttachments.length ? '📎 Attachment' : '');

    const recipientMeta = await mongoConversationViewerMeta(conversationId, recipientId);
    const recipientHasBlocked = !!(recipientMeta && recipientMeta.blockedAt);

    if (!recipientHasBlocked) {
      try {
        await mongoCreateUserNotification({
          title: `New message from ${req.user.fullName || 'MatchField'}`,
          message: previewText.slice(0, 500),
          targetUserId: recipientId,
          sentById: req.user.id
        });
      } catch (notifErr) {
        console.warn('Could not create in-app notification for reply:', notifErr);
      }
    }

    const payload = { conversationId, message };
    if (!recipientHasBlocked) {
      emitMessageNew(conversationId, payload);
      emitToUser(recipientId, 'message:new', payload);
    }
    emitToUser(req.user.id, 'message:new', payload);
    emitConversationUpdate(recipientHasBlocked ? [req.user.id] : [conversation.user1Id, conversation.user2Id], {
      conversationId,
      type: 'message',
      message
    });

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
    const { starred } = req.body;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user1Id !== req.user.id && conversation.user2Id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await mongoConversationSetStarred(conversationId, req.user.id, !!starred);

    emitToUser(req.user.id, 'conversation:update', {
      conversationId,
      type: 'starred',
      starred: !!starred
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
    const { blocked } = req.body;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user1Id !== req.user.id && conversation.user2Id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await mongoConversationSetBlocked(conversationId, req.user.id, !!blocked);

    emitToUser(req.user.id, 'conversation:update', {
      conversationId,
      type: 'blocked',
      blocked: !!blocked
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

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user1Id !== req.user.id && conversation.user2Id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const modified = await mongoMarkAllUnreadAsRead(conversationId, req.user.id);

    emitMessageRead(conversationId, {
      conversationId,
      readerId: req.user.id,
      all: true,
      modified
    });
    const readAtAll = new Date().toISOString();
    emitToUser(
      conversation.user1Id === req.user.id ? conversation.user2Id : conversation.user1Id,
      'message:read',
      {
        conversationId,
        readerId: req.user.id,
        all: true,
        readAt: readAtAll
      }
    );

    res.json({ success: true, modified });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

router.put('/conversation/:conversationId/messages/:messageId/read', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const { conversationId, messageId } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation || (conversation.user1Id !== req.user.id && conversation.user2Id !== req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await mongoMarkMessageRead(messageId, conversationId, req.user.id);
    if (!result.ok && result.reason === 'not_found') {
      return res.status(404).json({ error: 'Message not found' });
    }

    const readAt = new Date().toISOString();
    emitMessageRead(conversationId, {
      conversationId,
      messageId,
      readAt,
      readerId: req.user.id
    });

    if (result.ok && !result.skipped) {
      const msgRow = await prisma.message.findUnique({
        where: { id: messageId },
        select: { senderId: true }
      });
      if (msgRow && msgRow.senderId !== req.user.id) {
        emitToUser(msgRow.senderId, 'message:read', {
          conversationId,
          messageId,
          readAt,
          readerId: req.user.id
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

module.exports = router;
