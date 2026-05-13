/**
 * Booking duration & total cost from time strings (HH:mm).
 * Matches player booking UI: price is per hour, fractional hours count (e.g. 18:00–19:30 = 1.5h).
 */

function timeStrToMinutes(s) {
  if (s == null || s === '') return NaN;
  const parts = String(s).trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] != null && parts[1] !== '' ? parts[1] : '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}

/** Hours between two same-day times (fractional). Returns 0 if invalid or end <= start. */
function hoursInRange(startStr, endStr) {
  const a = timeStrToMinutes(startStr);
  const b = timeStrToMinutes(endStr);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  const diff = b - a;
  if (diff <= 0) return 0;
  return diff / 60;
}

/**
 * @param {Array<{start: string, end: string}>} ranges
 * @returns {number} total hours (fractional)
 */
function totalHoursFromRanges(ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return 0;
  let sum = 0;
  for (const r of ranges) {
    if (!r || r.start == null || r.end == null) continue;
    sum += hoursInRange(r.start, r.end);
  }
  return sum;
}

function totalCostFromFieldPrice(pricePerHour, ranges) {
  const hours = totalHoursFromRanges(ranges);
  return Math.round((Number(pricePerHour) || 0) * hours);
}

module.exports = {
  timeStrToMinutes,
  hoursInRange,
  totalHoursFromRanges,
  totalCostFromFieldPrice
};
