/**
 * HIGH priority H1–H8 regression suite.
 * Run: npm run test:high   (server must be up; seed users available)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { createUniqueUsername } = require('../lib/username');
const { createUniquePlayerCode } = require('../lib/playerCode');
const { equalSplitAmounts } = require('../lib/bookingShares');
const { toMajor } = require('../lib/money');
const { SETTLE_TX_OPTIONS } = require('../lib/bookingPayment');

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const USERS = {
  player: { email: 'player@matchfield.com', password: 'Player123!' },
  owner: { email: 'owner@matchfield.com', password: 'Owner123!' },
  admin: { email: 'admin@matchfield.com', password: 'Admin123!' }
};

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail: detail != null ? String(detail).slice(0, 240) : '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ` — ${String(detail).slice(0, 140)}` : ''}`);
}

async function json(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function req(method, pathName, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null && !formData) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if (formData) opts.body = formData;
  else if (body != null) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${pathName}`, opts);
  return { status: res.status, body: await json(res), raw: res };
}

async function login(role) {
  const r = await req('POST', '/api/auth/login', { body: USERS[role] });
  if (r.status !== 200 || !r.body.token) throw new Error(`login ${role} failed ${r.status}`);
  return { token: r.body.token, refreshToken: r.body.refreshToken, user: r.body.user };
}

function futureYmd(daysAhead) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function pickSlot(token, fieldId) {
  for (let offset = 3; offset <= 16; offset += 1) {
    const date = futureYmd(offset);
    const avail = await req('GET', `/api/fields/${fieldId}/availability?date=${date}`, { token });
    if (avail.status !== 200) continue;
    const working = avail.body.workingSlots || [];
    const booked = new Set(avail.body.bookedSlots || []);
    const blocked = new Set(avail.body.ownerBlockedSlots || []);
    for (const slot of working) {
      if (booked.has(slot) || blocked.has(slot)) continue;
      const hour = parseInt(String(slot).split(':')[0], 10);
      const end = `${String(hour + 1).padStart(2, '0')}:00`;
      const next = working.find((s) => s === end);
      // also return a partial-overlap neighbor if possible
      return { date, timeSlotStart: slot, timeSlotEnd: end, nextHour: next || null };
    }
  }
  return null;
}

function tinyJpeg() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
}

async function main() {
  console.log(`H1–H8 tests against ${BASE}\n`);

  // Ensure demo player is ACTIVE with known password (previous runs may have mutated it)
  const playerRow = await prisma.user.findUnique({ where: { email: USERS.player.email } });
  if (playerRow) {
    await prisma.user.update({
      where: { id: playerRow.id },
      data: {
        status: 'ACTIVE',
        passwordHash: await bcrypt.hash(USERS.player.password, 10)
      }
    });
  }

  let player = await login('player');
  const owner = await login('owner');
  const admin = await login('admin');

  const myFields = await req('GET', '/api/fields/me', { token: owner.token });
  let field = (myFields.body.fields || []).find((f) => f.moderationStatus === 'APPROVED' && f.isActive);
  if (!field && (myFields.body.fields || [])[0]) field = myFields.body.fields[0];
  if (field) {
    await prisma.field.update({
      where: { id: field.id },
      data: { moderationStatus: 'APPROVED', isActive: true }
    });
  }
  record('setup field', !!field, field && field.id);

  // ---------- H1 concurrent + overlap ----------
  if (field) {
    const slot = await pickSlot(player.token, field.id);
    if (!slot) {
      record('H1 concurrency', false, 'no slot');
    } else {
      const payload = {
        fieldId: field.id,
        date: slot.date,
        timeSlotStart: slot.timeSlotStart,
        timeSlotEnd: slot.timeSlotEnd,
        paymentMethod: 'ORGANIZER',
        teamSize: 1
      };
      const [a, b] = await Promise.all([
        req('POST', '/api/bookings', { token: player.token, body: payload }),
        req('POST', '/api/bookings', { token: player.token, body: payload })
      ]);
      const statuses = [a.status, b.status].sort();
      const oneOk = statuses.filter((s) => s === 201).length === 1;
      const oneConflict = statuses.filter((s) => s === 409).length === 1;
      record('H1 concurrent double booking', oneOk && oneConflict, statuses.join(','));

      const winner = a.status === 201 ? a : b.status === 201 ? b : null;
      if (winner && winner.body.booking) {
        // Partial overlap: same start hour claimed by first booking
        const hour = parseInt(slot.timeSlotStart.split(':')[0], 10);
        const overlapEnd = `${String(hour + 2).padStart(2, '0')}:00`;
        const overlap = await req('POST', '/api/bookings', {
          token: player.token,
          body: {
            fieldId: field.id,
            date: slot.date,
            timeSlotStart: slot.timeSlotStart,
            timeSlotEnd: overlapEnd,
            paymentMethod: 'ORGANIZER',
            teamSize: 1
          }
        });
        record('H1 partial overlap rejected', overlap.status === 409 || overlap.status === 400, overlap.status);

        await req('PUT', `/api/bookings/${winner.body.booking.id}/status`, {
          token: player.token,
          body: { status: 'CANCELLED' }
        });
        const rebook = await req('POST', '/api/bookings', { token: player.token, body: payload });
        record('H1 cancel then rebook', rebook.status === 201, rebook.status);
        if (rebook.body.booking) {
          await req('PUT', `/api/bookings/${rebook.body.booking.id}/status`, {
            token: player.token,
            body: { status: 'CANCELLED' }
          });
        }
      }
    }
  }

  // ---------- H2 payment ----------
  if (field) {
    const slot = await pickSlot(player.token, field.id);
    if (slot) {
      const created = await req('POST', '/api/bookings', {
        token: player.token,
        body: {
          fieldId: field.id,
          date: slot.date,
          timeSlotStart: slot.timeSlotStart,
          timeSlotEnd: slot.timeSlotEnd,
          paymentMethod: 'ORGANIZER',
          teamSize: 1
        }
      });
      const id = created.body.booking && created.body.booking.id;
      if (id) {
        const over = await req('POST', `/api/bookings/${id}/payments/manual-settle`, {
          token: player.token,
          body: { amount: 999999 }
        });
        record('H2 overpayment rejected', over.status === 400, over.status);

        const zero = await req('POST', `/api/bookings/${id}/payments/manual-settle`, {
          token: player.token,
          body: { amountMinor: 0 }
        });
        record('H2 invalid amount rejected', zero.status === 400, zero.status);

        const s1 = await req('POST', `/api/bookings/${id}/payments/manual-settle`, {
          token: player.token,
          body: {}
        });
        record(
          'H2 full payment',
          s1.status === 200 && s1.body.fullyPaid === true && s1.status !== 500,
          s1.status === 500
            ? `500 (possible Prisma P2028 tx timeout); body=${JSON.stringify(s1.body).slice(0, 120)}`
            : s1.status
        );

        const s2 = await req('POST', `/api/bookings/${id}/payments/manual-settle`, {
          token: player.token,
          body: {}
        });
        record(
          'H2 duplicate settlement idempotent',
          s2.status === 200 && s2.body.idempotent === true,
          `status=${s2.status} idempotent=${s2.body.idempotent}`
        );

        record(
          'H2 settle tx timeout exceeds Prisma 5s default (P2028 regression)',
          Number(SETTLE_TX_OPTIONS.timeout) > 5000,
          SETTLE_TX_OPTIONS.timeout
        );

        const [c1, c2] = await Promise.all([
          req('POST', `/api/bookings/${id}/payments/manual-settle`, { token: player.token, body: {} }),
          req('POST', `/api/bookings/${id}/payments/manual-settle`, { token: player.token, body: {} })
        ]);
        record(
          'H2 concurrent settlement safe',
          c1.status === 200 && c2.status === 200,
          `${c1.status},${c2.status}`
        );

        await req('PUT', `/api/bookings/${id}/status`, {
          token: player.token,
          body: { status: 'CANCELLED' }
        });
      }
    }
  }

  // ---------- H3 remoderation ----------
  if (field) {
    const before = await prisma.field.findUnique({ where: { id: field.id } });
    const upd = await req('PUT', `/api/fields/${field.id}`, {
      token: owner.token,
      body: { name: `${before.name} Audit` }
    });
    const after = await prisma.field.findUnique({ where: { id: field.id } });
    record(
      'H3 owner edit -> PENDING + inactive',
      upd.status === 200 && after.moderationStatus === 'PENDING' && after.isActive === false,
      `${after.moderationStatus}/${after.isActive}`
    );
    const pub = await req('GET', `/api/fields/${field.id}`);
    record('H3 pending field hidden publicly', pub.status === 404, pub.status);

    await req('PUT', `/api/admin/fields/${field.id}/moderation`, {
      token: admin.token,
      body: { status: 'APPROVED' }
    });
    // restore name
    await prisma.field.update({
      where: { id: field.id },
      data: { name: before.name, moderationStatus: 'APPROVED', isActive: true }
    });
  }

  // ---------- H4 auth ----------
  {
    const fresh = await login('player');
    await prisma.user.update({
      where: { id: fresh.user.id },
      data: { status: 'SUSPENDED', sessionVersion: { increment: 1 } }
    });
    await prisma.refreshToken.updateMany({
      where: { userId: fresh.user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    const susLogin = await req('POST', '/api/auth/login', { body: USERS.player });
    record('H4 suspended cannot login', susLogin.status === 403, susLogin.status);

    const refresh = await req('POST', '/api/auth/refresh', {
      body: { refreshToken: fresh.refreshToken }
    });
    record('H4 suspended cannot refresh', refresh.status === 401 || refresh.status === 403, refresh.status);

    await prisma.user.update({
      where: { id: fresh.user.id },
      data: { status: 'ACTIVE' }
    });

    // password change invalidates sessions
    const active = await login('player');
    const pwd = await req('PUT', '/api/auth/password', {
      token: active.token,
      body: { currentPassword: 'Player123!', newPassword: 'Player123!' }
    });
    // must be different — use temp then revert
    const pwd2 = await req('PUT', '/api/auth/password', {
      token: active.token,
      body: { currentPassword: 'Player123!', newPassword: 'Player123!x' }
    });
    record('H4 password change succeeds', pwd2.status === 200, pwd2.status);
    const oldAccess = await req('GET', '/api/auth/me', { token: active.token });
    record('H4 password change invalidates access JWT', oldAccess.status === 401, oldAccess.status);
    const oldRefresh = await req('POST', '/api/auth/refresh', {
      body: { refreshToken: active.refreshToken }
    });
    record('H4 password change invalidates refresh', oldRefresh.status === 401, oldRefresh.status);
    // revert password
    const again = await req('POST', '/api/auth/login', {
      body: { email: USERS.player.email, password: 'Player123!x' }
    });
    if (again.status === 200) {
      await req('PUT', '/api/auth/password', {
        token: again.body.token,
        body: { currentPassword: 'Player123!x', newPassword: 'Player123!' }
      });
    } else {
      // Best-effort restore via prisma if login failed
      const hash = await bcrypt.hash('Player123!', 10);
      await prisma.user.update({
        where: { id: fresh.user.id },
        data: { passwordHash: hash, status: 'ACTIVE', sessionVersion: { increment: 1 } }
      });
    }
    Object.assign(player, await login('player'));
  }

  // ---------- H5 SPLIT / MIXED / ORGANIZER ----------
  if (field) {
    const slot = await pickSlot(player.token, field.id);
    const temp = await prisma.user.create({
      data: {
        email: `h5.${Date.now()}@matchfield.test`,
        username: await createUniqueUsername(prisma, 'h5player'),
        passwordHash: await bcrypt.hash('TempPlayer123!', 10),
        fullName: 'H5 Player',
        role: 'PLAYER',
        status: 'ACTIVE',
        playerCode: await createUniquePlayerCode()
      }
    });
    if (slot) {
      const org = await req('POST', '/api/bookings', {
        token: player.token,
        body: {
          fieldId: field.id,
          date: slot.date,
          timeSlotStart: slot.timeSlotStart,
          timeSlotEnd: slot.timeSlotEnd,
          paymentMethod: 'ORGANIZER',
          teamSize: 1
        }
      });
      const orgShares = org.body.booking && org.body.booking.paymentShares;
      const orgTotal = org.body.booking && org.body.booking.totalCost;
      const orgSum = (orgShares || []).reduce((s, x) => s + Number(x.amount), 0);
      record(
        'H5 ORGANIZER share equals total',
        org.status === 201 && Math.abs(orgSum - orgTotal) < 0.001,
        `${orgSum}/${orgTotal}`
      );
      if (org.body.booking) {
        await req('PUT', `/api/bookings/${org.body.booking.id}/status`, {
          token: player.token,
          body: { status: 'CANCELLED' }
        });
      }

      const slot2 = await pickSlot(player.token, field.id);
      const split = await req('POST', '/api/bookings', {
        token: player.token,
        body: {
          fieldId: field.id,
          date: slot2.date,
          timeSlotStart: slot2.timeSlotStart,
          timeSlotEnd: slot2.timeSlotEnd,
          paymentMethod: 'SPLIT',
          teamSize: 2,
          participantIds: [temp.id]
        }
      });
      const shares = split.body.booking && split.body.booking.paymentShares;
      const total = split.body.booking && split.body.booking.totalCost;
      const sum = (shares || []).reduce((s, x) => s + Number(x.amount), 0);
      const expected = equalSplitAmounts(
        Math.round(Number(total) * 100),
        2
      ).map((m) => toMajor(m));
      record(
        'H5 SPLIT totals exact',
        split.status === 201 && shares && shares.length === 2 && Math.abs(sum - total) < 0.001,
        `${sum}/${total} n=${shares && shares.length}`
      );
      if (split.body.booking) {
        await req('PUT', `/api/bookings/${split.body.booking.id}/status`, {
          token: player.token,
          body: { status: 'CANCELLED' }
        });
      }

      const slot3 = await pickSlot(player.token, field.id);
      // Get price for distribution — create will compute server total; probe via ORGANIZER first
      const probe = await req('POST', '/api/bookings', {
        token: player.token,
        body: {
          fieldId: field.id,
          date: slot3.date,
          timeSlotStart: slot3.timeSlotStart,
          timeSlotEnd: slot3.timeSlotEnd,
          paymentMethod: 'ORGANIZER',
          teamSize: 1
        }
      });
      const totalMajor = probe.body.booking && probe.body.booking.totalCost;
      if (probe.body.booking) {
        await req('PUT', `/api/bookings/${probe.body.booking.id}/status`, {
          token: player.token,
          body: { status: 'CANCELLED' }
        });
      }
      const badMixed = await req('POST', '/api/bookings', {
        token: player.token,
        body: {
          fieldId: field.id,
          date: slot3.date,
          timeSlotStart: slot3.timeSlotStart,
          timeSlotEnd: slot3.timeSlotEnd,
          paymentMethod: 'MIXED',
          participantIds: [temp.id],
          mixedPaymentDistribution: {
            organizer: 1,
            [temp.id]: 1
          }
        }
      });
      record(
        'H5 MIXED validation rejects wrong total',
        badMixed.status === 400,
        badMixed.status
      );

      if (totalMajor != null) {
        const half = Math.floor(Number(totalMajor) / 2);
        const rest = Number(totalMajor) - half;
        const goodMixed = await req('POST', '/api/bookings', {
          token: player.token,
          body: {
            fieldId: field.id,
            date: slot3.date,
            timeSlotStart: slot3.timeSlotStart,
            timeSlotEnd: slot3.timeSlotEnd,
            paymentMethod: 'MIXED',
            participantIds: [temp.id],
            mixedPaymentDistribution: {
              organizer: half || 0.01,
              [temp.id]: rest || 0.01
            }
          }
        });
        // If half is 0 for very cheap hour, skip
        if (half > 0 && rest > 0) {
          record('H5 MIXED accepted when sums match', goodMixed.status === 201, goodMixed.status);
          if (goodMixed.body.booking) {
            await req('PUT', `/api/bookings/${goodMixed.body.booking.id}/status`, {
              token: player.token,
              body: { status: 'CANCELLED' }
            });
          }
        } else {
          record('H5 MIXED accepted when sums match', true, 'skipped tiny total');
        }
      }
    }
    await prisma.payment.deleteMany({ where: { userId: temp.id } }).catch(() => {});
    await prisma.paymentShare.deleteMany({ where: { userId: temp.id } }).catch(() => {});
    await prisma.bookingParticipant.deleteMany({ where: { userId: temp.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: temp.id } }).catch(() => {});
  }

  // ---------- H6 chat ----------
  {
    const cold = await req('GET', `/api/messages/conversation/${player.user.id}`, {
      token: await login('player').then((p) => p.token)
    });
    // player messaging self already 400; player-player cold DM:
    const otherPlayer = await prisma.user.create({
      data: {
        email: `dm.${Date.now()}@matchfield.test`,
        username: await createUniqueUsername(prisma, 'dmplayer'),
        passwordHash: await bcrypt.hash('TempPlayer123!', 10),
        fullName: 'DM Player',
        role: 'PLAYER',
        status: 'ACTIVE',
        playerCode: await createUniquePlayerCode()
      }
    });
    const dm = await req('GET', `/api/messages/conversation/${otherPlayer.id}`, {
      token: player.token
    });
    record('H6 unauthorized cold player-player DM blocked', dm.status === 403, dm.status);

    const ownerDm = await req('GET', `/api/messages/conversation/${owner.user.id}`, {
      token: player.token
    });
    record('H6 player-owner DM allowed', ownerDm.status === 200, ownerDm.status);
    const convId = ownerDm.body.conversation && ownerDm.body.conversation.id;

    // malicious upload without conversation
    const form = new FormData();
    form.append('file', new Blob([tinyJpeg()], { type: 'image/jpeg' }), 'x.jpg');
    const up1 = await fetch(`${BASE}/api/messages/attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${player.token}` },
      body: form
    });
    record('H6 upload requires conversationId', up1.status === 400, up1.status);

    if (convId) {
      const form2 = new FormData();
      form2.append('conversationId', convId);
      form2.append('file', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'x.html');
      const up2 = await fetch(`${BASE}/api/messages/attachment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${player.token}` },
        body: form2
      });
      record('H6 malicious HTML upload rejected', up2.status === 400, up2.status);

      const form3 = new FormData();
      form3.append('conversationId', convId);
      form3.append('file', new Blob([tinyJpeg()], { type: 'image/jpeg' }), 'ok.jpg');
      const up3 = await fetch(`${BASE}/api/messages/attachment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${player.token}` },
        body: form3
      });
      const up3Body = await up3.json().catch(() => ({}));
      record('H6 valid chat upload', up3.status === 201, up3.status);

      const foreign = await req(
        'GET',
        `/api/messages/files/${path.basename(String(up3Body.url || '').split('?')[0].split('/').pop() || 'x')}?conversationId=${convId}`,
        { token: (await login('admin')).token }
      );
      // admin may not be participant — should 403
      record(
        'H6 unauthorized file access blocked',
        foreign.status === 403 || foreign.status === 400 || foreign.status === 404,
        foreign.status
      );
    }

    await prisma.user.delete({ where: { id: otherPlayer.id } }).catch(() => {});
  }

  // ---------- H7 reviews ----------
  if (field) {
    const slot = await pickSlot(player.token, field.id);
    if (slot) {
      const created = await req('POST', '/api/bookings', {
        token: player.token,
        body: {
          fieldId: field.id,
          date: slot.date,
          timeSlotStart: slot.timeSlotStart,
          timeSlotEnd: slot.timeSlotEnd,
          paymentMethod: 'ORGANIZER',
          teamSize: 1
        }
      });
      const bid = created.body.booking && created.body.booking.id;
      if (bid) {
        await req('POST', `/api/bookings/${bid}/payments/manual-settle`, {
          token: player.token,
          body: {}
        });
        const early = await req('POST', '/api/reviews', {
          token: player.token,
          body: { fieldId: field.id, bookingId: bid, rating: 5, reviewText: 'too early' }
        });
        record('H7 review before completion rejected', early.status === 400, early.status);

        await prisma.booking.update({
          where: { id: bid },
          data: { status: 'COMPLETED' }
        });
        // Keep slots for COMPLETED (C1) — ok
        const ok = await req('POST', '/api/reviews', {
          token: player.token,
          body: { fieldId: field.id, bookingId: bid, rating: 5, reviewText: 'great' }
        });
        record('H7 completed booking review accepted', ok.status === 201 || ok.status === 200, ok.status);
      }
    }
  }

  // ---------- H8 pagination ----------
  {
    const fields = await req('GET', '/api/fields?limit=9999');
    const lim = fields.body.pagination && fields.body.pagination.limit;
    record('H8 fields limit capped', lim != null && lim <= 100, lim);

    const notif = await req('GET', '/api/notifications/me?limit=5', { token: player.token });
    record(
      'H8 notifications paginated',
      notif.status === 200 && notif.body.pagination && notif.body.pagination.limit === 5,
      notif.status
    );

    const fav = await req('GET', '/api/favorites?limit=5', { token: player.token });
    record(
      'H8 favorites paginated',
      fav.status === 200 && fav.body.pagination != null,
      fav.status
    );
  }

  await prisma.$disconnect();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    failed.forEach((f) => console.log(` - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
