/**
 * User localization preferences (language / currency / timezone).
 * Stored in User.preferences JSON under role slices: player | owner | admin.
 * Missing values normalize to Palestine-oriented defaults at runtime (no migration).
 */

const DEFAULT_LANGUAGE = 'en';
const DEFAULT_CURRENCY = 'ILS';
const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

const ALLOWED_LANGUAGES = new Set(['en', 'ar']);
const ALLOWED_CURRENCIES = new Set(['ILS', 'TRY']);
const ALLOWED_TIMEZONES = new Set(['Asia/Jerusalem', 'Europe/Istanbul']);

const LOCALE_DEFAULTS = Object.freeze({
  language: DEFAULT_LANGUAGE,
  currency: DEFAULT_CURRENCY,
  timezone: DEFAULT_TIMEZONE
});

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLanguage(value) {
  const v = value == null ? '' : String(value).trim();
  return ALLOWED_LANGUAGES.has(v) ? v : DEFAULT_LANGUAGE;
}

function normalizeCurrency(value) {
  const v = value == null ? '' : String(value).trim().toUpperCase();
  return ALLOWED_CURRENCIES.has(v) ? v : DEFAULT_CURRENCY;
}

function normalizeTimezone(value) {
  const v = value == null ? '' : String(value).trim();
  return ALLOWED_TIMEZONES.has(v) ? v : DEFAULT_TIMEZONE;
}

/**
 * Merge locale defaults into a role preference slice without dropping other keys.
 * Explicitly saved allowed values are preserved; missing/invalid → defaults.
 */
function normalizeLocalePrefs(slice) {
  const base = isPlainObject(slice) ? { ...slice } : {};
  const hasLanguage = Object.prototype.hasOwnProperty.call(base, 'language');
  const hasCurrency = Object.prototype.hasOwnProperty.call(base, 'currency');
  const hasTimezone = Object.prototype.hasOwnProperty.call(base, 'timezone');

  return {
    ...base,
    language: hasLanguage ? normalizeLanguage(base.language) : DEFAULT_LANGUAGE,
    currency: hasCurrency ? normalizeCurrency(base.currency) : DEFAULT_CURRENCY,
    timezone: hasTimezone ? normalizeTimezone(base.timezone) : DEFAULT_TIMEZONE
  };
}

/**
 * Validate inbound locale fields. Returns { ok, errors, sanitized }.
 * Unknown/invalid enum values produce errors (do not silently coerce on write).
 */
function validateLocalePrefPatch(body) {
  const errors = [];
  const sanitized = {};
  if (!isPlainObject(body)) {
    return { ok: false, errors: ['Invalid preferences body'], sanitized };
  }

  if (Object.prototype.hasOwnProperty.call(body, 'language')) {
    const v = String(body.language || '').trim();
    if (!ALLOWED_LANGUAGES.has(v)) {
      errors.push('Invalid language');
    } else {
      sanitized.language = v;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'currency')) {
    const v = String(body.currency || '').trim().toUpperCase();
    if (!ALLOWED_CURRENCIES.has(v)) {
      errors.push('Invalid currency');
    } else {
      sanitized.currency = v;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'timezone')) {
    const v = String(body.timezone || '').trim();
    if (!ALLOWED_TIMEZONES.has(v)) {
      errors.push('Invalid timezone');
    } else {
      sanitized.timezone = v;
    }
  }

  return { ok: errors.length === 0, errors, sanitized };
}

function roleKeyForUser(role) {
  const r = String(role || '').toUpperCase();
  if (r === 'ADMIN') return 'admin';
  if (r === 'OWNER') return 'owner';
  return 'player';
}

function getRoleSlice(preferences, role) {
  const raw = isPlainObject(preferences) ? preferences : {};
  const key = roleKeyForUser(role);
  return isPlainObject(raw[key]) ? raw[key] : {};
}

module.exports = {
  DEFAULT_LANGUAGE,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  LOCALE_DEFAULTS,
  ALLOWED_LANGUAGES,
  ALLOWED_CURRENCIES,
  ALLOWED_TIMEZONES,
  normalizeLanguage,
  normalizeCurrency,
  normalizeTimezone,
  normalizeLocalePrefs,
  validateLocalePrefPatch,
  roleKeyForUser,
  getRoleSlice,
  isPlainObject
};
