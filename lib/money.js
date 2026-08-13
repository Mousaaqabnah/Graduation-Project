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

/**
 * Display-only currency formatting. Does NOT convert between currencies.
 * amount is a major-unit number (e.g. 150), currency is ISO 4217 (ILS|TRY).
 */
function formatMoney(amount, currency, locale) {
  const n = Number(amount);
  const code = String(currency || 'ILS').toUpperCase() === 'TRY' ? 'TRY' : 'ILS';
  const loc =
    locale ||
    (code === 'TRY' ? 'tr-TR' : 'en-IL');
  const value = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch (_) {
    const symbol = code === 'TRY' ? '₺' : '₪';
    return `${symbol}${value.toLocaleString(loc)}`;
  }
}

function currencySymbol(currency) {
  return String(currency || 'ILS').toUpperCase() === 'TRY' ? '₺' : '₪';
}

module.exports = { toMinor, toMajor, formatMoney, currencySymbol };
