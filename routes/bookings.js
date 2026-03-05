const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all bookings (with filters)
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, fieldId, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // Regular users can only see their own bookings
    if (req.user.role === 'PLAYER') {
      where.OR = [
        { organizerId: req.user.id },
        { participants: { some: { userId: req.user.id } } }
      ];
    } else if (req.user.role === 'OWNER') {
      // Owners can see bookings for their fields
      where.field = { ownerId: req.user.id };
    }

    if (status) where.status = status;
    if (fieldId) where.fieldId = fieldId;
    if (userId && req.user.role === 'ADMIN') {
      where.OR = [
        { organizerId: userId },
        { participants: { some: { userId } } }
      ];
    }

    const [bookingsRaw, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          field: {
            select: {
              id: true,
              name: true,
              sport: true,
              location: true,
              images: true,
              pricePerHour: true
            }
          },
          organizer: {
            select: {
              id: true,
              fullName: true,
              avatar: true,
              email: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: true
                }
              }
            }
          }
        },
        orderBy: { date: 'desc' }
      }),
      prisma.booking.count({ where })
    ]);

    // Ensure each booking appears only once (e.g. if OR + relations ever produced duplicates)
    const seen = new Set();
    const bookings = bookingsRaw.filter((b) => {
      const id = b.id ? String(b.id) : null;
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get booking by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        field: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
                phone: true
              }
            }
          }
        },
        organizer: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
            email: true,
            phone: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check access
    const isOrganizer = booking.organizerId === req.user.id;
    const isParticipant = booking.participants.some(p => p.userId === req.user.id);
    const isFieldOwner = booking.field.ownerId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOrganizer && !isParticipant && !isFieldOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Create booking
router.post('/', authenticate, [
  body('fieldId').notEmpty(),
  body('date').isISO8601(),
  body('timeSlotStart').notEmpty(),
  body('timeSlotEnd').notEmpty(),
  body('paymentMethod').isIn(['ORGANIZER', 'SPLIT', 'MIXED']),
  body('teamSize').isInt({ min: 1 }).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fieldId, date, timeSlotStart, timeSlotEnd, paymentMethod, teamSize, mixedPaymentDistribution, timeSlotRanges } = req.body;

    // Check if field exists and is active
    const field = await prisma.field.findUnique({
      where: { id: fieldId }
    });

    if (!field || !field.isActive) {
      return res.status(404).json({ error: 'Field not found or inactive' });
    }

    // Total cost: sum hours from timeSlotRanges if provided, else single range
    let totalCost;
    const ranges = Array.isArray(timeSlotRanges) && timeSlotRanges.length > 0 ? timeSlotRanges : [{ start: timeSlotStart, end: timeSlotEnd }];
    let totalHours = 0;
    ranges.forEach(r => {
      const sh = parseInt(String(r.start).split(':')[0], 10);
      const eh = parseInt(String(r.end).split(':')[0], 10);
      totalHours += (eh - sh);
    });
    totalCost = Math.round((field.pricePerHour || 0) * totalHours);

    // Create booking (timeSlotStart/timeSlotEnd = first range for backward compat)
    const firstRange = ranges[0];
    const booking = await prisma.booking.create({
      data: {
        fieldId,
        organizerId: req.user.id,
        date: new Date(date),
        timeSlotStart: firstRange.start,
        timeSlotEnd: firstRange.end,
        timeSlotRanges: ranges.length > 1 ? ranges : null,
        totalCost,
        paymentMethod,
        teamSize: teamSize || 1,
        mixedPaymentDistribution: paymentMethod === 'MIXED' ? mixedPaymentDistribution : null,
        status: 'PENDING',
        organizerPaymentStatus: paymentMethod === 'ORGANIZER' ? 'PENDING' : null
      },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            sport: true,
            location: true
          }
        },
        organizer: {
          select: {
            id: true,
            fullName: true,
            avatar: true
          }
        }
      }
    });

    res.status(201).json({ message: 'Booking created successfully', booking });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Update booking status
