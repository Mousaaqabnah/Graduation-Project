const { toMajor } = require('./money');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function minutesToHm(mins) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Number(mins) || 0));
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function hmToMinutes(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
}

function scheduleFromOpeningHours(openingHours) {
  const schedule = {};
  DAY_NAMES.forEach((name) => {
    schedule[name] = { enabled: true, opening: '09:00', closing: '22:00' };
  });
  if (!Array.isArray(openingHours)) return schedule;
  openingHours.forEach((row) => {
    const name = DAY_NAMES[row.dayOfWeek];
    if (!name) return;
    schedule[name] = {
      enabled: !row.isClosed,
      opening: minutesToHm(row.opensAtMinute),
      closing: minutesToHm(row.closesAtMinute)
    };
  });
  return schedule;
}

function openingHoursFromSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') return [];
  const rows = [];
  DAY_NAMES.forEach((name, dayOfWeek) => {
    const day = schedule[name];
    if (!day || typeof day !== 'object') return;
    const opens = hmToMinutes(day.opening) ?? 9 * 60;
    const closes = hmToMinutes(day.closing) ?? 22 * 60;
    rows.push({
      dayOfWeek,
      opensAtMinute: opens,
      closesAtMinute: closes,
      isClosed: day.enabled === false
    });
  });
  return rows;
}

function imageUrlsFromField(field) {
  if (!field) return [];
  if (Array.isArray(field.images) && field.images.length) {
    if (typeof field.images[0] === 'string') return field.images;
    return field.images
      .slice()
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map((img) => img.publicUrl || img.storagePath)
      .filter(Boolean);
  }
  return [];
}

function amenityNames(field) {
  if (!field) return [];
  if (Array.isArray(field.amenities)) {
    if (!field.amenities.length) return [];
    if (typeof field.amenities[0] === 'string') return field.amenities;
    return field.amenities.map((a) => a.name).filter(Boolean);
  }
  return [];
}

function highlightTexts(field) {
  if (!field) return [];
  if (Array.isArray(field.highlights)) {
    if (!field.highlights.length) return [];
    if (typeof field.highlights[0] === 'string') return field.highlights;
    return field.highlights.map((h) => h.text).filter(Boolean);
  }
  return [];
}

function serializeUser(user, { includePrivate = false } = {}) {
  if (!user) return null;
  const base = {
    id: user.id,
    email: includePrivate || user.email != null ? user.email : undefined,
    username: user.username,
    fullName: user.fullName,
    phone: includePrivate ? user.phone : user.phone,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    location: user.location,
    avatar: user.avatarUrl || user.avatar || null,
    avatarUrl: user.avatarUrl || user.avatar || null,
    playerCode: user.playerCode,
    role: user.role,
    status: user.status,
    verificationStatus:
      user.ownerProfile?.verificationStatus ||
      user.verificationStatus ||
      (user.role === 'OWNER' ? 'NOT_SUBMITTED' : null),
    preferences: user.preferences,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt
  };
  return base;
}

function documentApiUrl(fieldId, type, accessToken) {
  if (!fieldId || !type) return null;
  const base = `/api/fields/${fieldId}/documents/${encodeURIComponent(type)}`;
  if (accessToken) {
    return `${base}?access_token=${encodeURIComponent(accessToken)}`;
  }
  return base;
}

function documentUrlsForAuthorizedViewer(field, accessToken) {
  const out = { ownershipDocumentUrl: null, licensesDocumentUrl: null };
  const docs = Array.isArray(field?.documents) ? field.documents : [];
  docs.forEach((doc) => {
    if (!doc || !doc.type) return;
    // Never emit raw data URLs or private filesystem paths to clients
    const url = documentApiUrl(field.id, doc.type, accessToken);
    if (doc.type === 'OWNERSHIP_DOCUMENT') out.ownershipDocumentUrl = url;
    if (doc.type === 'BUSINESS_LICENSE') out.licensesDocumentUrl = url;
  });
  return out;
}

