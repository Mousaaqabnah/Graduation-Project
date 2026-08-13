const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../lib/prisma');
const { authenticate, requireRole, optionalAuthenticate } = require('../middleware/auth');
const { isUuid } = require('../lib/ids');
const { toMinor } = require('../lib/money');
const {
  publicFieldSerializer,
  ownerFieldSerializer,
  adminFieldSerializer,
  openingHoursFromSchedule,
  scheduleFromOpeningHours,
  hmToMinutes,
  hmFromDate,
  DAY_NAMES
} = require('../lib/serializers');
const { writeAuditLog } = require('../lib/audit');
const { earliestAllowedSlotStartMinutesForYmd } = require('../lib/bookingSameDayRules');
const { isStoredDataUrl } = require('../lib/secureStorage');
const { putIncomingFile, openPrivateObject, removeManagedObject, resolvePublicUrl } = require('../lib/storage');

const router = express.Router();

const fieldInclude = {
  images: { orderBy: { displayOrder: 'asc' } },
  amenities: true,
  highlights: true,
  openingHours: true,
  owner: { select: { id: true, fullName: true, avatarUrl: true, phone: true } }
};

const fieldDetailIncludePublic = {
  ...fieldInclude,
  reviews: {
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, fullName: true, avatarUrl: true } }
    }
  },
  _count: { select: { reviews: true, bookings: true } }
};

const fieldDetailInclude = {
  ...fieldDetailIncludePublic,
  documents: true
};

const CORE_MODERATION_FIELDS = new Set([
  'name',
  'sport',
  'description',
  'type',
  'location',
  'address',
  'city',
  'district',
  'latitude',
  'longitude',
  'pricePerHour',
  'images',
  'schedule',
  'amenities',
  'features',
  'highlights',
  'ownershipDocumentUrl',
  'licensesDocumentUrl'
]);

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

function dayStartUtcFromYmd(dateStr) {
  const range = dayUtcRangeFromYmd(dateStr);
  return range ? range.start : null;
}

function utcDateWithMinutesFromYmd(dateStr, mins) {
  const base = dayStartUtcFromYmd(dateStr);
  if (!base || !Number.isInteger(mins) || mins < 0 || mins >= 24 * 60) return null;
  const d = new Date(base.getTime());
  d.setUTCMinutes(mins, 0, 0);
  return d;
}

