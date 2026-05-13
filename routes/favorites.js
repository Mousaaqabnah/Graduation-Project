const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function toObjectIdOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[a-fA-F0-9]{24}$/.test(trimmed)) return null;
  return new ObjectId(trimmed);
}

function mapFavoriteDoc(doc) {
  return {
    id: String(doc._id),
    userId: String(doc.user_id),
    fieldId: String(doc.field_id),
    createdAt: doc.created_at || null,
    field: doc.field || null
  };
}

// Get user's favorites
router.get('/', authenticate, async (req, res) => {
  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    const userId = toObjectIdOrNull(req.user.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    await client.connect();
    const db = client.db();

    const favorites = await db.collection('favorites').aggregate([
      { $match: { user_id: userId } },
      { $sort: { created_at: -1 } },
      {
        $lookup: {
          from: 'fields',
          localField: 'field_id',
          foreignField: '_id',
          as: 'field'
        }
      },
      { $unwind: { path: '$field', preserveNullAndEmptyArrays: true } }
    ]).toArray();

    res.json({ favorites: favorites.map(mapFavoriteDoc) });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  } finally {
    await client.close().catch(() => {});
  }
});

// Add to favorites
router.post('/', authenticate, async (req, res) => {
  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    const { fieldId } = req.body;

    if (!fieldId) {
      return res.status(400).json({ error: 'Field ID is required' });
    }
    const userObjId = toObjectIdOrNull(req.user.id);
    const fieldObjId = toObjectIdOrNull(fieldId);
    if (!userObjId || !fieldObjId) {
      return res.status(400).json({ error: 'Invalid field ID' });
    }
    await client.connect();
    const db = client.db();

    // Check if field exists
    const field = await db.collection('fields').findOne({ _id: fieldObjId });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    // Check if already favorited
    const existing = await db.collection('favorites').findOne({
      user_id: userObjId,
      field_id: fieldObjId
    });

    if (existing) {
      return res.status(400).json({ error: 'Field already in favorites' });
    }

    const insertResult = await db.collection('favorites').insertOne({
      user_id: userObjId,
      field_id: fieldObjId,
      created_at: new Date()
    });
    const favorite = await db.collection('favorites').aggregate([
      { $match: { _id: insertResult.insertedId } },
      {
        $lookup: {
          from: 'fields',
          localField: 'field_id',
          foreignField: '_id',
          as: 'field'
        }
      },
      { $unwind: { path: '$field', preserveNullAndEmptyArrays: true } }
    ]).next();

    res.status(201).json({ message: 'Added to favorites', favorite: mapFavoriteDoc(favorite) });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  } finally {
    await client.close().catch(() => {});
  }
});

// Remove from favorites
router.delete('/:fieldId', authenticate, async (req, res) => {
  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    const { fieldId } = req.params;
    const userObjId = toObjectIdOrNull(req.user.id);
    const fieldObjId = toObjectIdOrNull(fieldId);
    if (!userObjId || !fieldObjId) {
      return res.status(400).json({ error: 'Invalid field ID' });
    }
    await client.connect();
    const db = client.db();

    const result = await db.collection('favorites').deleteOne({
      user_id: userObjId,
      field_id: fieldObjId
    });
    if (!result.deletedCount) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  } finally {
    await client.close().catch(() => {});
  }
});

// Check if field is favorited
router.get('/check/:fieldId', authenticate, async (req, res) => {
  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    const { fieldId } = req.params;
    const userObjId = toObjectIdOrNull(req.user.id);
    const fieldObjId = toObjectIdOrNull(fieldId);
    if (!userObjId || !fieldObjId) {
      return res.status(400).json({ error: 'Invalid field ID' });
    }
    await client.connect();
    const db = client.db();

    const favorite = await db.collection('favorites').findOne({
      user_id: userObjId,
      field_id: fieldObjId
    });

    res.json({ isFavorited: !!favorite });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ error: 'Failed to check favorite' });
  } finally {
    await client.close().catch(() => {});
  }
});

module.exports = router;

