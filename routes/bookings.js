const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { isUuid } = require('../lib/ids');
const { toMinor, toMajor } = require('../lib/money');
const { totalHoursFromRanges, totalCostFromFieldPrice } = require('../lib/bookingPricing');
const { earliestAllowedSlotStartMinutesForYmd } = require('../lib/bookingSameDayRules');
const { serializeBooking, scheduleFromOpeningHours, hmToMinutes, DAY_NAMES } = require('../lib/serializers');
const { createUserNotification } = require('../lib/notifications');
const { writeAuditLog } = require('../lib/audit');
const {
  evaluateBookingPayment,
  settleManualShare,
  isInstantBookingField
} = require('../lib/bookingPayment');
const { buildPaymentSharesForCreate, equalSplitAmounts } = require('../lib/bookingShares');

const router = express.Router();
router.use(authenticate);

function ymdFromDateLike(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function dayNameFromYmdUtc(ymd) {
  const parts = String(ymd || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0));
  return DAY_NAMES[d.getUTCDay()] || null;
}

function utcDateTimeFromYmdAndHm(ymd, hm) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const mins = hmToMinutes(hm);
  if (!y || !m || !d || mins == null) return null;
  return new Date(Date.UTC(y, m - 1, d, Math.floor(mins / 60), mins % 60, 0, 0));
}

function expandHourlySlots(startAt, endAt) {
  const slots = [];
  // Normalize to UTC hour boundaries for consistent unique([fieldId, startAt]) locking
  const cursor = new Date(startAt.getTime());
  cursor.setUTCMinutes(0, 0, 0);
  const endNorm = new Date(endAt.getTime());
  if (endNorm.getUTCMinutes() !== 0 || endNorm.getUTCSeconds() !== 0) {
    // If end is not on the hour, include the partial final hour start
  }
  let t = cursor.getTime();
  const endMs = endAt.getTime();
  while (t < endMs) {
    const slotStart = new Date(t);
    const next = t + 60 * 60 * 1000;
    const slotEnd = new Date(Math.min(next, endMs));
    // Always store startAt on the hour for uniqueness
    const normalizedStart = new Date(slotStart);
    normalizedStart.setUTCMinutes(0, 0, 0);
    slots.push({ startAt: normalizedStart, endAt: slotEnd });
    t = next;
  }
  // Dedupe by startAt
  const seen = new Set();
  return slots.filter((s) => {
    const key = s.startAt.toISOString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  const dayBlocked = await prisma.fieldBlockedSlot.findFirst({
    where: {
      fieldId: field.id,
      startAt: { lte: endOfDay },
      endAt: { gte: startOfDay }
    },
    select: { id: true, startAt: true, endAt: true }
  });

  const schedule =
    field.schedule ||
    scheduleFromOpeningHours(
      field.openingHours ||
        (await prisma.fieldOpeningHour.findMany({ where: { fieldId: field.id } }))
    );
  const dayName = dayNameFromYmdUtc(ymd);
  const dayCfg = dayName && schedule ? schedule[dayName] : null;
  if (dayCfg && dayCfg.enabled === false) return 'This field is closed on the selected day.';

  let openingMins = 9 * 60;
  let closingMins = 22 * 60;
  if (dayCfg) {
    openingMins = hmToMinutes(dayCfg.opening);
    closingMins = hmToMinutes(dayCfg.closing);
    if (openingMins == null || closingMins == null || closingMins <= openingMins) {
      return 'Field schedule is invalid for this day.';
    }
  }

  const earliestSameDay = earliestAllowedSlotStartMinutesForYmd(ymd);

  for (const r of ranges) {
    const start = hmToMinutes(r && r.start);
    const end = hmToMinutes(r && r.end);
    if (start == null || end == null || end <= start) return 'Invalid time range.';
    if (earliestSameDay != null && start < earliestSameDay) {
      return 'You cannot book time slots before the current hour.';
    }
    if (start < openingMins || end > closingMins) {
      return 'Selected time is outside the field working schedule.';
    }

    const rangeStart = utcDateTimeFromYmdAndHm(ymd, r.start);
    const rangeEnd = utcDateTimeFromYmdAndHm(ymd, r.end);
    if (!rangeStart || !rangeEnd) return 'Invalid time range.';

    if (dayBlocked) {
      const blocks = await prisma.fieldBlockedSlot.findMany({
        where: {
          fieldId: field.id,
          startAt: { lt: rangeEnd },
          endAt: { gt: rangeStart }
        }
      });
      if (blocks.length) {
        const allDay = blocks.some((b) => {
          const bs = b.startAt.getUTCHours() * 60 + b.startAt.getUTCMinutes();
          const be = b.endAt.getUTCHours() * 60 + b.endAt.getUTCMinutes();
          return bs === 0 && be >= 23 * 60;
        });
        if (allDay) return 'This field is not available on the selected date.';
        return 'One or more selected slots are blocked by the owner.';
      }
    }
  }

  const existingBookings = await prisma.booking.findMany({
    where: {
      fieldId: field.id,
      status: { notIn: ['CANCELLED', 'EXPIRED'] },
      startAt: { lt: endOfDay },
      endAt: { gt: startOfDay },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {})
    },
    select: { id: true, startAt: true, endAt: true, slots: true }
  });

  for (const b of existingBookings) {
    for (const nr of ranges) {
      const nStart = utcDateTimeFromYmdAndHm(ymd, nr.start);
      const nEnd = utcDateTimeFromYmdAndHm(ymd, nr.end);
      if (!nStart || !nEnd) continue;
      if (rangesOverlap(nStart, nEnd, b.startAt, b.endAt)) {
        return 'One or more selected slots are already booked.';
      }
    }
  }

  return null;
}

function mapStatusForDb(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'UPCOMING') return 'CONFIRMED';
  return s;
}

