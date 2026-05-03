const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Shown on Contact Us — override with PUBLIC_SUPPORT_* in .env
router.get('/contact-info', (_req, res) => {
  res.json({
    email: process.env.PUBLIC_SUPPORT_EMAIL || 'MatchField@gmail.com',
    whatsapp: process.env.PUBLIC_SUPPORT_WHATSAPP || '+90 (5xx) xxx xx xx',
    phoneLine: process.env.PUBLIC_SUPPORT_PHONE || '+90 (212) xxx xx xx. 09:00-22:00'
  });
});

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

/** Persists every contact form post (MongoDB native — avoids Prisma client regen during dev). */
async function saveContactSubmission({ fullName, email, phone, topic, message, userId }) {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const doc = {
      full_name: fullName,
      email,
      phone: phone || null,
      topic: topic || null,
      message,
      created_at: new Date()
    };
    if (userId && ObjectId.isValid(String(userId))) {
      doc.user_id = new ObjectId(String(userId));
    }
    const ins = await client.db().collection('support_contact_submissions').insertOne(doc);
    return ins.insertedId;
  } finally {
    await client.close();
  }
}

async function linkSubmissionToConversation(mongoId, conversationId) {
  if (!mongoId || !conversationId) return;
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    await client.db().collection('support_contact_submissions').updateOne(
      { _id: mongoId },
      { $set: { prisma_conversation_id: String(conversationId) } }
    );
  } finally {
    await client.close();
  }
}

// Public contact endpoint – works even if account is suspended
router.post(
  '/contact',
  [
    body('fullName').trim().notEmpty(),
    body('email').trim().isEmail(),
    body('message').trim().notEmpty(),
    body('phone').optional({ values: 'falsy' }).isString().trim(),
    body('topic').optional({ values: 'falsy' }).isString().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let { fullName, email, phone, topic, message } = req.body;
      fullName = String(fullName).trim();
      email = String(email).trim().toLowerCase();
      message = String(message).trim();
      phone = phone && String(phone).trim() ? String(phone).trim() : null;
      topic = topic && String(topic).trim() ? String(topic).trim() : null;

      // Try to link to an existing user (even if suspended)
      const authUser = await getUserFromToken(req);

      const submissionMongoId = await saveContactSubmission({
        fullName,
        email,
        phone,
        topic,
        message,
        userId: authUser?.id || null
      });

      // Best-effort: mirror into admin support chat when both parties exist
      try {
        const admin = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true, email: true }
        });

        if (authUser && admin) {
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

          await linkSubmissionToConversation(submissionMongoId, conversation.id);
        }
      } catch (mirrorErr) {
        console.error('Support contact: admin chat mirror failed (submission was saved):', mirrorErr);
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

