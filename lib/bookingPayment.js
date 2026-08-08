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
 */
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
    let payment = await tx.payment.findFirst({
      where: {
        OR: [
          { providerReference },
          {
            bookingId,
            userId: payerUserId,
            status: 'PAID',
            amount: share.amount,
            provider: 'MANUAL'
          }
        ]
      }
    });

    if (!payment) {
      try {
        payment = await tx.payment.create({
          data: {
            bookingId,
            userId: payerUserId,
            provider: 'MANUAL',
            amount: share.amount,
            currency: booking.currency || 'ILS',
            status: 'PAID',
            paidAt: now,
            providerReference
          }
        });
      } catch (err) {
        if (err.code === 'P2002') {
          payment = await tx.payment.findFirst({
            where: { providerReference }
          });
          idempotent = true;
        } else {
          throw err;
        }
      }
    } else {
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

    const paymentEval = await evaluateBookingPayment(bookingId, tx);
    let confirmed = false;
    let bookingOut = await tx.booking.findUnique({
      where: { id: bookingId },
      include: bookingDetailInclude
    });

    if (
      paymentEval.ok &&
      bookingOut.status === 'PENDING' &&
      isInstantBookingField(bookingOut.field)
    ) {
      bookingOut = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: bookingOut.confirmedAt || now
        },
        include: bookingDetailInclude
      });
      confirmed = true;
    }

    return {
      share: updatedShare,
      payment,
      booking: bookingOut,
      fullyPaid: paymentEval.ok,
      confirmed,
      idempotent,
      actorUserId
    };
  };

  if (client) return run(client);
  return prisma.$transaction(run);
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
  manualProviderReference
};
