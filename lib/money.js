/** Money helpers: DB stores Int minor units; API uses major units for the UI. */

function toMinor(major) {
  const n = Number(major);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function toMajor(minor) {
  const n = Number(minor);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / 100) * 100) / 100;
}

module.exports = { toMinor, toMajor };
