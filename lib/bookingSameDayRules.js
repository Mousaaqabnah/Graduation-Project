/**
 * Calendar YYYY-MM-DD in the environment's local timezone (matches HTML date inputs).
 */
function localCalendarYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Earliest allowed slot start (minutes from midnight) for that calendar day.
 * Same-day bookings cannot start before the current clock hour.
 * @returns {number|null} null when the rule does not apply (not local "today")
 */
function earliestAllowedSlotStartMinutesForYmd(ymd) {
  if (!ymd || typeof ymd !== 'string' || ymd !== localCalendarYmd()) return null;
  return new Date().getHours() * 60;
}

module.exports = {
  localCalendarYmd,
  earliestAllowedSlotStartMinutesForYmd
};
