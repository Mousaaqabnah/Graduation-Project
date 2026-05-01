const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { mongoGetOrCreateConversation } = require('../lib/mongoConversation');
const { mongoCreateMessageAndTouchConversation } = require('../lib/mongoMessageWrite');

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

// Get user's conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1Id: req.user.id },
          { user2Id: req.user.id }
        ]
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

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get or create conversation (native Mongo — Prisma create hits P2031 on standalone mongod)
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

    res.json({ conversation: result.conversation });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Get messages for a conversation
router.get('/conversation/:conversationId/messages', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Verify user is part of conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user1Id !== req.user.id && conversation.user2Id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        skip,
        take: parseInt(limit),
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
      }),
      prisma.message.count({ where: { conversationId } })
    ]);

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message
router.post('/conversation/:conversationId/messages', authenticate, [
  body('content').trim().notEmpty()
], async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const { conversationId } = req.params;
    const { content } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verify user is part of conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user1Id !== req.user.id && conversation.user2Id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const message = await mongoCreateMessageAndTouchConversation(conversationId, req.user.id, content);

    // Notify the recipient (other user in conversation)
    const recipientId = conversation.user1Id === req.user.id ? conversation.user2Id : conversation.user1Id;
    try {
      const notification = await prisma.notification.create({
        data: {
          title: 'Reply from MatchField Support',
          message: content,
          audience: 'private',
          channels: ['in-app'],
          targetUserId: recipientId,
          sentById: req.user.id
        }
      });
      await prisma.userNotification.create({
        data: {
          userId: recipientId,
          notificationId: notification.id
        }
      });
    } catch (notifErr) {
      console.warn('Could not create in-app notification for reply:', notifErr);
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Star/unstar conversation (admin marks as important)
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

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { starredAt: starred ? new Date() : null }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Star conversation error:', error);
    res.status(500).json({ error: 'Failed to update star status' });
  }
});

// Block/unblock conversation (admin marks as spam or restores to normal)
router.patch('/conversation/:conversationId/block', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const { conversationId } = req.params;
    const { blocked } = req.body; // true = block, false = unblock

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user1Id !== req.user.id && conversation.user2Id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { blockedAt: blocked ? new Date() : null }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Block conversation error:', error);
    res.status(500).json({ error: 'Failed to update block status' });
  }
});

// Mark message as read
router.put('/conversation/:conversationId/messages/:messageId/read', authenticate, async (req, res) => {
  try {
    if (denyChatForUnverifiedOwner(req, res)) return;
    const { conversationId, messageId } = req.params;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId
      },
      include: {
        conversation: true
      }
    });

    if (!message || !message.conversation) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const conv = message.conversation;
    if (conv.user1Id !== req.user.id && conv.user2Id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { readAt: new Date() }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

module.exports = router;