function bookingInclude() {
  return {
    field: {
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        amenities: true,
        openingHours: true,
        owner: { select: { id: true, fullName: true, avatarUrl: true, phone: true } }
      }
    },
    organizer: {
      select: { id: true, fullName: true, avatarUrl: true, email: true, phone: true }
    },
    participants: {
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true, email: true } }
      }
    },
    slots: true,
    paymentShares: true
  };
}

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, fieldId, userId } = req.query;
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;
    const where = {};

    if (req.user.role === 'PLAYER') {
      where.OR = [
        { organizerId: req.user.id },
        { participants: { some: { userId: req.user.id } } }
      ];
    } else if (req.user.role === 'OWNER') {
      where.field = { ownerId: req.user.id };
    }

    if (status) {
      const mapped = mapStatusForDb(status);
      if (mapped === 'CONFIRMED') where.status = { in: ['CONFIRMED'] };
      else where.status = mapped;
    }
    if (fieldId && isUuid(fieldId)) where.fieldId = fieldId;
    if (userId && req.user.role === 'ADMIN' && isUuid(userId)) {
      where.OR = [
        { organizerId: userId },
        { participants: { some: { userId } } }
      ];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take,
        include: bookingInclude(),
        orderBy: { startAt: 'desc' }
      }),
      prisma.booking.count({ where })
    ]);

    res.json({
      bookings: bookings.map(serializeBooking),
      pagination: {
        page: Math.max(1, parseInt(page, 10) || 1),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid booking id' });

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: bookingInclude()
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const uid = String(req.user.id);
    const isOrganizer = String(booking.organizerId) === uid;
    const isParticipant = booking.participants.some((p) => String(p.userId) === uid);
    const isFieldOwner = String(booking.field.ownerId) === uid;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOrganizer && !isParticipant && !isFieldOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ booking: serializeBooking(booking) });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

router.post(
  '/',
  [
    body('fieldId').notEmpty(),
    body('date').isISO8601(),
    body('timeSlotStart').notEmpty(),
    body('timeSlotEnd').notEmpty(),
    body('paymentMethod').isIn(['ORGANIZER', 'SPLIT', 'MIXED']),
    body('teamSize').isInt({ min: 1 }).optional(),
    body('participantIds').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        fieldId,
        date,
        timeSlotStart,
        timeSlotEnd,
        paymentMethod,
        teamSize,
        mixedPaymentDistribution,
        timeSlotRanges,
        participantIds
      } = req.body;

      if (!isUuid(fieldId)) {
        return res.status(400).json({ error: 'Invalid field id' });
      }

      const field = await prisma.field.findFirst({
        where: {
          id: fieldId,
          isActive: true,
          deletedAt: null,
          moderationStatus: 'APPROVED'
        },
        include: { openingHours: true }
      });
      if (!field) {
        return res.status(404).json({ error: 'Field not found or inactive' });
      }

      const ranges =
        Array.isArray(timeSlotRanges) && timeSlotRanges.length > 0
          ? timeSlotRanges
          : [{ start: timeSlotStart, end: timeSlotEnd }];
      const totalHours = totalHoursFromRanges(ranges);
      if (totalHours <= 0) {
        return res.status(400).json({ error: 'End time must be after start time.' });
      }

      const bookingWindowError = await validateBookingWindow(field, date, ranges, null);
      if (bookingWindowError) {
        return res.status(400).json({ error: bookingWindowError });
      }

      const ymd = ymdFromDateLike(date);
      const startAt = utcDateTimeFromYmdAndHm(ymd, ranges[0].start);
      const endAt = utcDateTimeFromYmdAndHm(ymd, ranges[ranges.length - 1].end);
      if (!startAt || !endAt) {
        return res.status(400).json({ error: 'Invalid booking date/time' });
      }

      const hourlySlots = [];
      for (const r of ranges) {
        const rs = utcDateTimeFromYmdAndHm(ymd, r.start);
        const re = utcDateTimeFromYmdAndHm(ymd, r.end);
        if (!rs || !re) continue;
        hourlySlots.push(...expandHourlySlots(rs, re));
      }
      if (!hourlySlots.length) {
        return res.status(400).json({ error: 'No bookable slots in the selected range.' });
      }

      // Validate invitees exist and are players before entering the transaction
      const inviteeIds = Array.isArray(participantIds)
        ? [...new Set(participantIds.map((id) => String(id)).filter((id) => isUuid(id) && id !== req.user.id))]
        : [];
      if (inviteeIds.length) {
        const users = await prisma.user.findMany({
          where: { id: { in: inviteeIds }, deletedAt: null, status: 'ACTIVE' },
          select: { id: true, role: true }
        });
        if (users.length !== inviteeIds.length) {
          return res.status(400).json({ error: 'One or more participantIds are invalid' });
        }
        if (users.some((u) => u.role !== 'PLAYER')) {
          return res.status(400).json({ error: 'Only players can be invited to a booking' });
        }
      }

      let booking;
      try {
        booking = await prisma.$transaction(async (tx) => {
          // Re-check slot conflicts inside the transaction (TOCTOU hardening)
          const slotStarts = hourlySlots.map((s) => s.startAt);
          const conflict = await tx.bookingSlot.findFirst({
            where: {
              fieldId,
              startAt: { in: slotStarts }
            },
            select: { id: true }
          });
          if (conflict) {
            const err = new Error('One or more selected slots are already booked.');
            err.code = 'P2002';
            throw err;
          }

          // Server-side pricing only (minor units) inside the same transaction boundary
          const totalMajor = totalCostFromFieldPrice(toMajor(field.pricePerHour), ranges);
          const totalCost = toMinor(totalMajor);

          const sharePlan = buildPaymentSharesForCreate({
            paymentMethod,
            totalCost,
            organizerId: req.user.id,
            participantIds: inviteeIds,
            teamSize,
            mixedPaymentDistribution,
            toMinor
          });
          if (sharePlan.error) {
            const err = new Error(sharePlan.error);
            err.status = 400;
            throw err;
          }

          const participantCreates = [
            { userId: req.user.id, status: 'ACCEPTED', isOrganizer: true },
            ...inviteeIds.map((uid) => ({
              userId: uid,
              status: 'INVITED',
              isOrganizer: false
            }))
          ];

          const created = await tx.booking.create({
            data: {
              fieldId,
              organizerId: req.user.id,
              startAt,
              endAt,
              teamSize: sharePlan.teamSize,
              currency: field.currency || 'ILS',
              subtotal: totalCost,
              serviceFee: 0,
              totalCost,
              paymentMethod,
              status: 'PENDING',
              participants: { create: participantCreates },
              slots: {
                create: hourlySlots.map((s) => ({
                  fieldId,
                  startAt: s.startAt,
                  endAt: s.endAt
                }))
              },
              paymentShares: {
                create: sharePlan.shares
              }
            }
          });

          return tx.booking.findUnique({
            where: { id: created.id },
            include: bookingInclude()
          });
        });
      } catch (err) {
        if (err.code === 'P2002') {
          return res.status(409).json({ error: 'One or more selected slots are already booked.' });
        }
        if (err.status === 400) {
          return res.status(400).json({ error: err.message });
        }
        throw err;
      }

      res.status(201).json({
        message: 'Booking created successfully',
        booking: serializeBooking(booking)
      });
    } catch (error) {
      console.error('Create booking error:', error);
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'One or more selected slots are already booked.' });
      }
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }
);

