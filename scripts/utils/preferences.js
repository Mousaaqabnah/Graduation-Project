/**
 * MatchField user localization preferences (frontend).
 * Source of truth: API User.preferences. localStorage is a cache only.
 * Currency formatting is DISPLAY-ONLY — no FX conversion.
 */
(function (global) {
  var DEFAULTS = {
    language: 'en',
    currency: 'ILS',
    timezone: 'Asia/Jerusalem'
  };

  var ALLOWED_LANGUAGES = { en: true, ar: true };
  var ALLOWED_CURRENCIES = { ILS: true, TRY: true };
  var ALLOWED_TIMEZONES = {
    'Asia/Jerusalem': true,
    'Europe/Istanbul': true
  };

  var CACHE_KEY = 'matchfieldLocalePrefs';
  var ROLE_STORAGE = {
    PLAYER: 'playerSettings',
    OWNER: 'ownerSettings',
    ADMIN: 'adminSettings'
  };

  function normalizeLanguage(value) {
    var v = value == null ? '' : String(value).trim();
    return ALLOWED_LANGUAGES[v] ? v : DEFAULTS.language;
  }

  function normalizeCurrency(value) {
    var v = value == null ? '' : String(value).trim().toUpperCase();
    return ALLOWED_CURRENCIES[v] ? v : DEFAULTS.currency;
  }

  function normalizeTimezone(value) {
    var v = value == null ? '' : String(value).trim();
    return ALLOWED_TIMEZONES[v] ? v : DEFAULTS.timezone;
  }

  function normalizeLocalePrefs(slice) {
    var base = slice && typeof slice === 'object' && !Array.isArray(slice) ? slice : {};
    return Object.assign({}, base, {
      language: Object.prototype.hasOwnProperty.call(base, 'language')
        ? normalizeLanguage(base.language)
        : DEFAULTS.language,
      currency: Object.prototype.hasOwnProperty.call(base, 'currency')
        ? normalizeCurrency(base.currency)
        : DEFAULTS.currency,
      timezone: Object.prototype.hasOwnProperty.call(base, 'timezone')
        ? normalizeTimezone(base.timezone)
        : DEFAULTS.timezone
    });
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return normalizeLocalePrefs({});
      return normalizeLocalePrefs(JSON.parse(raw));
    } catch (_) {
      return normalizeLocalePrefs({});
    }
  }

  function writeCache(prefs) {
    var next = normalizeLocalePrefs(prefs);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        language: next.language,
        currency: next.currency,
        timezone: next.timezone
      }));
    } catch (_) {}
    return next;
  }

  function getLanguage() {
    return readCache().language;
  }

  function getCurrency() {
    return readCache().currency;
  }

  function getTimezone() {
    return readCache().timezone;
  }

  /**
   * Display-only money formatting. amount is major units.
   * Does not convert ILS↔TRY.
   */
  function formatMoney(amount, currency, locale) {
    var n = Number(amount);
    var code = normalizeCurrency(currency || getCurrency());
    var loc = locale || (code === 'TRY' ? 'tr-TR' : getLanguage() === 'ar' ? 'ar' : 'en-IL');
    var value = Number.isFinite(n) ? n : 0;
    try {
      return new Intl.NumberFormat(loc, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch (_) {
      var symbol = code === 'TRY' ? '₺' : '₪';
      return symbol + value.toLocaleString(loc);
    }
  }

  function currencySymbol(currency) {
    return normalizeCurrency(currency || getCurrency()) === 'TRY' ? '₺' : '₪';
  }

  /** Format an instant for display in the user's preferred IANA timezone. */
  function formatInTimezone(dateInput, options) {
    var d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(d.getTime())) return '';
    var tz = getTimezone();
    var opts = Object.assign(
      {
        timeZone: tz,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      },
      options || {}
    );
    try {
      return new Intl.DateTimeFormat(getLanguage() === 'ar' ? 'ar' : 'en-GB', opts).format(d);
    } catch (_) {
      return d.toISOString();
    }
  }

  function applyDocumentLocale(language) {
    var lang = normalizeLanguage(language || getLanguage());
    if (typeof document === 'undefined' || !document.documentElement) return lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    return lang;
  }

  function roleSliceKey(role) {
    var r = String(role || '').toUpperCase();
    if (r === 'ADMIN') return 'admin';
    if (r === 'OWNER') return 'owner';
    return 'player';
  }

  function syncRoleLocalStorage(role, localePrefs) {
    var key = ROLE_STORAGE[String(role || '').toUpperCase()];
    if (!key) return;
    try {
      var existing = JSON.parse(localStorage.getItem(key) || '{}');
      var next = Object.assign({}, existing, {
        language: localePrefs.language,
        currency: localePrefs.currency,
        timezone: localePrefs.timezone
      });
      localStorage.setItem(key, JSON.stringify(next));
    } catch (_) {}
  }

  /**
   * Load preferences from API for the logged-in user and update cache.
   * Safe no-op when unauthenticated.
   */
  async function hydrateFromApi() {
    if (typeof API === 'undefined' || !API.getAuthToken || !API.getAuthToken()) {
      applyDocumentLocale(getLanguage());
      return readCache();
    }
    try {
      var user = API.getCurrentUser && API.getCurrentUser();
      var role = (user && user.role) || 'PLAYER';
      var data = await API.users.getMyPreferences();
      var sliceKey = roleSliceKey(role);
      var slice = data && data[sliceKey] ? data[sliceKey] : {};
      var normalized = writeCache(normalizeLocalePrefs(slice));
      syncRoleLocalStorage(role, normalized);
      applyDocumentLocale(normalized.language);
      if (typeof global.dispatchEvent === 'function') {
        try {
          global.dispatchEvent(
            new CustomEvent('matchfield:prefs-updated', { detail: normalized })
          );
        } catch (_) {}
      }
      return normalized;
    } catch (_) {
      applyDocumentLocale(getLanguage());
      return readCache();
    }
  }

  function setLocalePrefs(partial, role) {
    var next = writeCache(Object.assign({}, readCache(), partial || {}));
    if (role) syncRoleLocalStorage(role, next);
    applyDocumentLocale(next.language);
    return next;
  }

  global.MatchFieldPrefs = {
    DEFAULTS: DEFAULTS,
    ALLOWED_LANGUAGES: ALLOWED_LANGUAGES,
    ALLOWED_CURRENCIES: ALLOWED_CURRENCIES,
    ALLOWED_TIMEZONES: ALLOWED_TIMEZONES,
    normalizeLocalePrefs: normalizeLocalePrefs,
    normalizeLanguage: normalizeLanguage,
    normalizeCurrency: normalizeCurrency,
    normalizeTimezone: normalizeTimezone,
    getLanguage: getLanguage,
    getCurrency: getCurrency,
    getTimezone: getTimezone,
    formatMoney: formatMoney,
    currencySymbol: currencySymbol,
    formatInTimezone: formatInTimezone,
    applyDocumentLocale: applyDocumentLocale,
    hydrateFromApi: hydrateFromApi,
    setLocalePrefs: setLocalePrefs,
    readCache: readCache
  };

  // Apply cached locale ASAP; hydrate from API when DOM is ready.
  applyDocumentLocale(getLanguage());
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        hydrateFromApi();
      });
    } else {
      hydrateFromApi();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
