const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { totalCostFromFieldPrice, totalHoursFromRanges } = require('../lib/bookingPricing');
const { isMongoObjectIdString, mongoBookingSetFields } = require('../lib/mongoBookingWrite');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

function timeToMinutes(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function ymdFromDateLike(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function dayNameFromYmdUtc(ymd) {
  const parts = String(ymd || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0));
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getUTCDay()] || null;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

async function validateBookingWindow(field, dateValue, ranges, excludeBookingId) {
  const ymd = ymdFromDateLike(dateValue);
  if (!ymd) return 'Invalid booking date.';

  const [year, month, day] = ymd.split('-').map(Number);
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  const dayLocked = await prisma.fieldUnavailableDate.findFirst({
    where: {
      fieldId: field.id,
      date: { gte: startOfDay, lte: endOfDay }
    },
    select: { id: true }
  });
  if (dayLocked) return 'This field is not available on the selected date.';

  const dayName = dayNameFromYmdUtc(ymd);
  const schedule = field.schedule && typeof field.schedule === 'object' ? field.schedule : null;
  const dayCfg = dayName && schedule ? schedule[dayName] : null;
  const dayEnabled = dayCfg ? dayCfg.enabled !== false : true;
  if (!dayEnabled) return 'This field is closed on the selected day.';

  let openingMins = 9 * 60;
  let closingMins = 22 * 60;
  if (dayCfg) {
    openingMins = timeToMinutes(dayCfg.opening);
    closingMins = timeToMinutes(dayCfg.closing);
    if (openingMins == null || closingMins == null || closingMins <= openingMins) {
      return 'Field schedule is invalid for this day.';
    }
  }

  for (const r of ranges) {
    const start = timeToMinutes(r && r.start);
    const end = timeToMinutes(r && r.end);
    if (start == null || end == null || end <= start) return 'Invalid time range.';
    if (start < openingMins || end > closingMins) return 'Selected time is outside the field working schedule.';
  }

  const existingBookings = await prisma.booking.findMany({
    where: {
      fieldId: field.id,
      date: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ['CANCELLED'] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {})
    },
    select: {
      id: true,
      timeSlotStart: true,
      timeSlotEnd: true,
      timeSlotRanges: true
    }
  });

  for (const b of existingBookings) {
    const bookingRanges = Array.isArray(b.timeSlotRanges) && b.timeSlotRanges.length
      ? b.timeSlotRanges
      : [{ start: b.timeSlotStart, end: b.timeSlotEnd }];
    for (const nr of ranges) {
      const nStart = timeToMinutes(nr.start);
      const nEnd = timeToMinutes(nr.end);
      for (const br of bookingRanges) {
        const bStart = timeToMinutes(br.start);
        const bEnd = timeToMinutes(br.end);
        if (nStart != null && nEnd != null && bStart != null && bEnd != null && rangesOverlap(nStart, nEnd, bStart, bEnd)) {
          return 'One or more selected slots are already booked.';
        }
      }
    }
  }

  return null;
}

// Get all bookings (with filters)
router.get('/', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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

    // Check access (string-compare ids — Mongo / JWT may differ in type)
    const uid = String(req.user.id);
    const isOrganizer = String(booking.organizerId) === uid;
    const isParticipant = booking.participants.some(p => String(p.userId) === uid);
    const isFieldOwner = String(booking.field.ownerId) === uid;
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
router.post('/', [
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
      where: { id: fieldId },
      select: { id: true, isActive: true, pricePerHour: true, schedule: true }
    });

    if (!field || !field.isActive) {
      return res.status(404).json({ error: 'Field not found or inactive' });
    }

    // Total cost: sum fractional hours from ranges (minutes respected, e.g. 18:00–19:30 = 1.5h)
    const ranges = Array.isArray(timeSlotRanges) && timeSlotRanges.length > 0 ? timeSlotRanges : [{ start: timeSlotStart, end: timeSlotEnd }];
    const totalHours = totalHoursFromRanges(ranges);
    if (totalHours <= 0) {
      return res.status(400).json({ error: 'End time must be after start time.' });
    }
    const bookingWindowError = await validateBookingWindow(field, date, ranges, null);
    if (bookingWindowError) {
      return res.status(400).json({ error: bookingWindowError });
    }
    const totalCost = totalCostFromFieldPrice(field.pricePerHour, ranges);

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
router.put('/:id/status', [
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

    const uid = String(req.user.id);
    const isOrganizer = String(booking.organizerId) === uid;
    const isFieldOwner = String(booking.field.ownerId) === uid;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOrganizer && !isFieldOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const prev = booking.status;
    // Approve pending requests (confirm): only venue owner or admin
    if (prev === 'PENDING' && (status === 'CONFIRMED' || status === 'UPCOMING')) {
      if (!isFieldOwner && !isAdmin) {
        return res.status(403).json({ error: 'Only the field owner can approve booking requests.' });
      }
    }
    // Decline / withdraw while still pending: owner, admin, or organizer
    if (prev === 'PENDING' && status === 'CANCELLED') {
      if (!isFieldOwner && !isAdmin && !isOrganizer) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (!isMongoObjectIdString(id)) {
      return res.status(400).json({ error: 'Invalid booking id' });
    }

    const $set = { status };
    if ((status === 'CONFIRMED' || status === 'UPCOMING') && !booking.confirmedAt) {
      $set.confirmed_at = new Date();
    }

    let matched;
    try {
      matched = await mongoBookingSetFields(id, $set);
    } catch (err) {
      console.error('Update booking error:', err);
      return res.status(500).json({ error: 'Failed to update booking' });
    }
    if (!matched) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const updatedBooking = await prisma.booking.findUnique({
      where: { id },
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
router.put('/:id/reschedule', [
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

    const uid = String(req.user.id);
    const isOrganizer = String(booking.organizerId) === uid;
    const isFieldOwner = String(booking.field.ownerId) === uid;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOrganizer && !isFieldOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!isMongoObjectIdString(id)) {
      return res.status(400).json({ error: 'Invalid booking id' });
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
    const totalHours = totalHoursFromRanges(ranges);
    if (totalHours <= 0) {
      return res.status(400).json({ error: 'End time must be after start time.' });
    }
    const rescheduleWindowError = await validateBookingWindow(booking.field, date, ranges, id);
    if (rescheduleWindowError) {
      return res.status(400).json({ error: rescheduleWindowError });
    }
    const totalCost = totalCostFromFieldPrice(booking.field.pricePerHour, ranges);

    const $set = {
      date: new Date(date),
      time_slot_start: ranges[0].start,
      time_slot_end: ranges[ranges.length - 1].end,
      time_slot_ranges: ranges.length > 1 ? ranges : null,
      total_cost: totalCost
    };

    let matched;
    try {
      matched = await mongoBookingSetFields(id, $set);
    } catch (err) {
      console.error('Reschedule booking error:', err);
      return res.status(500).json({ error: 'Failed to reschedule booking' });
    }
    if (!matched) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const updated = await prisma.booking.findUnique({
      where: { id },
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
router.post('/:id/participants', [
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
router.delete('/:id/participants/me', async (req, res) => {
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

