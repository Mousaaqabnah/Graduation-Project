/**
 * Lightweight MatchField i18n for application UI strings.
 * Do not translate user-generated content (field names, messages, etc.).
 * Prefer textContent / data-i18n attributes — never inject translations as HTML.
 */
(function (global) {
  if (typeof require === 'function' && typeof window === 'undefined' && !global.MatchFieldI18nCatalog) {
    try {
      require('./i18n-catalog.js');
    } catch (_) {
      /* browser loads catalog via script tag */
    }
  }

  var translations = {
    en: {
      settings: 'Settings',
      preferences: 'Preferences',
      language: 'Language',
      language_desc: 'Choose your preferred language',
      currency: 'Currency',
      currency_desc: 'Select your preferred currency',
      timezone: 'Time Zone',
      timezone_desc: 'Set your time zone',
      opt_english: 'English',
      opt_arabic: 'Arabic - العربية',
      opt_ils: 'Israeli New Shekel (₪)',
      opt_try: 'Turkish Lira (₺)',
      opt_jerusalem: 'Jerusalem / Palestine (GMT+3)',
      opt_istanbul: 'Istanbul / Turkey (GMT+3)',
      save_failed: 'Failed to save preferences.',
      notifications: 'Notifications',
      account: 'Account',
      back: 'Back',
      'nav.home': 'Home Page',
      'nav.bookings': 'My Booking',
      'nav.bookings_plural': 'My Bookings',
      'nav.map': 'Map',
      'nav.contact': 'Contact Us',
      'nav.about': 'About Us',
      'nav.settings': 'Settings',
      'nav.logout': 'Log Out',
      'nav.profile': 'Profile',
      'nav.dashboard': 'Dashboard',
      'nav.fields': 'Fields',
      'nav.users': 'Users',
      'nav.verification': 'Verification',
      'nav.messages': 'Messages',
      'nav.earnings': 'Earnings',
      'nav.statistics': 'Statistics',
      'nav.my_fields': 'My Fields',
      'nav.bookings_list': 'Bookings',
      price_per_hour: 'Price per Hour',
      total: 'Total',
      pay_now: 'Pay Now',
      pay_your_share: 'Pay Your Share'
    },
    ar: {
      settings: 'الإعدادات',
      preferences: 'التفضيلات',
      language: 'اللغة',
      language_desc: 'اختر لغتك المفضلة',
      currency: 'العملة',
      currency_desc: 'اختر عملتك المفضلة',
      timezone: 'المنطقة الزمنية',
      timezone_desc: 'حدد منطقتك الزمنية',
      opt_english: 'English',
      opt_arabic: 'العربية',
      opt_ils: 'الشيكل الإسرائيلي الجديد (₪)',
      opt_try: 'الليرة التركية (₺)',
      opt_jerusalem: 'القدس / فلسطين (GMT+3)',
      opt_istanbul: 'إسطنبول / تركيا (GMT+3)',
      save_failed: 'تعذر حفظ التفضيلات.',
      notifications: 'الإشعارات',
      account: 'الحساب',
      back: 'رجوع',
      'nav.home': 'الصفحة الرئيسية',
      'nav.bookings': 'حجوزاتي',
      'nav.bookings_plural': 'حجوزاتي',
      'nav.map': 'الخريطة',
      'nav.contact': 'اتصل بنا',
      'nav.about': 'من نحن',
      'nav.settings': 'الإعدادات',
      'nav.logout': 'تسجيل الخروج',
      'nav.profile': 'الملف الشخصي',
      'nav.dashboard': 'لوحة التحكم',
      'nav.fields': 'الملاعب',
      'nav.users': 'المستخدمون',
      'nav.verification': 'التحقق',
      'nav.messages': 'الرسائل',
      'nav.earnings': 'الأرباح',
      'nav.statistics': 'الإحصائيات',
      'nav.my_fields': 'ملاعبي',
      'nav.bookings_list': 'الحجوزات',
      price_per_hour: 'السعر لكل ساعة',
      total: 'الإجمالي',
      pay_now: 'ادفع الآن',
      pay_your_share: 'ادفع حصتك'
    }
  };

  var catalog = global.MatchFieldI18nCatalog || { en: {}, ar: {} };
  if (catalog.en) Object.assign(translations.en, catalog.en);
  if (catalog.ar) Object.assign(translations.ar, catalog.ar);

  var ERROR_MESSAGE_KEYS = {
    'Invalid email or password': 'errors.invalidCredentials',
    'Email already registered': 'errors.emailRegistered',
    'Email or username already registered': 'errors.emailOrUsernameRegistered',
    'Registration failed': 'errors.registrationFailed',
    'Login failed': 'errors.loginFailed',
    'Invalid or expired refresh token': 'errors.refreshInvalid',
    'Current password is incorrect': 'errors.currentPasswordWrong',
    'New password must be different from current password': 'errors.passwordMustDiffer',
    'Password must be 8–128 characters': 'errors.passwordLength',
    'Account deleted successfully': 'errors.accountDeleted',
    'Booking not found': 'errors.bookingNotFound',
    'Access denied': 'errors.accessDenied',
    'Field not found': 'errors.fieldNotFound',
    'Authentication required': 'errors.authRequired',
    'User not found': 'errors.userNotFound',
    'Failed to load protected resource': 'errors.failedProtected',
    'Invalid role': 'errors.invalidRole',
    'Invalid gender value': 'errors.invalidGender',
    'Field not found or inactive': 'errors.fieldInactive',
    'End time must be after start time.': 'errors.endAfterStart',
    'One or more selected slots are already booked.': 'errors.slotsBooked',
    'Only players can be invited to a booking': 'errors.onlyPlayersInvite',
    'Only players can be invited to a booking.': 'errors.onlyPlayersInvitePeriod',
    'Failed to create booking': 'errors.createBookingFailed',
    'Booking cannot be confirmed until all required payments are settled on the server': 'errors.paymentsNotSettled',
    'Cannot settle payment for another user': 'errors.cannotSettleOther',
    'You cannot reschedule a booking less than 24 hours before its start time.': 'errors.rescheduleTooSoon',
    'Failed to reschedule booking': 'errors.rescheduleFailed',
    'Owner verification required to create fields': 'errors.ownerVerifyRequired',
    'Valid latitude and longitude are required': 'errors.latLngRequired',
    'This date/time is already blocked': 'errors.alreadyBlocked',
    'Account is already verified': 'errors.alreadyVerified',
    'Verification is already pending review': 'errors.verificationPending',
    'Failed to submit your message': 'errors.supportSubmitFailed',
    'Please enter a valid email address.': 'errors.invalidEmail',
    'No bookable slots in the selected range.': 'errors.noSlots',
    'Failed to update password': 'errors.updatePasswordFailed',
    'Failed to delete account': 'errors.deleteAccountFailed',
    'Field already in favorites': 'errors.alreadyFavorite',
    'You can only review bookings you participated in': 'errors.reviewParticipantsOnly',
    'You can only review a booking after it is completed': 'errors.reviewAfterCompleted',
    'A review already exists for this booking': 'errors.reviewAlreadyExists',
    'Image data is too large; use a smaller photo': 'errors.imageTooLarge',
    'Invalid avatar image': 'errors.invalidAvatar',
    'Organizer cannot leave; cancel the booking instead': 'errors.organizerCannotLeave',
    'Failed to settle payment': 'errors.settlePaymentFailed',
    'Card details must not be sent to the server. Use the manual settlement flow only.': 'errors.cardDetailsNotSent',
    'Invalid booking date/time': 'errors.invalidBookingDateTime',
    'Failed to update booking': 'errors.failedUpdateBooking',
    'Failed to update profile': 'errors.failedUpdateProfile',
    'Invalid verification document upload': 'errors.invalidVerificationDoc',
    'Failed to submit verification': 'errors.failedSubmitVerification'
  };

  var SPORT_ALIASES = {
    soccer: 'football',
    football: 'football',
    basketball: 'basketball',
    tennis: 'tennis',
    padel: 'padel',
    futsal: 'futsal',
    volleyball: 'volleyball',
    badminton: 'badminton',
    other: 'other',
    indoor: 'indoor',
    outdoor: 'outdoor',
    all: 'all'
  };

  function currentLang() {
    if (global.MatchFieldPrefs && typeof global.MatchFieldPrefs.getLanguage === 'function') {
      return global.MatchFieldPrefs.getLanguage();
    }
    return 'en';
  }

  function interpolate(str, params) {
    if (!params || typeof params !== 'object') return str;
    return String(str).replace(/\{(\w+)\}/g, function (_, name) {
      if (!Object.prototype.hasOwnProperty.call(params, name)) return '{' + name + '}';
      var value = params[name];
      if (value == null) return '';
      return String(value);
    });
  }

  function lookup(lang, key) {
    var table = translations[lang] || translations.en;
    if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    if (lang !== 'en' && Object.prototype.hasOwnProperty.call(translations.en, key)) {
      return translations.en[key];
    }
    return null;
  }

  function t(key, params) {
    if (key == null || key === '') return '';
    var lang = currentLang();
    var raw = lookup(lang, key);
    if (raw == null) return String(key);
    return interpolate(raw, params);
  }

  function hasKey(key) {
    return (
      Object.prototype.hasOwnProperty.call(translations.en, key) ||
      Object.prototype.hasOwnProperty.call(translations.ar, key)
    );
  }

  function statusLabel(code) {
    var c = String(code || '').trim().toUpperCase().replace(/\s+/g, '_');
    if (!c) return '';
    var key = 'status.' + c;
    if (hasKey(key)) return t(key);
    return c;
  }

  function sportLabel(code) {
    var raw = String(code || '').trim().toLowerCase();
    if (!raw) return '';
    var alias = SPORT_ALIASES[raw] || raw;
    var key = 'sports.' + alias;
    if (hasKey(key)) return t(key);
    return String(code);
  }

  function paymentModeLabel(mode) {
    var m = String(mode || '').trim().toUpperCase();
    if (m === 'ORGANIZER') return t('payment.modeOrganizer');
    if (m === 'SPLIT') return t('payment.modeSplit');
    if (m === 'MIXED') return t('payment.modeMixed');
    return m;
  }

  function localizeError(message) {
    var m = String(message || '').trim();
    if (!m) return m;
    if (ERROR_MESSAGE_KEYS[m]) return t(ERROR_MESSAGE_KEYS[m]);
    var lower = m.toLowerCase();
    for (var i = 0; i < Object.keys(ERROR_MESSAGE_KEYS).length; i++) {
      var enMsg = Object.keys(ERROR_MESSAGE_KEYS)[i];
      if (lower === enMsg.toLowerCase()) return t(ERROR_MESSAGE_KEYS[enMsg]);
    }
    return m;
  }

  function applyAttr(scope, attrName, setter) {
    scope.querySelectorAll('[' + attrName + ']').forEach(function (el) {
      var key = el.getAttribute(attrName);
      if (!key) return;
      setter(el, t(key));
    });
  }

  /**
   * Apply data-i18n / data-i18n-placeholder / data-i18n-aria-label via textContent only.
   */
  function applyTranslations(root) {
    var scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });
    applyAttr(scope, 'data-i18n-placeholder', function (el, value) {
      el.setAttribute('placeholder', value);
    });
    applyAttr(scope, 'data-i18n-aria-label', function (el, value) {
      el.setAttribute('aria-label', value);
    });
    applyAttr(scope, 'data-i18n-title', function (el, value) {
      el.setAttribute('title', value);
    });
    applyAttr(scope, 'data-i18n-alt', function (el, value) {
      el.setAttribute('alt', value);
    });
    if (scope.querySelector) {
      var titleEl = scope.querySelector('title[data-i18n]') || (scope === document ? document.querySelector('title[data-i18n]') : null);
      if (titleEl) {
        var titleKey = titleEl.getAttribute('data-i18n');
        if (titleKey) titleEl.textContent = t(titleKey);
      }
    }
  }

  function applyLanguage(language) {
    var lang = language;
    if (global.MatchFieldPrefs && typeof global.MatchFieldPrefs.applyDocumentLocale === 'function') {
      lang = global.MatchFieldPrefs.applyDocumentLocale(language || currentLang());
    } else if (typeof document !== 'undefined' && document.documentElement) {
      lang = language === 'ar' ? 'ar' : 'en';
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
    applyTranslations(typeof document !== 'undefined' ? document : null);
    if (typeof global.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      try {
        global.dispatchEvent(new CustomEvent('matchfield:locale-applied', { detail: { language: lang || currentLang() } }));
      } catch (_) {}
    }
    return lang;
  }

  /** Apply translations + document locale after prefs hydrate. */
  function bootUiLocale() {
    applyLanguage(currentLang());
  }

  global.MatchFieldI18n = {
    translations: translations,
    t: t,
    hasKey: hasKey,
    statusLabel: statusLabel,
    sportLabel: sportLabel,
    paymentModeLabel: paymentModeLabel,
    localizeError: localizeError,
    applyTranslations: applyTranslations,
    applyLanguage: applyLanguage,
    bootUiLocale: bootUiLocale,
    interpolate: interpolate
  };
  global.t = t;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(bootUiLocale, 0);
      });
    } else {
      setTimeout(bootUiLocale, 0);
    }
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('matchfield:prefs-updated', function () {
        bootUiLocale();
      });
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.MatchFieldI18n;
  }
})(typeof window !== 'undefined' ? window : globalThis);
