const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all fields
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, sport, type, location, search, minPrice, maxPrice } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };
    
    if (sport) where.sport = sport;
    if (type) where.type = type;
    if (location) where.location = { contains: location };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }
    if (minPrice || maxPrice) {
      where.pricePerHour = {};
      if (minPrice) where.pricePerHour.gte = parseInt(minPrice);
      if (maxPrice) where.pricePerHour.lte = parseInt(maxPrice);
    }

    const [fields, total] = await Promise.all([
      prisma.field.findMany({
        where,
        skip,
        take: parseInt(limit),
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
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.field.count({ where })
    ]);

    res.json({
      fields,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get fields error:', error);
    res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

// Get fields by owner (must be before /:id to avoid "owner" being matched as id)
router.get('/owner/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;

    const fields = await prisma.field.findMany({
      where: {
        ownerId,
        isActive: true
      },
      include: {
        _count: {
          select: {
            reviews: true,
            bookings: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ fields });
  } catch (error) {
    console.error('Get owner fields error:', error);
    res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

// Get field availability for a specific date (must be before /:id to avoid route conflict)
router.get('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const field = await prisma.field.findUnique({
      where: { id },
      select: { id: true, isActive: true }
    });

    if (!field || !field.isActive) {
      return res.status(404).json({ error: 'Field not found or inactive' });
    }

    // Parse the date string (YYYY-MM-DD) and create UTC date range
    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // Check if the entire date is unavailable (locked by owner)
    const unavailableDate = await prisma.fieldUnavailableDate.findFirst({
      where: {
        fieldId: id,
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    if (unavailableDate) {
      return res.json({
        available: false,
        lockedByOwner: true,
        bookedSlots: [],
        message: 'This field is not available on the selected date'
      });
    }

    // Get all bookings for this field on this date (excluding cancelled)
    const bookings = await prisma.booking.findMany({
      where: {
        fieldId: id,
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          notIn: ['CANCELLED']
        }
      },
      select: {
        timeSlotStart: true,
        timeSlotEnd: true,
        timeSlotRanges: true,
        status: true,
        date: true
      }
    });

    // Build list of booked time slots (support timeSlotRanges for non-contiguous)
    const bookedSlots = [];
    bookings.forEach(booking => {
      const ranges = booking.timeSlotRanges && Array.isArray(booking.timeSlotRanges) ? booking.timeSlotRanges : [{ start: booking.timeSlotStart, end: booking.timeSlotEnd }];
      ranges.forEach(r => {
        const startHour = parseInt(String(r.start).split(':')[0], 10);
        const endHour = parseInt(String(r.end).split(':')[0], 10);
        for (let hour = startHour; hour < endHour; hour++) {
          const slotStart = `${hour.toString().padStart(2, '0')}:00`;
          if (!bookedSlots.includes(slotStart)) {
            bookedSlots.push(slotStart);
          }
        }
      });
    });

    res.json({
      available: true,
      lockedByOwner: false,
      bookedSlots: bookedSlots,
      debug: { bookingsFound: bookings.length, dateRange: { start: startOfDay.toISOString(), end: endOfDay.toISOString() } }
    });
  } catch (error) {
    console.error('Get field availability error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Get field by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const field = await prisma.field.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
            phone: true
          }
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            reviews: true,
            bookings: true
          }
        }
      }
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    res.json({ field });
  } catch (error) {
    console.error('Get field error:', error);
    res.status(500).json({ error: 'Failed to fetch field' });
  }
});

// Create field (Owner only)
router.post('/', authenticate, requireRole('OWNER', 'ADMIN'), [
  body('name').trim().notEmpty(),
  body('sport').trim().notEmpty(),
  body('type').isIn(['INDOOR', 'OUTDOOR']),
  body('location').trim().notEmpty(),
  body('pricePerHour').isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, sport, description, type, location, address, phone, pricePerHour, features, images, latitude, longitude } = req.body;

    // Check if owner is verified (if they're an owner)
    if (req.user.role === 'OWNER') {
      const owner = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { verificationStatus: true }
      });

      if (owner.verificationStatus !== 'APPROVED') {
        return res.status(403).json({ error: 'Owner verification required to create fields' });
      }
    }

    const field = await prisma.field.create({
      data: {
        name,
        sport,
        description,
        type,
        location,
        address,
        phone,
        pricePerHour: parseInt(pricePerHour),
        features: features || [],
        images: images || [],
        latitude: latitude != null ? parseFloat(latitude) : null,
        longitude: longitude != null ? parseFloat(longitude) : null,
        ownerId: req.user.id
      },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            avatar: true
          }
        }
      }
    });

    res.status(201).json({ message: 'Field created successfully', field });
  } catch (error) {
    console.error('Create field error:', error);
    res.status(500).json({ error: 'Failed to create field' });
  }
});

// Update field (Owner or Admin)
router.put('/:id', authenticate, [
  body('name').trim().optional(),
  body('sport').trim().optional(),
  body('type').isIn(['INDOOR', 'OUTDOOR']).optional(),
  body('pricePerHour').isInt({ min: 0 }).optional()
], async (req, res) => {
  try {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user owns the field or is admin
    const field = await prisma.field.findUnique({
      where: { id },
      select: { ownerId: true }
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    if (field.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = {};
    const allowedFields = ['name', 'sport', 'description', 'type', 'location', 'address', 'phone', 'pricePerHour', 'features', 'images', 'isActive', 'latitude', 'longitude'];
    
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (f === 'pricePerHour') {
          updateData[f] = parseInt(req.body[f]);
        } else if (f === 'latitude' || f === 'longitude') {
          updateData[f] = req.body[f] != null ? parseFloat(req.body[f]) : null;
        } else {
          updateData[f] = req.body[f];
        }
      }
    });

    const updatedField = await prisma.field.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            avatar: true
          }
        }
      }
    });

    res.json({ message: 'Field updated successfully', field: updatedField });
  } catch (error) {
    console.error('Update field error:', error);
    res.status(500).json({ error: 'Failed to update field' });
  }
});

// Delete field (Owner or Admin)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const field = await prisma.field.findUnique({
      where: { id },
      select: { ownerId: true }
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    if (field.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.field.delete({
      where: { id }
    });

    res.json({ message: 'Field deleted successfully' });
  } catch (error) {
    console.error('Delete field error:', error);
    res.status(500).json({ error: 'Failed to delete field' });
  }
});

module.exports = router;

