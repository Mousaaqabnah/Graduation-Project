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

/**
 * MIXED (and generally): required shares must sum exactly to booking.totalCost.
 * ORGANIZER / SPLIT: same rule once shares exist — prevents partial inventory confirm.
 */
function sharesCoverTotal(booking) {
  const total = Number(booking.totalCost) || 0;
  const sum = sharesSum(booking.paymentShares);
  return sum === total && total >= 0;
}

/**
 * @returns {{ ok: boolean, reason?: string, booking?: object }}
 */
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

  return { ok: true, booking };
}

async function isBookingFullyPaid(bookingId, client) {
  const result = await evaluateBookingPayment(bookingId, client);
  return result.ok === true;
}

/**
 * Mark a user's PaymentShare PAID and record a MANUAL Payment row.
 * Does not accept or store card data.
 */
async function settleManualShare({
  bookingId,
  payerUserId,
  actorUserId,
  client
}) {
  const run = async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        paymentShares: true,
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

    const now = new Date();
    let updatedShare = share;
    if (String(share.status).toUpperCase() !== 'PAID') {
      updatedShare = await tx.paymentShare.update({
        where: { id: share.id },
        data: { status: 'PAID', paidAt: now }
      });
    }

    const existingPaid = await tx.payment.findFirst({
      where: {
        bookingId,
        userId: payerUserId,
        status: 'PAID',
        amount: share.amount
      }
    });

    let payment = existingPaid;
    if (!payment) {
      payment = await tx.payment.create({
        data: {
          bookingId,
          userId: payerUserId,
          provider: 'MANUAL',
          amount: share.amount,
          currency: booking.currency || 'ILS',
          status: 'PAID',
          paidAt: now,
          providerReference: `manual:${bookingId}:${payerUserId}:${Date.now()}`
        }
      });
    }

    const refreshed = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        paymentShares: true,
        payments: true,
        field: true,
        participants: { include: { user: { select: { id: true, fullName: true, avatarUrl: true, email: true } } } },
        organizer: { select: { id: true, fullName: true, avatarUrl: true, email: true, phone: true } },
        slots: true
      }
    });

    const paymentEval = await evaluateBookingPayment(bookingId, tx);
    let confirmed = false;
    let bookingOut = refreshed;

    if (
      paymentEval.ok &&
      refreshed.status === 'PENDING' &&
      isInstantBookingField(refreshed.field)
    ) {
      bookingOut = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: refreshed.confirmedAt || now
        },
        include: {
          paymentShares: true,
          payments: true,
          field: true,
          participants: {
            include: { user: { select: { id: true, fullName: true, avatarUrl: true, email: true } } }
          },
          organizer: { select: { id: true, fullName: true, avatarUrl: true, email: true, phone: true } },
          slots: true
        }
      });
      confirmed = true;
    }

    return {
      share: updatedShare,
      payment,
      booking: bookingOut,
      fullyPaid: paymentEval.ok,
      confirmed,
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
  isInstantBookingField
};
