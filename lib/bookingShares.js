/**
 * Server-side PaymentShare construction. Amounts are minor units.
 * Never trust client-calculated totals or per-user amounts without validation.
 */

function equalSplitAmounts(totalMinor, n) {
  const count = Math.max(1, Math.floor(Number(n) || 1));
  const total = Math.max(0, Math.round(Number(totalMinor) || 0));
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  // Deterministic: first `remainder` recipients get +1 minor unit
  const amounts = [];
  for (let i = 0; i < count; i += 1) {
    amounts.push(base + (i < remainder ? 1 : 0));
  }
  return amounts;
}

function uniqueUuidList(ids) {
  const seen = new Set();
  const out = [];
  for (const raw of ids || []) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Build PaymentShare create rows for a new booking.
 * @returns {{ teamSize: number, shares: Array<{userId, amount, status}>, error?: string }}
 */
function buildPaymentSharesForCreate({
  paymentMethod,
  totalCost,
  organizerId,
  participantIds,
  teamSize: clientTeamSize,
  mixedPaymentDistribution,
  toMinor
}) {
  const method = String(paymentMethod || '').toUpperCase();
  const total = Math.round(Number(totalCost) || 0);
  if (total <= 0) {
    return { error: 'Booking total must be greater than zero', teamSize: 1, shares: [] };
  }

  const invitees = uniqueUuidList(participantIds).filter((id) => id !== String(organizerId));
  const roster = [String(organizerId), ...invitees];

  if (method === 'ORGANIZER') {
    return {
      teamSize: Math.max(1, roster.length),
      shares: [{ userId: organizerId, amount: total, status: 'PENDING' }]
    };
  }

  if (method === 'SPLIT') {
    if (clientTeamSize != null) {
      const n = parseInt(clientTeamSize, 10);
      if (!Number.isInteger(n) || n < 1) {
        return { error: 'teamSize must be a positive integer', teamSize: 1, shares: [] };
      }
      if (n < roster.length) {
        return {
          error: `teamSize (${n}) cannot be less than organizer + participantIds (${roster.length})`,
          teamSize: n,
          shares: []
        };
      }
    }
    // Shares always cover full total among known roster; invitees added later rebalance.
    const amounts = equalSplitAmounts(total, roster.length);
    const shares = roster.map((userId, i) => ({
      userId,
      amount: amounts[i],
      status: 'PENDING'
    }));
    return {
      teamSize: clientTeamSize != null ? parseInt(clientTeamSize, 10) : roster.length,
      shares
    };
  }

  if (method === 'MIXED') {
    if (!mixedPaymentDistribution || typeof mixedPaymentDistribution !== 'object') {
      return { error: 'mixedPaymentDistribution is required for MIXED payments', teamSize: 1, shares: [] };
    }

    const distKeys = Object.keys(mixedPaymentDistribution);
    if (!distKeys.length) {
      return { error: 'mixedPaymentDistribution cannot be empty', teamSize: 1, shares: [] };
    }

    // Normalize keys: allow "organizer" alias
    const normalized = {};
    for (const key of distKeys) {
      let userId = key;
      if (key === 'organizer' || key === 'ORGANIZER') userId = String(organizerId);
      if (normalized[userId] != null) {
        return { error: 'Duplicate user in mixedPaymentDistribution', teamSize: 1, shares: [] };
      }
      const raw = mixedPaymentDistribution[key];
      const major = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (!Number.isFinite(major) || major <= 0) {
        return { error: 'MIXED amounts must be positive numbers', teamSize: 1, shares: [] };
      }
      const minor = typeof toMinor === 'function' ? toMinor(major) : Math.round(major * 100);
      if (!Number.isInteger(minor) || minor <= 0) {
        return { error: 'MIXED amounts must convert to positive integer minor units', teamSize: 1, shares: [] };
      }
      normalized[userId] = minor;
    }

    const payers = Object.keys(normalized);
    // Every payer must be on the roster; roster must include organizer
    for (const uid of payers) {
      if (!roster.includes(uid)) {
        return {
          error: `MIXED distribution includes unknown user ${uid}. Pass participantIds for all payers.`,
          teamSize: roster.length,
          shares: []
        };
      }
    }
    for (const uid of roster) {
      if (normalized[uid] == null) {
        return {
          error: `MIXED distribution missing amount for participant ${uid}`,
          teamSize: roster.length,
          shares: []
        };
      }
    }

    const shares = payers.map((userId) => ({
      userId,
      amount: normalized[userId],
      status: 'PENDING'
    }));
    const sum = shares.reduce((s, x) => s + x.amount, 0);
    if (sum !== total) {
      return {
        error: `MIXED shares (${sum}) must equal booking total (${total})`,
        teamSize: roster.length,
        shares: []
      };
    }
    return { teamSize: roster.length, shares };
  }

  return { error: 'Invalid payment method', teamSize: 1, shares: [] };
}

module.exports = {
  equalSplitAmounts,
  uniqueUuidList,
  buildPaymentSharesForCreate
};
