const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { createRateLimiter } = require('../lib/security/rateLimit');

const router = express.Router();

const supportContactLimiter = createRateLimiter({
  bucket: 'support-contact',
  windowMs: Number(process.env.RATE_LIMIT_SUPPORT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_SUPPORT_MAX) || 10,
  message: 'Too many contact submissions. Please try again later.'
});

router.get('/contact-info', (_req, res) => {
  res.json({
    email: process.env.PUBLIC_SUPPORT_EMAIL || 'MatchField@gmail.com',
    whatsapp: process.env.PUBLIC_SUPPORT_WHATSAPP || '+90 (5xx) xxx xx xx',
    phoneLine: process.env.PUBLIC_SUPPORT_PHONE || '+90 (212) xxx xx xx. 09:00-22:00'
  });
});

async function getUserFromToken(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!decoded?.userId) return null;
    return prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, fullName: true, role: true, status: true }
    });
  } catch (_) {
    return null;
  }
}

router.post(
  '/contact',
  supportContactLimiter,
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

      const authUser = await getUserFromToken(req);
      const subject = topic || 'Contact form message';

      const ticket = await prisma.supportTicket.create({
        data: {
          requesterId: authUser?.id || null,
          email,
          subject: subject.slice(0, 180),
          message: phone ? `${message}\n\nPhone: ${phone}\nFrom: ${fullName}` : `${message}\n\nFrom: ${fullName}`,
          status: 'OPEN',
          priority: 'NORMAL',
          messages: {
            create: [
              {
                senderId: authUser?.id || null,
                message: message,
                isInternal: false
              }
            ]
          }
        }
      });

      res.status(201).json({
        message: 'Your message has been received. Our team will review your request.',
        ticketId: ticket.id
      });
    } catch (error) {
      console.error('Support contact error:', error);
      res.status(500).json({ error: 'Failed to submit your message' });
    }
  }
);

module.exports = router;
