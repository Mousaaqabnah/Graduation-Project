const express = require('express');
const { prisma } = require('../lib/prisma');
const { isUuid } = require('../lib/ids');
const { authenticate } = require('../middleware/auth');
const { serializeField } = require('../lib/serializers');

const router = express.Router();

const fieldInclude = {
  images: { orderBy: { displayOrder: 'asc' } },
  amenities: true,
  highlights: true,
  openingHours: true,
  owner: { select: { id: true, fullName: true, avatarUrl: true, phone: true } }
};

router.get('/', authenticate, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { field: { include: fieldInclude } }
    });

    res.json({
      favorites: favorites.map((f) => ({
        id: `${f.userId}_${f.fieldId}`,
        userId: f.userId,
        fieldId: f.fieldId,
        createdAt: f.createdAt,
        field: serializeField(f.field)
      }))
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const fieldId = req.body?.fieldId;
    if (!isUuid(fieldId)) {
      return res.status(400).json({ error: 'Invalid field ID' });
    }

    const field = await prisma.field.findFirst({
      where: { id: fieldId, deletedAt: null },
      include: fieldInclude
    });
    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const existing = await prisma.favorite.findUnique({
      where: { userId_fieldId: { userId: req.user.id, fieldId } }
    });
    if (existing) {
      return res.status(400).json({ error: 'Field already in favorites' });
    }

    const favorite = await prisma.favorite.create({
      data: { userId: req.user.id, fieldId },
      include: { field: { include: fieldInclude } }
    });

    res.status(201).json({
      message: 'Added to favorites',
      favorite: {
        id: `${favorite.userId}_${favorite.fieldId}`,
        userId: favorite.userId,
        fieldId: favorite.fieldId,
        createdAt: favorite.createdAt,
        field: serializeField(favorite.field)
      }
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

router.delete('/:fieldId', authenticate, async (req, res) => {
  try {
    const fieldId = req.params.fieldId;
    if (!isUuid(fieldId)) {
      return res.status(400).json({ error: 'Invalid field ID' });
    }

    try {
      await prisma.favorite.delete({
        where: { userId_fieldId: { userId: req.user.id, fieldId } }
      });
    } catch (e) {
      if (e.code === 'P2025') {
        return res.status(404).json({ error: 'Favorite not found' });
      }
      throw e;
    }

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

router.get('/check/:fieldId', authenticate, async (req, res) => {
  try {
    const fieldId = req.params.fieldId;
    if (!isUuid(fieldId)) {
      return res.status(400).json({ error: 'Invalid field ID' });
    }
    const favorite = await prisma.favorite.findUnique({
      where: { userId_fieldId: { userId: req.user.id, fieldId } }
    });
    res.json({ isFavorited: !!favorite });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ error: 'Failed to check favorite' });
  }
});

module.exports = router;