function baseFieldPayload(field) {
  const images = imageUrlsFromField(field).map((url) => {
    if (typeof url === 'string' && url.startsWith('uploads/')) return `/${url}`;
    return url;
  });
  const amenities = amenityNames(field);
  const highlights = highlightTexts(field);
  const schedule = field.schedule || scheduleFromOpeningHours(field.openingHours);
  const rating =
    field.rating != null
      ? Number(field.rating)
      : field.ratingAverage != null
        ? Number(field.ratingAverage)
        : 0;

  return {
    id: field.id,
    ownerId: field.ownerId,
    name: field.name,
    sport: field.sport,
    description: field.description,
    capacity: field.capacity,
    type: field.type,
    location: field.location,
    address: field.address,
    city: field.city,
    district: field.district,
    latitude: field.latitude != null ? Number(field.latitude) : null,
    longitude: field.longitude != null ? Number(field.longitude) : null,
    currency: field.currency || 'ILS',
    pricePerHour: toMajor(field.pricePerHour),
    amenities,
    features: amenities,
    highlights,
    images,
    schedule,
    bookingType: field.bookingType,
    advanceBookingDays: field.advanceBookingDays,
    advanceBooking: field.advanceBookingDays != null ? String(field.advanceBookingDays) : null,
    cancellationPolicy: field.cancellationPolicy,
    rating,
    ratingAverage: rating,
    reviewCount: field.reviewCount || 0,
    isActive: field.isActive,
    moderationStatus: field.moderationStatus,
    createdAt: field.createdAt,
    updatedAt: field.updatedAt,
    ownershipDocumentUrl: null,
    licensesDocumentUrl: null,
    pendingChanges: null,
    pendingChangeRequestedAt: null,
    venueResponse: null,
    visibilityRequested: null
  };
}

function attachReviews(out, field) {
  if (!Array.isArray(field.reviews)) return;
  out.reviews = field.reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    reviewText: r.reviewText,
    context: r.context,
    createdAt: r.createdAt,
    fieldId: r.fieldId,
    userId: r.userId,
    user: r.user
      ? {
          id: r.user.id,
          fullName: r.user.fullName,
          avatar: r.user.avatarUrl || r.user.avatar || null
        }
      : null
  }));
}

/** Public-safe field DTO — never includes KYC docs or owner private contact. */
function publicFieldSerializer(field) {
  if (!field) return null;
  const out = baseFieldPayload(field);
  // Public: contact phone on the field listing is intentional venue phone only when present
  out.phone = field.phone || null;
  if (field.owner) {
    out.owner = {
      id: field.owner.id,
      fullName: field.owner.fullName,
      avatar: field.owner.avatarUrl || field.owner.avatar || null
      // intentionally no owner.phone
    };
  }
  // Strip internal moderation details from public responses
  delete out.moderationReason;
  delete out.moderatedAt;
  delete out.moderatedById;
  delete out.deletedAt;
  attachReviews(out, field);
  if (field._count) out._count = field._count;
  return out;
}

/** Owner DTO — includes document download URLs (authz-gated routes), not raw storage. */
function ownerFieldSerializer(field, { accessToken } = {}) {
  if (!field) return null;
  const out = baseFieldPayload(field);
  out.phone = field.phone || null;
  out.moderationReason = field.moderationReason || null;
  out.moderatedAt = field.moderatedAt || null;
  out.moderatedById = field.moderatedById || null;
  out.deletedAt = field.deletedAt || null;
  Object.assign(out, documentUrlsForAuthorizedViewer(field, accessToken));
  if (field.owner) {
    out.owner = {
      id: field.owner.id,
      fullName: field.owner.fullName,
      avatar: field.owner.avatarUrl || field.owner.avatar || null,
      phone: field.owner.phone || null
    };
  }
  attachReviews(out, field);
  if (field._count) out._count = field._count;
  return out;
}

/** Admin DTO — moderation metadata + document download URLs. */
function adminFieldSerializer(field, { accessToken } = {}) {
  if (!field) return null;
  const out = ownerFieldSerializer(field, { accessToken });
  if (field.owner) {
    out.owner = {
      id: field.owner.id,
      fullName: field.owner.fullName,
      avatar: field.owner.avatarUrl || field.owner.avatar || null,
      phone: field.owner.phone || null,
      email: field.owner.email || null
    };
  }
  return out;
}

/**
 * Legacy helper — defaults to public-safe shape.
 * Prefer publicFieldSerializer / ownerFieldSerializer / adminFieldSerializer.
 */
