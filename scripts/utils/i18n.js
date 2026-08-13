/**
 * Lightweight MatchField i18n for application UI strings.
 * Do not translate user-generated content (field names, messages, etc.).
 * Prefer textContent / data-i18n attributes — never inject translations as HTML.
 */
(function (global) {
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
      opt_istanbul: 'Istanbul (GMT+3)',
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
      opt_istanbul: 'إسطنبول (GMT+3)',
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

  function currentLang() {
    if (global.MatchFieldPrefs && typeof global.MatchFieldPrefs.getLanguage === 'function') {
      return global.MatchFieldPrefs.getLanguage();
    }
    return 'en';
  }

  function t(key) {
    var lang = currentLang();
    var table = translations[lang] || translations.en;
    if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    if (Object.prototype.hasOwnProperty.call(translations.en, key)) return translations.en[key];
    return key;
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
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      el.setAttribute('placeholder', t(key));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria-label');
      if (!key) return;
      el.setAttribute('aria-label', t(key));
    });
  }

  /** Apply translations + document locale after prefs hydrate. */
  function bootUiLocale() {
    if (global.MatchFieldPrefs && typeof global.MatchFieldPrefs.applyDocumentLocale === 'function') {
      global.MatchFieldPrefs.applyDocumentLocale(global.MatchFieldPrefs.getLanguage());
    }
    applyTranslations(document);
  }

  global.MatchFieldI18n = {
    translations: translations,
    t: t,
    applyTranslations: applyTranslations,
    bootUiLocale: bootUiLocale
  };
  global.t = global.t || t;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(bootUiLocale, 0);
      });
    } else {
      setTimeout(bootUiLocale, 0);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
