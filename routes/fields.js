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

function parsePositiveIntOr(defaultValue, value, maxValue) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return defaultValue;
  return Math.min(n, maxValue);
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toFiniteNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function scheduleHoursForDate(schedule, dateUtc) {
  if (!schedule || typeof schedule !== 'object') return 13;
  const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dateUtc.getUTCDay()];
  const dayCfg = schedule[dayName];
  if (!dayCfg) return 13;
  if (dayCfg.enabled === false) return 0;
  const openMins = timeToMinutes(dayCfg.opening);
  const closeMins = timeToMinutes(dayCfg.closing);
  if (openMins == null || closeMins == null || closeMins <= openMins) return 0;
  return Math.max(0, Math.floor(closeMins / 60) - Math.ceil(openMins / 60));
}

function bookingHoursFromRanges(booking) {
  const ranges = booking.time_slot_ranges && Array.isArray(booking.time_slot_ranges)
    ? booking.time_slot_ranges
    : [{ start: booking.time_slot_start, end: booking.time_slot_end }];
  return ranges.reduce((sum, r) => {
    const startHour = parseInt(String(r.start || '').split(':')[0], 10);
    const endHour = parseInt(String(r.end || '').split(':')[0], 10);
    if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) return sum;
    return sum + (endHour - startHour);
  }, 0);
}

function composeFieldScore(field, metrics, requestLat, requestLng, maxPopularity) {
  const lat = toFiniteNumber(field.latitude);
  const lng = toFiniteNumber(field.longitude);
  const distanceKm = (lat != null && lng != null && requestLat != null && requestLng != null)
    ? haversineKm(requestLat, requestLng, lat, lng)
    : null;

  const rating = toFiniteNumber(field.rating) || 0;
  const popularityRaw = metrics.popularityRaw || 0;
  const popularityScore = maxPopularity > 0 ? popularityRaw / maxPopularity : 0;
  const availabilityScore = clamp01(metrics.availabilityScore);
  const distanceScore = distanceKm == null ? 0.35 : (1 / (1 + distanceKm / 5));
  const ratingScore = clamp01(rating / 5);

  const recommendationScore =
    distanceScore * 0.45 +
    popularityScore * 0.25 +
    availabilityScore * 0.2 +
    ratingScore * 0.1;

  return {
    distanceKm,
    distanceMeters: distanceKm == null ? null : Math.round(distanceKm * 1000),
    popularityScore: Number(popularityScore.toFixed(4)),
    availabilityScore: Number(availabilityScore.toFixed(4)),
    recommendationScore: Number(recommendationScore.toFixed(4)),
    isAvailableSoon: availabilityScore > 0.15
  };
}

async function getActiveFieldsWithDistance(lat, lng, radiusKm, sport) {
  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    await client.connect();
    const db = client.db();
    const fieldsCol = db.collection('fields');
    await fieldsCol.updateMany(
      {
        geoPoint: { $exists: false },
        latitude: { $type: 'number' },
        longitude: { $type: 'number' }
      },
      [
        {
          $set: {
            geoPoint: {
              type: 'Point',
              coordinates: ['$longitude', '$latitude']
            }
          }
        }
      ]
    );
    await fieldsCol.createIndex({ geoPoint: '2dsphere' });
    const query = { is_active: true };
    if (sport) query.sport = sport;
    const docs = await fieldsCol.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          key: 'geoPoint',
          distanceField: 'distanceMeters',
          spherical: true,
          maxDistance: Math.round(radiusKm * 1000),
          query
        }
      },
      { $limit: 300 }
    ]).toArray();
    return docs.map((d) => ({
      id: String(d._id),
      name: d.name,
      sport: d.sport,
      type: d.type,
      location: d.location,
      city: d.city,
      district: d.district,
      latitude: d.latitude,
      longitude: d.longitude,
      pricePerHour: d.price_per_hour,
      rating: d.rating,
      reviewCount: d.review_count || 0,
      images: d.images || [],
      features: d.features || [],
      distanceMeters: d.distanceMeters,
      schedule: d.schedule
    }));
  } catch (error) {
    const fallback = await prisma.field.findMany({
      where: {
        isActive: true,
        ...(sport ? { sport } : {})
      },
      take: 300
    });
    return fallback
      .map((f) => {
        const fieldLat = toFiniteNumber(f.latitude);
        const fieldLng = toFiniteNumber(f.longitude);
        if (fieldLat == null || fieldLng == null) return null;
        const distanceKm = haversineKm(lat, lng, fieldLat, fieldLng);
        if (distanceKm > radiusKm) return null;
        return {
          ...f,
          distanceMeters: Math.round(distanceKm * 1000)
        };
      })
      .filter(Boolean);
  } finally {
    await client.close().catch(() => {});
  }
}