function serializeField(field, { includeOwner = true, accessToken, variant } = {}) {
  if (!field) return null;
  if (variant === 'admin') return adminFieldSerializer(field, { accessToken });
  if (variant === 'owner') return ownerFieldSerializer(field, { accessToken });
  if (variant === 'public' || !variant) {
    const pub = publicFieldSerializer(field);
    if (!includeOwner) delete pub.owner;
    return pub;
  }
  return publicFieldSerializer(field);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ymdFromDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`;
}

function hmFromDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return `${pad2(x.getUTCHours())}:${pad2(x.getUTCMinutes())}`;
}

function shareByUserId(booking) {
  const map = new Map();
  (booking.paymentShares || []).forEach((s) => {
    map.set(String(s.userId), s);
  });
  return map;
}

function serializeBooking(booking) {
  if (!booking) return null;
  const startAt = booking.startAt ? new Date(booking.startAt) : null;
  const endAt = booking.endAt ? new Date(booking.endAt) : null;
  const ranges =
    Array.isArray(booking.slots) && booking.slots.length
      ? booking.slots
          .slice()
          .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
          .map((s) => ({
            start: hmFromDate(s.startAt),
            end: hmFromDate(s.endAt)
          }))
      : startAt && endAt
        ? [{ start: hmFromDate(startAt), end: hmFromDate(endAt) }]
        : [];

  const shares = shareByUserId(booking);
  const organizerShare = shares.get(String(booking.organizerId));
  const allShares = booking.paymentShares || [];
  const paidShares = allShares.filter((s) => String(s.status).toUpperCase() === 'PAID');
  const sharesSumMinor = allShares.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const paymentFullyPaid =
    allShares.length > 0 &&
    paidShares.length === allShares.length &&
    sharesSumMinor === Number(booking.totalCost);

  return {
    id: booking.id,
    fieldId: booking.fieldId,
    organizerId: booking.organizerId,
    startAt: booking.startAt,
    endAt: booking.endAt,
    date: startAt ? startAt.toISOString() : null,
    timeSlotStart: ranges[0]?.start || null,
    timeSlotEnd: ranges[ranges.length - 1]?.end || null,
    timeSlotRanges: ranges.length > 1 ? ranges : null,
    teamSize: booking.teamSize,
    currency: booking.currency,
    subtotal: toMajor(booking.subtotal),
    serviceFee: toMajor(booking.serviceFee),
    totalCost: toMajor(booking.totalCost),
    paymentMethod: booking.paymentMethod,
    paymentStatus: paymentFullyPaid ? 'PAID' : allShares.length ? 'PENDING' : null,
    organizerPaymentStatus: organizerShare
      ? String(organizerShare.status).toUpperCase() === 'PAID'
        ? 'paid'
        : 'pending'
      : null,
    paymentShares: allShares.map((s) => ({
      id: s.id,
      userId: s.userId,
      amount: toMajor(s.amount),
      status: s.status,
      paidAt: s.paidAt
    })),
    status: booking.status === 'CONFIRMED' ? 'UPCOMING' : booking.status,
    statusRaw: booking.status,
    notes: booking.notes,
    expiresAt: booking.expiresAt,
    confirmedAt: booking.confirmedAt,
    cancelledAt: booking.cancelledAt,
    cancellationReason: booking.cancellationReason,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    field: booking.field ? publicFieldSerializer(booking.field) : undefined,
    organizer: booking.organizer
      ? {
          id: booking.organizer.id,
          fullName: booking.organizer.fullName,
          avatar: booking.organizer.avatarUrl || null,
          email: booking.organizer.email,
          phone: booking.organizer.phone
        }
      : undefined,
    participants: Array.isArray(booking.participants)
      ? booking.participants.map((p) => {
          const share = shares.get(String(p.userId));
          return {
            id: p.id,
            userId: p.userId,
            status: p.status,
            isOrganizer: p.isOrganizer,
            paymentAmount: share ? toMajor(share.amount) : null,
            paymentStatus: share
              ? String(share.status).toUpperCase() === 'PAID'
                ? 'paid'
                : String(share.status).toLowerCase()
              : null,
            user: p.user
              ? {
                  id: p.user.id,
                  fullName: p.user.fullName,
                  avatar: p.user.avatarUrl || null,
                  email: p.user.email
                }
              : null
          };
        })
      : undefined
  };
}

module.exports = {
  DAY_NAMES,
  minutesToHm,
  hmToMinutes,
  scheduleFromOpeningHours,
  openingHoursFromSchedule,
  imageUrlsFromField,
  serializeUser,
  serializeField,
  publicFieldSerializer,
  ownerFieldSerializer,
  adminFieldSerializer,
  serializeBooking,
  documentApiUrl,
  ymdFromDate,
  hmFromDate
};