router.put('/:id/status', authenticate, [
  body('status').isIn(['PENDING', 'UPCOMING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'])
], async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { field: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check permissions
    const isOrganizer = booking.organizerId === req.user.id;
    const isFieldOwner = booking.field.ownerId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOrganizer && !isFieldOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = { status };
    if (status === 'CONFIRMED' && !booking.confirmedAt) {
      updateData.confirmedAt = new Date();
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        field: true,
        organizer: true,
        participants: {
          include: { user: true }
        }
      }
    });

    res.json({ message: 'Booking status updated', booking: updatedBooking });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Reschedule booking (change date/time) - must be at least 24h before original start
router.put('/:id/reschedule', authenticate, [
  body('date').isISO8601(),
  body('timeSlotStart').notEmpty(),
  body('timeSlotEnd').notEmpty()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { date, timeSlotStart, timeSlotEnd, timeSlotRanges } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { field: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only organizer, field owner or admin can reschedule
    const isOrganizer = booking.organizerId === req.user.id;
    const isFieldOwner = booking.field.ownerId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOrganizer && !isFieldOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Compute original start datetime
    const originalDateStr = booking.date.toISOString().split('T')[0];
    const originalStart = new Date(`${originalDateStr}T${booking.timeSlotStart}`);
    const now = new Date();
    const hoursUntilStart = (originalStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilStart < 24) {
      return res.status(400).json({ error: 'You cannot reschedule a booking less than 24 hours before its start time.' });
    }

    // Recalculate total cost based on new time ranges (supports non-contiguous)
    const ranges = Array.isArray(timeSlotRanges) && timeSlotRanges.length > 0
      ? timeSlotRanges
      : [{ start: timeSlotStart, end: timeSlotEnd }];
    let totalHours = 0;
    ranges.forEach((r) => {
      const sh = parseInt(String(r.start).split(':')[0], 10);
      const eh = parseInt(String(r.end).split(':')[0], 10);
      totalHours += (eh - sh);
    });
    if (totalHours <= 0) {
      return res.status(400).json({ error: 'End time must be after start time.' });
    }
    const totalCost = Math.round(booking.field.pricePerHour * totalHours);

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        date: new Date(date),
        timeSlotStart: ranges[0].start,
        timeSlotEnd: ranges[ranges.length - 1].end,
        timeSlotRanges: ranges.length > 1 ? ranges : null,
        totalCost
      },
      include: {
        field: true,
        organizer: true,
        participants: {
          include: { user: true }
        }
      }
    });

    res.json({ message: 'Booking rescheduled', booking: updated });
  } catch (error) {
    console.error('Reschedule booking error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

// Add participant to booking
router.post('/:id/participants', authenticate, [
  body('userId').notEmpty()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { participants: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only organizer can add participants
    if (booking.organizerId !== req.user.id) {
      return res.status(403).json({ error: 'Only organizer can add participants' });
    }

    // Check if user is already a participant
    if (booking.participants.some(p => p.userId === userId)) {
      return res.status(400).json({ error: 'User is already a participant' });
    }

    // Calculate payment amount based on payment method
    let paymentAmount = null;
    if (booking.paymentMethod === 'SPLIT') {
      paymentAmount = Math.round(booking.totalCost / (booking.teamSize || 1));
    } else if (booking.paymentMethod === 'MIXED' && booking.mixedPaymentDistribution) {
      paymentAmount = booking.mixedPaymentDistribution[userId] || null;
    }

    const participant = await prisma.bookingParticipant.create({
      data: {
        bookingId: id,
        userId,
        paymentAmount,
        paymentStatus: 'PENDING'
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

    res.status(201).json({ message: 'Participant added', participant });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

// Remove current user as participant (leave booking)
router.delete('/:id/participants/me', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { participants: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const participant = booking.participants.find(p => p.userId === req.user.id);
    if (!participant) {
      return res.status(400).json({ error: 'You are not a participant in this booking' });
    }

    await prisma.bookingParticipant.delete({
      where: { id: participant.id }
    });

    res.json({ message: 'Successfully left the booking' });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Failed to leave booking' });
  }
});

module.exports = router;