async function buildFieldMetrics(fieldIds, fieldById) {
  if (!fieldIds.length) return { byFieldId: new Map(), maxPopularity: 0 };
  const ids = fieldIds.map((id) => new ObjectId(id));
  const now = new Date();
  const recentFrom = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const horizonDays = 7;
  const horizonTo = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  const client = new MongoClient(process.env.DATABASE_URL);
  try {
    await client.connect();
    const db = client.db();
    const [totalBookings, recentBookings, upcomingBookings, favoritesCounts, blockedDays] = await Promise.all([
      db.collection('bookings').aggregate([
        { $match: { field_id: { $in: ids }, status: { $ne: 'CANCELLED' } } },
        { $group: { _id: '$field_id', count: { $sum: 1 } } }
      ]).toArray(),
      db.collection('bookings').aggregate([
        { $match: { field_id: { $in: ids }, status: { $ne: 'CANCELLED' }, created_at: { $gte: recentFrom } } },
        { $group: { _id: '$field_id', count: { $sum: 1 } } }
      ]).toArray(),
      db.collection('bookings').find({
        field_id: { $in: ids },
        status: { $ne: 'CANCELLED' },
        date: { $gte: now, $lte: horizonTo }
      }, {
        projection: { field_id: 1, time_slot_start: 1, time_slot_end: 1, time_slot_ranges: 1 }
      }).toArray(),
      db.collection('favorites').aggregate([
        { $match: { field_id: { $in: ids } } },
        { $group: { _id: '$field_id', count: { $sum: 1 } } }
      ]).toArray(),
      db.collection('field_unavailable_dates').aggregate([
        { $match: { field_id: { $in: ids }, date: { $gte: now, $lte: horizonTo } } },
        { $group: { _id: '$field_id', count: { $sum: 1 } } }
      ]).toArray()
    ]);

    const totals = new Map(totalBookings.map((r) => [String(r._id), r.count]));
    const recent = new Map(recentBookings.map((r) => [String(r._id), r.count]));
    const favorites = new Map(favoritesCounts.map((r) => [String(r._id), r.count]));
    const unavailable = new Map(blockedDays.map((r) => [String(r._id), r.count]));

    const upcomingBookedHoursByField = new Map();
    upcomingBookings.forEach((b) => {
      const id = String(b.field_id);
      const prev = upcomingBookedHoursByField.get(id) || 0;
      upcomingBookedHoursByField.set(id, prev + bookingHoursFromRanges(b));
    });

    const byFieldId = new Map();
    let maxPopularity = 0;
    fieldIds.forEach((id) => {
      const field = fieldById.get(id);
      const bookingCount = totals.get(id) || 0;
      const recentActivityCount = recent.get(id) || 0;
      const favoriteCount = favorites.get(id) || 0;
      const reviewCount = field.reviewCount || 0;
      const rating = toFiniteNumber(field.rating) || 0;
      const blockedCount = unavailable.get(id) || 0;
      const bookedHours = upcomingBookedHoursByField.get(id) || 0;

      let possibleHours = 0;
      for (let i = 0; i < horizonDays; i++) {
        const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        possibleHours += scheduleHoursForDate(field.schedule, d);
      }
      const blockedPenalty = blockedCount >= 3 ? 0.55 : (blockedCount > 0 ? 0.8 : 1);
      const availabilityScore = possibleHours <= 0 ? 0 : clamp01(((possibleHours - bookedHours) / possibleHours) * blockedPenalty);
      const popularityRaw =
        bookingCount * 0.5 +
        recentActivityCount * 1.2 +
        favoriteCount * 0.8 +
        reviewCount * 0.35 +
        rating * 2;
      if (popularityRaw > maxPopularity) maxPopularity = popularityRaw;
      byFieldId.set(id, {
        bookingCount,
        recentActivityCount,
        favoriteCount,
        reviewCount,
        rating,
        popularityRaw,
        availabilityScore
      });
    });
    return { byFieldId, maxPopularity };
  } finally {
    await client.close().catch(() => {});
  }
}

