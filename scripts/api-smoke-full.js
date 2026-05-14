/**
 * Full API smoke test — exercises essentially all Express API modules.
 * Run: npm run test:api   (server must be up; DATABASE_URL + JWT_SECRET in .env)
 *
 * Skips: account delete, clearing all notifications, owner verify/moderation mutations,
 * admin broadcast to all users (optional future opt-in).
 * May: preferences PATCH, contact POST, mark-read, favorite add+remove if not favorited,
 * admin support star/block idempotent clears, tiny chat PNG upload.
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

const USERS = {
  player: { email: 'player@matchfield.com', password: 'Player123!' },
  owner: { email: 'owner@matchfield.com', password: 'Owner123!' },
  admin: { email: 'admin@matchfield.com', password: 'Admin123!' }
};

const results = [];

function record(name, status, ok, detail) {
  results.push({ name, status, ok, detail: detail != null ? String(detail).slice(0, 200) : '' });
}

async function json(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function req(method, path, { token, body, jsonBody = true, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (jsonBody && body != null && !formData) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if (formData) opts.body = formData;
  else if (body != null) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const b = await json(res);
  return { status: res.status, body: b };
}

async function login(role) {
  const { email, password } = USERS[role];
  const r = await req('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200 || !r.body.token) {
    throw new Error(`Login ${role} failed: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  }
  return { token: r.body.token, user: r.body.user };
}

function expect(status, allowed, name, detail) {
  const ok = allowed.includes(status);
  record(name, status, ok, detail);
  return ok;
}

async function main() {
  let playerT;
  let ownerT;
  let adminT;
  let playerId;
  let ownerId;
  let adminId;

  try {
    const p = await login('player');
    playerT = p.token;
    playerId = p.user.id;
    const o = await login('owner');
    ownerT = o.token;
    ownerId = o.user.id;
    const a = await login('admin');
    adminT = a.token;
    adminId = a.user.id;
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }

  // --- Core / public ---
  {
    const r = await req('GET', '/health');
    expect(r.status, [200], 'GET /health', r.body.status);
  }
  {
    const r = await req('GET', '/api/public/stats');
    expect(r.status, [200], 'GET /api/public/stats', `fields=${r.body.fieldCount}`);
  }

  // --- Auth ---
  {
    const r = await req('POST', '/api/auth/login', { body: { email: 'player@matchfield.com', password: 'wrong' } });
    expect(r.status, [401], 'POST /api/auth/login bad password');
  }
  {
    const r = await req('GET', '/api/auth/me', { token: playerT });
    expect(r.status, [200], 'GET /api/auth/me player', r.body.user?.email);
  }
  {
    const r = await req('GET', '/api/auth/me', { token: ownerT });
    expect(r.status, [200], 'GET /api/auth/me owner', r.body.user?.role);
  }
  {
    const r = await req('GET', '/api/auth/me', { token: adminT });
    expect(r.status, [200], 'GET /api/auth/me admin', r.body.user?.role);
  }
  {
    const r = await req('POST', '/api/auth/register', { body: { email: 'bad', password: 'short', fullName: '' } });
    expect(r.status, [400], 'POST /api/auth/register validation');
  }
  {
    const r = await req('POST', '/api/auth/forgot-password', { body: { email: 'player@matchfield.com' } });
    expect(r.status, [200], 'POST /api/auth/forgot-password');
  }
  {
    const r = await req('POST', '/api/auth/reset-password', { body: { token: 'x'.repeat(32), newPassword: 'Abcd12345!' } });
    expect(r.status, [400], 'POST /api/auth/reset-password invalid token');
  }
  {
    const r = await req('PUT', '/api/auth/password', {
      token: playerT,
      body: { currentPassword: 'Player123!', newPassword: 'Player123!' }
    });
    expect(r.status, [400], 'PUT /api/auth/password same password rejected');
  }
  {
    const r = await req('PUT', '/api/auth/password', {
      token: playerT,
      body: { currentPassword: 'wrong', newPassword: 'Newpass12!' }
    });
    expect(r.status, [401], 'PUT /api/auth/password wrong current');
  }

  // --- Fields (public + owner) ---
  let fieldId;
  let fieldOwnerId;
  {
    const r = await req('GET', '/api/fields?limit=5');
    expect(r.status, [200], 'GET /api/fields');
    const fields = r.body.fields || [];
    if (fields[0]) {
      fieldId = fields[0].id;
      fieldOwnerId = fields[0].ownerId || fields[0].owner_id;
    }
  }
  {
    const r = await req('GET', '/api/fields/nearby?lat=41.0082&lng=28.9784&limit=5');
    expect(r.status, [200], 'GET /api/fields/nearby');
  }
  {
    const r = await req('GET', '/api/fields/nearby?limit=5');
    expect(r.status, [400], 'GET /api/fields/nearby missing lat/lng');
  }
  {
    const r = await req('GET', '/api/fields/popular-now?limit=5');
    expect(r.status, [200], 'GET /api/fields/popular-now');
  }
  {
    const r = await req('GET', '/api/fields/recommendations?lat=41&lng=29&limit=5');
    expect(r.status, [200], 'GET /api/fields/recommendations');
  }
  {
    const r = await req('GET', '/api/fields/not-a-valid-id');
    expect(r.status, [400], 'GET /api/fields/:id invalid id');
  }
  if (fieldId) {
    const r = await req('GET', `/api/fields/${fieldId}`);
    expect(r.status, [200], 'GET /api/fields/:id', r.body.field?.name || r.body.name);
  }
  if (fieldId) {
    const r = await req('GET', `/api/fields/${fieldId}/availability?date=2026-07-01`);
    expect(r.status, [200], 'GET /api/fields/:id/availability');
  }
  if (fieldOwnerId) {
    const r = await req('GET', `/api/fields/owner/${fieldOwnerId}`);
    expect(r.status, [200], 'GET /api/fields/owner/:ownerId');
  }
  {
    const r = await req('GET', '/api/fields/me', { token: playerT });
    expect(r.status, [403], 'GET /api/fields/me as player');
  }
  {
    const r = await req('GET', '/api/fields/me', { token: ownerT });
    expect(r.status, [200], 'GET /api/fields/me as owner', `n=${r.body.fields?.length ?? 0}`);
  }
  let ownerFieldId = fieldId;
  {
    const r = await req('GET', '/api/fields/me', { token: ownerT });
    if (r.status === 200 && r.body.fields?.[0]?.id) ownerFieldId = r.body.fields[0].id;
  }
  if (ownerFieldId) {
    const r = await req('GET', `/api/fields/${ownerFieldId}/unavailable-dates`, { token: ownerT });
    expect(r.status, [200], 'GET /api/fields/:id/unavailable-dates (owner)', Array.isArray(r.body.dates) ? `n=${r.body.dates.length}` : 'ok');
  }
  if (ownerFieldId) {
    const r = await req('POST', `/api/fields/${ownerFieldId}/unavailable-dates`, {
      token: ownerT,
      body: { date: 'not-a-date' }
    });
    expect(r.status, [400], 'POST /api/fields/:id/unavailable-dates validation');
  }
  if (ownerFieldId) {
    const r = await req('DELETE', `/api/fields/${ownerFieldId}/unavailable-dates`, { token: ownerT });
    expect(r.status, [400], 'DELETE /api/fields/:id/unavailable-dates missing date query');
  }
  {
    const r = await req('GET', '/api/fields/me', { token: adminT });
    expect(r.status, [200], 'GET /api/fields/me as admin');
  }

  // --- Bookings (auth all) ---
  {
    const r = await req('GET', '/api/bookings?limit=3', { token: playerT });
    expect(r.status, [200], 'GET /api/bookings player');
  }
  {
    const r = await req('GET', '/api/bookings?limit=3', { token: ownerT });
    expect(r.status, [200], 'GET /api/bookings owner');
  }
  {
    const r = await req('POST', '/api/bookings', { token: playerT, body: {} });
    expect(r.status, [400], 'POST /api/bookings validation empty body');
  }
  let bookingId;
  {
    const r = await req('GET', '/api/bookings?limit=1', { token: playerT });
    bookingId = r.body.bookings?.[0]?.id;
  }
  if (bookingId) {
    const r = await req('GET', `/api/bookings/${bookingId}`, { token: playerT });
    expect(r.status, [200], 'GET /api/bookings/:id player');
    const r2 = await req('GET', `/api/bookings/${bookingId}`, { token: adminT });
    expect(r2.status, [200], 'GET /api/bookings/:id admin');
  }
  {
    const r = await req('GET', '/api/bookings/507f1f77bcf86cd799439011', { token: playerT });
    expect(r.status, [404], 'GET /api/bookings/:id not found');
  }
  {
    const r = await req('PUT', `/api/bookings/${bookingId || '000000000000000000000000'}/status`, {
      token: playerT,
      body: { status: 'NOT_A_STATUS' }
    });
    expect(r.status, [400], 'PUT /api/bookings/:id/status validation');
  }
  {
    const r = await req('PUT', `/api/bookings/${bookingId || '507f1f77bcf86cd799439011'}/reschedule`, {
      token: playerT,
      body: {}
    });
    expect(r.status, [400], 'PUT /api/bookings/:id/reschedule validation');
  }
  {
    const r = await req('POST', `/api/bookings/${bookingId || '507f1f77bcf86cd799439011'}/participants`, {
      token: playerT,
      body: {}
    });
    expect(r.status, [400], 'POST /api/bookings/:id/participants validation');
  }
  {
    const r = await req('DELETE', '/api/bookings/507f1f77bcf86cd799439011/participants/me', { token: playerT });
    expect(r.status, [404], 'DELETE /api/bookings/:id/participants/me booking not found');
  }

  // --- Reviews ---
  if (fieldId) {
    const r = await req('GET', `/api/reviews/field/${fieldId}`);
    expect(r.status, [200], 'GET /api/reviews/field/:fieldId');
  }
  {
    const r = await req('GET', '/api/reviews/field/not-an-objectid');
    expect(r.status, [400], 'GET /api/reviews/field/:fieldId invalid id');
  }
  {
    const r = await req('GET', '/api/reviews/user/me', { token: playerT });
    expect(r.status, [200], 'GET /api/reviews/user/me');
  }
  {
    const r = await req('POST', '/api/reviews', { token: playerT, body: { fieldId: 'bad', rating: 6 } });
    expect(r.status, [400], 'POST /api/reviews validation');
  }

  // --- Favorites ---
  {
    const r = await req('GET', '/api/favorites', { token: playerT });
    expect(r.status, [200], 'GET /api/favorites');
  }
  if (fieldId) {
    const r = await req('GET', `/api/favorites/check/${fieldId}`, { token: playerT });
    expect(r.status, [200], 'GET /api/favorites/check/:fieldId');
    const chk = r.body;
    if (chk && chk.isFavorited === false) {
      const add = await req('POST', '/api/favorites', { token: playerT, body: { fieldId } });
      expect(add.status, [201], 'POST /api/favorites add field');
      const del = await req('DELETE', `/api/favorites/${fieldId}`, { token: playerT });
      expect(del.status, [200], 'DELETE /api/favorites/:fieldId remove');
    }
  }
  {
    const r = await req('POST', '/api/favorites', { token: playerT, body: {} });
    expect(r.status, [400], 'POST /api/favorites missing fieldId');
  }

  // --- Notifications ---
  {
    const r = await req('GET', '/api/notifications/me', { token: playerT });
    expect(r.status, [200], 'GET /api/notifications/me');
  }
  {
    const r = await req('POST', '/api/notifications/me/mark-read', { token: playerT, body: {} });
    expect(r.status, [200], 'POST /api/notifications/me/mark-read');
  }

  // --- Messages / chat ---
  let convId;
  let otherUserId;
  let messageId;
  {
    const r = await req('GET', '/api/messages/conversations', { token: playerT });
    expect(r.status, [200], 'GET /api/messages/conversations');
    const c = r.body.conversations?.[0];
    if (c) {
      convId = c.id;
      const u1 = c.user1Id || c.user1?.id;
      const u2 = c.user2Id || c.user2?.id;
      otherUserId = String(u1) === String(playerId) ? u2 : u1;
    }
  }
  if (otherUserId) {
    const r = await req('GET', `/api/messages/conversation/${otherUserId}`, { token: playerT });
    expect(r.status, [200], 'GET /api/messages/conversation/:userId');
  }
  if (convId) {
    const r = await req('GET', `/api/messages/conversation/${convId}/messages?limit=5`, { token: playerT });
    expect(r.status, [200], 'GET /api/messages/conversation/:conversationId/messages');
    const msgs = r.body.messages || [];
    if (msgs.length) messageId = msgs[msgs.length - 1].id;
  }
  if (convId) {
    const r = await req('PUT', `/api/messages/conversation/${convId}/messages/read-all`, { token: playerT, body: {} });
    expect(r.status, [200], 'PUT /api/messages/conversation/:id/messages/read-all');
  }
  if (convId && messageId) {
    const r = await req('PUT', `/api/messages/conversation/${convId}/messages/${messageId}/read`, { token: playerT, body: {} });
    expect(r.status, [200], 'PUT /api/messages/conversation/:cid/messages/:mid/read');
  }
  if (convId) {
    const r = await req('PATCH', `/api/messages/conversation/${convId}/star`, { token: playerT, body: { starred: false } });
    expect(r.status, [200], 'PATCH /api/messages/conversation/:id/star');
  }
  if (convId) {
    const r = await req('PATCH', `/api/messages/conversation/${convId}/block`, { token: playerT, body: { blocked: false } });
    expect(r.status, [200], 'PATCH /api/messages/conversation/:id/block');
  }
  if (convId) {
    const r = await req('POST', `/api/messages/conversation/${convId}/messages`, { token: playerT, body: {} });
    expect(r.status, [400], 'POST /api/messages/conversation/:id/messages empty body');
  }

  // Chat upload: tiny PNG
  {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png');
    const res = await fetch(`${BASE}/api/messages/attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${playerT}` },
      body: form
    });
    const b = await json(res);
    record('POST /api/messages/attachment', res.status, res.status === 201, b.url || b.error);
  }
  {
    const form = new FormData();
    const res = await fetch(`${BASE}/api/messages/attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${playerT}` },
      body: form
    });
    const b = await json(res);
    record('POST /api/messages/attachment no file', res.status, res.status === 400, b.error);
  }

  // --- Support ---
  {
    const r = await req('GET', '/api/support/contact-info');
    expect(r.status, [200], 'GET /api/support/contact-info');
  }
  {
    const r = await req('POST', '/api/support/contact', {
      body: {
        fullName: 'API Smoke',
        email: `smoke-${Date.now()}@example.com`,
        message: 'Automated smoke test contact submission.'
      }
    });
    expect(r.status, [201], 'POST /api/support/contact');
  }
  {
    const r = await req('POST', '/api/support/contact', { body: { fullName: '', email: 'x', message: '' } });
    expect(r.status, [400], 'POST /api/support/contact validation');
  }

  // --- Users ---
  {
    const r = await req('GET', '/api/users', { token: playerT });
    expect(r.status, [403], 'GET /api/users as player');
  }
  {
    const r = await req('GET', '/api/users', { token: adminT });
    expect(r.status, [200], 'GET /api/users admin');
  }
  {
    const r = await req('GET', '/api/users/search/users?q=pla&playersOnly=1', { token: playerT });
    expect(r.status, [200], 'GET /api/users/search/users');
  }
  {
    const r = await req('GET', '/api/users/me/preferences', { token: playerT });
    expect(r.status, [200], 'GET /api/users/me/preferences');
  }
  {
    const r = await req('PATCH', '/api/users/me/preferences', {
      token: playerT,
      body: { reminders: true }
    });
    expect(r.status, [200], 'PATCH /api/users/me/preferences player');
  }
  {
    const r = await req('PATCH', '/api/users/me/preferences', {
      token: ownerT,
      body: { bookingNotifications: true }
    });
    expect(r.status, [200], 'PATCH /api/users/me/preferences owner');
  }
  {
    const r = await req('PATCH', '/api/users/me/preferences', {
      token: adminT,
      body: { verificationRequests: true }
    });
    expect(r.status, [200], 'PATCH /api/users/me/preferences admin');
  }
  {
    const r = await req('GET', `/api/users/${playerId}`, { token: playerT });
    expect(r.status, [200], 'GET /api/users/:id self');
  }
  {
    const r = await req('GET', `/api/users/${ownerId}`, { token: playerT });
    expect(r.status, [403], 'GET /api/users/:id other as player');
  }
  {
    const r = await req('GET', `/api/users/${playerId}`, { token: ownerT });
    expect(r.status, [200], 'GET /api/users/:id player as owner (limited)');
  }
  {
    const r = await req('GET', `/api/users/${playerId}`, { token: adminT });
    expect(r.status, [200], 'GET /api/users/:id as admin');
  }
  {
    const r = await req('PUT', `/api/users/${playerId}/status`, {
      token: adminT,
      body: { status: 'INVALID_STATUS' }
    });
    expect(r.status, [400], 'PUT /api/users/:id/status validation');
  }

  // --- Owner dashboard ---
  {
    const r = await req('GET', '/api/owner/stats', { token: ownerT });
    expect(r.status, [200], 'GET /api/owner/stats');
  }
  {
    const r = await req('GET', '/api/owner/stats', { token: playerT });
    expect(r.status, [403], 'GET /api/owner/stats as player');
  }

  // --- Admin ---
  {
    const r = await req('GET', '/api/admin/stats', { token: adminT });
    expect(r.status, [200], 'GET /api/admin/stats');
  }
  {
    const r = await req('GET', '/api/admin/bookings/region-stats', { token: adminT });
    expect(r.status, [200], 'GET /api/admin/bookings/region-stats');
  }
  {
    const r = await req('GET', '/api/admin/stats', { token: playerT });
    expect(r.status, [403], 'GET /api/admin/stats as player');
  }
  {
    const r = await req('GET', '/api/admin/verifications', { token: adminT });
    expect(r.status, [200], 'GET /api/admin/verifications');
  }
  {
    const r = await req('GET', '/api/admin/notifications', { token: adminT });
    expect(r.status, [200], 'GET /api/admin/notifications');
  }
  {
    const r = await req('GET', '/api/admin/fields?limit=3', { token: adminT });
    expect(r.status, [200], 'GET /api/admin/fields');
  }
  let supportConvId;
  {
    const r = await req('GET', '/api/admin/support/conversations?conversationTake=5', { token: adminT });
    expect(r.status, [200], 'GET /api/admin/support/conversations');
    supportConvId = r.body.conversations?.[0]?.id;
  }
  if (supportConvId) {
    const r = await req('GET', `/api/admin/support/conversation/${supportConvId}/messages?limit=10`, { token: adminT });
    expect(r.status, [200], 'GET /api/admin/support/conversation/:id/messages');
  }
  {
    const r = await req('PATCH', '/api/admin/support/submission/000000000000000000000000/seen', { token: adminT, body: {} });
    expect(r.status, [404], 'PATCH /api/admin/support/submission/:id/seen not found');
  }
  {
    const r = await req('POST', '/api/admin/notifications/send', { token: adminT, body: {} });
    expect(r.status, [400], 'POST /api/admin/notifications/send validation');
  }
  {
    const r = await req('POST', '/api/admin/notifications/send', {
      token: adminT,
      body: { title: 't', message: 'm', audience: 'private' }
    });
    expect(r.status, [400], 'POST /api/admin/notifications/send private without targetUserId');
  }
  {
    const r = await req('POST', '/api/admin/invite-admin', { token: adminT, body: {} });
    expect(r.status, [400], 'POST /api/admin/invite-admin validation');
  }
  {
    const r = await req('PUT', '/api/admin/verify-owner/507f1f77bcf86cd799439011', { token: adminT, body: {} });
    expect(r.status, [400], 'PUT /api/admin/verify-owner/:userId validation');
  }
  if (fieldId) {
    const r = await req('PUT', `/api/admin/fields/${fieldId}/moderation`, {
      token: adminT,
      body: { status: 'INVALID' }
    });
    expect(r.status, [400], 'PUT /api/admin/fields/:fieldId/moderation validation');
  }
  if (supportConvId) {
    const r = await req('POST', `/api/admin/support/conversation/${supportConvId}/messages`, {
      token: adminT,
      body: {}
    });
    expect(r.status, [400], 'POST /api/admin/support/conversation/:id/messages validation');
  }
  {
    const r = await req('POST', '/api/admin/support/submission/000000000000000000000000/reply', {
      token: adminT,
      body: {}
    });
    expect(r.status, [400], 'POST /api/admin/support/submission/:id/reply validation');
  }
  if (supportConvId) {
    const r = await req('PATCH', `/api/admin/support/conversation/${supportConvId}/star`, {
      token: adminT,
      body: { starred: false }
    });
    expect(r.status, [200], 'PATCH /api/admin/support/conversation/:id/star');
  }
  if (supportConvId) {
    const r = await req('PATCH', `/api/admin/support/conversation/${supportConvId}/block`, {
      token: adminT,
      body: { blocked: false }
    });
    expect(r.status, [200], 'PATCH /api/admin/support/conversation/:id/block');
  }
  {
    const r = await req('PATCH', '/api/admin/support/conversation/not-an-id/star', {
      token: adminT,
      body: { starred: false }
    });
    expect(r.status, [400], 'PATCH /api/admin/support/conversation/:id/star invalid id');
  }

  // --- Summary ---
  const failed = results.filter((x) => !x.ok);
  console.log(JSON.stringify({ base: BASE, total: results.length, passed: results.length - failed.length, failed: failed.length }, null, 2));
  if (failed.length) {
    console.log('FAILURES:');
    for (const f of failed) console.log(`  [${f.status}] ${f.name} — ${f.detail}`);
    process.exit(1);
  }
  console.log('All checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
