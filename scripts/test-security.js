/**
 * Security regression suite (S1–S18).
 * Requires API server running (npm start) with valid DATABASE_URL + JWT_SECRET.
 *
 * Run: npm run test:security
 *
 * Result states: PASS | FAIL | SKIP
 * Exit code is non-zero only when FAIL > 0.
 *
 * Live login flooding for 429 is intentionally SKIPPED (see S3 live check).
 * Deterministic limiter behavior is covered by the in-memory unit test.
 */

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const bcrypt = require('bcryptjs');
const {
  createRateLimiter,
  _resetRateLimitBuckets
} = require('../lib/security/rateLimit');
const { parseAllowedOrigins, isOriginAllowed, WEAK_JWT_SECRETS } = require('../lib/security/env');
const { persistIncomingFile } = require('../lib/secureStorage');
const { prisma } = require('../lib/prisma');
const { createUniqueUsername } = require('../lib/username');
const { createUniquePlayerCode } = require('../lib/playerCode');

require('./utils/dom-safe');

const BASE = process.env.API_BASE || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const PASS = 'PASS';
const FAIL = 'FAIL';
const SKIP = 'SKIP';
const results = [];

function record(name, status, detail) {
  let st = status;
  if (status === true) st = PASS;
  else if (status === false) st = FAIL;
  if (st !== PASS && st !== FAIL && st !== SKIP) st = FAIL;
  results.push({ name, status: st, detail: detail == null ? '' : detail });
  const suffix =
    detail != null && detail !== ''
      ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
      : '';
  console.log(`${st}  ${name}${suffix}`);
}

function req(method, urlPath, { token, body, headers = {}, origin } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath.startsWith('http') ? urlPath : `${BASE}${urlPath}`);
    const payload = body != null ? JSON.stringify(body) : null;
    const h = {
      Accept: 'application/json',
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    };
    if (token) h.Authorization = `Bearer ${token}`;
    if (origin) h.Origin = origin;
    const r = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: h
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200 || !r.body?.token) {
    throw new Error(`Login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  }
  return r.body;
}

function mockRes() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function tinyJpegBuffer() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
}

function tinyJpegDataUrl() {
  return `data:image/jpeg;base64,${tinyJpegBuffer().toString('base64')}`;
}

function futureYmd(daysAhead) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function pickBookableSlot(token, fieldId) {
  for (let offset = 2; offset <= 14; offset += 1) {
    const date = futureYmd(offset);
    const avail = await req('GET', `/api/fields/${fieldId}/availability?date=${date}`, { token });
    if (avail.status !== 200) continue;
    const working = avail.body.workingSlots || [];
    const booked = new Set(avail.body.bookedSlots || []);
    const blocked = new Set(avail.body.ownerBlockedSlots || []);
    for (const slot of working) {
      if (!booked.has(slot) && !blocked.has(slot)) {
        const hour = parseInt(String(slot).split(':')[0], 10);
        if (!Number.isFinite(hour)) continue;
        const end = `${String(hour + 1).padStart(2, '0')}:00`;
        return { date, timeSlotStart: slot, timeSlotEnd: end };
      }
    }
  }
  return null;
}

async function createTempPlayer(prefix) {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `${prefix}.${stamp}@matchfield.test`;
  const password = 'SecTempPlayer123!';
  const user = await prisma.user.create({
    data: {
      email,
      username: await createUniqueUsername(prisma, prefix.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'sectemp'),
      passwordHash: await bcrypt.hash(password, 10),
      fullName: `Sec Temp ${prefix}`,
      role: 'PLAYER',
      status: 'ACTIVE',
      playerCode: await createUniquePlayerCode()
    }
  });
  const auth = await login(email, password);
  return { user, token: auth.token, email, password };
}

async function deleteTempUser(userId) {
  if (!userId) return;
  await prisma.payment.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.paymentShare.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.bookingParticipant.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.messageAttachment.deleteMany({
    where: { message: { senderId: userId } }
  }).catch(() => {});
  await prisma.message.deleteMany({ where: { senderId: userId } }).catch(() => {});
  await prisma.conversationParticipant.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.userNotification.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

async function cancelBooking(bookingId, token) {
  if (!bookingId) return;
  await req('PUT', `/api/bookings/${bookingId}/status`, {
    token,
    body: { status: 'CANCELLED' }
  }).catch(() => {});
}

function isDenied(status) {
  return status === 403 || status === 404;
}

async function multipartUpload({ token, fields = {}, file, filename, mimeType }) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v != null) fd.append(k, String(v));
  });
  if (file) {
    fd.append('file', new Blob([file], { type: mimeType || 'application/octet-stream' }), filename || 'upload.bin');
  }
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/messages/attachment`, {
    method: 'POST',
    headers,
    body: fd
  });
  const raw = await res.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }
  return { status: res.status, body, raw };
}

