const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// All admin routes require authentication and ADMIN role
router.use(authenticate);
router.use(requireRole('ADMIN'));

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeOwners,
      pendingVerifications,
      recentBookings,
      totalRevenue
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          role: 'OWNER',
          verificationStatus: 'APPROVED'
        }
      }),
      prisma.user.count({
        where: {
          role: 'OWNER',
          verificationStatus: 'PENDING'
        }
      }),
      prisma.booking.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      prisma.booking.aggregate({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          },
          status: {
            in: ['CONFIRMED', 'COMPLETED']
          }
        },
        _sum: {
          totalCost: true
        }
      })
    ]);

    res.json({
      stats: {
        totalUsers,
        activeOwners,
        pendingVerifications,
        recentBookings,
        totalRevenue: totalRevenue._sum.totalCost || 0
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Verify owner
router.put('/verify-owner/:userId', [
  body('verificationStatus').isIn(['APPROVED', 'REJECTED']),
  body('reason').optional()
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { verificationStatus, reason } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = {
      verificationStatus,
      verifiedAt: verificationStatus === 'APPROVED' ? new Date() : null
    };

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        verificationStatus: true,
        verifiedAt: true
      }
    });

    res.json({ message: 'Owner verification updated', user });
  } catch (error) {
    console.error('Verify owner error:', error);
    res.status(500).json({ error: 'Failed to verify owner' });
  }
});

// Get pending verifications
router.get('/verifications', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: 'OWNER',
          verificationStatus: 'PENDING'
        },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          location: true,
          idFrontUrl: true,
          idBackUrl: true,
          verificationStatus: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({
        where: {
          role: 'OWNER',
          verificationStatus: 'PENDING'
        }
      })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

module.exports = router;