router.put(
  '/:id/status',
  [body('status').isIn(['PENDING', 'UPCOMING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'])],
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!isUuid(id)) return res.status(400).json({ error: 'Invalid booking id' });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const status = mapStatusForDb(req.body.status);
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          field: true,
          participants: { select: { userId: true } },
          paymentShares: true
        }
      });
      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      const uid = String(req.user.id);
      const isOrganizer = String(booking.organizerId) === uid;
      const isFieldOwner = String(booking.field.ownerId) === uid;
      const isAdmin = req.user.role === 'ADMIN';
      const isParticipant = (booking.participants || []).some((p) => String(p.userId) === uid);
      const prev = booking.status;
      const instantField = isInstantBookingField(booking.field);

      // Idempotent cancel/expire: already in terminal state
      if (
        (status === 'CANCELLED' && prev === 'CANCELLED') ||
        (status === 'EXPIRED' && prev === 'EXPIRED')
      ) {
        await prisma.bookingSlot.deleteMany({ where: { bookingId: id } });
        const current = await prisma.booking.findUnique({
          where: { id },
          include: bookingInclude()
        });
        return res.json({
          message: 'Booking status unchanged',
          booking: serializeBooking(current)
        });
      }

      const participantInstantFinalize =
        isParticipant &&
        !isOrganizer &&
        !isFieldOwner &&
        !isAdmin &&
        prev === 'PENDING' &&
        status === 'CONFIRMED' &&
        instantField;

      if (!isOrganizer && !isFieldOwner && !isAdmin && !participantInstantFinalize) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (prev === 'PENDING' && status === 'CONFIRMED') {
        if (isFieldOwner && !isAdmin && instantField) {
          return res.status(403).json({
            error:
              'This field uses instant booking. Reservations are not approved here — they confirm when players complete payment (or you may cancel a pending booking if needed).'
          });
        }
        const ownerOrAdmin = isFieldOwner || isAdmin;
        const organizerInstant = isOrganizer && instantField;
        const participantInstant = isParticipant && !isOrganizer && instantField;
        if (!ownerOrAdmin && !organizerInstant && !participantInstant) {
          return res.status(403).json({
            error: isOrganizer
              ? 'This field uses request-based booking. The owner must approve before it can be confirmed.'
              : 'Only the field owner can approve booking requests.'
          });
        }

        // C2: server payment state is the only source of truth for confirmation
        const paymentEval = await evaluateBookingPayment(id);
        if (!paymentEval.ok) {
          return res.status(402).json({
            error: 'Booking cannot be confirmed until all required payments are settled on the server',
            detail: paymentEval.reason
          });
        }
      }

      if (prev === 'PENDING' && status === 'CANCELLED') {
        if (!isFieldOwner && !isAdmin && !isOrganizer) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      if (status === 'COMPLETED' && prev === 'COMPLETED') {
        const current = await prisma.booking.findUnique({
          where: { id },
          include: bookingInclude()
        });
        return res.json({
          message: 'Booking status unchanged',
          booking: serializeBooking(current)
        });
      }

      const data = { status };
      if (status === 'CONFIRMED' && !booking.confirmedAt) data.confirmedAt = new Date();
      if (status === 'CANCELLED') data.cancelledAt = new Date();

      const releaseSlots = status === 'CANCELLED' || status === 'EXPIRED';

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.booking.update({
          where: { id },
          data,
          include: bookingInclude()
        });
        if (releaseSlots) {
          await tx.bookingSlot.deleteMany({ where: { bookingId: id } });
        }
        return row;
      });

      if (prev === 'PENDING' && status === 'CANCELLED' && (isFieldOwner || isAdmin) && !isOrganizer) {
        try {
          await createUserNotification({
            title: 'Booking Rejected',
            message: `Your booking at ${booking.field.name || 'your booking'} was rejected by the field owner.`,
            type: 'BOOKING',
            targetUserId: booking.organizerId,
            sentById: req.user.id
          });
        } catch (notifyErr) {
          console.error('Booking rejection notification error:', notifyErr);
        }
        await writeAuditLog({
          actorId: req.user.id,
          action: 'OTHER',
          entityType: 'Booking',
          entityId: id,
          metadata: { from: prev, to: status },
          req
        });
      }

      if (status === 'CANCELLED' || status === 'EXPIRED') {
        await writeAuditLog({
          actorId: req.user.id,
          action: 'OTHER',
          entityType: 'Booking',
          entityId: id,
          metadata: { action: status === 'EXPIRED' ? 'expire' : 'cancel', from: prev },
          req
        });
      }

      res.json({ message: 'Booking status updated', booking: serializeBooking(updated) });
    } catch (error) {
      console.error('Update booking error:', error);
      res.status(500).json({ error: 'Failed to update booking' });
    }
  }
);

