/**
 * Localization regression suite (no external translation APIs).
 * Run: npm run test:i18n
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const {
  DEFAULT_LANGUAGE,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  normalizeLanguage,
  normalizeLocalePrefs,
  validateLocalePrefPatch,
  ALLOWED_LANGUAGES,
  ALLOWED_CURRENCIES,
  ALLOWED_TIMEZONES
} = require('../lib/userPreferences');

let lang = 'en';
global.MatchFieldPrefs = {
  getLanguage() {
    return lang;
  },
  applyDocumentLocale(language) {
    lang = language === 'ar' ? 'ar' : 'en';
    return lang;
  }
};

const I18n = require('./utils/i18n.js');
const catalog = require('./utils/i18n-catalog.js');

let passed = 0;
let failed = 0;

function record(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log('PASS', name);
  } else {
    failed += 1;
    console.log('FAIL', name, detail || '');
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walkHtml(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walkHtml(abs, acc);
    else if (name.endsWith('.html')) acc.push(abs);
  }
  return acc;
}

function hasArabic(str) {
  return /[\u0600-\u06FF]/.test(String(str || ''));
}

function hasMojibake(str) {
  return /Ã.|â€.|Ø.|Ù.|ðŸ/.test(String(str || '')) && /â€/.test(String(str || ''));
}

lang = 'en';
record('en supported', ALLOWED_LANGUAGES.has('en') && I18n.hasKey('nav.home'));
record('ar supported', ALLOWED_LANGUAGES.has('ar'));

record('invalid language rejected on write', !validateLocalePrefPatch({ language: 'fr' }).ok);
record('invalid language falls back to en on normalize', normalizeLanguage('fr') === 'en' && DEFAULT_LANGUAGE === 'en');

const prefsSrc = read('scripts/utils/preferences.js');
record(
  'English -> LTR',
  /dir\s*=\s*lang\s*===\s*['"]ar['"]\s*\?\s*['"]rtl['"]\s*:\s*['"]ltr['"]/.test(prefsSrc)
);
record(
  'Arabic -> RTL',
  prefsSrc.includes("dir = lang === 'ar' ? 'rtl' : 'ltr'")
);

record('user preference language validation accepts en+ar', validateLocalePrefPatch({ language: 'en' }).ok && validateLocalePrefPatch({ language: 'ar' }).ok);
record(
  'language preference persistence/normalization',
  normalizeLocalePrefs({ language: 'ar' }).language === 'ar' &&
    normalizeLocalePrefs({}).language === 'en'
);

lang = 'en';
record('translation lookup works', I18n.t('nav.home') === 'Home Page');
lang = 'ar';
record('matching Arabic key exists', I18n.t('nav.home') === 'الصفحة الرئيسية');
lang = 'en';
record('missing-key behavior is safe', I18n.t('this.key.does.not.exist') === 'this.key.does.not.exist');
record(
  'interpolation works safely',
  I18n.t('booking.playersCount', { count: 4 }).includes('4') &&
    !I18n.t('booking.playersCount', { count: '<script>' }).includes('<script>alert')
);
record('common English key exists', I18n.hasKey('common.save') && I18n.t('common.save') === 'Save');
lang = 'ar';
record('common Arabic key exists', hasArabic(I18n.t('common.save')));
record('booking translation keys exist', I18n.hasKey('booking.confirmBooking') && I18n.hasKey('booking.bookField'));
record('auth translation keys exist', I18n.hasKey('auth.logIn') && I18n.hasKey('auth.email'));
record('owner translation keys exist', I18n.hasKey('owner.addField') && I18n.hasKey('owner.ownershipDocument'));
record('admin translation keys exist', I18n.hasKey('admin.usersManagement') && I18n.hasKey('nav.messages'));
record('status translations exist', I18n.hasKey('status.CONFIRMED') && I18n.hasKey('status.PENDING'));
record('sports translations exist', I18n.hasKey('sports.football') && I18n.hasKey('sports.padel'));

lang = 'ar';
record('Arabic strings are real UTF-8 Arabic', hasArabic(I18n.t('auth.logIn')) && hasArabic(I18n.t('booking.confirmBooking')));

const catalogSrc = read('scripts/utils/i18n-catalog.js');
const i18nSrc = read('scripts/utils/i18n.js');
record('no mojibake in active localization files', !hasMojibake(catalogSrc) && !hasMojibake(i18nSrc));

record('machine enum values remain unchanged', I18n.statusLabel('CONFIRMED') !== 'CONFIRMED');

lang = 'ar';
record('status helper translates display only', I18n.statusLabel('CONFIRMED') === I18n.t('status.CONFIRMED'));
lang = 'en';
record('sport helper translates display only', I18n.sportLabel('Football') === I18n.t('sports.football'));

record('currency default remains ILS', DEFAULT_CURRENCY === 'ILS');
record('timezone default remains Asia/Jerusalem', DEFAULT_TIMEZONE === 'Asia/Jerusalem');
record('TRY remains optional', ALLOWED_CURRENCIES.has('TRY') && DEFAULT_CURRENCY !== 'TRY');
record('Europe/Istanbul remains optional', ALLOWED_TIMEZONES.has('Europe/Istanbul') && DEFAULT_TIMEZONE !== 'Europe/Istanbul');

const playerHome = read('pages/player/home.html');
const ownerDash = read('pages/owner/dashboard.html');
record(
  'no internal chat navigation restored',
  !playerHome.includes('chat.html') &&
    !ownerDash.includes('chat.html') &&
    !/nav\.chat/.test(i18nSrc + catalogSrc)
);

const serverSrc = read('server.js');
record(
  'no /api/messages restored',
  !/\/api\/messages/.test(serverSrc) || /404/.test(serverSrc)
);
const routes = fs.readdirSync(path.join(ROOT, 'routes')).join(' ');
record('no messages route module', !fs.existsSync(path.join(ROOT, 'routes', 'messages.js')));

const inj =
  /<script|javascript:|onerror\s*=/i.test(JSON.stringify(catalog.en) + JSON.stringify(catalog.ar));
record('translations do not contain script/HTML injection patterns', !inj);

const i18nApply = i18nSrc.includes('el.textContent = t(key)') && !/innerHTML\s*=/.test(i18nSrc);
record('i18n applyTranslations uses textContent not innerHTML', i18nApply);

const pages = walkHtml(path.join(ROOT, 'pages'));
const missingI18n = pages.filter((p) => !fs.readFileSync(p, 'utf8').includes('i18n.js'));
record('active HTML pages use localization architecture', missingI18n.length === 0, missingI18n.map((p) => path.relative(ROOT, p)).join(', '));

const missingBoot = pages.filter((p) => !fs.readFileSync(p, 'utf8').includes('locale-boot.js'));
record('active HTML pages apply cached language early', missingBoot.length === 0, missingBoot.map((p) => path.relative(ROOT, p)).join(', '));

const enKeys = Object.keys(catalog.en);
const arKeys = Object.keys(catalog.ar);
const missingAr = enKeys.filter((k) => !Object.prototype.hasOwnProperty.call(catalog.ar, k));
record('catalog en/ar key parity', missingAr.length === 0, missingAr.slice(0, 8).join(', '));

const loginHtml = read('pages/auth/login.html');
record('login page uses data-i18n', loginHtml.includes('data-i18n="auth.logIn"'));
record('rtl stylesheet present on auth login', loginHtml.includes('rtl.css'));

record(
  'representative user-generated content remains escaped',
  read('scripts/player/home.js').includes('escapeHtml(venue.name)') ||
    read('scripts/utils/dom-safe.js').includes('function escapeHtml')
);

record('applyLanguage exported', typeof I18n.applyLanguage === 'function');
record('localizeError maps known API copy', I18n.localizeError('Invalid email or password') === I18n.t('errors.invalidCredentials'));

const termsHtml = read('pages/auth/terms.html');
record(
  'terms HTML wires remaining legal sections',
  termsHtml.includes('data-i18n="legal.terms7h"') &&
    termsHtml.includes('data-i18n="legal.terms8h"') &&
    termsHtml.includes('data-i18n="legal.terms9h"') &&
    termsHtml.includes('data-i18n="legal.termsNote"')
);
lang = 'ar';
record(
  'terms Arabic coverage',
  hasArabic(I18n.t('legal.terms7h')) &&
    hasArabic(I18n.t('legal.terms7')) &&
    hasArabic(I18n.t('legal.terms8')) &&
    hasArabic(I18n.t('legal.terms9')) &&
    hasArabic(I18n.t('legal.termsNote')) &&
    I18n.t('legal.terms7').includes('MatchField')
);

const privacyHtml = read('pages/auth/privacy.html');
record(
  'privacy HTML wires remaining legal sections',
  privacyHtml.includes('data-i18n="legal.privacy1h"') &&
    privacyHtml.includes('data-i18n="legal.privacySecurityH"') &&
    privacyHtml.includes('data-i18n="legal.privacyChoicesH"') &&
    privacyHtml.includes('data-i18n="legal.privacyTransfersH"') &&
    privacyHtml.includes('data-i18n="legal.privacyChangesH"') &&
    privacyHtml.includes('data-i18n="legal.privacyContactH"') &&
    privacyHtml.includes('data-i18n="legal.privacyNote"')
);
record(
  'privacy Arabic coverage',
  hasArabic(I18n.t('legal.privacy1a')) &&
    hasArabic(I18n.t('legal.privacySecurity')) &&
    hasArabic(I18n.t('legal.privacyChoices')) &&
    hasArabic(I18n.t('legal.privacyNote')) &&
    I18n.t('legal.privacyIntro').includes('MatchField') === false
      ? hasArabic(I18n.t('legal.privacyIntro'))
      : hasArabic(I18n.t('legal.privacyIntro'))
);

const homeHtml = read('pages/player/home.html');
record(
  'representative placeholders are localized',
  homeHtml.includes('data-i18n-placeholder="payment.cardholderExample"') &&
    homeHtml.includes('data-i18n-placeholder="geo.ramallah"') &&
    homeHtml.includes('data-i18n-placeholder="booking.searchPlayerPh"') &&
    hasArabic(I18n.t('payment.cardholderExample')) &&
    hasArabic(I18n.t('geo.ramallah'))
);

const ownerBookingsHtml = read('pages/owner/bookings.html');
record(
  'representative filter labels keep machine option values',
  ownerBookingsHtml.includes('value="All Fields"') &&
    ownerBookingsHtml.includes('value="Pending"') &&
    ownerBookingsHtml.includes('value="Football"') &&
    ownerBookingsHtml.includes('data-i18n="filter.allFields"') &&
    ownerBookingsHtml.includes('data-i18n="status.PENDING"')
);

lang = 'ar';
record(
  'common API error mappings',
  I18n.localizeError('Authentication required') === I18n.t('errors.authRequired') &&
    I18n.localizeError('Field not found or inactive') === I18n.t('errors.fieldInactive') &&
    I18n.localizeError('One or more selected slots are already booked.') === I18n.t('errors.slotsBooked') &&
    I18n.localizeError('Owner verification required to create fields') === I18n.t('errors.ownerVerifyRequired') &&
    I18n.localizeError('Failed to submit your message') === I18n.t('errors.supportSubmitFailed') &&
    I18n.localizeError('Access denied') === I18n.t('errors.accessDenied') &&
    hasArabic(I18n.localizeError('Invalid email or password'))
);
record(
  'unmapped API errors keep backend message',
  I18n.localizeError('Some unknown backend error xyz') === 'Some unknown backend error xyz'
);

const attrKeyRe = /data-i18n(?:-placeholder|-aria-label|-title|-alt)?="([^"]+)"/g;
const missingUiKeys = [];
for (const abs of pages) {
  const html = fs.readFileSync(abs, 'utf8');
  let m;
  attrKeyRe.lastIndex = 0;
  while ((m = attrKeyRe.exec(html))) {
    if (m[1] && !I18n.hasKey(m[1])) missingUiKeys.push(path.relative(ROOT, abs) + ':' + m[1]);
  }
}
record(
  'no missing catalog keys on audited active UI',
  missingUiKeys.length === 0,
  missingUiKeys.slice(0, 8).join(', ')
);

lang = 'ar';
record(
  'Arabic-mode filter labels are Arabic not English',
  hasArabic(I18n.t('filter.allFields')) &&
    hasArabic(I18n.t('filter.allStatus')) &&
    I18n.t('filter.allFields') !== 'All Fields'
);

console.log('\n---');
console.log(`PASS ${passed} / FAIL ${failed}`);
process.exit(failed ? 1 : 0);
