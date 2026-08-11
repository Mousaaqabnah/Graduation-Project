const { prisma } = require('./prisma');

/**
 * Server-side payment truth for bookings.
 * Amounts are minor units (Int). Never trust client payment flags.
 */

function db(client) {
  return client || prisma;
}

async function loadBookingPaymentBundle(bookingId, client) {
  return db(client).booking.findUnique({
    where: { id: bookingId },
    include: {
      paymentShares: true,
      payments: true,
      field: { select: { id: true, bookingType: true, ownerId: true } },
      participants: { select: { userId: true, status: true, isOrganizer: true } }
    }
  });
}

function sharesSum(shares) {
  return (shares || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

function allSharesPaid(shares) {
  if (!shares || !shares.length) return false;
  return shares.every((s) => String(s.status).toUpperCase() === 'PAID');
}

function sharesCoverTotal(booking) {
  const total = Number(booking.totalCost) || 0;
  const sum = sharesSum(booking.paymentShares);
  return sum === total && total >= 0;
}

async function evaluateBookingPayment(bookingId, client) {
  const booking = await loadBookingPaymentBundle(bookingId, client);
  if (!booking) {
    return { ok: false, reason: 'Booking not found' };
  }

  const shares = booking.paymentShares || [];
  if (!shares.length) {
    return { ok: false, reason: 'No payment shares defined for this booking', booking };
  }

  if (!sharesCoverTotal(booking)) {
    return {
      ok: false,
      reason: `Payment shares (${sharesSum(shares)}) must equal booking total (${booking.totalCost})`,
      booking
    };
  }

  if (!allSharesPaid(shares)) {
    const unpaid = shares.filter((s) => String(s.status).toUpperCase() !== 'PAID').length;
    return {
      ok: false,
      reason: `${unpaid} payment share(s) still unpaid`,
      booking
    };
  }

  // Payments marked PAID must not exceed required share totals (overpayment guard)
  const paidPayments = (booking.payments || []).filter((p) => String(p.status).toUpperCase() === 'PAID');
  const paidSum = paidPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (paidSum > Number(booking.totalCost)) {
    return { ok: false, reason: 'Recorded payments exceed booking total', booking };
  }

  return { ok: true, booking };
}

async function isBookingFullyPaid(bookingId, client) {
  const result = await evaluateBookingPayment(bookingId, client);
  return result.ok === true;
}

function manualProviderReference(bookingId, payerUserId) {
  return `manual:${bookingId}:${payerUserId}`;
}

const bookingDetailInclude = {
  paymentShares: true,
  payments: true,
  field: true,
  participants: {
    include: { user: { select: { id: true, fullName: true, avatarUrl: true, email: true } } }
  },
  organizer: { select: { id: true, fullName: true, avatarUrl: true, email: true, phone: true } },
  slots: true
};

/**
 * Mark a user's PaymentShare PAID and record a MANUAL Payment row.
 * Idempotent for the same payer. Does not accept or store card data.
 * Rejects client-supplied amounts that disagree with the share.
 *
 * SETTLE_TX_OPTIONS: Prisma's interactive-tx default timeout is 5s. Settlement
 * performs several DB round-trips (share lock, payment upsert, confirm + detail
 * include). On slower DB connections that exceeded 5s and surfaced as HTTP 500
 * with Prisma P2028 ("Transaction not found"). Keep timeout above that default.
 */
const SETTLE_TX_OPTIONS = Object.freeze({
  maxWait: 10_000,
  timeout: 15_000
});

async function settleManualShare({
  bookingId,
  payerUserId,
  actorUserId,
  requestedAmountMinor,
  client
}) {
  const run = async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        paymentShares: true,
        payments: true,
        field: { select: { bookingType: true, ownerId: true, name: true } },
        participants: { select: { userId: true } }
      }
    });
    if (!booking) {
      const err = new Error('Booking not found');
      err.status = 404;
      throw err;
    }

    if (['CANCELLED', 'EXPIRED'].includes(booking.status)) {
      const err = new Error('Cannot settle payment for a cancelled or expired booking');
      err.status = 400;
      throw err;
    }

    const share = (booking.paymentShares || []).find((s) => String(s.userId) === String(payerUserId));
    if (!share) {
      const err = new Error('No payment share found for this user on the booking');
      err.status = 400;
      throw err;
    }

    if (Number(share.amount) <= 0) {
      const err = new Error('Payment share amount must be greater than zero');
      err.status = 400;
      throw err;
    }

    if (requestedAmountMinor != null) {
      const reqAmt = Math.round(Number(requestedAmountMinor));
      if (!Number.isFinite(reqAmt) || reqAmt <= 0) {
        const err = new Error('Invalid settlement amount');
        err.status = 400;
        throw err;
      }
      if (reqAmt !== Number(share.amount)) {
        const err = new Error('Settlement amount must equal the required payment share');
        err.status = 400;
        throw err;
      }
    }

    const now = new Date();
    const alreadyPaid = String(share.status).toUpperCase() === 'PAID';
    let updatedShare = share;
    let idempotent = alreadyPaid;

    if (!alreadyPaid) {
      // Optimistic lock: only transition PENDING → PAID once
      const locked = await tx.paymentShare.updateMany({
        where: { id: share.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: now }
      });
      if (locked.count === 0) {
        // Lost race — reload; treat as idempotent if now PAID
        const again = await tx.paymentShare.findUnique({ where: { id: share.id } });
        if (!again || String(again.status).toUpperCase() !== 'PAID') {
          const err = new Error('Payment share could not be settled');
          err.status = 409;
          throw err;
        }
        updatedShare = again;
        idempotent = true;
      } else {
        updatedShare = await tx.paymentShare.findUnique({ where: { id: share.id } });
      }
    }

    const providerReference = manualProviderReference(bookingId, payerUserId);
    // Upsert avoids create+catch(P2002): a unique violation aborts the Postgres
    // interactive transaction, which then surfaces as P2028 on follow-up queries.
    const existingPayment = await tx.payment.findUnique({
      where: { providerReference }
    });
    const payment = await tx.payment.upsert({
      where: { providerReference },
      create: {
        bookingId,
        userId: payerUserId,
        provider: 'MANUAL',
        amount: share.amount,
        currency: booking.currency || 'ILS',
        status: 'PAID',
        paidAt: now,
        providerReference
      },
      update: {
        status: 'PAID',
        paidAt: existingPayment?.paidAt || now
      }
    });
    if (existingPayment) {
      idempotent = true;
    }

    // Guard: total PAID payments cannot exceed booking total
    const paidPayments = await tx.payment.findMany({
      where: { bookingId, status: 'PAID' },
      select: { amount: true }
    });
    const paidSum = paidPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (paidSum > Number(booking.totalCost)) {
      const err = new Error('Overpayment is not allowed');
      err.status = 400;
      throw err;
    }

    // Evaluate fully-paid from current shares (one query) instead of a second
    // full booking bundle load + a third detail include before confirm.
    const sharesNow = await tx.paymentShare.findMany({
      where: { bookingId },
      select: { amount: true, status: true }
    });
    const fullyPaid =
      sharesNow.length > 0 &&
      sharesNow.every((s) => String(s.status).toUpperCase() === 'PAID') &&
      sharesNow.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) === Number(booking.totalCost);

    let confirmed = false;
    if (fullyPaid && isInstantBookingField(booking.field)) {
      const confirmedRows = await tx.booking.updateMany({
        where: { id: bookingId, status: 'PENDING' },
        data: { status: 'CONFIRMED', confirmedAt: now }
      });
      confirmed = confirmedRows.count > 0;
    }

    // Single detail load for the response (avoid double bookingDetailInclude).
    const bookingOut = await tx.booking.findUnique({
      where: { id: bookingId },
      include: bookingDetailInclude
    });

    return {
      share: updatedShare,
      payment,
      booking: bookingOut,
      fullyPaid,
      confirmed,
      idempotent,
      actorUserId
    };
  };

  if (client) return run(client);
  return prisma.$transaction(run, SETTLE_TX_OPTIONS);
}

function isInstantBookingField(field) {
  const t = String(field?.bookingType ?? 'instant').toLowerCase();
  return t !== 'request';
}

module.exports = {
  evaluateBookingPayment,
  isBookingFullyPaid,
  settleManualShare,
  sharesCoverTotal,
  sharesSum,
  allSharesPaid,
  loadBookingPaymentBundle,
  isInstantBookingField,
  manualProviderReference,
  SETTLE_TX_OPTIONS
};
