const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Optional helper to extract userId from JWT without enforcing ACTIVE status
async function getUserFromToken(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true
      }
    });

    return user;
  } catch (e) {
    return null;
  }
}

// Public contact endpoint – works even if account is suspended
router.post(
  '/contact',
  [
    body('fullName').trim().notEmpty(),
    body('email').isEmail(),
    body('message').trim().notEmpty(),
    body('phone').optional().trim(),
    body('topic').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fullName, email, phone, topic, message } = req.body;

      // Try to link to an existing user (even if suspended)
      const authUser = await getUserFromToken(req);

      // Find an admin to route this ticket to (for future use)
      const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true, email: true }
      });

      // For now, just log and optionally create a conversation + message if user and admin exist
      console.log('Support contact request:', {
        fullName,
        email,
        phone,
        topic,
        message,
        authUserId: authUser?.id,
        adminId: admin?.id
      });

      if (authUser && admin) {
        // Create or reuse a conversation between this user and an admin
        let conversation = await prisma.conversation.findFirst({
          where: {
            OR: [
              { user1Id: authUser.id, user2Id: admin.id },
              { user1Id: admin.id, user2Id: authUser.id }
            ]
          }
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              user1Id: authUser.id,
              user2Id: admin.id,
              isSupportThread: true
            }
          });
        } else if (!conversation.isSupportThread) {
          // Ensure it shows up in the shared admin inbox
          try {
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { isSupportThread: true }
            });
          } catch (_) {
            // best effort
          }
        }

        const contentParts = [];
        if (topic) contentParts.push(`Topic: ${topic}`);
        contentParts.push(message);
        if (phone) contentParts.push(`Phone: ${phone}`);
        if (email && email !== authUser.email) {
          contentParts.push(`Contact email: ${email}`);
        }

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: authUser.id,
            content: contentParts.join('\n\n')
          }
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() }
        });
      }

      res.status(201).json({
        message: 'Your message has been received. Our team will review your request.'
      });
    } catch (error) {
      console.error('Support contact error:', error);
      res.status(500).json({ error: 'Failed to submit your message' });
    }
  }
);

module.exports = router;

