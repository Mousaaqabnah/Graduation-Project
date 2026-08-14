/**
 * Apply cached language/direction before first paint.
 * Safe on auth pages (no API). Does not read secrets.
 */
(function () {
  try {
    var raw = localStorage.getItem('matchfieldLocalePrefs');
    var lang = 'en';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.language === 'ar') lang = 'ar';
    }
    if (document.documentElement) {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  } catch (_) {
    /* keep html defaults */
  }
})();
