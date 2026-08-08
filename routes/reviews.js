const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../lib/prisma');
const { isUuid } = require('../lib/ids');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function recalculateFieldRating(tx, fieldId) {
  const agg = await tx.review.aggregate({
    where: { fieldId },
    _avg: { rating: true },
    _count: { _all: true }
  });
  const avg = agg._avg.rating != null ? Math.round(Number(agg._avg.rating) * 100) / 100 : 0;
  const count = agg._count._all || 0;
  await tx.field.update({
    where: { id: fieldId },
    data: { ratingAverage: avg, reviewCount: count }
  });
}

router.get('/user/me', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * take;
    const where = { userId: req.user.id };
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: { rating: true, id: true, fieldId: true, createdAt: true }
      }),
      prisma.review.count({ where })
    ]);
    const avgRating = total
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length
      : 0;
    res.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: Number(r.rating || 0),
        fieldId: r.fieldId,
        createdAt: r.createdAt
      })),
      averageRating: Math.round(avgRating * 10) / 10,
      count: total,
      pagination: { page, limit: take, total, pages: Math.ceil(total / take) || 1 }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.get('/field/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params;
    if (!isUuid(fieldId)) return res.status(400).json({ error: 'Invalid field id' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const take = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * take;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { fieldId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } }
        }
      }),
      prisma.review.count({ where: { fieldId } })
    ]);

    res.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        reviewText: r.reviewText || '',
        context: r.context || '',
        createdAt: r.createdAt,
        fieldId: r.fieldId,
        userId: r.userId,
        bookingId: r.bookingId,
        user: r.user
          ? { id: r.user.id, fullName: r.user.fullName, avatar: r.user.avatarUrl || '' }
          : null
      })),
      pagination: { page, limit: take, total, pages: Math.ceil(total / take) }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.post(
  '/',
  authenticate,
  [
    body('fieldId').notEmpty(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('reviewText').optional({ nullable: true }).trim(),
    body('bookingId').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fieldId, rating, reviewText, context, bookingId } = req.body;
      if (!isUuid(fieldId)) {
        return res.status(400).json({ error: 'Invalid field or user id' });
      }

      const field = await prisma.field.findFirst({
        where: { id: fieldId, deletedAt: null },
        select: { id: true }
      });
      if (!field) return res.status(404).json({ error: 'Field not found' });

      let booking = null;
      if (bookingId) {
        if (!isUuid(bookingId)) {
          return res.status(400).json({ error: 'Invalid booking id' });
        }
        booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.fieldId !== fieldId) {
          return res.status(400).json({ error: 'Booking does not match field' });
        }
        if (String(booking.organizerId) !== String(req.user.id)) {
          const participant = await prisma.bookingParticipant.findUnique({
            where: {
              bookingId_userId: { bookingId, userId: req.user.id }
            }
          });
          if (!participant) {
            return res.status(403).json({ error: 'You can only review bookings you participated in' });
          }
        }
        if (booking.status !== 'COMPLETED') {
          return res.status(400).json({
            error: 'You can only review a booking after it is completed'
          });
        }
      } else {
        booking = await prisma.booking.findFirst({
          where: {
            fieldId,
            status: 'COMPLETED',
            OR: [
              { organizerId: req.user.id },
              { participants: { some: { userId: req.user.id } } }
            ],
            review: null
          },
          orderBy: { endAt: 'desc' }
        });
        if (!booking) {
          return res.status(400).json({
            error: 'A completed booking is required to leave a review. Pass bookingId.'
          });
        }
      }

      const existing = await prisma.review.findUnique({
        where: { bookingId: booking.id }
      });

      const review = await prisma.$transaction(async (tx) => {
        let saved;
        if (existing) {
          if (String(existing.userId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
            const err = new Error('Access denied');
            err.status = 403;
            throw err;
          }
          saved = await tx.review.update({
            where: { id: existing.id },
            data: {
              rating: parseInt(rating, 10),
              reviewText: reviewText == null ? '' : String(reviewText).trim(),
              context: context ? String(context).slice(0, 220) : null
            },
            include: {
              user: { select: { id: true, fullName: true, avatarUrl: true } }
            }
          });
        } else {
          saved = await tx.review.create({
            data: {
              bookingId: booking.id,
              fieldId,
              userId: req.user.id,
              rating: parseInt(rating, 10),
              reviewText: reviewText == null ? '' : String(reviewText).trim(),
              context: context ? String(context).slice(0, 220) : null
            },
            include: {
              user: { select: { id: true, fullName: true, avatarUrl: true } }
            }
          });
        }
        await recalculateFieldRating(tx, fieldId);
        return saved;
      });

      res.status(existing ? 200 : 201).json({
        message: existing ? 'Review updated' : 'Review created',
        review: {
          id: review.id,
          rating: review.rating,
          reviewText: review.reviewText || '',
          context: review.context || '',
          createdAt: review.createdAt,
          fieldId: review.fieldId,
          userId: review.userId,
          bookingId: review.bookingId,
          user: review.user
            ? {
                id: review.user.id,
                fullName: review.user.fullName,
                avatar: review.user.avatarUrl || ''
              }
            : null
        }
      });
    } catch (error) {
      if (error.status === 403) {
        return res.status(403).json({ error: error.message });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'A review already exists for this booking' });
      }
      console.error('Create review error:', error);
      res.status(500).json({ error: 'Failed to create review' });
    }
  }
);

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid id' });

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (String(review.userId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      await recalculateFieldRating(tx, review.fieldId);
    });

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;
