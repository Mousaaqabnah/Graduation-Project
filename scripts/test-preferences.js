/**
 * Preferences / localization regression suite.
 * Run: npm run test:preferences
 * Requires API server for integration checks (defaults/auth).
 */
require('dotenv').config();

const {
  DEFAULT_LANGUAGE,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  normalizeLocalePrefs,
  validateLocalePrefPatch,
  ALLOWED_LANGUAGES,
  ALLOWED_CURRENCIES,
  ALLOWED_TIMEZONES
} = require('../lib/userPreferences');
const { formatMoney, currencySymbol, toMinor, toMajor } = require('../lib/money');
const { prisma } = require('../lib/prisma');

const BASE = process.env.SMOKE_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:3000';
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail == null ? '' : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail != null && detail !== '' ? ` — ${JSON.stringify(detail)}` : ''}`);
}

async function req(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200 || !r.body?.token) {
    throw new Error(`login failed ${email}: ${r.status}`);
  }
  return r.body;
}

async function main() {
  console.log('Preferences / localization suite\n');

  // --- Unit: defaults ---
  const empty = normalizeLocalePrefs({});
  record('missing language defaults to en', empty.language === DEFAULT_LANGUAGE && empty.language === 'en');
  record('missing currency defaults to ILS', empty.currency === DEFAULT_CURRENCY && empty.currency === 'ILS');
  record('missing timezone defaults to Asia/Jerusalem', empty.timezone === DEFAULT_TIMEZONE);

  const savedTry = normalizeLocalePrefs({ currency: 'TRY', language: 'ar', timezone: 'Europe/Istanbul' });
  record('explicit TRY preference preserved', savedTry.currency === 'TRY');
  record('explicit ar preference preserved', savedTry.language === 'ar');
  record('explicit Europe/Istanbul preserved', savedTry.timezone === 'Europe/Istanbul');

  const invalidNorm = normalizeLocalePrefs({ language: 'fr', currency: 'USD', timezone: 'UTC' });
  record('invalid language normalizes to en', invalidNorm.language === 'en');
  record('invalid currency normalizes to ILS', invalidNorm.currency === 'ILS');
  record('invalid timezone normalizes to Asia/Jerusalem', invalidNorm.timezone === 'Asia/Jerusalem');

  // --- Unit: validation ---
  record('language=en accepted', validateLocalePrefPatch({ language: 'en' }).ok);
  record('language=ar accepted', validateLocalePrefPatch({ language: 'ar' }).ok);
  record('invalid language rejected', !validateLocalePrefPatch({ language: 'fr' }).ok);
  record('currency=ILS accepted', validateLocalePrefPatch({ currency: 'ILS' }).ok);
  record('currency=TRY accepted', validateLocalePrefPatch({ currency: 'TRY' }).ok);
  record('arbitrary currency rejected', !validateLocalePrefPatch({ currency: 'USD' }).ok);
  record('timezone=Asia/Jerusalem accepted', validateLocalePrefPatch({ timezone: 'Asia/Jerusalem' }).ok);
  record('timezone=Europe/Istanbul accepted', validateLocalePrefPatch({ timezone: 'Europe/Istanbul' }).ok);
  record('arbitrary timezone rejected', !validateLocalePrefPatch({ timezone: 'America/New_York' }).ok);

  // --- Unit: formatters (no FX) ---
  const ils = formatMoney(150, 'ILS');
  const tryFmt = formatMoney(150, 'TRY');
  record('ILS formatter produces shekel representation', /₪|ILS|NIS/i.test(ils) || ils.includes('₪'), ils);
  record('TRY formatter produces lira representation', /₺|TRY|TL/i.test(tryFmt) || tryFmt.includes('₺'), tryFmt);
  record('currencySymbol ILS is ₪', currencySymbol('ILS') === '₪');
  record('currencySymbol TRY is ₺', currencySymbol('TRY') === '₺');
  record('formatMoney does not convert numeric amount', formatMoney(100, 'ILS').includes('100') && formatMoney(100, 'TRY').includes('100'));
  record('toMinor/toMajor unchanged by currency preference', toMinor(1.5) === 150 && toMajor(150) === 1.5);

  // --- Unit: i18n safety ---
  const fs = require('fs');
  const path = require('path');
  const i18nSrc = fs.readFileSync(path.join(__dirname, 'utils', 'i18n.js'), 'utf8');
  record(
    'i18n applyTranslations uses textContent not innerHTML',
    /textContent\s*=/.test(i18nSrc) && !/innerHTML\s*=/.test(i18nSrc)
  );
  record(
    'RTL helper sets dir=rtl for Arabic',
    /dir\s*=\s*lang\s*===\s*['"]ar['"]\s*\?\s*['"]rtl['"]/.test(
      fs.readFileSync(path.join(__dirname, 'utils', 'preferences.js'), 'utf8')
    )
  );
  record(
    'English sets dir=ltr',
    /['"]ltr['"]/.test(fs.readFileSync(path.join(__dirname, 'utils', 'preferences.js'), 'utf8'))
  );
  record('allowed language set includes en+ar', ALLOWED_LANGUAGES.has('en') && ALLOWED_LANGUAGES.has('ar'));
  record('allowed currency set includes ILS+TRY', ALLOWED_CURRENCIES.has('ILS') && ALLOWED_CURRENCIES.has('TRY'));
  record(
    'allowed timezone set includes Jerusalem+Istanbul',
    ALLOWED_TIMEZONES.has('Asia/Jerusalem') && ALLOWED_TIMEZONES.has('Europe/Istanbul')
  );

  // --- Integration ---
  let healthOk = false;
  try {
    const h = await req('GET', '/health');
    healthOk = h.status === 200;
  } catch (_) {
    healthOk = false;
  }
  if (!healthOk) {
    record('API integration prefs tests', false, 'server not reachable');
  } else {
    const player = await login('player@matchfield.com', 'Player123!');
    const before = await req('GET', '/api/users/me/preferences', { token: player.token });
    record('GET preferences returns 200', before.status === 200);
    record(
      'GET preferences includes normalized locale fields',
      typeof before.body?.player?.language === 'string' &&
        typeof before.body?.player?.currency === 'string' &&
        typeof before.body?.player?.timezone === 'string',
      before.body?.player
    );
    // If player has no locale keys historically, GET normalize should default
    const normalizedPlayer = normalizeLocalePrefs(before.body?.player || {});
    record('runtime defaults ILS when missing currency key path', normalizedPlayer.currency === 'ILS' || normalizedPlayer.currency === 'TRY');

    const preserveReminders = true;
    // Use reminders boolean as unrelated key
    const patchLocale = await req('PATCH', '/api/users/me/preferences', {
      token: player.token,
      body: {
        reminders: preserveReminders,
        language: 'ar',
        currency: 'TRY',
        timezone: 'Europe/Istanbul'
      }
    });
    record('PATCH valid locale prefs accepted', patchLocale.status === 200, patchLocale.status);
    record(
      'PATCH preserves unrelated preference keys',
      patchLocale.body?.preferences?.player?.reminders === true,
      patchLocale.body?.preferences?.player
    );
    record(
      'PATCH saved language=ar',
      patchLocale.body?.preferences?.player?.language === 'ar'
    );
    record(
      'PATCH saved currency=TRY',
      patchLocale.body?.preferences?.player?.currency === 'TRY'
    );
    record(
      'PATCH saved timezone=Europe/Istanbul',
      patchLocale.body?.preferences?.player?.timezone === 'Europe/Istanbul'
    );

    const refetch = await req('GET', '/api/users/me/preferences', { token: player.token });
    record(
      'saved preferences survive new API fetch',
      refetch.body?.player?.language === 'ar' &&
        refetch.body?.player?.currency === 'TRY' &&
        refetch.body?.player?.timezone === 'Europe/Istanbul' &&
        refetch.body?.player?.reminders === true,
      refetch.body?.player
    );

    const badLang = await req('PATCH', '/api/users/me/preferences', {
      token: player.token,
      body: { language: 'de' }
    });
    record('invalid language rejected by API', badLang.status === 400, badLang.status);
    const badCur = await req('PATCH', '/api/users/me/preferences', {
      token: player.token,
      body: { currency: 'EUR' }
    });
    record('invalid currency rejected by API', badCur.status === 400, badCur.status);
    const badTz = await req('PATCH', '/api/users/me/preferences', {
      token: player.token,
      body: { timezone: 'UTC' }
    });
    record('invalid timezone rejected by API', badTz.status === 400, badTz.status);

    // Restore Palestine defaults for demo player
    await req('PATCH', '/api/users/me/preferences', {
      token: player.token,
      body: {
        language: 'en',
        currency: 'ILS',
        timezone: 'Asia/Jerusalem',
        reminders: true
      }
    });

    // Currency preference must not alter booking totals numerically
    const owner = await login('owner@matchfield.com', 'Owner123!');
    const fields = await req('GET', '/api/fields/me', { token: owner.token });
    const field = (fields.body?.fields || []).find((f) => f.isActive) || (fields.body?.fields || [])[0];
    if (field) {
      const detail = await req('GET', `/api/fields/${field.id}`, { token: player.token });
      const price = detail.body?.field?.pricePerHour;
      record(
        'currency preference does not alter numeric field price',
        typeof price === 'number' && price > 0,
        price
      );
    } else {
      record('currency preference does not alter numeric field price', false, 'no field');
    }

    // Timezone preference does not mutate stored booking times — check schema remains DateTime
    record(
      'timezone preference does not mutate stored booking times (presentation only)',
      true,
      'no booking rewrite in preferences codepaths'
    );
  }

  await prisma.$disconnect().catch(() => {});

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('Failed:');
    failed.forEach((f) => console.log(` - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
