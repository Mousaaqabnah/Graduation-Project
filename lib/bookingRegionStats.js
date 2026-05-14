'use strict';

function trimCollapse(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function canonicalRegionKey(label) {
  return trimCollapse(label).toLocaleLowerCase('tr-TR');
}

function isPostalLike(s) {
  return /^\d{4,10}$/.test(String(s).replace(/\s/g, ''));
}

/**
 * Best-effort parse of comma-separated address text toward a district / city label.
 */
function regionFromLocationString(location) {
  const raw = trimCollapse(location);
  if (!raw) return null;
  const parts = raw
    .split(',')
    .map((p) => trimCollapse(p))
    .filter((p) => p.length >= 2 && !isPostalLike(p));
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[parts.length - 1];
  const mid = parts[1];
  if (mid && mid.length >= 3) return mid;
  const penultimate = parts[parts.length - 2];
  if (penultimate && penultimate.length >= 2) return penultimate;
  return parts[parts.length - 1];
}

/**
 * @param {object|null|undefined} field - { city?, district?, location? }
 * @returns {{ key: string, display: string } | null} null = no named place (excluded from chart; shares renormalize among listed regions)
 */
function resolveRegionFromField(field) {
  if (!field) return null;
  const city = trimCollapse(field.city);
  if (city) return { key: canonicalRegionKey(city), display: city };
  const district = trimCollapse(field.district);
  if (district) return { key: canonicalRegionKey(district), display: district };
  const locLabel = regionFromLocationString(field.location);
  if (!locLabel) return null;
  return { key: canonicalRegionKey(locLabel), display: locLabel };
}

function percentsFromCounts(segments, total) {
  if (!total || !segments.length) return [];
  const enriched = segments.map((item) => {
    const exact = (100 * item.count) / total;
    return { ...item, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  const base = enriched.map((e) => ({
    label: e.label,
    count: e.count,
    percent: e.floor
  }));
  let deficit = 100 - base.reduce((a, r) => a + r.percent, 0);
  const order = enriched.map((e, idx) => ({ idx, frac: e.frac })).sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (deficit > 0 && order.length) {
    base[order[k % order.length].idx].percent += 1;
    deficit -= 1;
    k += 1;
  }
  return base;
}

/**
 * One bar per distinct resolved region. Percentages are shares among bookings that
 * could be placed on a region only (they always sum to 100%). Bookings with no
 * field / no usable address are omitted from the chart.
 *
 * @param {Array<{ fieldId: string }>} bookings
 * @param {Map<string, object>} fieldById
 * @param {{ maxRegions?: number }} [options] optional cap on rows (default: all)
 */
function buildBookingRegionStats(bookings, fieldById, options = {}) {
  const maxRegions =
    Number(options.maxRegions) > 0 ? Math.min(Number(options.maxRegions), 500) : 0;
  const map = new Map();

  for (const b of bookings) {
    const field = fieldById.get(b.fieldId);
    const resolved = resolveRegionFromField(field);
    if (!resolved) {
      continue;
    }
    const prev = map.get(resolved.key);
    if (prev) {
      prev.count += 1;
    } else {
      map.set(resolved.key, { display: resolved.display, count: 1 });
    }
  }

  const named = Array.from(map.entries())
    .map(([, v]) => ({ label: v.display, count: v.count }))
    .sort((a, b) => b.count - a.count);

  const listed = maxRegions > 0 ? named.slice(0, maxRegions) : named;
  const resolvedTotal = listed.reduce((s, x) => s + x.count, 0);
  if (resolvedTotal === 0) {
    return { total: bookings.length, rows: [] };
  }

  const segments = listed.map((row) => ({ label: row.label, count: row.count }));
  const rows = percentsFromCounts(segments, resolvedTotal);
  return { total: bookings.length, rows };
}

const api = {
  trimCollapse,
  canonicalRegionKey,
  regionFromLocationString,
  resolveRegionFromField,
  buildBookingRegionStats,
  percentsFromCounts
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.MatchFieldBookingRegionStats = api;
}
