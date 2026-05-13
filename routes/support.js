const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { mongoCreateMessageAndTouchConversation, mongoConversationGlobalBlockActive } = require('../lib/mongoMessageWrite');

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

async function findOrCreateSupportConversation(userId, adminId) {
  const userIdStr = String(userId || '').trim();
  const adminIdStr = String(adminId || '').trim();
  if (!ObjectId.isValid(userIdStr) || !ObjectId.isValid(adminIdStr)) {
    throw new Error('Invalid support conversation user ids');
  }

  const userOid = new ObjectId(userIdStr);
  const adminOid = new ObjectId(adminIdStr);
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  try {
    const db = client.db();
    const conversations = db.collection('conversations');
    const now = new Date();

    let conversation = await conversations.findOne({
      $or: [
        { user1_id: userOid, user2_id: adminOid },
        { user1_id: adminOid, user2_id: userOid }
      ]
    });

    if (!conversation) {
      const inserted = await conversations.insertOne({
        user1_id: userOid,
        user2_id: adminOid,
        is_support_thread: true,
        created_at: now,
        updated_at: now,
        blocked_at: null,
        starred_at: null
      });
      conversation = await conversations.findOne({ _id: inserted.insertedId });
    } else if (conversation.is_support_thread !== true) {
      await conversations.updateOne(
        { _id: conversation._id },
        { $set: { is_support_thread: true, updated_at: now } }
      );
      conversation = await conversations.findOne({ _id: conversation._id });
    }

    return String(conversation._id);
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

      let admin = null;
      let supportConversationId = null;
      if (authUser) {
        admin = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true, email: true }
        });
        if (admin) {
          supportConversationId = await findOrCreateSupportConversation(authUser.id, admin.id);
          const convFlags = await prisma.conversation.findUnique({
            where: { id: supportConversationId },
            select: { blockedAt: true }
          });
          const threadLocked =
            !!(convFlags && convFlags.blockedAt) ||
            (await mongoConversationGlobalBlockActive(supportConversationId));
          if (threadLocked) {
            return res.status(403).json({
              error:
                'This support channel is restricted and cannot accept new messages. Use the email or phone on this page to reach our team.'
            });
          }
        }
      }

      const submissionMongoId = await saveContactSubmission({
        fullName,
        email,
        phone,
        topic,
        message,
        userId: authUser?.id || null
      });

      // Best-effort: mirror into admin support chat when both parties exist (thread not locked — checked above)
      try {
        if (authUser && admin && supportConversationId) {
          const contentParts = [];
          if (topic) contentParts.push(`Topic: ${topic}`);
          contentParts.push(message);
          if (phone) contentParts.push(`Phone: ${phone}`);
          if (email && email !== authUser.email) {
            contentParts.push(`Contact email: ${email}`);
          }

          await mongoCreateMessageAndTouchConversation(
            supportConversationId,
            authUser.id,
            contentParts.join('\n\n')
          );

          await linkSubmissionToConversation(submissionMongoId, supportConversationId);
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

