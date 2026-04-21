const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { MongoClient, ObjectId } = require('mongodb');
const { authenticate, requireRole } = require('../middleware/auth');
const { mongoUserGetVerificationStatus } = require('../lib/mongoUserWrite');
const {
  mongoFieldGetOwnerId,
  mongoFieldUpdateAndFetch,
  mongoFieldCreateAndFetch,
  mongoFieldUnavailableDeleteInRange,
  mongoFieldGetByIdPublicDetail,
  mongoFieldUnavailableListForField,
  mongoFieldUnavailableInsertDayStart
} = require('../lib/mongoFieldWrite');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Prisma wraps MongoDB deleteMany chains in transactions (replica set required).
 * Standalone mongod rejects those — delete related docs with the driver instead.
 * Collection / field names match prisma @@map.
 */
async function deleteFieldCascadeNative(fieldIdHex) {
  const oid = new ObjectId(fieldIdHex);
  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    await client.connect();
    const db = client.db();

    const bookingsCol = db.collection('bookings');
    const participantsCol = db.collection('booking_participants');
    const reviewsCol = db.collection('field_reviews');
    const favoritesCol = db.collection('favorites');
    const unavailableCol = db.collection('field_unavailable_dates');
    const fieldsCol = db.collection('fields');

    const bookings = await bookingsCol
      .find({ field_id: oid }, { projection: { _id: 1 } })
      .toArray();
    const bookingOids = bookings.map((b) => b._id);
    if (bookingOids.length > 0) {
      await participantsCol.deleteMany({ booking_id: { $in: bookingOids } });
    }
    await bookingsCol.deleteMany({ field_id: oid });
    await reviewsCol.deleteMany({ field_id: oid });
    await favoritesCol.deleteMany({ field_id: oid });
    await unavailableCol.deleteMany({ field_id: oid });
    const { deletedCount } = await fieldsCol.deleteOne({ _id: oid });
    return deletedCount === 1;
  } finally {
    await client.close();
  }
}

function dayUtcRangeFromYmd(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  return {
    start: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
  };
}

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

// My fields (authenticated owner or admin) — includes inactive fields for the owner
router.get('/me', authenticate, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const ownerId = req.user.id;
    const fields = await prisma.field.findMany({
      where: { ownerId },
      include: {
        unavailableDates: {
          orderBy: { date: 'asc' }
        },
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
    console.error('Get my fields error:', error);
    res.status(500).json({ error: 'Failed to fetch your fields' });
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

// List dates the owner has marked unavailable (authenticated owner of field or admin)
router.get('/:id/unavailable-dates', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const idTrim = typeof id === 'string' ? id.trim() : '';
    if (!isMongoObjectIdParam(idTrim)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }

    let fieldOwnerId;
    try {
      fieldOwnerId = await mongoFieldGetOwnerId(idTrim);
    } catch (e) {
      console.error('List unavailable dates (owner lookup):', e);
      return res.status(500).json({ error: 'Failed to list unavailable dates' });
    }
    if (!fieldOwnerId) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const uid = String(req.user.id);
    if (fieldOwnerId !== uid && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    let rows;
    try {
      rows = await mongoFieldUnavailableListForField(idTrim);
    } catch (e) {
      console.error('List unavailable dates error:', e);
      return res.status(500).json({ error: 'Failed to list unavailable dates' });
    }

    res.json({ unavailableDates: rows });
  } catch (error) {
    console.error('List unavailable dates error:', error);
    res.status(500).json({ error: 'Failed to list unavailable dates' });
  }
});

// Block a full calendar day for bookings (owner or admin)
router.post(
  '/:id/unavailable-dates',
  authenticate,
  [body('date').trim().matches(/^\d{4}-\d{2}-\d{2}$/)],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { date } = req.body;
      const idTrim = typeof id === 'string' ? id.trim() : '';
      if (!isMongoObjectIdParam(idTrim)) {
        return res.status(400).json({ error: 'Invalid field id' });
      }

      let fieldOwnerId;
      try {
        fieldOwnerId = await mongoFieldGetOwnerId(idTrim);
      } catch (e) {
        console.error('Add unavailable date (owner lookup):', e);
        return res.status(500).json({ error: 'Failed to block date' });
      }
      if (!fieldOwnerId) {
        return res.status(404).json({ error: 'Field not found' });
      }

      const uid = String(req.user.id);
      if (fieldOwnerId !== uid && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const range = dayUtcRangeFromYmd(date);
      if (!range) {
        return res.status(400).json({ error: 'Invalid date' });
      }

      let created;
      try {
        created = await mongoFieldUnavailableInsertDayStart(idTrim, range.start);
      } catch (error) {
        console.error('Add unavailable date error:', error);
        return res.status(500).json({ error: 'Failed to block date' });
      }

      if (!created) {
        return res.status(409).json({ error: 'This date is already blocked' });
      }

      res.status(201).json({ message: 'Date blocked', unavailableDate: created });
    } catch (error) {
      console.error('Add unavailable date error:', error);
      res.status(500).json({ error: 'Failed to block date' });
    }
  }
);

// Unblock a day
router.delete('/:id/unavailable-dates', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Query parameter date is required (YYYY-MM-DD)' });
    }

    const idTrim = typeof id === 'string' ? id.trim() : '';
    if (!isMongoObjectIdParam(idTrim)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }

    let fieldOwnerId;
    try {
      fieldOwnerId = await mongoFieldGetOwnerId(idTrim);
    } catch (e) {
      console.error('Delete unavailable date (owner lookup):', e);
      return res.status(500).json({ error: 'Failed to unblock date' });
    }
    if (!fieldOwnerId) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const uid = String(req.user.id);
    if (fieldOwnerId !== uid && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const range = dayUtcRangeFromYmd(date);
    if (!range) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    let removed;
    try {
      removed = await mongoFieldUnavailableDeleteInRange(idTrim, range.start, range.end);
    } catch (e) {
      console.error('Delete unavailable date error:', e);
      return res.status(500).json({ error: 'Failed to unblock date' });
    }

    if (removed === 0) {
      return res.status(404).json({ error: 'No blocked date found for that day' });
    }

    res.json({ message: 'Date unblocked', removed });
  } catch (error) {
    console.error('Delete unavailable date error:', error);
    res.status(500).json({ error: 'Failed to unblock date' });
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

// Get field by ID (native driver — avoids Prisma transaction/replica-set issues on standalone MongoDB)
router.get('/:id', async (req, res) => {
  try {
    const idTrim = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!isMongoObjectIdParam(idTrim)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }

    let field;
    try {
      field = await mongoFieldGetByIdPublicDetail(idTrim);
    } catch (error) {
      console.error('Get field error:', error);
      return res.status(500).json({ error: 'Failed to fetch field' });
    }

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    res.json({ field });
  } catch (error) {
    console.error('Get field error:', error);
    res.status(500).json({ error: 'Failed to fetch field' });
  }
});

/** Avoid NaN / invalid floats — Prisma rejects NaN for Float fields and surfaces a 500. */
function parseCoordOrNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/** Prisma String[] must be strings only (not objects); tolerate a single URL string. */
function normalizeStringArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (v === undefined || v === null ? '' : String(v).trim()))
      .filter((s) => s.length > 0);
  }
  if (typeof value === 'string' && value.trim() !== '') return [value.trim()];
  return [];
}

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? Math.round(value) : parseInt(String(value).trim(), 10);
  return Number.isInteger(n) ? n : null;
}

function normalizeScheduleObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

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

    const {
      name,
      sport,
      description,
      capacity,
      type,
      location,
      address,
      city,
      district,
      phone,
      pricePerHour,
      amenities,
      features,
      highlights,
      images,
      schedule,
      bookingType,
      advanceBooking,
      cancellationPolicy,
      visibilityRequested,
      latitude,
      longitude,
      ownershipDocumentUrl,
      licensesDocumentUrl
    } = req.body;

    function optionalDocumentUrl(v) {
      if (v == null || typeof v !== 'string') return null;
      const t = v.trim();
      // Accept long data URLs (base64) produced by owner-side uploads.
      if (!t || t.length > 10 * 1024 * 1024) return null;
      return t;
    }

    // Check if owner is verified (if they're an owner)
    if (req.user.role === 'OWNER') {
      const verificationStatus = await mongoUserGetVerificationStatus(req.user.id);
      if (verificationStatus !== 'APPROVED') {
        return res.status(403).json({ error: 'Owner verification required to create fields' });
      }
    }

    const isAdmin = req.user.role === 'ADMIN';
    const moderationStatus = isAdmin ? 'APPROVED' : 'PENDING';
    const isActive = isAdmin; // owner-created fields must be approved by admin first

    // Native insert — Prisma create() hits P2031 on standalone MongoDB (requires replica set for transactions).
    const field = await mongoFieldCreateAndFetch({
      name,
      sport,
      description,
      capacity: parseIntOrNull(capacity),
      type,
      location,
      address,
      city: city != null ? String(city).trim() || null : null,
      district: district != null ? String(district).trim() || null : null,
      phone,
      pricePerHour: parseInt(pricePerHour, 10),
      amenities: normalizeStringArray(amenities),
      features: normalizeStringArray(features),
      highlights: normalizeStringArray(highlights),
      images: normalizeStringArray(images),
      schedule: normalizeScheduleObject(schedule),
      bookingType: bookingType != null ? String(bookingType).trim() || null : null,
      advanceBooking: advanceBooking != null ? String(advanceBooking).trim() || null : null,
      cancellationPolicy: cancellationPolicy != null ? String(cancellationPolicy).trim() || null : null,
      visibilityRequested: visibilityRequested === undefined ? null : !!visibilityRequested,
      latitude: parseCoordOrNull(latitude),
      longitude: parseCoordOrNull(longitude),
      ownershipDocumentUrl: optionalDocumentUrl(ownershipDocumentUrl),
      licensesDocumentUrl: optionalDocumentUrl(licensesDocumentUrl),
      ownerId: req.user.id,
      moderationStatus,
      moderationReason: null,
      moderatedAt: isAdmin ? new Date() : null,
      moderatedById: isAdmin ? req.user.id : null,
      isActive
    });

    const msg = isAdmin
      ? 'Field created successfully'
      : 'Field submitted for approval';
    res.status(201).json({ message: msg, field });
  } catch (error) {
    console.error('Create field error:', error);
    const payload = { error: 'Failed to create field' };
    if (process.env.NODE_ENV !== 'production') {
      const msg = error && error.message ? String(error.message) : String(error);
      payload.details = msg;
    }
    res.status(500).json(payload);
  }
});