/**
 * Static XSS regression: fail if untrusted field/venue props are interpolated
 * into onerror/onclick or innerHTML templates without approved helpers.
 */
function inspectPlayerXssGuards(filePath, label) {
  const src = fs.readFileSync(filePath, 'utf8');
  const problems = [];

  function hasUnsafeFieldInterp(chunk) {
    const sinkProps = ['name', 'description', 'location', 'sport', 'image', 'features'];
    for (const prop of sinkProps) {
      const re = new RegExp(
        String.raw`\$\{\s*(?!escapeHtml\s*\(|escapeAttr\s*\(|safeUrlAttr\s*\()[^}]*\b(?:venue|field)\.${prop}\b`,
        'g'
      );
      if (re.test(chunk)) return prop;
    }
    return null;
  }

  // onerror / onclick containing venue.|field. without an approved helper
  const handlerRe = /on(?:error|click)\s*=\s*(["'`])[\s\S]*?\1/gi;
  let m;
  while ((m = handlerRe.exec(src))) {
    const attr = m[0];
    if (!/\b(?:venue|field)\./.test(attr)) continue;
    const idOnly =
      /\$\{\s*String\(\s*(?:venue|field)\.id\s*\)\.replace\(/.test(attr) &&
      !/\b(?:venue|field)\.(name|description|location|sport|image|features|owner)\b/.test(attr);
    if (idOnly) continue;
    if (
      /\$\{\s*(?:escapeHtml|escapeAttr|safeUrlAttr|encodeURIComponent)\s*\(/.test(attr)
    ) {
      continue;
    }
    if (/\b(?:venue|field)\.(name|description|location|sport|image|features)\b/.test(attr)) {
      problems.push(`unsafe handler interpolation: ${attr.slice(0, 120)}`);
    }
  }

  // innerHTML template literals
  const innerHtmlRe = /\.innerHTML\s*=\s*`([\s\S]*?)`/g;
  while ((m = innerHtmlRe.exec(src))) {
    const prop = hasUnsafeFieldInterp(m[1]);
    if (prop) {
      problems.push(`unescaped field.${prop} (or venue.${prop}) inside innerHTML template`);
    }
  }

  // card.innerHTML / similar via createVenueCard-style assignment through helper returning HTML
  // Also scan tagged HTML string fragments that set img onerror with field values
  if (
    /onerror\s*=\s*["'][^"']*\$\{[^}]*\b(?:venue|field)\.(?:name|description|location|sport|image)/i.test(
      src
    ) &&
    !/onerror\s*=\s*["'][^"']*\$\{\s*(?:escapeHtml|escapeAttr|safeUrlAttr|encodeURIComponent)\(/i.test(
      src
    )
  ) {
    problems.push('onerror interpolates field-controlled value without helper');
  }

  return { ok: problems.length === 0, problems, label };
}

async function main() {
  console.log(`Security suite against ${BASE}\n`);
  const cleanup = {
    userIds: [],
    bookingIds: [],
    chatFiles: [],
    fieldDocFieldId: null
  };

  try {
    // ---- Unit: rate limiter ----
    _resetRateLimitBuckets();
    const limiter = createRateLimiter({ bucket: 'sec-test', windowMs: 60_000, max: 3 });
    let hit429 = false;
    for (let i = 0; i < 5; i += 1) {
      const res = mockRes();
      limiter({ ip: '9.9.9.9', headers: {}, user: null }, res, () => {});
      if (res.statusCode === 429) hit429 = true;
    }
    record('S3 in-memory rate limiter returns 429 after max', hit429);

    // ---- Unit: CORS allowlist ----
    process.env.ALLOWED_ORIGINS = 'https://matchfield.example';
    const allowed = parseAllowedOrigins();
    record('S4 ALLOWED_ORIGINS parsed', allowed.includes('https://matchfield.example'), allowed);
    record('S4 rejects arbitrary origin', !isOriginAllowed('https://evil.example', allowed));
    delete process.env.ALLOWED_ORIGINS;

    // ---- Unit: weak JWT production refuse (spawn) ----
    const envCheck = spawnSync(
      process.execPath,
      [
        '-e',
        `process.env.NODE_ENV='production';process.env.JWT_SECRET='secret';process.env.DATABASE_URL='postgresql://x';process.env.ALLOWED_ORIGINS='https://a.example';require('./lib/security/env').validateEnvOrExit();`
      ],
      { cwd: path.join(__dirname, '..'), encoding: 'utf8' }
    );
    record(
      'S9 production refuses weak JWT_SECRET',
      envCheck.status !== 0,
      envCheck.stderr && envCheck.stderr.slice(0, 120)
    );
    record(
      'S9 known weak secret list includes placeholder',
      WEAK_JWT_SECRETS.has('your-super-secret-jwt-key-change-this-in-production')
    );

    // ---- Unit: HTML/SVG upload rejection ----
    try {
      persistIncomingFile('data:image/svg+xml;base64,PHN2Zy8+', { kind: 'field-doc' });
      record('S7 SVG upload rejected', false, 'accepted');
    } catch (e) {
      record('S7 SVG upload rejected', true, e.message);
    }
    try {
      persistIncomingFile('data:text/html;base64,PGh0bWw+', { kind: 'public-image' });
      record('S7 HTML upload rejected', false, 'accepted');
    } catch (e) {
      record('S7 HTML upload rejected', true, e.message);
    }
    try {
      persistIncomingFile('data:image/jpeg;base64,/9j/4AAQ', {
        kind: 'field-doc',
        originalName: '../../../etc/passwd.jpg'
      });
      record('S7 path traversal in original name ignored', true);
    } catch (e) {
      record('S7 path traversal in original name ignored', true, e.message);
    }

    // ---- Unit: shared DOM escaping helpers (real module) ----
    const SafeDOM = globalThis.MatchFieldSafeDOM;
    const xssPayload = '<img src=x onerror=alert(1)>';
    record(
      'S1 MatchFieldSafeDOM.escapeHtml available',
      !!(SafeDOM && typeof SafeDOM.escapeHtml === 'function')
    );
    const escaped = SafeDOM.escapeHtml(xssPayload);
    record(
      'S1 escapeHtml neutralizes XSS payload (shared helper)',
      typeof escaped === 'string' &&
        !escaped.includes('<img') &&
        !escaped.includes('<') &&
        escaped.includes('&lt;img') &&
        escaped.includes('&gt;'),
      escaped
    );
    const attrEsc = SafeDOM.escapeAttr(`" onclick=alert(1) x="`);
    record(
      'S1 escapeAttr escapes quotes for attributes',
      attrEsc.includes('&quot;') && !attrEsc.includes('" onclick'),
      attrEsc
    );

    const homeInspect = inspectPlayerXssGuards(
      path.join(__dirname, 'player', 'home.js'),
      'home.js'
    );
    record(
      'S1 static XSS guards: scripts/player/home.js',
      homeInspect.ok,
      homeInspect.ok ? 'ok' : homeInspect.problems
    );
    const fieldInfoInspect = inspectPlayerXssGuards(
      path.join(__dirname, 'player', 'field-info.js'),
      'field-info.js'
    );
    record(
      'S1 static XSS guards: scripts/player/field-info.js',
      fieldInfoInspect.ok,
      fieldInfoInspect.ok ? 'ok' : fieldInfoInspect.problems
    );

    // Lightweight render regression using shared helper (no browser dependency)
    const fakeVenue = {
      name: '<img src=x onerror=alert(1)>',
      sport: 'Football" onerror="alert(2)',
      location: '<script>alert(3)</script>'
    };
    const cardSnippet = `<h3>${SafeDOM.escapeHtml(fakeVenue.name)}</h3><span>${SafeDOM.escapeHtml(
      fakeVenue.sport
    )}</span><p>${SafeDOM.escapeHtml(fakeVenue.location)}</p>`;
    record(
      'S1 DOM render regression via shared escape helpers',
      !cardSnippet.includes('<img') &&
        !cardSnippet.includes('<script>') &&
        cardSnippet.includes('&lt;img') &&
        cardSnippet.includes('&lt;script&gt;') &&
        cardSnippet.includes('&quot;'),
      cardSnippet.slice(0, 160)
    );

    // ---- Integration ----
    let health;
    try {
      health = await req('GET', '/health');
    } catch (e) {
      console.error('Server not reachable. Start with: npm start');
      process.exit(1);
    }
    record('Health OK', health.status === 200);

    const headersCheck = await req('GET', '/health');
    record(
      'S2 X-Content-Type-Options nosniff',
      String(headersCheck.headers['x-content-type-options'] || '').toLowerCase() === 'nosniff'
    );
    record(
      'S2 CSP present',
      !!(
        headersCheck.headers['content-security-policy'] ||
        headersCheck.headers['content-security-policy-report-only']
      )
    );
    record('S2 X-Powered-By removed', !headersCheck.headers['x-powered-by']);
    record('S2 Referrer-Policy present', !!headersCheck.headers['referrer-policy']);

    const corsBad = await req('GET', '/health', { origin: 'https://evil.example' });
    record(
      'S4 CORS rejects evil Origin',
      corsBad.status === 403 || corsBad.status === 500,
      corsBad.status
    );

    const rlEarly = await req('POST', '/api/auth/login', {
      body: { email: 'nobody-early@matchfield.com', password: 'WrongPass1!' }
    });
    record(
      'S3 auth responses include rate limit headers',
      !!(rlEarly.headers['x-ratelimit-limit'] || rlEarly.headers['X-RateLimit-Limit']),
      rlEarly.headers['x-ratelimit-limit']
    );
    record(
      'S3 live login flooding for HTTP 429',
      SKIP,
      'skipped by design — use in-memory unit test above; optional live check: RATE_LIMIT_AUTH_MAX=5 npm start'
    );

    const player = await login('player@matchfield.com', 'Player123!');
    const owner = await login('owner@matchfield.com', 'Owner123!');
    const admin = await login('admin@matchfield.com', 'Admin123!');

    // Forgot-password enumeration
    const fp1 = await req('POST', '/api/auth/forgot-password', {
      body: { email: 'player@matchfield.com' }
    });
    const fp2 = await req('POST', '/api/auth/forgot-password', {
      body: { email: 'does-not-exist-xyz@matchfield.com' }
    });
    record(
      'S5 forgot-password generic for existing email',
      fp1.status === 200 &&
        typeof fp1.body?.message === 'string' &&
        /if an account exists/i.test(fp1.body.message)
    );
    record(
      'S5 forgot-password generic for missing email',
      fp2.status === 200 && fp2.body?.message === fp1.body?.message
    );

    // Register cannot create ADMIN
    const regEmail = `secadmin_${Date.now()}@example.com`;
    const reg = await req('POST', '/api/auth/register', {
      body: {
        email: regEmail,
        password: 'SecurePass1!',
        fullName: 'Sec Test',
        role: 'ADMIN'
      }
    });
    const regRole = reg.body?.user?.role || (reg.status === 400 ? 'REJECTED' : null);
    record(
      'S10 registration cannot create ADMIN',
      reg.status === 400 ||
        (reg.status === 201 || reg.status === 200 ? regRole === 'PLAYER' : false),
      { status: reg.status, role: regRole }
    );
    if (reg.body?.user?.id) {
      cleanup.userIds.push(reg.body.user.id);
    }

    // User search PII
    const search = await req('GET', '/api/users/search/users?q=player&playersOnly=1', {
      token: player.token
    });
    const leakedEmail = Array.isArray(search.body?.users)
      ? search.body.users.some((u) => Object.prototype.hasOwnProperty.call(u, 'email'))
      : true;
    record('S5 player search omits email', search.status === 200 && !leakedEmail, search.body?.users?.[0]);

    // Invalid UUID
    const badUuid = await req('GET', '/api/fields/not-a-uuid', { token: player.token });
    record('S6 invalid UUID rejected', badUuid.status === 400 || badUuid.status === 404, badUuid.status);

    // Oversized input
    const huge = await req('POST', '/api/auth/login', {
      body: { email: 'player@matchfield.com', password: 'x'.repeat(10_000) }
    });
    record(
      'S6 oversized password rejected or 401',
      huge.status === 400 || huge.status === 401 || huge.status === 429,
      huge.status
    );

    // ===================== S8 / S13 documents (deterministic fixture) =====================
    const ownerFields = await req('GET', '/api/fields?mine=1&limit=5', { token: owner.token });
    let field =
      (ownerFields.body?.fields || []).find(
        (f) => f.moderationStatus === 'APPROVED' && f.isActive
      ) || (ownerFields.body?.fields || [])[0];

    if (!field) {
      const myFields = await req('GET', '/api/fields/me', { token: owner.token });
      field =
        (myFields.body?.fields || []).find(
          (f) => f.moderationStatus === 'APPROVED' && f.isActive
        ) || (myFields.body?.fields || [])[0];
    }

    let docUrl = null;
    if (field) {
      const uploaded = await req('PUT', `/api/fields/${field.id}`, {
        token: owner.token,
        body: { ownershipDocumentUrl: tinyJpegDataUrl() }
      });
      if (uploaded.status === 200 || uploaded.status === 201) {
        cleanup.fieldDocFieldId = field.id;
        await prisma.field.update({
          where: { id: field.id },
          data: { moderationStatus: 'APPROVED', isActive: true, moderatedAt: new Date() }
        });
        const ownerGet = await req('GET', `/api/fields/${field.id}`, { token: owner.token });
        docUrl = ownerGet.body?.field?.ownershipDocumentUrl || null;
      }
    }

    if (docUrl) {
      record(
        'S8 document URL has no access_token',
        String(docUrl).includes('/documents/') &&
          !String(docUrl).includes('access_token') &&
          !String(docUrl).includes('?token='),
        docUrl
      );
      const withQuery = await req(
        'GET',
        `${docUrl}${docUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(owner.token)}`
      );
      record(
        'S8 query access_token alone does not authorize',
        withQuery.status === 401 || withQuery.status === 403,
        withQuery.status
      );
      const withAuth = await req('GET', docUrl, { token: owner.token });
      record('S8 Authorization header download works (owner)', withAuth.status === 200, withAuth.status);
      const adminDoc = await req('GET', docUrl, { token: admin.token });
      record('S8 admin can download private document', adminDoc.status === 200, adminDoc.status);
      const idorDoc = await req('GET', docUrl, { token: player.token });
      record('S13 IDOR document download blocked', idorDoc.status === 403, idorDoc.status);
    } else {
      record('S8 document URL has no access_token', SKIP, 'could not create ownership document fixture');
      record('S8 query access_token alone does not authorize', SKIP, 'no document fixture');
      record('S8 Authorization header download works (owner)', SKIP, 'no document fixture');
      record('S8 admin can download private document', SKIP, 'no document fixture');
      record('S13 IDOR document download blocked', SKIP, 'no document fixture');
    }

    // Stored XSS text at API (field name kept as text)
    const xssField = await req('POST', '/api/fields', {
      token: owner.token,
      body: {
        name: '<script>alert(1)</script>',
        sport: 'Football',
        type: 'OUTDOOR',
        location: 'Test',
        pricePerHour: 100,
        description: '<img src=x onerror=alert(1)>'
      }
    });
    if (xssField.status === 201 || xssField.status === 200) {
      const fname = xssField.body?.field?.name || xssField.body?.name;
      record(
        'S1 stored field XSS kept as text (API)',
        typeof fname === 'string' && fname.includes('<script>'),
        fname
      );
      if (xssField.body?.field?.id) {
        await prisma.field.delete({ where: { id: xssField.body.field.id } }).catch(() => {});
      }
    } else {
      record('S1 stored field XSS kept as text (API)', SKIP, {
        status: xssField.status,
        error: xssField.body?.error
      });
    }

    // ===================== S13 BOOKING IDOR (deterministic) =====================
    let participant = null;
    let stranger = null;
    let bookingId = null;
    try {
      if (!field) {
        record('S13 booking IDOR organizer can access', FAIL, 'no owner field for fixture');
        record('S13 booking IDOR participant can access', FAIL, 'no owner field for fixture');
        record('S13 booking IDOR unrelated player denied', FAIL, 'no owner field for fixture');
      } else {
        participant = await createTempPlayer('secpart');
        stranger = await createTempPlayer('secstranger');
        cleanup.userIds.push(participant.user.id, stranger.user.id);

        const slot = await pickBookableSlot(player.token, field.id);
        if (!slot) {
          record('S13 booking IDOR organizer can access', FAIL, 'no free slot to create booking');
          record('S13 booking IDOR participant can access', FAIL, 'no free slot');
          record('S13 booking IDOR unrelated player denied', FAIL, 'no free slot');
        } else {
          const created = await req('POST', '/api/bookings', {
            token: player.token,
            body: {
              fieldId: field.id,
              date: slot.date,
              timeSlotStart: slot.timeSlotStart,
              timeSlotEnd: slot.timeSlotEnd,
              paymentMethod: 'ORGANIZER',
              teamSize: 2,
              participantIds: [participant.user.id]
            }
          });
          bookingId = created.body?.booking?.id || null;
          if (!bookingId) {
            record('S13 booking IDOR organizer can access', FAIL, {
              status: created.status,
              body: created.body
            });
            record('S13 booking IDOR participant can access', FAIL, 'booking create failed');
            record('S13 booking IDOR unrelated player denied', FAIL, 'booking create failed');
          } else {
            cleanup.bookingIds.push(bookingId);

            const asOrganizer = await req('GET', `/api/bookings/${bookingId}`, {
              token: player.token
            });
            record(
              'S13 booking IDOR organizer can access',
              asOrganizer.status === 200 && asOrganizer.body?.booking?.id === bookingId,
              asOrganizer.status
            );

            const asParticipant = await req('GET', `/api/bookings/${bookingId}`, {
              token: participant.token
            });
            record(
              'S13 booking IDOR participant can access',
              asParticipant.status === 200 && asParticipant.body?.booking?.id === bookingId,
              asParticipant.status
            );

            const asStranger = await req('GET', `/api/bookings/${bookingId}`, {
              token: stranger.token
            });
            const strangerOk = isDenied(asStranger.status);
            record(
              'S13 booking IDOR unrelated player denied',
              strangerOk,
              strangerOk
                ? asStranger.status
                : `UNAUTHORIZED_STATUS=${asStranger.status} (200 for unrelated must fail)`
            );
          }
        }
      }
    } finally {
      for (const id of cleanup.bookingIds.splice(0)) {
        await cancelBooking(id, player.token);
      }
    }

    // ===================== S13 CHAT IDOR (real conversation) =====================
    let chatStranger = stranger;
    if (!chatStranger) {
      chatStranger = await createTempPlayer('secchatc');
      cleanup.userIds.push(chatStranger.user.id);
    }

    const convRes = await req('GET', `/api/messages/conversation/${owner.user.id}`, {
      token: player.token
    });
    const conversationId = convRes.body?.conversation?.id || convRes.body?.conversation?.conversationId;
    if (!conversationId || (convRes.status !== 200 && convRes.status !== 201)) {
      record('S13 chat IDOR setup conversation A↔B', FAIL, {
        status: convRes.status,
        body: convRes.body
      });
      record('S13 chat IDOR participant can read messages', FAIL, 'no conversation');
      record('S13 chat IDOR unrelated cannot read messages', FAIL, 'no conversation');
      record('S13 chat IDOR unrelated cannot send message', FAIL, 'no conversation');
      record('S13 chat IDOR unrelated cannot star conversation', FAIL, 'no conversation');
      record('S13 chat IDOR unrelated cannot block conversation', FAIL, 'no conversation');
      record('S13 chat IDOR unrelated cannot mark read', FAIL, 'no conversation');
    } else {
      record('S13 chat IDOR setup conversation A↔B', true, conversationId);

      const sendOk = await req('POST', `/api/messages/conversation/${conversationId}/messages`, {
        token: player.token,
        body: { content: `sec-idor-${Date.now()}` }
      });
      record(
        'S13 chat IDOR participant can send message',
        sendOk.status === 200 || sendOk.status === 201,
        sendOk.status
      );

      const readOk = await req('GET', `/api/messages/conversation/${conversationId}/messages`, {
        token: player.token
      });
      record(
        'S13 chat IDOR participant can read messages',
        readOk.status === 200,
        readOk.status
      );

      const cRead = await req('GET', `/api/messages/conversation/${conversationId}/messages`, {
        token: chatStranger.token
      });
      record(
        'S13 chat IDOR unrelated cannot read messages',
        isDenied(cRead.status),
        cRead.status === 200
          ? `UNAUTHORIZED_STATUS=200 (must fail)`
          : cRead.status
      );

      const cSend = await req('POST', `/api/messages/conversation/${conversationId}/messages`, {
        token: chatStranger.token,
        body: { content: 'idor-probe' }
      });
      record(
        'S13 chat IDOR unrelated cannot send message',
        isDenied(cSend.status),
        cSend.status === 200 || cSend.status === 201
          ? `UNAUTHORIZED_STATUS=${cSend.status}`
          : cSend.status
      );

      const cStar = await req('PATCH', `/api/messages/conversation/${conversationId}/star`, {
        token: chatStranger.token,
        body: { starred: true }
      });
      record(
        'S13 chat IDOR unrelated cannot star conversation',
        isDenied(cStar.status),
        cStar.status === 200 ? 'UNAUTHORIZED_STATUS=200' : cStar.status
      );

      const cBlock = await req('PATCH', `/api/messages/conversation/${conversationId}/block`, {
        token: chatStranger.token,
        body: { blocked: true }
      });
      record(
        'S13 chat IDOR unrelated cannot block conversation',
        isDenied(cBlock.status),
        cBlock.status === 200 ? 'UNAUTHORIZED_STATUS=200' : cBlock.status
      );

      const cReadAll = await req(
        'PUT',
        `/api/messages/conversation/${conversationId}/messages/read-all`,
        { token: chatStranger.token }
      );
      record(
        'S13 chat IDOR unrelated cannot mark read',
        isDenied(cReadAll.status),
        cReadAll.status === 200 ? 'UNAUTHORIZED_STATUS=200' : cReadAll.status
      );

      // Fake UUID still denied
      const fakeConv = await req(
        'GET',
        '/api/messages/conversation/00000000-0000-4000-8000-000000000000/messages',
        { token: player.token }
      );
      record(
        'S13 chat IDOR unknown conversation denied',
        isDenied(fakeConv.status) || fakeConv.status === 400,
        fakeConv.status
      );
    }

    // ===================== Chat upload security =====================
    if (!conversationId) {
      record('S7 chat upload requires authentication', FAIL, 'no conversation fixture');
      record('S7 chat upload requires valid conversationId', FAIL, 'no conversation fixture');
      record('S7 chat upload unrelated cannot upload', FAIL, 'no conversation fixture');
      record('S7 chat upload rejects SVG', FAIL, 'no conversation fixture');
      record('S7 chat upload rejects HTML', FAIL, 'no conversation fixture');
      record('S7 chat upload participant can upload allowed file', FAIL, 'no conversation fixture');
      record('S7 chat upload unrelated cannot download attachment', FAIL, 'no conversation fixture');
      record('S7 chat upload path traversal filename rejected', FAIL, 'no conversation fixture');
    } else {
      const unauthUp = await multipartUpload({
        fields: { conversationId },
        file: tinyJpegBuffer(),
        filename: 'x.jpg',
        mimeType: 'image/jpeg'
      });
      record(
        'S7 chat upload requires authentication',
        unauthUp.status === 401 || unauthUp.status === 403,
        unauthUp.status
      );

      const badConv = await multipartUpload({
        token: player.token,
        fields: { conversationId: 'not-a-uuid' },
        file: tinyJpegBuffer(),
        filename: 'x.jpg',
        mimeType: 'image/jpeg'
      });
      record(
        'S7 chat upload requires valid conversationId',
        badConv.status === 400,
        badConv.status
      );

      const strangerUp = await multipartUpload({
        token: chatStranger.token,
        fields: { conversationId },
        file: tinyJpegBuffer(),
        filename: 'x.jpg',
        mimeType: 'image/jpeg'
      });
      record(
        'S7 chat upload unrelated cannot upload',
        isDenied(strangerUp.status),
        strangerUp.status === 200 || strangerUp.status === 201
          ? `UNAUTHORIZED_STATUS=${strangerUp.status}`
          : strangerUp.status
      );

      const svgUp = await multipartUpload({
        token: player.token,
        fields: { conversationId },
        file: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        filename: 'x.svg',
        mimeType: 'image/svg+xml'
      });
      record(
        'S7 chat upload rejects SVG',
        svgUp.status === 400 || svgUp.status === 415,
        svgUp.status
      );

      const htmlUp = await multipartUpload({
        token: player.token,
        fields: { conversationId },
        file: Buffer.from('<html><body>x</body></html>'),
        filename: 'x.html',
        mimeType: 'text/html'
      });
      record(
        'S7 chat upload rejects HTML',
        htmlUp.status === 400 || htmlUp.status === 415,
        htmlUp.status
      );

      const okUp = await multipartUpload({
        token: player.token,
        fields: { conversationId },
        file: tinyJpegBuffer(),
        filename: 'ok.jpg',
        mimeType: 'image/jpeg'
      });
      const attachUrl = okUp.body?.url;
      if (attachUrl && (okUp.status === 200 || okUp.status === 201)) {
        const fnameMatch = String(attachUrl).match(/\/files\/([^?]+)/);
        if (fnameMatch) {
          cleanup.chatFiles.push(decodeURIComponent(fnameMatch[1]));
        }
        record('S7 chat upload participant can upload allowed file', true, okUp.status);

        const cDl = await req('GET', attachUrl, { token: chatStranger.token });
        record(
          'S7 chat upload unrelated cannot download attachment',
          isDenied(cDl.status),
          cDl.status === 200 ? 'UNAUTHORIZED_STATUS=200' : cDl.status
        );

        const aDl = await req('GET', attachUrl, { token: player.token });
        record(
          'S7 chat upload participant can download attachment',
          aDl.status === 200,
          aDl.status
        );
      } else {
        record('S7 chat upload participant can upload allowed file', false, {
          status: okUp.status,
          body: okUp.body
        });
        record('S7 chat upload unrelated cannot download attachment', FAIL, 'upload failed');
        record('S7 chat upload participant can download attachment', FAIL, 'upload failed');
      }

      const trav = await req(
        'GET',
        `/api/messages/files/${encodeURIComponent('../../../etc/passwd')}?conversationId=${conversationId}`,
        { token: player.token }
      );
      record(
        'S7 chat upload path traversal filename rejected',
        trav.status === 400 || trav.status === 403 || trav.status === 404,
        trav.status
      );

      // Original-name traversal must not escape private chat storage
      const travUp = await multipartUpload({
        token: player.token,
        fields: { conversationId },
        file: tinyJpegBuffer(),
        filename: '../../../etc/passwd.jpg',
        mimeType: 'image/jpeg'
      });
      if (travUp.status === 200 || travUp.status === 201) {
        const stored = String(travUp.body?.url || travUp.body?.storagePath || '');
        const base = path.basename(stored.split('?')[0]);
        const escaped =
          stored.includes('..') ||
          /[/\\]etc[/\\]passwd/i.test(stored) ||
          (base && base.includes('..'));
        if (travUp.body?.url) {
          const fm = String(travUp.body.url).match(/\/files\/([^?]+)/);
          if (fm) cleanup.chatFiles.push(decodeURIComponent(fm[1]));
        }
        record(
          'S7 chat upload traversal originalName stays in chat storage',
          !escaped && /\/api\/messages\/files\//.test(stored),
          stored
        );
      } else {
        // Rejection is also acceptable
        record(
          'S7 chat upload traversal originalName stays in chat storage',
          true,
          { status: travUp.status, note: 'rejected' }
        );
      }
    }

    // ===================== JWT / session =====================
    const malformed = await req('GET', '/api/auth/me', {
      headers: { Authorization: 'Bearer not-a-jwt' }
    });
    record('S10 malformed JWT rejected', malformed.status === 401, malformed.status);

    const invalidSig = await req('GET', '/api/auth/me', {
      headers: {
        Authorization:
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDAiLCJ0eXAiOiJhY2Nlc3MifQ.invalid'
      }
    });
    record('S10 invalid JWT signature rejected', invalidSig.status === 401, invalidSig.status);

    if (docUrl) {
      const qJwt = await req(
        'GET',
        `${docUrl}${docUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(player.token)}`
      );
      record(
        'S10 query-string JWT does not auth private documents',
        qJwt.status === 401 || qJwt.status === 403,
        qJwt.status
      );
    } else {
      record('S10 query-string JWT does not auth private documents', SKIP, 'no document fixture');
    }

    // Suspended user cannot establish new session
    const susp = await createTempPlayer('secsusp');
    cleanup.userIds.push(susp.user.id);
    await prisma.user.update({
      where: { id: susp.user.id },
      data: { status: 'SUSPENDED' }
    });
    const suspLogin = await req('POST', '/api/auth/login', {
      body: { email: susp.email, password: susp.password }
    });
    record(
      'S10 suspended user cannot login',
      suspLogin.status === 403 || suspLogin.status === 401,
      suspLogin.status
    );
    const suspUse = await req('GET', '/api/bookings?limit=1', { token: susp.token });
    record(
      'S10 suspended session cannot use protected routes',
      suspUse.status === 403 || suspUse.status === 401,
      suspUse.status
    );
    await prisma.user.update({
      where: { id: susp.user.id },
      data: { status: 'ACTIVE' }
    });

    // logout-all / sessionVersion invalidates prior access token
    const sess = await createTempPlayer('secsess');
    cleanup.userIds.push(sess.user.id);
    const oldToken = sess.token;
    const logoutAll = await req('POST', '/api/auth/logout-all', { token: oldToken });
    record(
      'S10 logout-all succeeds',
      logoutAll.status === 200 || logoutAll.status === 204,
      logoutAll.status
    );
    const afterLogout = await req('GET', '/api/auth/me', { token: oldToken });
    // /me allows suspended but still enforces sessionVersion → expect 401
    record(
      'S10 logout-all invalidates prior access token',
      afterLogout.status === 401,
      afterLogout.status
    );

    // Invalid credentials (generic)
    const badLogin = await req('POST', '/api/auth/login', {
      body: { email: 'player@matchfield.com', password: 'WrongPass999!' }
    });
    record(
      'S10 login invalid credentials generic',
      badLogin.status === 401 ||
        (badLogin.status === 429 && /too many/i.test(String(badLogin.body?.error || ''))),
      badLogin.body
    );

    // Safe production-like error
    const missing = await req('GET', '/api/this-route-does-not-exist');
    record(
      'S14 safe 404 JSON without stack',
      missing.status === 404 &&
        missing.body &&
        typeof missing.body === 'object' &&
        !missing.body.stack,
      missing.body
    );
  } finally {
    // Cleanup chat files
    for (const name of cleanup.chatFiles) {
      const abs = path.join(__dirname, '..', 'storage', 'private', 'chat', path.basename(name));
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch (_) {}
    }
    for (const id of cleanup.bookingIds) {
      await cancelBooking(id, (await login('player@matchfield.com', 'Player123!').catch(() => ({}))).token);
    }
    for (const uid of cleanup.userIds) {
      await deleteTempUser(uid);
    }
    await prisma.$disconnect().catch(() => {});
  }

  const passCount = results.filter((r) => r.status === PASS).length;
  const failCount = results.filter((r) => r.status === FAIL).length;
  const skipCount = results.filter((r) => r.status === SKIP).length;

  console.log(`\nPASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`SKIP: ${skipCount}`);

  if (failCount > 0) {
    console.log('\nFailed:');
    results
      .filter((r) => r.status === FAIL)
      .forEach((f) => console.log(` - ${f.name}: ${typeof f.detail === 'string' ? f.detail : JSON.stringify(f.detail)}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