/**
 * MANUAL payment settlement — server records PaymentShare + Payment as PAID.
 * Never accepts or stores card numbers / CVV / expiry.
 * Instant bookings auto-confirm in the same transaction when fully paid.
 */
router.post(
  '/:id/payments/manual-settle',
  [body('userId').optional().isString()],
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!isUuid(id)) return res.status(400).json({ error: 'Invalid booking id' });

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          field: { select: { ownerId: true, bookingType: true } },
          participants: { select: { userId: true } },
          paymentShares: true
        }
      });
      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      const uid = String(req.user.id);
      const isAdmin = req.user.role === 'ADMIN';
      const isFieldOwner = String(booking.field.ownerId) === uid;
      const isOrganizer = String(booking.organizerId) === uid;
      const isParticipant = (booking.participants || []).some((p) => String(p.userId) === uid);

      let payerUserId = uid;
      if (req.body.userId && String(req.body.userId) !== uid) {
        if (!isAdmin && !isFieldOwner && !isOrganizer) {
          return res.status(403).json({ error: 'Cannot settle payment for another user' });
        }
        if (!isUuid(String(req.body.userId))) {
          return res.status(400).json({ error: 'Invalid user id' });
        }
        payerUserId = String(req.body.userId);
      } else if (!isParticipant && !isOrganizer && !isAdmin && !isFieldOwner) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Reject any client attempt to send card material (defense in depth)
      const forbiddenKeys = ['cardNumber', 'cvv', 'expiry', 'expiryDate', 'card'];
      for (const k of forbiddenKeys) {
        if (req.body && req.body[k] != null) {
          return res.status(400).json({
            error: 'Card details must not be sent to the server. Use the manual settlement flow only.'
          });
        }
      }

      let requestedAmountMinor;
      if (req.body.amount != null || req.body.amountMinor != null) {
        if (req.body.amountMinor != null) {
          requestedAmountMinor = Math.round(Number(req.body.amountMinor));
        } else {
          requestedAmountMinor = toMinor(req.body.amount);
        }
      }

      const result = await settleManualShare({
        bookingId: id,
        payerUserId,
        actorUserId: uid,
        requestedAmountMinor
      });

      await writeAuditLog({
        actorId: uid,
        action: 'OTHER',
        entityType: 'Payment',
        entityId: result.payment?.id || id,
        metadata: {
          action: 'manual_settle',
          bookingId: id,
          payerUserId,
          confirmed: result.confirmed,
          fullyPaid: result.fullyPaid,
          idempotent: result.idempotent
        },
        req
      });

      res.json({
        message: result.confirmed
          ? 'Payment settled and booking confirmed'
          : result.fullyPaid
            ? 'Payment settled; booking is fully paid'
            : result.idempotent
              ? 'Payment share already settled'
              : 'Payment share settled',
        fullyPaid: result.fullyPaid,
        confirmed: result.confirmed,
        idempotent: !!result.idempotent,
        booking: serializeBooking(result.booking)
      });
    } catch (error) {
      console.error('Manual settle error:', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Failed to settle payment' });
    }
  }
);