// Coordinate-aware nearby fields with relevance scoring.
router.get('/nearby', async (req, res) => {
  try {
    const lat = toFiniteNumber(req.query.lat);
    const lng = toFiniteNumber(req.query.lng);
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat and lng are required numbers' });
    }
    const page = parsePositiveIntOr(1, req.query.page, 1000);
    const limit = parsePositiveIntOr(12, req.query.limit, 48);
    const radiusKm = Math.min(parseFloat(req.query.radiusKm) || 30, 120);
    const sport = req.query.sport ? String(req.query.sport) : undefined;

    const nearbyFields = await getActiveFieldsWithDistance(lat, lng, radiusKm, sport);
    const fieldIds = nearbyFields.map((f) => String(f.id));
    const fieldById = new Map(nearbyFields.map((f) => [String(f.id), f]));
    const { byFieldId, maxPopularity } = await buildFieldMetrics(fieldIds, fieldById);

    const ranked = nearbyFields
      .map((field) => {
        const fieldId = String(field.id);
        const metrics = byFieldId.get(fieldId) || { popularityRaw: 0, availabilityScore: 0.4 };
        const score = composeFieldScore(field, metrics, lat, lng, maxPopularity);
        return {
          ...field,
          ...score,
          bookingCount: metrics.bookingCount || 0,
          recentActivityCount: metrics.recentActivityCount || 0,
          favoriteCount: metrics.favoriteCount || 0
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters || b.recommendationScore - a.recommendationScore);

    const start = (page - 1) * limit;
    const paged = ranked.slice(start, start + limit);
    res.json({
      fields: paged,
      pagination: { page, limit, total: ranked.length, pages: Math.ceil(ranked.length / limit) }
    });
  } catch (error) {
    console.error('Get nearby fields error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby fields' });
  }
});

router.get('/popular-now', async (req, res) => {
  try {
    const page = parsePositiveIntOr(1, req.query.page, 1000);
    const limit = parsePositiveIntOr(12, req.query.limit, 48);
    const lat = toFiniteNumber(req.query.lat);
    const lng = toFiniteNumber(req.query.lng);
    const sport = req.query.sport ? String(req.query.sport) : undefined;

    const candidates = await prisma.field.findMany({
      where: { isActive: true, ...(sport ? { sport } : {}) },
      take: 250
    });
    const fieldById = new Map(candidates.map((f) => [String(f.id), f]));
    const { byFieldId, maxPopularity } = await buildFieldMetrics(candidates.map((f) => String(f.id)), fieldById);

    const ranked = candidates
      .map((field) => {
        const fieldId = String(field.id);
        const metrics = byFieldId.get(fieldId) || { popularityRaw: 0, availabilityScore: 0.4 };
        const score = composeFieldScore(field, metrics, lat, lng, maxPopularity);
        return {
          ...field,
          ...score,
          bookingCount: metrics.bookingCount || 0,
          recentActivityCount: metrics.recentActivityCount || 0,
          favoriteCount: metrics.favoriteCount || 0
        };
      })
      .sort((a, b) => {
        if (b.popularityScore !== a.popularityScore) return b.popularityScore - a.popularityScore;
        if (b.availabilityScore !== a.availabilityScore) return b.availabilityScore - a.availabilityScore;
        return b.recommendationScore - a.recommendationScore;
      });

    const start = (page - 1) * limit;
    const fields = ranked.slice(start, start + limit);
    res.json({
      fields,
      pagination: { page, limit, total: ranked.length, pages: Math.ceil(ranked.length / limit) }
    });
  } catch (error) {
    console.error('Get popular now fields error:', error);
    res.status(500).json({ error: 'Failed to fetch popular fields' });
  }
});

