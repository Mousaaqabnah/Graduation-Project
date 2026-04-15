const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get user's favorites
router.get('/', authenticate, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: {
        field: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                avatar: true
              }
            },
            _count: {
              select: {
                reviews: true,
                bookings: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ favorites });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Add to favorites
router.post('/', authenticate, async (req, res) => {
  try {
    const { fieldId } = req.body;

    if (!fieldId) {
      return res.status(400).json({ error: 'Field ID is required' });
    }

    // Check if field exists
    const field = await prisma.field.findUnique({
      where: { id: fieldId }
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_fieldId: {
          userId: req.user.id,
          fieldId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Field already in favorites' });
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId: req.user.id,
        fieldId
      },
      include: {
        field: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({ message: 'Added to favorites', favorite });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove from favorites
router.delete('/:fieldId', authenticate, async (req, res) => {
  try {
    const { fieldId } = req.params;

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_fieldId: {
          userId: req.user.id,
          fieldId
        }
      }
    });

    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    await prisma.favorite.delete({
      where: { id: favorite.id }
    });

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// Check if field is favorited
router.get('/check/:fieldId', authenticate, async (req, res) => {
  try {
    const { fieldId } = req.params;

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_fieldId: {
          userId: req.user.id,
          fieldId
        }
      }
    });

    res.json({ isFavorited: !!favorite });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ error: 'Failed to check favorite' });
  }
});

module.exports = router;