router.put(
  '/:id/reschedule',
  [body('date').isISO8601(), body('timeSlotStart').notEmpty(), body('timeSlotEnd').notEmpty()],
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!isUuid(id)) return res.status(400).json({ error: 'Invalid booking id' });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { date, timeSlotStart, timeSlotEnd, timeSlotRanges } = req.body;
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { field: { include: { openingHours: true } } }
      });
      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      const uid = String(req.user.id);
      const isOrganizer = String(booking.organizerId) === uid;
      const isFieldOwner = String(booking.field.ownerId) === uid;
      const isAdmin = req.user.role === 'ADMIN';
      if (!isOrganizer && !isFieldOwner && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const hoursUntilStart = (booking.startAt.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilStart < 24) {
        return res.status(400).json({
          error: 'You cannot reschedule a booking less than 24 hours before its start time.'
        });
      }

      const ranges =
        Array.isArray(timeSlotRanges) && timeSlotRanges.length > 0
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

      const ymd = ymdFromDateLike(date);
      const startAt = utcDateTimeFromYmdAndHm(ymd, ranges[0].start);
      const endAt = utcDateTimeFromYmdAndHm(ymd, ranges[ranges.length - 1].end);
      const totalMajor = totalCostFromFieldPrice(toMajor(booking.field.pricePerHour), ranges);
      const totalCost = toMinor(totalMajor);

      const hourlySlots = [];
      for (const r of ranges) {
        const rs = utcDateTimeFromYmdAndHm(ymd, r.start);
        const re = utcDateTimeFromYmdAndHm(ymd, r.end);
        if (!rs || !re) continue;
        hourlySlots.push(...expandHourlySlots(rs, re));
      }

      let updated;
      try {
        updated = await prisma.$transaction(async (tx) => {
          await tx.bookingSlot.deleteMany({ where: { bookingId: id } });
          await tx.booking.update({
            where: { id },
            data: {
              startAt,
              endAt,
              subtotal: totalCost,
              totalCost,
              slots: {
                create: hourlySlots.map((s) => ({
                  fieldId: booking.fieldId,
                  startAt: s.startAt,
                  endAt: s.endAt
                }))
              }
            }
          });
          return tx.booking.findUnique({
            where: { id },
            include: bookingInclude()
          });
        });
      } catch (err) {
        if (err.code === 'P2002') {
          return res.status(409).json({ error: 'One or more selected slots are already booked.' });
        }
        throw err;
      }

      res.json({ message: 'Booking rescheduled', booking: serializeBooking(updated) });
    } catch (error) {
      console.error('Reschedule booking error:', error);
      res.status(500).json({ error: 'Failed to reschedule booking' });
    }
  }
);