router.get('/recommendations', async (req, res) => {
  try {
    const lat = toFiniteNumber(req.query.lat);
    const lng = toFiniteNumber(req.query.lng);
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat and lng are required numbers' });
    }
    const page = parsePositiveIntOr(1, req.query.page, 1000);
    const limit = parsePositiveIntOr(12, req.query.limit, 48);
    const radiusKm = Math.min(parseFloat(req.query.radiusKm) || 45, 160);

    const candidates = await getActiveFieldsWithDistance(lat, lng, radiusKm);
    const fieldIds = candidates.map((f) => String(f.id));
    const fieldById = new Map(candidates.map((f) => [String(f.id), f]));
    const { byFieldId, maxPopularity } = await buildFieldMetrics(fieldIds, fieldById);
    const ranked = candidates
      .map((field) => {
        const fieldId = String(field.id);
        const metrics = byFieldId.get(fieldId) || { popularityRaw: 0, availabilityScore: 0.4 };
        return {
          ...field,
          ...composeFieldScore(field, metrics, lat, lng, maxPopularity),
          bookingCount: metrics.bookingCount || 0,
          recentActivityCount: metrics.recentActivityCount || 0,
          favoriteCount: metrics.favoriteCount || 0
        };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore);

    const start = (page - 1) * limit;
    const fields = ranked.slice(start, start + limit);
    res.json({
      fields,
      pagination: { page, limit, total: ranked.length, pages: Math.ceil(ranked.length / limit) }
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

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
      select: { id: true, isActive: true, schedule: true }
    });

    if (!field || !field.isActive) {
      return res.status(404).json({ error: 'Field not found or inactive' });
    }

    // Parse the date string (YYYY-MM-DD) and create UTC date range
    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const dayName = ymdToUtcDayName(date);
    const schedule = field.schedule && typeof field.schedule === 'object' ? field.schedule : null;
    const dayCfg = dayName && schedule ? schedule[dayName] : null;
    const dayEnabled = dayCfg ? dayCfg.enabled !== false : true;
    const openingMins = dayCfg ? timeToMinutes(dayCfg.opening) : null;
    const closingMins = dayCfg ? timeToMinutes(dayCfg.closing) : null;
    let workingSlots = [];

    if (!dayEnabled) {
      return res.json({
        available: false,
        lockedByOwner: false,
        closedBySchedule: true,
        bookedSlots: [],
        workingSlots: [],
        message: 'This field is closed on the selected day.'
      });
    }

    if (dayCfg) {
      if (openingMins == null || closingMins == null || closingMins <= openingMins) {
        return res.status(400).json({ error: 'Field schedule is invalid for this day' });
      }
      const startHour = Math.ceil(openingMins / 60);
      const endHour = Math.floor(closingMins / 60);
      for (let hour = startHour; hour < endHour; hour++) {
        workingSlots.push(`${String(hour).padStart(2, '0')}:00`);
      }
      if (workingSlots.length === 0) {
        return res.json({
          available: false,
          lockedByOwner: false,
          closedBySchedule: true,
          bookedSlots: [],
          workingSlots: [],
          message: 'No bookable slots are configured for this day.'
        });
      }
    } else {
      // Fallback for old data with no explicit schedule.
      for (let hour = 9; hour < 22; hour++) {
        workingSlots.push(`${String(hour).padStart(2, '0')}:00`);
      }
    }

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
        closedBySchedule: false,
        bookedSlots: [],
        workingSlots,
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

    const bookedInWorkingSlots = bookedSlots.filter((s) => workingSlots.includes(s));
    res.json({
      available: true,
      lockedByOwner: false,
      closedBySchedule: false,
      bookedSlots: bookedInWorkingSlots,
      workingSlots,
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

function timeToMinutes(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function ymdToUtcDayName(ymd) {
  const parts = String(ymd || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0));
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getUTCDay()] || null;
}

function normalizeUpdateFieldValue(field, value) {
  if (field === 'pricePerHour') return parseInt(value, 10);
  if (field === 'capacity') return parseIntOrNull(value);
  if (field === 'latitude' || field === 'longitude') return parseCoordOrNull(value);
  if (field === 'schedule') return normalizeScheduleObject(value);
  if (field === 'visibilityRequested') return !!value;
  if (field === 'amenities' || field === 'features' || field === 'highlights' || field === 'images') {
    return normalizeStringArray(value);
  }
  if (field === 'ownershipDocumentUrl' || field === 'licensesDocumentUrl') {
    if (value === null || value === '') return null;
    const t = String(value).trim();
    return t.length <= 10 * 1024 * 1024 ? t : null;
  }
  return value;
}

// Create field (Owner only)
router.post('/', authenticate, requireRole('OWNER', 'ADMIN'), [
  body('name').trim().notEmpty(),
  body('sport').trim().notEmpty(),
  body('type').isIn(['INDOOR', 'OUTDOOR']),
  body('location').trim().notEmpty(),
  body('pricePerHour').isInt({ min: 0 }),
  body('latitude')
    .exists({ checkFalsy: true })
    .withMessage('latitude is required')
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90'),
  body('longitude')
    .exists({ checkFalsy: true })
    .withMessage('longitude is required')
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180')
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
      venueResponse,
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
    const parsedLatitude = parseCoordOrNull(latitude);
    const parsedLongitude = parseCoordOrNull(longitude);
    if (parsedLatitude == null || parsedLongitude == null) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }

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
      venueResponse: venueResponse != null ? String(venueResponse).trim() || null : null,
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
      latitude: parsedLatitude,
      longitude: parsedLongitude,
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
    const pendingSensitiveData = {};
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
      'venueResponse',
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
    const sensitiveFields = new Set([
      'ownershipDocumentUrl',
      'licensesDocumentUrl',
      'location',
      'address',
      'city',
      'district',
      'latitude',
      'longitude'
    ]);
    
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) {
        const normalized = normalizeUpdateFieldValue(f, req.body[f]);
        if (req.user.role !== 'ADMIN' && sensitiveFields.has(f)) {
          pendingSensitiveData[f] = normalized;
        } else if (f === 'ownershipDocumentUrl' || f === 'licensesDocumentUrl') {
          updateData[f] = normalized;
        } else {
          updateData[f] = normalized;
        }
      }
    });

    const hasPendingSensitive = Object.keys(pendingSensitiveData).length > 0;
    if (hasPendingSensitive) {
      updateData.pendingChanges = pendingSensitiveData;
      updateData.pendingChangeRequestedAt = new Date();
      updateData.moderationStatus = 'PENDING';
      updateData.moderationReason = null;
      updateData.moderatedAt = null;
      updateData.moderatedById = null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({ message: 'No changes to update' });
    }

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

    const message = hasPendingSensitive
      ? 'Field updated. Sensitive changes were submitted for admin approval.'
      : 'Field updated successfully';
    res.json({ message, field: updatedField });
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