function ymdAndTimeFromUtcDate(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
  const ymd = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCDate()).padStart(2, '0')}`;
  const hh = String(dateObj.getUTCHours()).padStart(2, '0');
  const mm = String(dateObj.getUTCMinutes()).padStart(2, '0');
  return { ymd, time: `${hh}:${mm}` };
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
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function ymdToUtcDayName(ymd) {
  const parts = String(ymd || '')
    .split('-')
    .map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0));
  return DAY_NAMES[d.getUTCDay()] || null;
}

function scheduleHoursForDate(schedule, dateUtc) {
  if (!schedule || typeof schedule !== 'object') return 13;
  const dayName = DAY_NAMES[dateUtc.getUTCDay()];
  const dayCfg = schedule[dayName];
  if (!dayCfg) return 13;
  if (dayCfg.enabled === false) return 0;
  const openMins = hmToMinutes(dayCfg.opening);
  const closeMins = hmToMinutes(dayCfg.closing);
  if (openMins == null || closeMins == null || closeMins <= openMins) return 0;
  return Math.max(0, Math.floor(closeMins / 60) - Math.ceil(openMins / 60));
}

function bookingHoursFromBooking(booking) {
  if (Array.isArray(booking.slots) && booking.slots.length) {
    return booking.slots.reduce((sum, slot) => {
      const start = new Date(slot.startAt);
      const end = new Date(slot.endAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return sum;
      return sum + Math.max(0, (end.getTime() - start.getTime()) / (60 * 60 * 1000));
    }, 0);
  }
  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, (end.getTime() - start.getTime()) / (60 * 60 * 1000));
}

function composeFieldScore(field, metrics, requestLat, requestLng, maxPopularity) {
  const lat = toFiniteNumber(field.latitude);
  const lng = toFiniteNumber(field.longitude);
  const distanceKm =
    lat != null && lng != null && requestLat != null && requestLng != null
      ? haversineKm(requestLat, requestLng, lat, lng)
      : null;

  const rating = toFiniteNumber(field.rating) || toFiniteNumber(field.ratingAverage) || 0;
  const popularityRaw = metrics.popularityRaw || 0;
  const popularityScore = maxPopularity > 0 ? popularityRaw / maxPopularity : 0;
  const availabilityScore = clamp01(metrics.availabilityScore);
  const distanceScore = distanceKm == null ? 0.35 : 1 / (1 + distanceKm / 5);
  const ratingScore = clamp01(rating / 5);

  const recommendationScore =
    distanceScore * 0.45 + popularityScore * 0.25 + availabilityScore * 0.2 + ratingScore * 0.1;

  return {
    distanceKm,
    distanceMeters: distanceKm == null ? null : Math.round(distanceKm * 1000),
    popularityScore: Number(popularityScore.toFixed(4)),
    availabilityScore: Number(availabilityScore.toFixed(4)),
    recommendationScore: Number(recommendationScore.toFixed(4)),
    isAvailableSoon: availabilityScore > 0.15
  };
}

function serializeFieldForViewer(field, req) {
  const user = req.user;
  if (user?.role === 'ADMIN') {
    return adminFieldSerializer(field);
  }
  if (user && String(field.ownerId) === String(user.id)) {
    return ownerFieldSerializer(field);
  }
  return publicFieldSerializer(field);
}

function publicFieldWhere(extra = {}) {
  return {
    deletedAt: null,
    isActive: true,
    moderationStatus: 'APPROVED',
    ...extra
  };
}

function blockedSlotToUnavailableRow(slot) {
  return {
    id: slot.id,
    date: slot.startAt,
    fieldId: slot.fieldId,
    createdAt: slot.createdAt
  };
}

function isAllDayBlockedSlot(slot) {
  const startMins = slot.startAt.getUTCHours() * 60 + slot.startAt.getUTCMinutes();
  const endMins = slot.endAt.getUTCHours() * 60 + slot.endAt.getUTCMinutes();
  return startMins === 0 && endMins >= 23 * 60 + 59;
}

function parseCoordOrNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

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

function parseAdvanceBookingDays(value) {
  const n = parseIntOrNull(value);
  if (n != null && n >= 0) return n;
  return 30;
}

function optionalDocumentUrl(v) {
  if (v == null || typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t;
}

async function documentCreateData(url, type, ctx) {
  const saved = await putIncomingFile(url, {
    kind: 'field-doc',
    fieldId: ctx && ctx.fieldId,
    docType: type
  });
  if (!saved) {
    const err = new Error('Invalid document');
    err.status = 400;
    throw err;
  }
  if (isStoredDataUrl(saved.storagePath)) {
    const err = new Error('Documents cannot be stored as data URLs');
    err.status = 400;
    throw err;
  }
  return {
    type,
    storagePath: saved.storagePath,
    mimeType: saved.mimeType,
    sizeBytes: saved.sizeBytes
  };
}

async function persistPublicImage(url, ctx) {
  if (url == null || url === '') return null;
  const saved = await putIncomingFile(url, {
    kind: 'public-image',
    fieldId: ctx && ctx.fieldId,
    purpose: 'gallery'
  });
  if (!saved) return null;
  const publicUrl = saved.publicUrl || resolvePublicUrl(saved.storagePath);
  return {
    storagePath: saved.storagePath,
    publicUrl
  };
}

async function isOwnerVerified(userId) {
  const profile = await prisma.ownerProfile.findUnique({
    where: { userId },
    select: { verificationStatus: true }
  });
  return profile?.verificationStatus === 'APPROVED';
}

async function getFieldOwnerId(fieldId) {
  const field = await prisma.field.findFirst({
    where: { id: fieldId, deletedAt: null },
    select: { ownerId: true }
  });
  return field ? field.ownerId : null;
}

async function fetchFieldById(fieldId, include = fieldDetailInclude) {
  return prisma.field.findFirst({
    where: { id: fieldId, deletedAt: null },
    include
  });
}

async function getActiveFieldsWithDistance(lat, lng, radiusKm, sport) {
  const fields = await prisma.field.findMany({
    where: publicFieldWhere(sport ? { sport } : {}),
    include: fieldInclude,
    take: 500
  });

  return fields
    .map((f) => {
      const fieldLat = toFiniteNumber(f.latitude);
      const fieldLng = toFiniteNumber(f.longitude);
      if (fieldLat == null || fieldLng == null) return null;
      const distanceKm = haversineKm(lat, lng, fieldLat, fieldLng);
      if (distanceKm > radiusKm) return null;
      const serialized = publicFieldSerializer(f);
      return {
        ...serialized,
        distanceMeters: Math.round(distanceKm * 1000)
      };
    })
    .filter(Boolean);
}

async function buildFieldMetrics(fieldIds, fieldById) {
  if (!fieldIds.length) return { byFieldId: new Map(), maxPopularity: 0 };

  const now = new Date();
  const recentFrom = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const horizonDays = 7;
  const horizonTo = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  const [
    totalBookings,
    recentBookings,
    upcomingBookings,
    favoritesCounts,
    blockedDays
  ] = await Promise.all([
    prisma.booking.groupBy({
      by: ['fieldId'],
      where: { fieldId: { in: fieldIds }, status: { not: 'CANCELLED' } },
      _count: { _all: true }
    }),
    prisma.booking.groupBy({
      by: ['fieldId'],
      where: {
        fieldId: { in: fieldIds },
        status: { not: 'CANCELLED' },
        createdAt: { gte: recentFrom }
      },
      _count: { _all: true }
    }),
    prisma.booking.findMany({
      where: {
        fieldId: { in: fieldIds },
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
        startAt: { gte: now, lte: horizonTo }
      },
      select: { fieldId: true, startAt: true, endAt: true, slots: true }
    }),
    prisma.favorite.groupBy({
      by: ['fieldId'],
      where: { fieldId: { in: fieldIds } },
      _count: { _all: true }
    }),
    prisma.fieldBlockedSlot.groupBy({
      by: ['fieldId'],
      where: {
        fieldId: { in: fieldIds },
        startAt: { gte: now, lte: horizonTo }
      },
      _count: { _all: true }
    })
  ]);

  const totals = new Map(totalBookings.map((r) => [r.fieldId, r._count._all]));
  const recent = new Map(recentBookings.map((r) => [r.fieldId, r._count._all]));
  const favorites = new Map(favoritesCounts.map((r) => [r.fieldId, r._count._all]));
  const unavailable = new Map(blockedDays.map((r) => [r.fieldId, r._count._all]));

  const upcomingBookedHoursByField = new Map();
  upcomingBookings.forEach((b) => {
    const prev = upcomingBookedHoursByField.get(b.fieldId) || 0;
    upcomingBookedHoursByField.set(b.fieldId, prev + bookingHoursFromBooking(b));
  });

  const byFieldId = new Map();
  let maxPopularity = 0;

  fieldIds.forEach((id) => {
    const field = fieldById.get(id);
    const bookingCount = totals.get(id) || 0;
    const recentActivityCount = recent.get(id) || 0;
    const favoriteCount = favorites.get(id) || 0;
    const reviewCount = field?.reviewCount || 0;
    const rating = toFiniteNumber(field?.rating) || toFiniteNumber(field?.ratingAverage) || 0;
    const blockedCount = unavailable.get(id) || 0;
    const bookedHours = upcomingBookedHoursByField.get(id) || 0;

    const schedule = field?.schedule || scheduleFromOpeningHours(field?.openingHours);
    let possibleHours = 0;
    for (let i = 0; i < horizonDays; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      possibleHours += scheduleHoursForDate(schedule, d);
    }
    const blockedPenalty = blockedCount >= 3 ? 0.55 : blockedCount > 0 ? 0.8 : 1;
    const availabilityScore =
      possibleHours <= 0 ? 0 : clamp01(((possibleHours - bookedHours) / possibleHours) * blockedPenalty);
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
}

async function replaceFieldImages(tx, fieldId, urls) {
  const previous = await tx.fieldImage.findMany({
    where: { fieldId },
    select: { storagePath: true }
  });
  const rows = [];
  for (let i = 0; i < (urls || []).length; i += 1) {
    const saved = await persistPublicImage(urls[i], { fieldId });
    if (!saved) continue;
    rows.push({
      fieldId,
      storagePath: saved.storagePath,
      publicUrl: saved.publicUrl,
      displayOrder: i,
      isPrimary: i === 0
    });
  }
  await tx.fieldImage.deleteMany({ where: { fieldId } });
  if (rows.length) {
    await tx.fieldImage.createMany({ data: rows });
  }
  const keep = new Set(rows.map((r) => r.storagePath));
  for (const old of previous) {
    if (old.storagePath && !keep.has(old.storagePath)) {
      await removeManagedObject(old.storagePath);
    }
  }
}

async function replaceFieldAmenities(tx, fieldId, names) {
  await tx.fieldAmenity.deleteMany({ where: { fieldId } });
  if (!names.length) return;
  await tx.fieldAmenity.createMany({
    data: names.map((name) => ({ fieldId, name }))
  });
}

async function replaceFieldHighlights(tx, fieldId, texts) {
  await tx.fieldHighlight.deleteMany({ where: { fieldId } });
  if (!texts.length) return;
  await tx.fieldHighlight.createMany({
    data: texts.map((text) => ({ fieldId, text }))
  });
}

async function replaceFieldOpeningHours(tx, fieldId, schedule) {
  await tx.fieldOpeningHour.deleteMany({ where: { fieldId } });
  const rows = openingHoursFromSchedule(schedule);
  if (!rows.length) return;
  await tx.fieldOpeningHour.createMany({
    data: rows.map((row) => ({ fieldId, ...row }))
  });
}

async function upsertFieldDocument(tx, fieldId, type, url) {
  const previous = await tx.fieldDocument.findFirst({
    where: { fieldId, type },
    select: { storagePath: true }
  });
  if (!url) {
    await tx.fieldDocument.deleteMany({ where: { fieldId, type } });
    if (previous && previous.storagePath) await removeManagedObject(previous.storagePath);
    return;
  }
  const created = await documentCreateData(url, type, { fieldId });
  await tx.fieldDocument.deleteMany({ where: { fieldId, type } });
  await tx.fieldDocument.create({
    data: { fieldId, ...created }
  });
  if (previous && previous.storagePath && previous.storagePath !== created.storagePath) {
    await removeManagedObject(previous.storagePath);
  }
}

async function deleteFieldCascade(fieldId) {
  await prisma.$transaction(async (tx) => {
    const bookingIds = (
      await tx.booking.findMany({ where: { fieldId }, select: { id: true } })
    ).map((b) => b.id);

    await tx.review.deleteMany({ where: { fieldId } });
    if (bookingIds.length) {
      await tx.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.booking.deleteMany({ where: { fieldId } });
    }
    await tx.field.delete({ where: { id: fieldId } });
  });
}

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
      .sort(
        (a, b) =>
          (a.distanceMeters || 0) - (b.distanceMeters || 0) ||
          b.recommendationScore - a.recommendationScore
      );

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

    const candidatesRaw = await prisma.field.findMany({
      where: publicFieldWhere(sport ? { sport } : {}),
      include: fieldInclude,
      take: 250
    });
    const candidates = candidatesRaw.map((f) => publicFieldSerializer(f));
    const fieldById = new Map(candidates.map((f) => [String(f.id), f]));
    const { byFieldId, maxPopularity } = await buildFieldMetrics(
      candidates.map((f) => String(f.id)),
      fieldById
    );

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

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, sport, type, location, search, minPrice, maxPrice } = req.query;
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;

    const where = publicFieldWhere();
    if (sport) where.sport = sport;
    if (type) where.type = type;
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (minPrice || maxPrice) {
      where.pricePerHour = {};
      if (minPrice) where.pricePerHour.gte = toMinor(parseInt(minPrice, 10));
      if (maxPrice) where.pricePerHour.lte = toMinor(parseInt(maxPrice, 10));
    }

    const [fieldsRaw, total] = await Promise.all([
      prisma.field.findMany({
        where,
        skip,
        take,
        include: {
          ...fieldInclude,
          _count: { select: { reviews: true, bookings: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.field.count({ where })
    ]);

    res.json({
      fields: fieldsRaw.map((f) => publicFieldSerializer(f)),
      pagination: {
        page: Math.max(1, parseInt(page, 10) || 1),
        limit: take,
        total,
        pages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    console.error('Get fields error:', error);
    res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

router.get('/me', authenticate, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const ownerId = req.user.id;
    const fieldsRaw = await prisma.field.findMany({
      where: { ownerId, deletedAt: null },
      include: {
        ...fieldInclude,
        documents: true,
        blockedSlots: { orderBy: { startAt: 'asc' } },
        _count: { select: { reviews: true, bookings: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const fields = fieldsRaw.map((f) => {
      const serialized = serializeFieldForViewer(f, req);
      serialized.unavailableDates = (f.blockedSlots || []).map(blockedSlotToUnavailableRow);
      return serialized;
    });

    res.json({ fields });
  } catch (error) {
    console.error('Get my fields error:', error);
    res.status(500).json({ error: 'Failed to fetch your fields' });
  }
});

router.get('/owner/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!isUuid(ownerId)) {
      return res.status(400).json({ error: 'Invalid owner id' });
    }

    const fieldsRaw = await prisma.field.findMany({
      where: publicFieldWhere({ ownerId }),
      include: {
        ...fieldInclude,
        _count: { select: { reviews: true, bookings: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ fields: fieldsRaw.map((f) => publicFieldSerializer(f)) });
  } catch (error) {
    console.error('Get owner fields error:', error);
    res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

router.get('/:id/unavailable-dates', authenticate, async (req, res) => {
  try {
    const idTrim = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!isUuid(idTrim)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }

    const fieldOwnerId = await getFieldOwnerId(idTrim);
    if (!fieldOwnerId) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const uid = String(req.user.id);
    if (fieldOwnerId !== uid && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rows = await prisma.fieldBlockedSlot.findMany({
      where: { fieldId: idTrim },
      orderBy: { startAt: 'asc' }
    });

    res.json({ unavailableDates: rows.map(blockedSlotToUnavailableRow) });
  } catch (error) {
    console.error('List unavailable dates error:', error);
    res.status(500).json({ error: 'Failed to list unavailable dates' });
  }
});

router.post(
  '/:id/unavailable-dates',
  authenticate,
  [
    body('date').trim().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('startTime').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\d{2}:\d{2}$/),
    body('endTime').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\d{2}:\d{2}$/)
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { date, startTime, endTime } = req.body;
      const idTrim = typeof req.params.id === 'string' ? req.params.id.trim() : '';
      if (!isUuid(idTrim)) {
        return res.status(400).json({ error: 'Invalid field id' });
      }

      const fieldOwnerId = await getFieldOwnerId(idTrim);
      if (!fieldOwnerId) {
        return res.status(404).json({ error: 'Field not found' });
      }

      const uid = String(req.user.id);
      if (fieldOwnerId !== uid && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const dayRange = dayUtcRangeFromYmd(date);
      if (!dayRange) {
        return res.status(400).json({ error: 'Invalid date' });
      }

      const hasStart = typeof startTime === 'string' && startTime.trim() !== '';
      const hasEnd = typeof endTime === 'string' && endTime.trim() !== '';
      if (hasStart !== hasEnd) {
        return res.status(400).json({ error: 'Provide both startTime and endTime, or neither.' });
      }

      let slotsToInsert = [];
      if (hasStart && hasEnd) {
        const startMins = hmToMinutes(startTime);
        const endMins = hmToMinutes(endTime);
        if (startMins == null || endMins == null || endMins <= startMins) {
          return res.status(400).json({ error: 'Invalid time range. endTime must be after startTime.' });
        }
        if (startMins % 60 !== 0 || endMins % 60 !== 0) {
          return res.status(400).json({
            error: 'Only hourly slots are supported. Use times like 09:00 to 12:00.'
          });
        }
        for (let mins = startMins; mins < endMins; mins += 60) {
          const slotStart = utcDateWithMinutesFromYmd(date, mins);
          const slotEnd = utcDateWithMinutesFromYmd(date, mins + 60);
          if (slotStart && slotEnd) {
            slotsToInsert.push({ startAt: slotStart, endAt: new Date(slotEnd.getTime() - 1) });
          }
        }
      } else {
        slotsToInsert = [{ startAt: dayRange.start, endAt: dayRange.end }];
      }

      if (!slotsToInsert.length) {
        return res.status(400).json({ error: 'No valid blocked slots provided.' });
      }

      const createdRows = [];
      for (const slot of slotsToInsert) {
        const existing = await prisma.fieldBlockedSlot.findFirst({
          where: {
            fieldId: idTrim,
            startAt: slot.startAt,
            endAt: slot.endAt
          }
        });
        if (existing) continue;

        const overlap = await prisma.fieldBlockedSlot.findFirst({
          where: {
            fieldId: idTrim,
            startAt: { lt: slot.endAt },
            endAt: { gt: slot.startAt }
          }
        });
        if (overlap) continue;

        const row = await prisma.fieldBlockedSlot.create({
          data: {
            fieldId: idTrim,
            startAt: slot.startAt,
            endAt: slot.endAt
          }
        });
        createdRows.push(blockedSlotToUnavailableRow(row));
      }

      if (createdRows.length === 0) {
        return res.status(409).json({ error: 'This date/time is already blocked' });
      }

      res.status(201).json({
        message: createdRows.length > 1 ? 'Time range blocked' : 'Date/time blocked',
        inserted: createdRows.length,
        unavailableDates: createdRows
      });
    } catch (error) {
      console.error('Add unavailable date error:', error);
      res.status(500).json({ error: 'Failed to block date/time' });
    }
  }
);

router.delete('/:id/unavailable-dates', authenticate, async (req, res) => {
  try {
    const { date, startTime, endTime } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Query parameter date is required (YYYY-MM-DD)' });
    }

    const idTrim = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!isUuid(idTrim)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }

    const fieldOwnerId = await getFieldOwnerId(idTrim);
    if (!fieldOwnerId) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const uid = String(req.user.id);
    if (fieldOwnerId !== uid && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const dayRange = dayUtcRangeFromYmd(date);
    if (!dayRange) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    const hasStart = typeof startTime === 'string' && startTime.trim() !== '';
    const hasEnd = typeof endTime === 'string' && endTime.trim() !== '';
    if (hasStart !== hasEnd) {
      return res.status(400).json({ error: 'Provide both startTime and endTime, or neither.' });
    }

    let deleteStart = dayRange.start;
    let deleteEnd = dayRange.end;
    if (hasStart && hasEnd) {
      const startMins = hmToMinutes(startTime);
      const endMins = hmToMinutes(endTime);
      if (startMins == null || endMins == null || endMins <= startMins) {
        return res.status(400).json({ error: 'Invalid time range. endTime must be after startTime.' });
      }
      const slotStart = utcDateWithMinutesFromYmd(date, startMins);
      const slotEndExclusive = utcDateWithMinutesFromYmd(date, endMins);
      if (!slotStart || !slotEndExclusive) {
        return res.status(400).json({ error: 'Invalid date/time range' });
      }
      deleteStart = slotStart;
      deleteEnd = new Date(slotEndExclusive.getTime() - 1);
    }

    const result = await prisma.fieldBlockedSlot.deleteMany({
      where: {
        fieldId: idTrim,
        startAt: { gte: deleteStart, lte: deleteEnd }
      }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'No blocked date/time found for that range' });
    }

    res.json({
      message: hasStart ? 'Time range unblocked' : 'Date unblocked',
      removed: result.count
    });
  } catch (error) {
    console.error('Delete unavailable date error:', error);
    res.status(500).json({ error: 'Failed to unblock date/time' });
  }
});

router.get('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!isUuid(id)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const field = await prisma.field.findFirst({
      where: publicFieldWhere({ id }),
      include: { openingHours: true }
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found or inactive' });
    }

    const dayRange = dayUtcRangeFromYmd(String(date));
    if (!dayRange) {
      return res.status(400).json({ error: 'Invalid date' });
    }
    const { start: startOfDay, end: endOfDay } = dayRange;

    const schedule = scheduleFromOpeningHours(field.openingHours);
    const dayName = ymdToUtcDayName(String(date));
    const dayCfg = dayName && schedule ? schedule[dayName] : null;
    const dayEnabled = dayCfg ? dayCfg.enabled !== false : true;
    const openingMins = dayCfg ? hmToMinutes(dayCfg.opening) : null;
    const closingMins = dayCfg ? hmToMinutes(dayCfg.closing) : null;
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
      for (let hour = 9; hour < 22; hour++) {
        workingSlots.push(`${String(hour).padStart(2, '0')}:00`);
      }
    }

    const earliestSameDay = earliestAllowedSlotStartMinutesForYmd(String(date));
    if (earliestSameDay != null) {
      workingSlots = workingSlots.filter((s) => {
        const mins = hmToMinutes(s);
        return mins != null && mins >= earliestSameDay;
      });
    }
    if (earliestSameDay != null && workingSlots.length === 0) {
      return res.json({
        available: false,
        lockedByOwner: false,
        closedBySchedule: true,
        bookedSlots: [],
        workingSlots: [],
        message: 'No time slots remain available for the rest of today.'
      });
    }

    const blockedRows = await prisma.fieldBlockedSlot.findMany({
      where: {
        fieldId: id,
        startAt: { lte: endOfDay },
        endAt: { gte: startOfDay }
      },
      select: { startAt: true, endAt: true }
    });

    const ownerBlockedSlots = [];
    let hasAllDayLock = false;
    blockedRows.forEach((row) => {
      if (isAllDayBlockedSlot(row)) {
        hasAllDayLock = true;
        return;
      }
      const parsed = ymdAndTimeFromUtcDate(row.startAt);
      if (parsed && parsed.time !== '00:00' && !ownerBlockedSlots.includes(parsed.time)) {
        ownerBlockedSlots.push(parsed.time);
      }
    });

    if (hasAllDayLock) {
      return res.json({
        available: false,
        lockedByOwner: true,
        closedBySchedule: false,
        bookedSlots: [],
        ownerBlockedSlots: [],
        workingSlots,
        message: 'This field is not available on the selected date'
      });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        fieldId: id,
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
        startAt: { lt: endOfDay },
        endAt: { gt: startOfDay }
      },
      select: {
        startAt: true,
        endAt: true,
        slots: { select: { startAt: true, endAt: true } }
      }
    });

    const bookedSlots = [];
    bookings.forEach((booking) => {
      const slotRows =
        Array.isArray(booking.slots) && booking.slots.length
          ? booking.slots
          : [{ startAt: booking.startAt, endAt: booking.endAt }];
      slotRows.forEach((slot) => {
        const hm = hmFromDate(slot.startAt);
        if (hm && !bookedSlots.includes(hm)) bookedSlots.push(hm);
      });
    });

    const ownerBlockedInWorkingSlots = ownerBlockedSlots.filter((s) => workingSlots.includes(s));
    const bookedInWorkingSlots = bookedSlots
      .concat(ownerBlockedInWorkingSlots)
      .filter((s, idx, arr) => workingSlots.includes(s) && arr.indexOf(s) === idx);

    res.json({
      available: true,
      lockedByOwner: false,
      closedBySchedule: false,
      bookedSlots: bookedInWorkingSlots,
      ownerBlockedSlots: ownerBlockedInWorkingSlots,
      workingSlots,
      debug: {
        bookingsFound: bookings.length,
        dateRange: { start: startOfDay.toISOString(), end: endOfDay.toISOString() }
      }
    });
  } catch (error) {
    console.error('Get field availability error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

router.get('/:id/documents/:docType', authenticate, async (req, res) => {
  try {
    const idTrim = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const docType = String(req.params.docType || '').toUpperCase();
    if (!isUuid(idTrim)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }
    if (!['OWNERSHIP_DOCUMENT', 'BUSINESS_LICENSE'].includes(docType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // Auth via Authorization header only — never accept tokens in query strings
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const field = await prisma.field.findFirst({
      where: { id: idTrim, deletedAt: null },
      select: { id: true, ownerId: true }
    });
    if (!field) return res.status(404).json({ error: 'Field not found' });

    const isOwner = String(field.ownerId) === String(req.user.id);
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const doc = await prisma.fieldDocument.findFirst({
      where: { fieldId: idTrim, type: docType }
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (isStoredDataUrl(doc.storagePath)) {
      return res.status(409).json({
        error:
          'Document is still stored as legacy base64. Run scripts/migrate-base64-documents.js --apply'
      });
    }

    const opened = await openPrivateObject(doc.storagePath);
    if (!opened || !opened.stream) {
      return res.status(404).json({ error: 'Document file missing' });
    }

    res.setHeader('Content-Type', doc.mimeType || opened.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${docType.toLowerCase()}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    opened.stream.pipe(res);
  } catch (error) {
    console.error('Get field document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.get('/:id', optionalAuthenticate, async (req, res) => {
  try {
    const idTrim = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!isUuid(idTrim)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }

    const field = await fetchFieldById(idTrim, fieldDetailInclude);
    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const user = req.user;
    const isOwner = user && String(field.ownerId) === String(user.id);
    const isAdmin = user && user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (field.deletedAt || !field.isActive || field.moderationStatus !== 'APPROVED') {
        return res.status(404).json({ error: 'Field not found' });
      }
      return res.json({ field: publicFieldSerializer(field) });
    }

    // Owner/admin: include documents metadata only via authorized serializer (download URLs)
    res.json({ field: serializeFieldForViewer(field, req) });
  } catch (error) {
    console.error('Get field error:', error);
    res.status(500).json({ error: 'Failed to fetch field' });
  }
});

function normalizeUpdateFieldValue(field, value) {
  if (field === 'pricePerHour') return toMinor(parseInt(value, 10));
  if (field === 'capacity') return parseIntOrNull(value);
  if (field === 'latitude' || field === 'longitude') return parseCoordOrNull(value);
  if (field === 'schedule') return normalizeScheduleObject(value);
  if (field === 'advanceBooking') return parseAdvanceBookingDays(value);
  if (field === 'amenities' || field === 'features' || field === 'highlights' || field === 'images') {
    return normalizeStringArray(value);
  }
  if (field === 'ownershipDocumentUrl' || field === 'licensesDocumentUrl') {
    if (value === null || value === '') return null;
    const t = String(value).trim();
    // Cap inbound data URL size before disk write (8MB decoded ≈ ~11MB encoded)
    return t.length <= 12 * 1024 * 1024 ? t : null;
  }
  return value;
}

router.post(
  '/',
  authenticate,
  requireRole('OWNER', 'ADMIN'),
  [
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
  ],
  async (req, res) => {
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
        latitude,
        longitude,
        ownershipDocumentUrl,
        licensesDocumentUrl
      } = req.body;

      if (req.user.role === 'OWNER') {
        const verified = await isOwnerVerified(req.user.id);
        if (!verified) {
          return res.status(403).json({ error: 'Owner verification required to create fields' });
        }
      }

      const parsedLatitude = parseCoordOrNull(latitude);
      const parsedLongitude = parseCoordOrNull(longitude);
      if (parsedLatitude == null || parsedLongitude == null) {
        return res.status(400).json({ error: 'Valid latitude and longitude are required' });
      }

      const isAdmin = req.user.role === 'ADMIN';
      const moderationStatus = isAdmin ? 'APPROVED' : 'PENDING';
      const isActive = isAdmin;
      const imageUrls = normalizeStringArray(images);
      const amenityNames = normalizeStringArray(amenities?.length ? amenities : features);
      const highlightTexts = normalizeStringArray(highlights);
      const scheduleObj = normalizeScheduleObject(schedule);
      const openingHourRows = openingHoursFromSchedule(scheduleObj);
      const ownDoc = optionalDocumentUrl(ownershipDocumentUrl);
      const licDoc = optionalDocumentUrl(licensesDocumentUrl);
      const fieldId = crypto.randomUUID();

      const imageRows = [];
      for (let i = 0; i < imageUrls.length; i += 1) {
        try {
          const saved = await persistPublicImage(imageUrls[i], { fieldId });
          if (!saved) continue;
          imageRows.push({
            storagePath: saved.storagePath,
            publicUrl: saved.publicUrl,
            displayOrder: i,
            isPrimary: i === 0
          });
        } catch {
          /* skip invalid gallery item */
        }
      }
      const documentRows = [];
      if (ownDoc) documentRows.push(await documentCreateData(ownDoc, 'OWNERSHIP_DOCUMENT', { fieldId }));
      if (licDoc) documentRows.push(await documentCreateData(licDoc, 'BUSINESS_LICENSE', { fieldId }));

      let field;
      try {
      field = await prisma.$transaction(async (tx) => {
        return tx.field.create({
          data: {
            id: fieldId,
            ownerId: req.user.id,
            name,
            sport,
            description: description || null,
            capacity: parseIntOrNull(capacity),
            type,
            location,
            address: address != null ? String(address).trim() || null : null,
            city: city != null ? String(city).trim() || null : null,
            district: district != null ? String(district).trim() || null : null,
            latitude: parsedLatitude,
            longitude: parsedLongitude,
            phone: phone || null,
            pricePerHour: toMinor(parseInt(pricePerHour, 10)),
            bookingType: bookingType != null ? String(bookingType).trim() || null : null,
            advanceBookingDays: parseAdvanceBookingDays(advanceBooking),
            cancellationPolicy:
              cancellationPolicy != null ? String(cancellationPolicy).trim() || null : null,
            moderationStatus,
            moderationReason: null,
            moderatedAt: isAdmin ? new Date() : null,
            moderatedById: isAdmin ? req.user.id : null,
            isActive,
            images: {
              create: imageRows
            },
            amenities: {
              create: amenityNames.map((n) => ({ name: n }))
            },
            highlights: {
              create: highlightTexts.map((text) => ({ text }))
            },
            openingHours: {
              create: openingHourRows
            },
            documents: {
              create: documentRows
            }
          },
          include: fieldDetailInclude
        });
      });
      } catch (createErr) {
        for (const row of imageRows) {
          if (row.storagePath) await removeManagedObject(row.storagePath);
        }
        for (const row of documentRows) {
          if (row.storagePath) await removeManagedObject(row.storagePath);
        }
        throw createErr;
      }

      await writeAuditLog({
        actorId: req.user.id,
        action: 'FIELD_CREATE',
        entityType: 'field',
        entityId: field.id,
        metadata: { moderationStatus, isActive },
        req
      });

      const msg = isAdmin ? 'Field created successfully' : 'Field submitted for approval';
      res.status(201).json({
        message: msg,
        field: serializeFieldForViewer(field, req)
      });
    } catch (error) {
      console.error('Create field error:', error);
      const payload = { error: error.message || 'Failed to create field' };
      if (process.env.NODE_ENV !== 'production') {
        payload.details = error && error.message ? String(error.message) : String(error);
      }
      res.status(error.status || 500).json(payload);
    }
  }
);

router.put(
  '/:id',
  authenticate,
  [
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
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const idTrim = typeof id === 'string' ? id.trim() : '';
      if (!isUuid(idTrim)) {
        return res.status(400).json({ error: 'Invalid field id' });
      }

      const existing = await fetchFieldById(idTrim, fieldDetailInclude);
      if (!existing) {
        return res.status(404).json({ error: 'Field not found' });
      }

      const uid = String(req.user.id);
      if (existing.ownerId !== uid && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Access denied' });
      }

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
        'isActive',
        'latitude',
        'longitude',
        'ownershipDocumentUrl',
        'licensesDocumentUrl'
      ];

      const scalarUpdates = {};
      let needsRemoderation = false;
      let imageUrls;
      let amenityNames;
      let highlightTexts;
      let scheduleObj;
      let ownershipDoc;
      let licensesDoc;

      allowedFields.forEach((f) => {
        if (req.body[f] === undefined) return;
        const normalized = normalizeUpdateFieldValue(f, req.body[f]);

        if (req.user.role !== 'ADMIN' && CORE_MODERATION_FIELDS.has(f)) {
          needsRemoderation = true;
        }

        if (f === 'images') imageUrls = normalized;
        else if (f === 'amenities' || f === 'features') amenityNames = normalized;
        else if (f === 'highlights') highlightTexts = normalized;
        else if (f === 'schedule') scheduleObj = normalized;
        else if (f === 'ownershipDocumentUrl') ownershipDoc = normalized;
        else if (f === 'licensesDocumentUrl') licensesDoc = normalized;
        else if (f === 'advanceBooking') scalarUpdates.advanceBookingDays = normalized;
        else if (f === 'isActive') {
          if (req.user.role === 'ADMIN') scalarUpdates.isActive = !!normalized;
        } else {
          scalarUpdates[f] = normalized;
        }
      });

      if (
        Object.keys(scalarUpdates).length === 0 &&
        imageUrls === undefined &&
        amenityNames === undefined &&
        highlightTexts === undefined &&
        scheduleObj === undefined &&
        ownershipDoc === undefined &&
        licensesDoc === undefined
      ) {
        return res.json({ message: 'No changes to update' });
      }

      if (needsRemoderation && req.user.role !== 'ADMIN') {
        scalarUpdates.moderationStatus = 'PENDING';
        scalarUpdates.moderationReason = null;
        scalarUpdates.moderatedAt = null;
        scalarUpdates.moderatedById = null;
        // Hide from public listings until re-approved
        scalarUpdates.isActive = false;
      }

      const updatedField = await prisma.$transaction(async (tx) => {
        await tx.field.update({
          where: { id: idTrim },
          data: scalarUpdates
        });

        if (imageUrls !== undefined) await replaceFieldImages(tx, idTrim, imageUrls);
        if (amenityNames !== undefined) await replaceFieldAmenities(tx, idTrim, amenityNames);
        if (highlightTexts !== undefined) await replaceFieldHighlights(tx, idTrim, highlightTexts);
        if (scheduleObj !== undefined) await replaceFieldOpeningHours(tx, idTrim, scheduleObj);
        if (ownershipDoc !== undefined) {
          await upsertFieldDocument(tx, idTrim, 'OWNERSHIP_DOCUMENT', ownershipDoc);
        }
        if (licensesDoc !== undefined) {
          await upsertFieldDocument(tx, idTrim, 'BUSINESS_LICENSE', licensesDoc);
        }

        return tx.field.findFirst({
          where: { id: idTrim },
          include: fieldDetailInclude
        });
      });

      await writeAuditLog({
        actorId: req.user.id,
        action: 'FIELD_UPDATE',
        entityType: 'field',
        entityId: idTrim,
        metadata: { needsRemoderation },
        req
      });

      const message = needsRemoderation && req.user.role !== 'ADMIN'
        ? 'Field updated. Changes were submitted for admin approval.'
        : 'Field updated successfully';

      res.json({
        message,
        field: serializeFieldForViewer(updatedField, req)
      });
    } catch (error) {
      console.error('Update field error:', error);
      res.status(error.status || 500).json({ error: error.message || 'Failed to update field' });
    }
  }
);

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!isUuid(id)) {
      return res.status(400).json({ error: 'Invalid field id' });
    }

    const field = await prisma.field.findFirst({
      where: { id, deletedAt: null },
      select: { ownerId: true, name: true }
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const ownerId = String(field.ownerId);
    const userId = String(req.user.id);
    if (ownerId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await deleteFieldCascade(id);

    await writeAuditLog({
      actorId: req.user.id,
      action: 'FIELD_DELETE',
      entityType: 'field',
      entityId: id,
      metadata: { name: field.name },
      req
    });

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

module.exports = router;
