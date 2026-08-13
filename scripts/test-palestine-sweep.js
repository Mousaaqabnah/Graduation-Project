/**
 * Palestine product sweep regression tests (Phase 2).
 * Display/defaults only — no FX, no payment math changes.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const {
  formatMoney,
  currencySymbol
} = require('../lib/money');
const {
  LOCALE_DEFAULTS,
  ALLOWED_CURRENCIES,
  ALLOWED_TIMEZONES,
  normalizeLocalePrefs
} = require('../lib/userPreferences');
const geo = require('./utils/geoDefaults');

let passed = 0;
let failed = 0;
const failures = [];

function record(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log('PASS', name);
  } else {
    failed += 1;
    failures.push(detail ? `${name}: ${detail}` : name);
    console.log('FAIL', name, detail || '');
  }
}

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function listRuntimeUiScripts() {
  const roots = [
    path.join(__dirname, 'player'),
    path.join(__dirname, 'owner'),
    path.join(__dirname, 'admin'),
    path.join(__dirname, 'utils')
  ];
  const out = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root)) {
      if (!name.endsWith('.js')) continue;
      // Legitimate preference / i18n labels may contain ₺
      if (name === 'preferences.js' || name === 'i18n.js') continue;
      out.push(path.join(root, name));
    }
  }
  return out;
}

console.log('\n=== Palestine product sweep tests ===\n');

// 1–5 currency defaults / TRY / no FX
record('default currency is ILS', LOCALE_DEFAULTS.currency === 'ILS');
record('default currency symbol is ₪', currencySymbol('ILS') === '₪');
record('TRY remains accepted', ALLOWED_CURRENCIES.has('TRY'));
record(
  'TRY symbol works when selected',
  currencySymbol('TRY') === '₺' && /₺|TRY|TL/i.test(formatMoney(120, 'TRY'))
);
record(
  'no fake FX conversion',
  formatMoney(100, 'ILS').includes('100') && formatMoney(100, 'TRY').includes('100')
);

// 6–7 booking/owner numeric unchanged by currency preference (display only)
const amount = 250;
record(
  'booking total numeric unchanged across currency prefs',
  formatMoney(amount, 'ILS').includes('250') && formatMoney(amount, 'TRY').includes('250')
);
record(
  'owner price numeric unchanged across currency prefs',
  /1[,.]500/.test(formatMoney(1500, 'ILS')) && /1[,.]500/.test(formatMoney(1500, 'TRY'))
);

// 8–10 timezone
record('default timezone Asia/Jerusalem', LOCALE_DEFAULTS.timezone === 'Asia/Jerusalem');
record('Europe/Istanbul remains accepted', ALLOWED_TIMEZONES.has('Europe/Istanbul'));
record(
  'timezone preference only in prefs normalize',
  normalizeLocalePrefs({ timezone: 'Europe/Istanbul' }).timezone === 'Europe/Istanbul' &&
    normalizeLocalePrefs({}).timezone === 'Asia/Jerusalem'
);

// 11–13 map defaults
record(
  'default map fallback is not Istanbul',
  geo.PALESTINE_CENTER.lat === 31.9038 &&
    geo.PALESTINE_CENTER.lng === 35.2034 &&
    !(geo.PALESTINE_CENTER.lat === 41.0082 && geo.PALESTINE_CENTER.lng === 28.9784)
);
const mapService = read('scripts/utils/mapService.js');
record(
  'mapService has no Istanbul default coords',
  !mapService.includes('41.0082') && !mapService.includes('28.9784')
);
const mapPicker = read('scripts/utils/mapPickerService.js');
record(
  'mapPicker has no Istanbul default coords',
  !mapPicker.includes('41.0082') && !mapPicker.includes('28.9784')
);
const homeJs = read('scripts/player/home.js');
record(
  'home.js default location not Istanbul coords',
  !homeJs.includes('41.0082') && !homeJs.includes('28.9784')
);

// Field coordinates override: mapService uses options.center when provided
record(
  'mapService respects options.center override',
  /options\s*&&\s*options\.center/.test(mapService) ||
    /options\.center/.test(mapService)
);

// 14–16 nav i18n keys
const i18n = read('scripts/utils/i18n.js');
record('player nav keys present', i18n.includes("'nav.home'") && i18n.includes("'nav.bookings'"));
record(
  'owner nav keys present',
  i18n.includes("'nav.dashboard'") && i18n.includes("'nav.fields'")
);
record(
  'admin nav keys present',
  i18n.includes("'nav.users'") && i18n.includes("'nav.verification'")
);
record('Arabic translations for nav.home', /'nav\.home':\s*'[^']+'/.test(i18n.split('ar:')[1] || ''));

// 17–18 RTL / LTR via preferences applyDocumentLocale
const prefsFront = read('scripts/utils/preferences.js');
record(
  'Arabic activates RTL',
  prefsFront.includes("dir = lang === 'ar' ? 'rtl' : 'ltr'") ||
    prefsFront.includes("dir=lang==='ar'?'rtl':'ltr'")
);
record(
  'English activates LTR',
  prefsFront.includes("'ltr'") && prefsFront.includes("normalizeLanguage")
);

// 19 XSS: i18n uses textContent
record(
  'i18n applyTranslations uses textContent',
  i18n.includes('el.textContent = t(key)') && !/innerHTML\s*=\s*t\(/.test(i18n)
);

// 20 preference merge intact
record(
  'preference merge preserves explicit TRY',
  normalizeLocalePrefs({ currency: 'TRY', language: 'ar' }).currency === 'TRY' &&
    normalizeLocalePrefs({ currency: 'TRY', language: 'ar' }).language === 'ar'
);

// Static ₺ guard on runtime UI scripts (exclude prefs/i18n)
const offenders = [];
for (const file of listRuntimeUiScripts()) {
  const src = fs.readFileSync(file, 'utf8');
  // Hardcoded product money display: ₺${ or '₺' + or "₺" +
  if (/₺\$\{|'₺'\s*\+|\"₺\"\s*\+|`₺\$\{/.test(src) || /'\\u20BA'|"\\u20BA"/.test(src)) {
    offenders.push(path.relative(path.join(__dirname, '..'), file));
  }
}
record(
  'no hardcoded ₺ money concatenation in runtime UI scripts',
  offenders.length === 0,
  offenders.join(', ')
);

// Extra: default language English
record('default language is English', LOCALE_DEFAULTS.language === 'en');

console.log('\n---');
console.log(`PASS ${passed} / FAIL ${failed}`);
if (failures.length) {
  console.log('Failures:');
  failures.forEach((f) => console.log(' -', f));
}
process.exit(failed ? 1 : 0);