router.post(
  '/:id/participants',
  [body('userId').notEmpty()],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      if (!isUuid(id) || !isUuid(userId)) {
        return res.status(400).json({ error: 'Invalid id' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { participants: true, paymentShares: true }
      });
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      if (String(booking.organizerId) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Only organizer can add participants' });
      }
      if (booking.participants.some((p) => String(p.userId) === String(userId))) {
        return res.status(400).json({ error: 'User is already a participant' });
      }

      const invitee = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true }
      });
      if (!invitee) return res.status(404).json({ error: 'User not found' });
      if (invitee.role !== 'PLAYER') {
        return res.status(400).json({ error: 'Only players can be invited to a booking.' });
      }

      const participant = await prisma.$transaction(async (tx) => {
        const p = await tx.bookingParticipant.create({
          data: {
            bookingId: id,
            userId,
            status: 'INVITED',
            isOrganizer: false
          },
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } }
          }
        });

        if (booking.paymentMethod === 'SPLIT') {
          const active = await tx.bookingParticipant.findMany({
            where: { bookingId: id, status: { not: 'REMOVED' } },
            select: { userId: true }
          });
          const paidShares = await tx.paymentShare.findMany({
            where: { bookingId: id, status: 'PAID' }
          });
          if (paidShares.length) {
            // Do not rebalance after money is taken; invitee gets no new share if total already covered
            const sumAll = await tx.paymentShare.aggregate({
              where: { bookingId: id },
              _sum: { amount: true }
            });
            const covered = Number(sumAll._sum.amount || 0);
            if (covered < booking.totalCost) {
              await tx.paymentShare.upsert({
                where: { bookingId_userId: { bookingId: id, userId } },
                create: {
                  bookingId: id,
                  userId,
                  amount: booking.totalCost - covered,
                  status: 'PENDING'
                },
                update: {}
              });
            }
          } else {
            const amounts = equalSplitAmounts(booking.totalCost, active.length);
            await tx.paymentShare.deleteMany({ where: { bookingId: id } });
            await tx.paymentShare.createMany({
              data: active.map((row, i) => ({
                bookingId: id,
                userId: row.userId,
                amount: amounts[i],
                status: 'PENDING'
              }))
            });
            await tx.booking.update({
              where: { id },
              data: { teamSize: active.length }
            });
          }
        } else if (booking.paymentMethod === 'MIXED') {
          // MIXED amounts are fixed at create; invitee without amount is not auto-added
        }

        return p;
      });

      res.status(201).json({
        message: 'Participant added',
        participant: {
          id: participant.id,
          userId: participant.userId,
          status: participant.status,
          user: {
            id: participant.user.id,
            fullName: participant.user.fullName,
            avatar: participant.user.avatarUrl
          }
        }
      });
    } catch (error) {
      console.error('Add participant error:', error);
      res.status(500).json({ error: 'Failed to add participant' });
    }
  }
);

router.delete('/:id/participants/me', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid booking id' });

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { participants: true }
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const participant = booking.participants.find((p) => String(p.userId) === String(req.user.id));
    if (!participant) {
      return res.status(400).json({ error: 'You are not a participant in this booking' });
    }
    if (participant.isOrganizer) {
      return res.status(400).json({ error: 'Organizer cannot leave; cancel the booking instead' });
    }

    await prisma.bookingParticipant.update({
      where: { id: participant.id },
      data: { status: 'REMOVED', respondedAt: new Date() }
    });

    res.json({ message: 'Successfully left the booking' });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Failed to leave booking' });
  }
});

module.exports = router;
