const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get reviews for a field
router.get('/field/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { fieldId },
        skip,
        take: parseInt(limit),
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.review.count({ where: { fieldId } })
    ]);

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Create or update review
router.post('/', authenticate, [
  body('fieldId').notEmpty(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('reviewText').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fieldId, rating, reviewText, context } = req.body;

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: {
        fieldId_userId: {
          fieldId,
          userId: req.user.id
        }
      }
    });

    let review;
    if (existingReview) {
      // Update existing review
      review = await prisma.review.update({
        where: { id: existingReview.id },
        data: {
          rating: parseInt(rating),
          reviewText,
          context
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatar: true
            }
          }
        }
      });
    } else {
      // Create new review
      review = await prisma.review.create({
        data: {
          fieldId,
          userId: req.user.id,
          rating: parseInt(rating),
          reviewText,
          context
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatar: true
            }
          }
        }
      });
    }

    // Update field rating
    const fieldReviews = await prisma.review.findMany({
      where: { fieldId },
      select: { rating: true }
    });

    const avgRating = fieldReviews.reduce((sum, r) => sum + r.rating, 0) / fieldReviews.length;

    await prisma.field.update({
      where: { id: fieldId },
      data: {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: fieldReviews.length
      }
    });

    res.status(existingReview ? 200 : 201).json({
      message: existingReview ? 'Review updated' : 'Review created',
      review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Delete review
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const review = await prisma.review.findUnique({
      where: { id }
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.review.delete({
      where: { id }
    });

    // Update field rating
    const fieldReviews = await prisma.review.findMany({
      where: { fieldId: review.fieldId },
      select: { rating: true }
    });

    const avgRating = fieldReviews.length > 0
      ? fieldReviews.reduce((sum, r) => sum + r.rating, 0) / fieldReviews.length
      : 0;

    await prisma.field.update({
      where: { id: review.fieldId },
      data: {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: fieldReviews.length
      }
    });

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;

