/**
 * Critical C1–C4 automated verification.
 * Requires: server running, seeded demo users, DATABASE_URL in .env
 *
 * Run: npm run test:critical
 */

require('dotenv').config();
const { prisma } = require('../lib/prisma');
const { persistIncomingFile, isStoredDataUrl } = require('../lib/secureStorage');

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

const USERS = {
  player: { email: 'player@matchfield.com', password: 'Player123!' },
  owner: { email: 'owner@matchfield.com', password: 'Owner123!' },
  admin: { email: 'admin@matchfield.com', password: 'Admin123!' }
};

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail: detail != null ? String(detail).slice(0, 300) : '' });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ''}`);
}

async function json(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined
  });
  const b = await json(res);
  return { status: res.status, body: b, headers: res.headers };
}

async function login(role) {
  const r = await req('POST', '/api/auth/login', { body: USERS[role] });
  if (r.status !== 200 || !r.body.token) {
    throw new Error(`Login ${role} failed: ${r.status} ${JSON.stringify(r.body)}`);
  }
  return { token: r.body.token, user: r.body.user };
}

/** Minimal JPEG (SOI + EOI) — enough for magic-byte sniff */
function tinyJpegDataUrl() {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
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

async function main() {
  console.log(`Critical C1–C4 tests against ${BASE}\n`);

  let player;
  let owner;
  let admin;
  try {
    player = await login('player');
    owner = await login('owner');
    admin = await login('admin');
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }

  // -------- Find an approved active field owned by demo owner --------
  const myFields = await req('GET', '/api/fields/me', { token: owner.token });
  let field =
    (myFields.body.fields || []).find(
      (f) => f.moderationStatus === 'APPROVED' && f.isActive
    ) || (myFields.body.fields || [])[0];

  if (!field) {
    record('setup: owner has a field', false, 'No fields for owner');
  } else {
    record('setup: owner has a field', true, field.id);
  }

  // Ensure field is APPROVED+active for public booking tests
  if (field && (field.moderationStatus !== 'APPROVED' || !field.isActive)) {
    await req('PUT', `/api/admin/fields/${field.id}/moderation`, {
      token: admin.token,
      body: { status: 'APPROVED' }
    });
    await prisma.field.update({
      where: { id: field.id },
      data: { isActive: true, moderationStatus: 'APPROVED' }
    });
    field = { ...field, isActive: true, moderationStatus: 'APPROVED' };
  }

  // ===================== C1: cancel releases slots =====================
  if (field) {
    const slot = await pickBookableSlot(player.token, field.id);
    if (!slot) {
      record('C1 create booking for cancel test', false, 'No free slot');
    } else {
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
      const bookingId = created.body.booking && created.body.booking.id;
      record('C1 create booking', created.status === 201 && !!bookingId, created.status);

      if (bookingId) {
        const beforeSlots = await prisma.bookingSlot.count({ where: { bookingId } });
        record('C1 slots exist after create', beforeSlots > 0, `count=${beforeSlots}`);

        const cancel1 = await req('PUT', `/api/bookings/${bookingId}/status`, {
          token: player.token,
          body: { status: 'CANCELLED' }
        });
        record('C1 cancel booking', cancel1.status === 200, cancel1.status);

        const afterSlots = await prisma.bookingSlot.count({ where: { bookingId } });
        record('C1 slots removed after cancel', afterSlots === 0, `count=${afterSlots}`);

        const cancel2 = await req('PUT', `/api/bookings/${bookingId}/status`, {
          token: player.token,
          body: { status: 'CANCELLED' }
        });
        record('C1 cancel idempotent', cancel2.status === 200, cancel2.status);

        const rebook = await req('POST', '/api/bookings', {
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
        record('C1 rebook same slot after cancel', rebook.status === 201, rebook.status);

        // Expire path: create another booking then expire
        const slot2 = await pickBookableSlot(player.token, field.id);
        if (slot2 && rebook.body.booking) {
          // cleanup previous rebook
          await req('PUT', `/api/bookings/${rebook.body.booking.id}/status`, {
            token: player.token,
            body: { status: 'CANCELLED' }
          });
        }
        if (slot2) {
          const expCreate = await req('POST', '/api/bookings', {
            token: player.token,
            body: {
              fieldId: field.id,
              date: slot2.date,
              timeSlotStart: slot2.timeSlotStart,
              timeSlotEnd: slot2.timeSlotEnd,
              paymentMethod: 'ORGANIZER',
              teamSize: 1
            }
          });
          const expId = expCreate.body.booking && expCreate.body.booking.id;
          if (expId) {
            const exp = await req('PUT', `/api/bookings/${expId}/status`, {
              token: admin.token,
              body: { status: 'EXPIRED' }
            });
            const expSlots = await prisma.bookingSlot.count({ where: { bookingId: expId } });
            record('C1 expire releases slots', exp.status === 200 && expSlots === 0, `status=${exp.status} slots=${expSlots}`);
          } else {
            record('C1 expire releases slots', false, 'could not create booking');
          }
        }
      }
    }
  }

  // ===================== C2: payment before confirm =====================
  if (field) {
    const slot = await pickBookableSlot(player.token, field.id);
    if (!slot) {
      record('C2 payment tests', false, 'No free slot');
    } else {
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
      const bookingId = created.body.booking && created.body.booking.id;
      record('C2 create unpaid booking', created.status === 201 && !!bookingId, created.status);

      if (bookingId) {
        const fakeConfirm = await req('PUT', `/api/bookings/${bookingId}/status`, {
          token: player.token,
          body: { status: 'CONFIRMED' }
        });
        record(
          'C2 unpaid cannot confirm (fake frontend)',
          fakeConfirm.status === 402 || fakeConfirm.status === 400,
          fakeConfirm.status
        );

        const settle = await req('POST', `/api/bookings/${bookingId}/payments/manual-settle`, {
          token: player.token,
          body: {}
        });
        record(
          'C2 fully paid organizer can confirm via settle',
          settle.status === 200 && (settle.body.confirmed === true || settle.body.booking?.status === 'UPCOMING'),
          `status=${settle.status} confirmed=${settle.body.confirmed}`
        );

        // Split: partial then full
        const slotSplit = await pickBookableSlot(player.token, field.id);
        if (slotSplit) {
          const bcrypt = require('bcryptjs');
          const { createUniqueUsername } = require('../lib/username');
          const { createUniquePlayerCode } = require('../lib/playerCode');
          const tempPlayer = await prisma.user.create({
            data: {
              email: `split.temp.${Date.now()}@matchfield.test`,
              username: await createUniqueUsername(prisma, 'splittemp'),
              passwordHash: await bcrypt.hash('TempPlayer123!', 10),
              fullName: 'Split Temp Player',
              role: 'PLAYER',
              status: 'ACTIVE',
              playerCode: await createUniquePlayerCode()
            }
          });

          const splitCreate = await req('POST', '/api/bookings', {
            token: player.token,
            body: {
              fieldId: field.id,
              date: slotSplit.date,
              timeSlotStart: slotSplit.timeSlotStart,
              timeSlotEnd: slotSplit.timeSlotEnd,
              paymentMethod: 'SPLIT',
              teamSize: 2,
              participantIds: [tempPlayer.id]
            }
          });
          const splitId = splitCreate.body.booking && splitCreate.body.booking.id;
          if (splitId) {
            await req('POST', `/api/bookings/${splitId}/payments/manual-settle`, {
              token: player.token,
              body: {}
            });
            const partialConfirm = await req('PUT', `/api/bookings/${splitId}/status`, {
              token: player.token,
              body: { status: 'CONFIRMED' }
            });
            record(
              'C2 partially paid split cannot confirm',
              partialConfirm.status === 402 || partialConfirm.status === 400,
              partialConfirm.status
            );

            const tempLogin = await req('POST', '/api/auth/login', {
              body: { email: tempPlayer.email, password: 'TempPlayer123!' }
            });
            await req('POST', `/api/bookings/${splitId}/payments/manual-settle`, {
              token: tempLogin.body.token,
              body: {}
            });
            const afterFull = await prisma.booking.findUnique({
              where: { id: splitId },
              include: { paymentShares: true }
            });
            const allPaid = afterFull.paymentShares.every((s) => s.status === 'PAID');
            const sumOk =
              afterFull.paymentShares.reduce((s, x) => s + x.amount, 0) === afterFull.totalCost;
            if (allPaid && sumOk && afterFull.status === 'PENDING') {
              const conf = await req('PUT', `/api/bookings/${splitId}/status`, {
                token: player.token,
                body: { status: 'CONFIRMED' }
              });
              record('C2 fully paid split can confirm', conf.status === 200, conf.status);
            } else if (afterFull.status === 'CONFIRMED') {
              record('C2 fully paid split can confirm', true, 'auto-confirmed on last settle');
            } else {
              record(
                'C2 fully paid split can confirm',
                false,
                `status=${afterFull.status} allPaid=${allPaid} sumOk=${sumOk}`
              );
            }

            await req('PUT', `/api/bookings/${splitId}/status`, {
              token: player.token,
              body: { status: 'CANCELLED' }
            });
          }
          await prisma.payment.deleteMany({ where: { userId: tempPlayer.id } }).catch(() => {});
          await prisma.paymentShare.deleteMany({ where: { userId: tempPlayer.id } }).catch(() => {});
          await prisma.bookingParticipant.deleteMany({ where: { userId: tempPlayer.id } }).catch(() => {});
          await prisma.user.delete({ where: { id: tempPlayer.id } }).catch(() => {});
        }

        // MIXED shares must equal total
        const mixedEval = await prisma.$transaction(async (tx) => {
          // Use evaluate via creating a booking-like check with unequal shares
          const b = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { paymentShares: true }
          });
          return b;
        });
        // Create a throwaway booking for MIXED sum test
        const slotM = await pickBookableSlot(player.token, field.id);
        if (slotM) {
          const mixed = await req('POST', '/api/bookings', {
            token: player.token,
            body: {
              fieldId: field.id,
              date: slotM.date,
              timeSlotStart: slotM.timeSlotStart,
              timeSlotEnd: slotM.timeSlotEnd,
              paymentMethod: 'MIXED',
              teamSize: 1,
              mixedPaymentDistribution: { organizer: 1 }
            }
          });
          const mid = mixed.body.booking && mixed.body.booking.id;
          if (!mid) {
            // Create ORGANIZER then force mismatch for the sum check
            const fallback = await req('POST', '/api/bookings', {
              token: player.token,
              body: {
                fieldId: field.id,
                date: slotM.date,
                timeSlotStart: slotM.timeSlotStart,
                timeSlotEnd: slotM.timeSlotEnd,
                paymentMethod: 'ORGANIZER',
                teamSize: 1
              }
            });
            const fid = fallback.body.booking && fallback.body.booking.id;
            if (fid) {
              const row = await prisma.booking.findUnique({
                where: { id: fid },
                include: { paymentShares: true }
              });
              if (row.paymentShares[0]) {
                await prisma.paymentShare.update({
                  where: { id: row.paymentShares[0].id },
                  data: { amount: Math.max(1, row.totalCost - 1), status: 'PAID', paidAt: new Date() }
                });
              }
              const conf = await req('PUT', `/api/bookings/${fid}/status`, {
                token: player.token,
                body: { status: 'CONFIRMED' }
              });
              record(
                'C2 mixed shares must equal total',
                conf.status === 402 || conf.status === 400,
                conf.status
              );
              await req('PUT', `/api/bookings/${fid}/status`, {
                token: player.token,
                body: { status: 'CANCELLED' }
              });
            } else {
              record('C2 mixed shares must equal total', false, 'could not create booking');
            }
          } else {
            const row = await prisma.booking.findUnique({
              where: { id: mid },
              include: { paymentShares: true }
            });
            if (row.paymentShares[0]) {
              await prisma.paymentShare.update({
                where: { id: row.paymentShares[0].id },
                data: { amount: Math.max(1, row.totalCost - 1), status: 'PAID', paidAt: new Date() }
              });
            }
            const conf = await req('PUT', `/api/bookings/${mid}/status`, {
              token: player.token,
              body: { status: 'CONFIRMED' }
            });
            record(
              'C2 mixed shares must equal total',
              conf.status === 402 || conf.status === 400,
              conf.status
            );
            await req('PUT', `/api/bookings/${mid}/status`, {
              token: player.token,
              body: { status: 'CANCELLED' }
            });
          }
        }

        // cleanup confirmed booking
        await req('PUT', `/api/bookings/${bookingId}/status`, {
          token: player.token,
          body: { status: 'CANCELLED' }
        });
      }
    }
  }

  // ===================== C3: KYC docs not public =====================
  if (field) {
    // Attach a tiny ownership doc as owner
    const dataUrl = tinyJpegDataUrl();
    const updated = await req('PUT', `/api/fields/${field.id}`, {
      token: owner.token,
      body: { ownershipDocumentUrl: dataUrl }
    });
    record(
      'C3/C4 owner can upload ownership doc',
      updated.status === 200 || updated.status === 201,
      updated.status
    );

    // Doc upload may flip moderation to PENDING — restore public visibility for assertions
    await prisma.field.update({
      where: { id: field.id },
      data: { moderationStatus: 'APPROVED', isActive: true, moderatedAt: new Date() }
    });

    const pub = await req('GET', `/api/fields/${field.id}`);
    const pubField = pub.body.field || {};
    const leaked =
      (typeof pubField.ownershipDocumentUrl === 'string' &&
        (pubField.ownershipDocumentUrl.startsWith('data:') ||
          pubField.ownershipDocumentUrl.includes('storage/private'))) ||
      (typeof pubField.licensesDocumentUrl === 'string' &&
        pubField.licensesDocumentUrl.startsWith('data:'));
    record('C3 anonymous cannot retrieve KYC docs', pub.status === 200 && !leaked, {
      ownershipDocumentUrl: pubField.ownershipDocumentUrl,
      licensesDocumentUrl: pubField.licensesDocumentUrl
    });

    const playerGet = await req('GET', `/api/fields/${field.id}`, { token: player.token });
    const pf = playerGet.body.field || {};
    const playerLeaked =
      (pf.ownershipDocumentUrl && String(pf.ownershipDocumentUrl).startsWith('data:')) ||
      (pf.ownershipDocumentUrl && String(pf.ownershipDocumentUrl).includes('storage/private'));
    record('C3 authenticated player cannot retrieve KYC docs', !playerLeaked, pf.ownershipDocumentUrl);

    const ownerGet = await req('GET', `/api/fields/${field.id}`, { token: owner.token });
    const of = ownerGet.body.field || {};
    record(
      'C3 owning owner gets document download URL',
      typeof of.ownershipDocumentUrl === 'string' &&
        of.ownershipDocumentUrl.includes('/documents/OWNERSHIP_DOCUMENT'),
      of.ownershipDocumentUrl
    );

    const docAnon = await req('GET', `/api/fields/${field.id}/documents/OWNERSHIP_DOCUMENT`);
    record('C3 anonymous cannot download KYC doc', docAnon.status === 401 || docAnon.status === 403, docAnon.status);

    const docPlayer = await req('GET', `/api/fields/${field.id}/documents/OWNERSHIP_DOCUMENT`, {
      token: player.token
    });
    record('C3 player cannot download KYC doc', docPlayer.status === 403, docPlayer.status);

    const docOwner = await req('GET', `/api/fields/${field.id}/documents/OWNERSHIP_DOCUMENT`, {
      token: owner.token
    });
    record('C3 owning owner can download KYC doc', docOwner.status === 200, docOwner.status);

    const docAdmin = await req('GET', `/api/fields/${field.id}/documents/OWNERSHIP_DOCUMENT`, {
      token: admin.token
    });
    record('C3 admin can download KYC doc', docAdmin.status === 200, docAdmin.status);

    // Unapproved field not public
    const pendingField = await prisma.field.create({
      data: {
        ownerId: owner.user.id,
        name: 'Pending Audit Field',
        sport: 'Football',
        type: 'OUTDOOR',
        location: 'Test',
        pricePerHour: 10000,
        moderationStatus: 'PENDING',
        isActive: false
      }
    });
    const pendingPub = await req('GET', `/api/fields/${pendingField.id}`);
    record('C3 unapproved field not exposed publicly', pendingPub.status === 404, pendingPub.status);
    await prisma.field.delete({ where: { id: pendingField.id } });

    // Unrelated owner: create second owner? Use admin as non-owner — already covered by player.
    // Use player token as unrelated — done.
  }

  // ===================== C4: no data URL in DB =====================
  if (field) {
    const docs = await prisma.fieldDocument.findMany({ where: { fieldId: field.id } });
    const anyData = docs.some((d) => isStoredDataUrl(d.storagePath));
    record('C4 field documents stored as paths not data URLs', !anyData && docs.length > 0, {
      count: docs.length,
      sample: docs[0] && docs[0].storagePath
    });

    // Unit-level persist helper
    try {
      const saved = persistIncomingFile(tinyJpegDataUrl(), { kind: 'field-doc' });
      record(
        'C4 persistIncomingFile writes filesystem path',
        saved && saved.storagePath.startsWith('storage/private/') && !isStoredDataUrl(saved.storagePath),
        saved && saved.storagePath
      );
    } catch (e) {
      record('C4 persistIncomingFile writes filesystem path', false, e.message);
    }
  }

  await prisma.$disconnect();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('Failed:');
    failed.forEach((f) => console.log(` - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
