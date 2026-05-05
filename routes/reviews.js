const express = require('express');
const { body, validationResult } = require('express-validator');
const { MongoClient, ObjectId } = require('mongodb');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function toObjectIdOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[a-fA-F0-9]{24}$/.test(trimmed)) return null;
  return new ObjectId(trimmed);
}

async function recalculateFieldRating(db, fieldObjectId) {
  const agg = await db.collection('field_reviews').aggregate([
    { $match: { field_id: fieldObjectId } },
    {
      $group: {
        _id: '$field_id',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  const avg = agg.length ? Number(agg[0].avgRating || 0) : 0;
  const count = agg.length ? Number(agg[0].count || 0) : 0;
  await db.collection('fields').updateOne(
    { _id: fieldObjectId },
    {
      $set: {
        rating: Math.round(avg * 10) / 10,
        review_count: count
      }
    }
  );
}

// Get current user's reviews (for profile stats - average rating given)
router.get('/user/me', authenticate, async (req, res) => {
  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    const userObjectId = toObjectIdOrNull(req.user.id);
    if (!userObjectId) return res.status(400).json({ error: 'Invalid user id' });
    await client.connect();
    const db = client.db();
    const reviews = await db.collection('field_reviews')
      .find({ user_id: userObjectId }, { projection: { rating: 1 } })
      .toArray();
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length
      : 0;
    res.json({
      reviews: reviews.map((r) => ({ rating: Number(r.rating || 0) })),
      averageRating: Math.round(avgRating * 10) / 10,
      count: reviews.length
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  } finally {
    await client.close().catch(() => {});
  }
});

// Get reviews for a field
router.get('/field/:fieldId', async (req, res) => {
  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    const { fieldId } = req.params;
    const fieldObjectId = toObjectIdOrNull(fieldId);
    if (!fieldObjectId) return res.status(400).json({ error: 'Invalid field id' });
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    await client.connect();
    const db = client.db();

    const [reviewsRaw, total] = await Promise.all([
      db.collection('field_reviews').aggregate([
        { $match: { field_id: fieldObjectId } },
        { $sort: { created_at: -1 } },
        { $skip: skip },
        { $limit: take },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
      ]).toArray(),
      db.collection('field_reviews').countDocuments({ field_id: fieldObjectId })
    ]);

    const reviews = reviewsRaw.map((r) => ({
      id: String(r._id),
      rating: Number(r.rating || 0),
      reviewText: r.review_text || '',
      context: r.context || '',
      createdAt: r.created_at || null,
      fieldId: String(r.field_id),
      userId: String(r.user_id),
      user: r.user ? {
        id: String(r.user._id),
        fullName: r.user.full_name || '',
        avatar: r.user.avatar || ''
      } : null
    }));

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  } finally {
    await client.close().catch(() => {});
  }
});

// Create or update review
router.post('/', authenticate, [
  body('fieldId').notEmpty(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('reviewText').optional({ nullable: true }).trim()
], async (req, res) => {
  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fieldId, rating, reviewText, context } = req.body;
    const fieldObjectId = toObjectIdOrNull(fieldId);
    const userObjectId = toObjectIdOrNull(req.user.id);
    if (!fieldObjectId || !userObjectId) {
      return res.status(400).json({ error: 'Invalid field or user id' });
    }
    await client.connect();
    const db = client.db();

    const fieldExists = await db.collection('fields').findOne({ _id: fieldObjectId }, { projection: { _id: 1 } });
    if (!fieldExists) return res.status(404).json({ error: 'Field not found' });

    const existingReview = await db.collection('field_reviews').findOne({
      field_id: fieldObjectId,
      user_id: userObjectId
    });

    const normalizedReviewText = (reviewText == null ? '' : String(reviewText).trim());
    const reviewPayload = {
      rating: parseInt(rating, 10),
      review_text: normalizedReviewText,
      context: context || ''
    };

    let reviewId = null;
    let isUpdate = false;
    if (existingReview) {
      isUpdate = true;
      reviewId = existingReview._id;
      await db.collection('field_reviews').updateOne(
        { _id: existingReview._id },
        { $set: reviewPayload }
      );
    } else {
      const inserted = await db.collection('field_reviews').insertOne({
        ...reviewPayload,
        field_id: fieldObjectId,
        user_id: userObjectId,
        created_at: new Date()
      });
      reviewId = inserted.insertedId;
    }

    await recalculateFieldRating(db, fieldObjectId);

    const reviewRaw = await db.collection('field_reviews').aggregate([
      { $match: { _id: reviewId } },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
    ]).next();

    const review = {
      id: String(reviewRaw._id),
      rating: Number(reviewRaw.rating || 0),
      reviewText: reviewRaw.review_text || '',
      context: reviewRaw.context || '',
      createdAt: reviewRaw.created_at || null,
      fieldId: String(reviewRaw.field_id),
      userId: String(reviewRaw.user_id),
      user: reviewRaw.user ? {
        id: String(reviewRaw.user._id),
        fullName: reviewRaw.user.full_name || '',
        avatar: reviewRaw.user.avatar || ''
      } : null
    };

    res.status(isUpdate ? 200 : 201).json({
      message: isUpdate ? 'Review updated' : 'Review created',
      review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  } finally {
    await client.close().catch(() => {});
  }
});

// Delete review
router.delete('/:id', authenticate, async (req, res) => {
  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    const { id } = req.params;
    const reviewObjectId = toObjectIdOrNull(id);
    const userObjectId = toObjectIdOrNull(req.user.id);
    if (!reviewObjectId || !userObjectId) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    await client.connect();
    const db = client.db();

    const review = await db.collection('field_reviews').findOne({ _id: reviewObjectId });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (String(review.user_id) !== String(userObjectId) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.collection('field_reviews').deleteOne({ _id: reviewObjectId });
    await recalculateFieldRating(db, review.field_id);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  } finally {
    await client.close().catch(() => {});
  }
});

module.exports = router;