// Update field (Owner or Admin)
router.put('/:id', authenticate, [
  body('name').trim().optional(),
  body('sport').trim().optional(),
  body('type').isIn(['INDOOR', 'OUTDOOR']).optional(),
  body('pricePerHour')
    .optional()
    .custom((v) => {
      if (v === undefined || v === null) return true;
      const n = typeof v === 'string' ? parseInt(v, 10) : Math.round(Number(v));
      return Number.isInteger(n) && n >= 0;
    })
    .withMessage('pricePerHour must be a non-negative integer')
], async (req, res) => {
  try {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const idTrim = typeof id === 'string' ? id.trim() : '';
    if (!isMongoObjectIdParam(idTrim)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }

    let fieldOwnerId;
    try {
      fieldOwnerId = await mongoFieldGetOwnerId(idTrim);
    } catch (err) {
      console.error('Update field (owner lookup) error:', err);
      return res.status(500).json({ error: 'Failed to update field' });
    }
    if (!fieldOwnerId) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const uid = String(req.user.id);
    if (fieldOwnerId !== uid && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = {};
    const allowedFields = [
      'name',
      'sport',
      'description',
      'capacity',
      'type',
      'location',
      'address',
      'city',
      'district',
      'phone',
      'pricePerHour',
      'amenities',
      'features',
      'highlights',
      'images',
      'schedule',
      'bookingType',
      'advanceBooking',
      'cancellationPolicy',
      'visibilityRequested',
      'isActive',
      'latitude',
      'longitude',
      'ownershipDocumentUrl',
      'licensesDocumentUrl'
    ];
    
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (f === 'pricePerHour') {
          updateData[f] = parseInt(req.body[f], 10);
        } else if (f === 'capacity') {
          updateData[f] = parseIntOrNull(req.body[f]);
        } else if (f === 'latitude' || f === 'longitude') {
          updateData[f] = parseCoordOrNull(req.body[f]);
        } else if (f === 'schedule') {
          updateData[f] = normalizeScheduleObject(req.body[f]);
        } else if (f === 'visibilityRequested') {
          updateData[f] = !!req.body[f];
        } else if (f === 'ownershipDocumentUrl' || f === 'licensesDocumentUrl') {
          const v = req.body[f];
          if (v === null || v === '') {
            updateData[f] = null;
          } else {
            const t = String(v).trim();
            updateData[f] = t.length <= 10 * 1024 * 1024 ? t : null;
          }
        } else {
          updateData[f] = req.body[f];
        }
      }
    });

    let updatedField;
    try {
      const { matched, field } = await mongoFieldUpdateAndFetch(idTrim, updateData);
      if (!matched) {
        return res.status(404).json({ error: 'Field not found' });
      }
      updatedField = field;
    } catch (err) {
      console.error('Update field error:', err);
      return res.status(500).json({ error: 'Failed to update field' });
    }

    if (!updatedField) {
      return res.status(404).json({ error: 'Field not found' });
    }

    res.json({ message: 'Field updated successfully', field: updatedField });
  } catch (error) {
    console.error('Update field error:', error);
    res.status(500).json({ error: 'Failed to update field' });
  }
});

function isMongoObjectIdParam(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id.trim());
}

// Delete field (Owner or Admin)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!isMongoObjectIdParam(id)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }

    const field = await prisma.field.findUnique({
      where: { id },
      select: { ownerId: true }
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const ownerId = String(field.ownerId);
    const userId = String(req.user.id);
    if (ownerId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = await deleteFieldCascadeNative(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Field not found' });
    }

    res.json({ message: 'Field deleted successfully' });
  } catch (error) {
    console.error('Delete field error:', error);
    const details =
      process.env.NODE_ENV !== 'production' && error && error.message
        ? { details: error.message }
        : {};
    res.status(500).json({ error: 'Failed to delete field', ...details });
  }
});

if (process.env.NODE_ENV !== 'production') {
  console.log('[api/fields] Field creation uses native MongoDB (restart server after changing routes/fields.js).');
}

module.exports = router;

