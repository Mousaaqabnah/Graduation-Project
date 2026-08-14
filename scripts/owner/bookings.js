// Bookings — owner scope comes from the API (same JWT + API.bookings pattern as player/bookings.js).

var ownerBookingsCache = [];
var calendarBookings = {};

function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

/** YYYY-MM-DD in local timezone (for filters; matches calendar display). */
function bookingDateKeyLocal(d) {
    if (d == null || d === '') return '';
    var x = d instanceof Date ? d : new Date(d);
    if (isNaN(x.getTime())) return '';
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}

function todayDateKeyLocal() {
    return bookingDateKeyLocal(new Date());
}

/** Week starts Sunday (en-US style). Returns { startKey, endKey } as YYYY-MM-DD. */
function thisWeekRangeKeysLocal() {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var dow = start.getDay();
    start.setDate(start.getDate() - dow);
    var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { startKey: bookingDateKeyLocal(start), endKey: bookingDateKeyLocal(end) };
}

function rowMatchesDateFilter(row, dateFilter) {
    if (!dateFilter || dateFilter === 'Date range') return true;
    var rowKey = row.getAttribute('data-booking-date') || '';
    if (!rowKey) return false;

    if (dateFilter === 'Today') {
        return rowKey === todayDateKeyLocal();
    }
    if (dateFilter === 'This week') {
        var w = thisWeekRangeKeysLocal();
        return rowKey >= w.startKey && rowKey <= w.endKey;
    }
    if (dateFilter === 'This month') {
        var parts = rowKey.split('-');
        if (parts.length < 2) return false;
        var now = new Date();
        return parseInt(parts[0], 10) === now.getFullYear() && parseInt(parts[1], 10) === now.getMonth() + 1;
    }
    return true;
}

function ownerStatusUiLabel(status) {
    var s = (status || '').toUpperCase();
    if (s === 'PENDING') return t('status.PENDING');
    if (s === 'CONFIRMED' || s === 'UPCOMING' || s === 'COMPLETED') return t('status.APPROVED');
    if (s === 'CANCELLED') return t('status.CANCELLED');
    return t('status.PENDING');
}

function ownerNormalizePaymentStatus(status) {
    return String(status || '').toUpperCase() === 'PAID' ? 'PAID' : 'PENDING';
}

function ownerAllPaymentsCompleted(booking) {
    if (!booking) return false;
    var bookingId = String(booking.id != null ? booking.id : booking._id || '');
    var paymentMethod = String(booking.paymentMethod || '').toUpperCase();
    var organizerPaidMap = {};
    var playerPaidMap = {};
    try { organizerPaidMap = JSON.parse(localStorage.getItem('organizerPaidBookings') || '{}'); } catch (_) {}
    try { playerPaidMap = JSON.parse(localStorage.getItem('playerPaidBookings') || '{}'); } catch (_) {}

    var organizerPaid = ownerNormalizePaymentStatus(booking.organizerPaymentStatus) === 'PAID' || !!organizerPaidMap[bookingId];
    if (!organizerPaid) return false;

    if (paymentMethod === 'ORGANIZER') {
        return true;
    }

    var participants = booking.participants || booking.players || [];
    var expectedParticipants = Number(booking.teamSize) > 0 ? Math.max(Number(booking.teamSize) - 1, 0) : null;
    var participantById = {};
    participants.forEach(function(p) {
        var pid = String(p.userId || p.id || '');
        if (!pid) return;
        participantById[pid] = p;
    });
    Object.keys(playerPaidMap || {}).forEach(function(k) {
        if (!bookingId || k.indexOf(bookingId + '_') !== 0) return;
        var pid = k.slice(bookingId.length + 1);
        if (!pid) return;
        if (!participantById[pid]) participantById[pid] = { userId: pid, paymentStatus: 'PAID' };
    });
    var mergedParticipants = Object.keys(participantById).map(function(pid) { return participantById[pid]; });
    if (expectedParticipants != null && mergedParticipants.length < expectedParticipants) return false;
    if (expectedParticipants === 0) return true;

    return mergedParticipants.length > 0 && mergedParticipants.every(function(p) {
        var pid = String(p.userId || p.id || '');
        var byMap = bookingId && pid ? !!playerPaidMap[bookingId + '_' + pid] : false;
        return byMap || ownerNormalizePaymentStatus(p.paymentStatus) === 'PAID';
    });
}

function ownerPaymentUiLabel(b) {
    return ownerAllPaymentsCompleted(b) ? t('status.PAID') : t('status.PENDING');
}

function ownerDecisionStorageKey() {
    return 'ownerBookingDecisions';
}

function getOwnerDecisionMap() {
    try {
        return JSON.parse(localStorage.getItem(ownerDecisionStorageKey()) || '{}');
    } catch (_) {
        return {};
    }
}

function setOwnerDecision(bookingId, decision) {
    if (!bookingId) return;
    var map = getOwnerDecisionMap();
    map[String(bookingId)] = String(decision || '');
    localStorage.setItem(ownerDecisionStorageKey(), JSON.stringify(map));
}

/** Matches routes/bookings.js — instant fields skip owner approve/decline in the UI. */
function ownerFieldUsesInstantBooking(field) {
    var t = String((field && field.bookingType) || 'instant').toLowerCase();
    return t !== 'request';
}

function ownerStatusDisplayCode(booking) {
    var statusRaw = String((booking && booking.status) || '').toUpperCase();
    var field = booking && booking.field;
    if (statusRaw === 'PENDING' && ownerFieldUsesInstantBooking(field)) {
        return 'Instant';
    }
    var bookingId = String(booking && (booking.id != null ? booking.id : booking._id || '') || '');
    var decisionMap = getOwnerDecisionMap();
    var decision = bookingId ? String(decisionMap[bookingId] || '').toLowerCase() : '';

    if (statusRaw === 'PENDING') return 'Pending';
    if (statusRaw === 'CANCELLED') {
        if (decision === 'rejected') return 'Rejected';
        return 'Cancelled';
    }
    if (statusRaw === 'CONFIRMED' || statusRaw === 'UPCOMING' || statusRaw === 'COMPLETED') return 'Approved';
    return 'Pending';
}

function ownerStatusDisplayLabel(booking) {
    var code = ownerStatusDisplayCode(booking);
    var keyMap = {
        Instant: 'status.INSTANT',
        Pending: 'status.PENDING',
        Rejected: 'status.REJECTED',
        Cancelled: 'status.CANCELLED',
        Approved: 'status.APPROVED'
    };
    return t(keyMap[code] || 'status.PENDING');
}

/** Same badge classes as the bookings table STATUS column. */
function ownerStatusBadgeClassForBooking(b) {
    var statusCode = ownerStatusDisplayCode(b);
    if (statusCode === 'Rejected' || statusCode === 'Cancelled') {
        return 'badge-cancelled';
    }
    if (statusCode === 'Pending') {
        return 'badge-pending';
    }
    if (statusCode === 'Instant') {
        return 'badge-confirmed';
    }
    return 'badge-confirmed';
}

function renderOwnerBookingsTable() {
    var tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;

    if (!ownerBookingsCache.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;color:#6B7280;">' + t('owner.noBookingsYet') + '</td></tr>';
        return;
    }

    tbody.innerHTML = ownerBookingsCache.map(function(b) {
        var id = String(b.id != null ? b.id : b._id || '');
        var org = b.organizer || {};
        var field = b.field || {};
        var name = org.fullName || t('owner.player');
        var avatar = org.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=007BFF&color=fff&size=128');
        var dateObj = b.date ? new Date(b.date) : new Date();
        var dateStr = dateObj.toLocaleDateString((document.documentElement && document.documentElement.lang === 'ar') ? 'ar' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        var timeStr = (b.timeSlotStart || '') + '-' + (b.timeSlotEnd || '');
        var durationStr = formatBookingDurationLabel(b);
        var st = (b.status || '').toUpperCase();
        var statusCode = ownerStatusDisplayCode(b);
        var statusLabel = ownerStatusDisplayLabel(b);
        var statusFilterLabel = statusCode === 'Instant' ? 'Pending' : statusCode;
        var statusClass = (statusCode === 'Rejected' || statusCode === 'Cancelled')
            ? 'badge-cancelled'
            : (statusCode === 'Pending' ? 'badge-pending' : 'badge-confirmed');
        var payClass = ownerAllPaymentsCompleted(b) ? 'badge-paid' : 'badge-pending-payment';

        var actions = '<div class="action-buttons">' +
            '<button type="button" class="action-icon-btn" data-action="view" title="' + t('common.view') + '"><i class="fi fi-rr-eye"></i></button>';
        if (st === 'PENDING') {
            if (ownerFieldUsesInstantBooking(field)) {
                actions += '<button type="button" class="action-icon-btn decline" data-action="decline" title="' + t('owner.cancelBooking') + '"><i class="fi fi-rr-cross"></i></button>';
            } else {
                actions += '<button type="button" class="action-icon-btn approve" data-action="approve" title="' + t('owner.approve') + '"><i class="fi fi-rr-check"></i></button>' +
                    '<button type="button" class="action-icon-btn decline" data-action="decline" title="' + t('owner.decline') + '"><i class="fi fi-rr-cross"></i></button>';
            }
        }
        actions += '</div>';

        return '<tr data-booking-id="' + escHtml(id) + '" data-booking-date="' + escHtml(bookingDateKeyLocal(b.date)) + '" data-field-sport="' + escHtml(field.sport || '') + '" data-status-label="' + escHtml(statusFilterLabel) + '">' +
            '<td><div class="customer-cell"><img src="' + escHtml(avatar) + '" alt="" class="customer-avatar"><span>' + escHtml(name) + '</span></div></td>' +
            '<td>' + escHtml(field.name || '') + '</td>' +
            '<td><div class="date-time-cell"><span class="date-text">' + escHtml(dateStr) + '</span><span class="time-text">' + escHtml(timeStr) + '</span></div></td>' +
            '<td>' + escHtml(durationStr) + '</td>' +
            '<td><span class="badge ' + payClass + '">' + ownerPaymentUiLabel(b) + '</span></td>' +
            '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>' +
            '<td>' + actions + '</td></tr>';
    }).join('');
}

function syncCalendarFromCache() {
    calendarBookings = {};
    ownerBookingsCache.forEach(function(b) {
        if (!b.date) return;
        var d = new Date(b.date);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (!calendarBookings[key]) calendarBookings[key] = [];
        var org = b.organizer || {};
        var field = b.field || {};
        var name = org.fullName || t('owner.player');
        var orgId = String(org.id || '');
        var avatarFromOrg = (org.avatar && String(org.avatar).trim()) || '';
        var cachedAvatar = '';
        if (orgId && typeof localStorage !== 'undefined') {
            try {
                cachedAvatar = (localStorage.getItem('userAvatar_' + orgId) || '').trim();
            } catch (_) {}
        }
        var avatarUrl = avatarFromOrg || cachedAvatar ||
            ('https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=007BFF&color=fff&size=128');
        var initials = (name || 'P').split(/\s+/).map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
        calendarBookings[key].push({
            name: name,
            initials: initials,
            avatarUrl: avatarUrl,
            field: field.name || '',
            time: (b.timeSlotStart || '') + ' - ' + (b.timeSlotEnd || ''),
            duration: formatBookingDurationLabel(b),
            status: ownerStatusDisplayLabel(b),
            statusBadgeClass: ownerStatusBadgeClassForBooking(b)
        });
    });
}

async function loadOwnerBookingsFromApi() {
    if (typeof API === 'undefined' || !API.bookings || !API.bookings.getAll) return;
    try {
        var res = await API.bookings.getAll({ limit: 500 });
        ownerBookingsCache = (res && res.bookings) ? res.bookings : [];
        renderOwnerBookingsTable();
        syncCalendarFromCache();
    } catch (e) {
        console.error('Owner bookings load failed', e);
    }
}

function closeBookingDetailModal() {
    var modal = document.getElementById('bookingDetailModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
    syncBookingDetailFooter(null);
}

function syncBookingDetailFooter(booking) {
    var foot = document.getElementById('bookingDetailFooter');
    if (!foot) return;
    var approveBtn = foot.querySelector('[data-booking-detail-action="approve"]');
    var declineBtn = foot.querySelector('[data-booking-detail-action="decline"]');
    var hint = foot.querySelector('.booking-detail-footer-hint');
    if (!booking || String(booking.status || '').toUpperCase() !== 'PENDING') {
        if (approveBtn) approveBtn.style.display = '';
        if (hint) hint.textContent = t('owner.waitingApproval');
        foot.dataset.bookingId = '';
        foot.hidden = true;
        foot.querySelectorAll('button').forEach(function(b) {
            b.disabled = false;
        });
        return;
    }
    var fld = booking.field || {};
    var inst = ownerFieldUsesInstantBooking(fld);
    var bid = String(booking.id != null ? booking.id : booking._id || '');
    if (approveBtn) approveBtn.style.display = inst ? 'none' : '';
    if (declineBtn) declineBtn.style.display = '';
    if (hint) {
        hint.textContent = inst
            ? t('owner.instantCancelHint')
            : t('owner.waitingApproval');
    }
    foot.dataset.bookingId = bid;
    foot.hidden = false;
    foot.querySelectorAll('button').forEach(function(b) {
        b.disabled = false;
    });
}

function findCachedOwnerBooking(bookingId) {
    if (bookingId == null || bookingId === '') return null;
    return ownerBookingsCache.find(function(b) {
        return String(b.id != null ? b.id : b._id) === String(bookingId);
    });
}

function ownerBookingConfirmLabels(bookingId) {
    var b = findCachedOwnerBooking(bookingId);
    var customer = (b && b.organizer && b.organizer.fullName) || t('owner.thisCustomer');
    var field = (b && b.field && b.field.name) || t('owner.yourField');
    return { customer: customer, field: field };
}

async function resolveBookingParticipantsForNotification(booking, bookingId) {
    var source = booking || null;
    var participants = (source && (source.participants || source.players)) || [];
    if (participants.length) return { booking: source, participants: participants };

    if (typeof API !== 'undefined' && API.bookings && API.bookings.getById && bookingId) {
        try {
            var res = await API.bookings.getById(bookingId);
            var fullBooking = (res && (res.booking || res.data || res)) || source;
            var fullParticipants = (fullBooking && (fullBooking.participants || fullBooking.players)) || [];
            return { booking: fullBooking, participants: fullParticipants };
        } catch (_) {
            // Fallback to whatever we had in cache.
        }
    }
    return { booking: source, participants: participants };
}

async function notifyParticipantsBookingStatus(booking, bookingId, nextStatus) {
    var resolved = await resolveBookingParticipantsForNotification(booking, bookingId);
    var bookingData = resolved.booking || booking || {};
    var participants = resolved.participants || [];

    var ownerName = (bookingData.field && bookingData.field.owner && bookingData.field.owner.fullName) || t('owner.fieldOwner');
    var fieldName = (bookingData.field && bookingData.field.name) || bookingData.fieldName || t('owner.yourField');
    var isApproved = String(nextStatus || '').toUpperCase() === 'CONFIRMED';
    var title = isApproved ? t('owner.bookingApproved') : t('owner.bookingRejected');
    var message = isApproved
        ? t('owner.bookingApprovedMsg', { owner: ownerName, field: fieldName })
        : t('owner.bookingRejectedMsg', { owner: ownerName, field: fieldName });

    var notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    var bookingIdStr = String((bookingData.id != null ? bookingData.id : bookingData._id) || bookingId || '');
    var recipientMap = {};

    // The organizer should always be told when the field owner rejects the booking.
    if (!isApproved) {
        var organizerId = String(bookingData.organizerId || (bookingData.organizer && bookingData.organizer.id) || '');
        if (organizerId) recipientMap[organizerId] = true;
    }

    // API participants/players
    participants.forEach(function(p) {
        var pid = String(p.userId || p.id || (p.user && p.user.id) || '');
        if (!pid) return;
        recipientMap[pid] = true;
    });

    // Also include invited users from existing booking invite/payment notifications.
    notifications.forEach(function(n) {
        var isSameBooking = String(n.bookingId || '') === bookingIdStr;
        var isInviteType = n.type === 'booking_payment_request' || n.type === 'booking_invite' || n.type === 'booking_invitation';
        var pid = String(n.playerId || '');
        if (!isSameBooking || !isInviteType || !pid) return;
        recipientMap[pid] = true;
    });

    var recipientIds = Object.keys(recipientMap);
    if (!recipientIds.length) return;
    var now = new Date().toISOString();
    recipientIds.forEach(function(pid) {
        notifications.push({
            id: 'notif_' + Date.now() + '_' + pid + '_' + Math.random().toString(36).slice(2, 7),
            type: isApproved ? 'booking_approved' : 'booking_rejected',
            playerId: pid,
            bookingId: bookingIdStr,
            title: title,
            message: message,
            date: bookingData.date,
            status: 'unread',
            createdAt: now
        });
    });
    localStorage.setItem('playerNotifications', JSON.stringify(notifications));
    try { if (typeof window.matchfieldRefreshNotificationBadge === 'function') window.matchfieldRefreshNotificationBadge(); } catch (_) {}
}

function setOwnerRowActionLoading(row, loading) {
    if (!row) return;
    row.querySelectorAll('.action-icon-btn').forEach(function(btn) {
        btn.disabled = !!loading;
        if (loading) btn.setAttribute('aria-busy', 'true');
        else btn.removeAttribute('aria-busy');
    });
}

function setBookingDetailFooterBusy(loading) {
    var foot = document.getElementById('bookingDetailFooter');
    if (!foot) return;
    foot.querySelectorAll('button').forEach(function(b) {
        b.disabled = !!loading;
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Notifications: scripts/player/notifications.js (no duplicate toggle here)

    const notificationPopup = document.getElementById('notificationPopup');
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');

    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            if (notificationPopup) notificationPopup.classList.remove('active');
        });

        document.addEventListener('click', function(e) {
            if (!profileBtn.contains(e.target) && !profilePopup.contains(e.target)) {
                profilePopup.classList.remove('active');
            }
        });
    }

    // View toggle (Table/Calendar)
    const tableViewBtn = document.getElementById('tableViewBtn');
    const calendarViewBtn = document.getElementById('calendarViewBtn');
    const tableView = document.getElementById('tableView');
    const calendarView = document.getElementById('calendarView');

    if (tableViewBtn && calendarViewBtn && tableView && calendarView) {
        tableViewBtn.addEventListener('click', function() {
            tableViewBtn.classList.add('active');
            calendarViewBtn.classList.remove('active');
            tableView.style.display = 'block';
            calendarView.style.display = 'none';
        });

        calendarViewBtn.addEventListener('click', function() {
            calendarViewBtn.classList.add('active');
            tableViewBtn.classList.remove('active');
            tableView.style.display = 'none';
            calendarView.style.display = 'block';
            // Initialize calendar when switching to calendar view
            if (calendarView.style.display !== 'none') {
                initCalendar();
            }
        });
    }

    // Initialize calendar if calendar view is shown
    if (calendarView && calendarView.style.display !== 'none') {
        initCalendar();
    }

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            applyFilters();
        });
    }

    // Filter functionality
    const fieldFilter = document.getElementById('fieldFilter');
    const statusFilter = document.getElementById('statusFilter');
    const dateFilter = document.getElementById('dateFilter');

    if (fieldFilter) {
        fieldFilter.addEventListener('change', function() {
            applyFilters();
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            applyFilters();
        });
    }

    if (dateFilter) {
        dateFilter.addEventListener('change', function() {
            applyFilters();
        });
    }

    // Actions (delegated — works with API-rendered rows, same pattern as player bookings list)
    const bookingsTbody = document.getElementById('bookingsTableBody');
    if (bookingsTbody) {
        bookingsTbody.addEventListener('click', function(e) {
            const btn = e.target.closest('.action-icon-btn');
            if (!btn) return;
            e.stopPropagation();
            const action = (btn.getAttribute('data-action') || '').toLowerCase();
            const row = btn.closest('tr');
            const bookingId = row && row.getAttribute('data-booking-id');
            if (action === 'view') {
                viewBookingDetail(bookingId);
            } else if (action === 'approve') {
                approveBookingById(bookingId, row);
            } else if (action === 'decline') {
                declineBookingById(bookingId, row);
            }
        });
    }

    var bookingDetailModal = document.getElementById('bookingDetailModal');
    var bookingDetailClose = document.getElementById('bookingDetailClose');
    if (bookingDetailClose) {
        bookingDetailClose.addEventListener('click', closeBookingDetailModal);
    }
    if (bookingDetailModal) {
        bookingDetailModal.addEventListener('click', function(e) {
            if (e.target === bookingDetailModal) closeBookingDetailModal();
        });
    }

    var bookingDetailFooter = document.getElementById('bookingDetailFooter');
    if (bookingDetailFooter) {
        bookingDetailFooter.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-booking-detail-action]');
            if (!btn) return;
            var id = bookingDetailFooter.dataset.bookingId;
            if (!id) return;
            var act = (btn.getAttribute('data-booking-detail-action') || '').toLowerCase();
            if (act === 'approve') approveBookingById(id, null);
            else if (act === 'decline') declineBookingById(id, null);
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && bookingDetailModal && bookingDetailModal.classList.contains('active')) {
            closeBookingDetailModal();
        }
    });

    loadOwnerBookingsFromApi();
});

// Apply all filters
function applyFilters() {
    const fieldFilter = document.getElementById('fieldFilter')?.value || 'All Fields';
    const statusFilter = document.getElementById('statusFilter')?.value || 'All Status';
    const dateFilter = document.getElementById('dateFilter')?.value || 'Date range';
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';

    const rows = document.querySelectorAll('#bookingsTableBody tr');
    
    rows.forEach(row => {
        const fieldName = row.cells[1]?.textContent.trim() || '';
        const statusBadge = row.querySelector('.badge')?.textContent.trim() || '';
        const dateText = row.querySelector('.date-text')?.textContent || '';
        
        let show = true;

        // Field filter — match sport on row (data-field-sport from API)
        if (fieldFilter !== 'All Fields') {
            const sportAttr = (row.getAttribute('data-field-sport') || '').toLowerCase();
            const filterLower = fieldFilter.toLowerCase();
            if (!sportAttr.includes(filterLower) && !fieldName.toLowerCase().includes(filterLower)) {
                show = false;
            }
        }

        // Status filter — compare to data-status-label for API-driven rows
        const rowStatus = row.getAttribute('data-status-label') || statusBadge;
        if (statusFilter !== 'All Status' && rowStatus !== statusFilter) {
            show = false;
        }

        // Search filter
        if (searchTerm) {
            const customerName = row.querySelector('.customer-cell span')?.textContent.toLowerCase() || '';
            const text = customerName + ' ' + fieldName.toLowerCase();
            if (!text.includes(searchTerm)) {
                show = false;
            }
        }

        // Date range (table rows only — skip empty-state row without data-booking-id)
        if (dateFilter !== 'Date range') {
            if (!row.getAttribute('data-booking-id')) {
                show = false;
            } else if (!rowMatchesDateFilter(row, dateFilter)) {
                show = false;
            }
        }

        row.style.display = show ? '' : 'none';
    });
}

function formatOwnerBookingMoney(n) {
    if (typeof MatchFieldPrefs !== 'undefined' && MatchFieldPrefs.formatMoney) {
        return MatchFieldPrefs.formatMoney(Number(n) || 0);
    }
    return '₪' + (Number(n) || 0).toLocaleString('en-IL');
}

function bookingPaymentMethodLabel(pm) {
    var p = (pm || '').toUpperCase();
    if (p === 'ORGANIZER') return t('payment.modeOrganizer');
    if (p === 'SPLIT') return t('payment.modeSplit');
    if (p === 'MIXED') return t('payment.modeMixed');
    return pm || '—';
}

function timeStrToMinutesOwner(s) {
    if (s == null || s === '') return NaN;
    var parts = String(s).trim().split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1] != null && parts[1] !== '' ? parts[1] : '0', 10);
    if (isNaN(h) || isNaN(m)) return NaN;
    return h * 60 + m;
}

function hoursInRangeOwner(startStr, endStr) {
    var a = timeStrToMinutesOwner(startStr);
    var b = timeStrToMinutesOwner(endStr);
    if (isNaN(a) || isNaN(b) || b <= a) return 0;
    return (b - a) / 60;
}

function bookingHoursFromRecord(b) {
    var ranges = Array.isArray(b.timeSlotRanges) && b.timeSlotRanges.length ? b.timeSlotRanges : null;
    var list = ranges || [{ start: b.timeSlotStart, end: b.timeSlotEnd }];
    var total = 0;
    list.forEach(function(r) {
        if (!r || r.start == null || r.end == null) return;
        total += hoursInRangeOwner(r.start, r.end);
    });
    return total;
}

/** Human-readable duration for table/calendar/detail (e.g. "2 hours"). */
function formatBookingDurationLabel(b) {
    var hours = bookingHoursFromRecord(b);
    if (hours <= 0) return '—';
    var hRounded = Math.round(hours * 1000) / 1000;
    var hLabel = hRounded % 1 === 0 ? String(Math.round(hRounded)) : String(hRounded);
    return hLabel + ' ' + (Math.abs(hRounded - 1) < 1e-9 ? t('common.hour') : t('common.hours'));
}

function formatBookingDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString((document.documentElement && document.documentElement.lang === 'ar') ? 'ar' : 'en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return '—';
    }
}

function buildBookingDetailHtml(b) {
    var field = b.field || {};
    var owner = field.owner || {};
    var org = b.organizer || {};
    var durationStr = formatBookingDurationLabel(b);
    var slotLine = (b.timeSlotStart || '') + ' – ' + (b.timeSlotEnd || '');
    var ranges = b.timeSlotRanges;
    if (Array.isArray(ranges) && ranges.length > 1) {
        slotLine = ranges
            .map(function(r) {
                if (!r || r.start == null || r.end == null) return '';
                return String(r.start) + ' – ' + String(r.end);
            })
            .filter(Boolean)
            .join(', ');
    }

    var payExtra = '';
    if ((b.paymentMethod || '').toUpperCase() === 'ORGANIZER') {
        payExtra =
            ' · ' + t('owner.organizerPayment') + ': ' +
            ((b.organizerPaymentStatus || '').toUpperCase() === 'PAID' ? t('status.PAID') : t('status.PENDING'));
    }

    var participantsHtml = '';
    var parts = b.participants || [];
    if (!parts.length) {
        participantsHtml = '<p class="booking-detail-muted">' + t('owner.noParticipants') + '</p>';
    } else {
        participantsHtml =
            '<ul class="booking-detail-list">' +
            parts
                .map(function(p) {
                    var u = p.user || {};
                    var line = escHtml(u.fullName || '—');
                    if (u.email) line += ' <span class="booking-detail-muted">(' + escHtml(u.email) + ')</span>';
                    return '<li>' + line + '</li>';
                })
                .join('') +
            '</ul>';
    }

    return (
        '<dl class="booking-detail-grid">' +
        '<dt>' + t('owner.bookingId') + '</dt><dd><code style="font-size:12px;">' +
        escHtml(String(b.id != null ? b.id : b._id || '')) +
        '</code></dd>' +
        '<dt>' + t('common.status') + '</dt><dd>' +
        escHtml(ownerStatusUiLabel(b.status)) +
        ' <span class="booking-detail-muted">(' +
        escHtml(String(b.status || '')) +
        ')</span></dd>' +
        '<dt>' + t('owner.colField') + '</dt><dd>' +
        escHtml(field.name || '—') +
        '</dd>' +
        '<dt>' + t('owner.sportLocation') + '</dt><dd>' +
        escHtml((window.MatchFieldI18n && MatchFieldI18n.sportLabel) ? (MatchFieldI18n.sportLabel(field.sport) || field.sport || '—') : (field.sport || '—')) +
        ' · ' +
        escHtml(field.location || '—') +
        '</dd>' +
        '<dt>' + t('owner.dateTime') + '</dt><dd>' +
        formatBookingDate(b.date) +
        '</dd>' +
        '<dt>' + t('owner.timeSlots') + '</dt><dd>' +
        escHtml(slotLine) +
        '</dd>' +
        '<dt>' + t('owner.duration') + '</dt><dd>' +
        escHtml(durationStr) +
        '</dd>' +
        '<dt>' + t('owner.teamSize') + '</dt><dd>' +
        escHtml(b.teamSize != null ? String(b.teamSize) : '—') +
        '</dd>' +
        '<dt>' + t('owner.payment') + '</dt><dd>' +
        escHtml(bookingPaymentMethodLabel(b.paymentMethod)) +
        payExtra +
        '</dd>' +
        '<dt>' + t('common.total') + '</dt><dd><strong>' +
        formatOwnerBookingMoney(b.totalCost) +
        '</strong></dd>' +
        '<dt>' + t('owner.created') + '</dt><dd>' +
        formatBookingDate(b.createdAt) +
        '</dd>' +
        '<dt>' + t('owner.confirmedAt') + '</dt><dd>' +
        formatBookingDate(b.confirmedAt) +
        '</dd>' +
        '</dl>' +
        '<div class="booking-detail-section"><h3>' + t('owner.organizer') + '</h3>' +
        '<dl class="booking-detail-grid">' +
        '<dt>' + t('common.name') + '</dt><dd>' +
        escHtml(org.fullName || '—') +
        '</dd>' +
        '<dt>' + t('common.email') + '</dt><dd>' +
        escHtml(org.email || '—') +
        '</dd>' +
        '<dt>' + t('common.phone') + '</dt><dd>' +
        escHtml(org.phone || '—') +
        '</dd>' +
        '</dl></div>' +
        '<div class="booking-detail-section"><h3>' + t('owner.venueOwnerYou') + '</h3>' +
        '<dl class="booking-detail-grid">' +
        '<dt>' + t('common.name') + '</dt><dd>' +
        escHtml(owner.fullName || '—') +
        '</dd>' +
        '<dt>' + t('common.phone') + '</dt><dd>' +
        escHtml(owner.phone || '—') +
        '</dd>' +
        '</dl></div>' +
        '<div class="booking-detail-section"><h3>' + t('owner.participants') + '</h3>' +
        participantsHtml +
        '</div>'
    );
}

async function viewBookingDetail(bookingId) {
    var modal = document.getElementById('bookingDetailModal');
    var body = document.getElementById('bookingDetailBody');
    if (!bookingId || !modal || !body) return;
    if (typeof API === 'undefined' || !API.bookings || !API.bookings.getById) {
        alert(t('common.apiUnavailable'));
        return;
    }

    syncBookingDetailFooter(null);
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    body.innerHTML = '<p class="booking-detail-loading">' + t('common.loading') + '</p>';

    try {
        var res = await API.bookings.getById(bookingId);
        var b = res && res.booking;
        if (!b) {
            body.innerHTML = '<p class="booking-detail-error">' + t('errors.bookingNotFound') + '</p>';
            return;
        }
        body.innerHTML = buildBookingDetailHtml(b);
        syncBookingDetailFooter(b);
    } catch (err) {
        var msg = (window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('owner.couldNotLoadBooking');
        body.innerHTML = '<p class="booking-detail-error">' + escHtml(msg) + '</p>';
    }
}

async function approveBookingById(bookingId, row) {
    if (!bookingId || typeof API === 'undefined' || !API.bookings || !API.bookings.updateStatus) {
        alert(t('common.signInAgain'));
        return;
    }
    var cached = findCachedOwnerBooking(bookingId);
    if (cached && ownerFieldUsesInstantBooking(cached.field) && String(cached.status || '').toUpperCase() === 'PENDING') {
        alert(t('owner.instantNoApprove'));
        return;
    }
    var labels = ownerBookingConfirmLabels(bookingId);
    if (!(await MatchFieldDialog.confirm(
        t('owner.approveConfirmLong', { customer: labels.customer, field: labels.field }),
        { okText: t('owner.approve') }
    ))) return;
    setOwnerRowActionLoading(row, true);
    setBookingDetailFooterBusy(true);
    try {
        var cachedBeforeUpdate = findCachedOwnerBooking(bookingId);
        await API.bookings.updateStatus(bookingId, 'CONFIRMED');
        setOwnerDecision(bookingId, 'approved');
        await notifyParticipantsBookingStatus(cachedBeforeUpdate, bookingId, 'CONFIRMED');
        await loadOwnerBookingsFromApi();
        if (typeof renderCalendar === 'function') renderCalendar();
        closeBookingDetailModal();
    } catch (e) {
        alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(e && e.message)) || t('owner.couldNotApprove'));
    } finally {
        setOwnerRowActionLoading(row, false);
        setBookingDetailFooterBusy(false);
    }
}

async function declineBookingById(bookingId, row) {
    if (!bookingId || typeof API === 'undefined' || !API.bookings || !API.bookings.updateStatus) {
        alert(t('common.signInAgain'));
        return;
    }
    var labels = ownerBookingConfirmLabels(bookingId);
    if (!(await MatchFieldDialog.confirm(
        t('owner.declineConfirmLong', { customer: labels.customer, field: labels.field }),
        { type: 'danger', okText: t('owner.decline') }
    ))) return;
    setOwnerRowActionLoading(row, true);
    setBookingDetailFooterBusy(true);
    try {
        var cachedBeforeUpdate = findCachedOwnerBooking(bookingId);
        await API.bookings.updateStatus(bookingId, 'CANCELLED');
        setOwnerDecision(bookingId, 'rejected');
        await notifyParticipantsBookingStatus(cachedBeforeUpdate, bookingId, 'CANCELLED');
        await loadOwnerBookingsFromApi();
        if (typeof renderCalendar === 'function') renderCalendar();
        closeBookingDetailModal();
    } catch (e) {
        alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(e && e.message)) || t('owner.couldNotDecline'));
    } finally {
        setOwnerRowActionLoading(row, false);
        setBookingDetailFooterBusy(false);
    }
}

// Calendar — filled from ownerBookingsCache via syncCalendarFromCache()
let currentCalendarDate = new Date();

function initCalendar() {
    renderCalendar();
    setupCalendarNavigation();
    selectDate(currentCalendarDate);
}

function renderCalendar() {
    const calendarDaysGrid = document.getElementById('calendarDaysGrid');
    if (!calendarDaysGrid) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update month/year display
    const monthYearElement = document.getElementById('calendarMonthYear');
    if (monthYearElement) {
        const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june',
                          'july', 'august', 'september', 'october', 'november', 'december'];
        monthYearElement.textContent = `${t('months.' + monthKeys[month])} ${year}`;
    }

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    calendarDaysGrid.innerHTML = '';

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day-widget other-month';
        calendarDaysGrid.appendChild(emptyDay);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day-widget';
        dayElement.innerHTML = `<span class="calendar-day-number">${day}</span>`;
        
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Check if date has bookings
        if (calendarBookings[dateKey]) {
            dayElement.classList.add('has-booking');
        }

        // Check if this is the selected date
        if (year === currentCalendarDate.getFullYear() && 
            month === currentCalendarDate.getMonth() && 
            day === currentCalendarDate.getDate()) {
            dayElement.classList.add('selected');
        }

        dayElement.addEventListener('click', function() {
            selectDate(new Date(year, month, day));
        });

        calendarDaysGrid.appendChild(dayElement);
    }

    // Add empty cells for days after the last day of the month
    const totalCells = startingDayOfWeek + daysInMonth;
    const remainingCells = 42 - totalCells; // 6 rows * 7 days
    for (let i = 0; i < remainingCells && totalCells + i < 42; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day-widget other-month';
        calendarDaysGrid.appendChild(emptyDay);
    }
}

function setupCalendarNavigation() {
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', function() {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', function() {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
        });
    }
}

function selectDate(date) {
    currentCalendarDate = new Date(date);
    renderCalendar();
    displayBookingsForDate(date);
}

function displayBookingsForDate(date) {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const bookings = calendarBookings[dateKey] || [];
    
    // Update title
    const titleElement = document.getElementById('calendarBookingsTitle');
    if (titleElement) {
        const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june',
                          'july', 'august', 'september', 'october', 'november', 'december'];
        const dayName = t('days.' + dayKeys[date.getDay()]);
        const monthName = t('months.' + monthKeys[date.getMonth()]);
        const day = date.getDate();
        const year = date.getFullYear();
        titleElement.textContent = t('owner.bookingsForDate', { weekday: dayName, month: monthName, day: day, year: year });
    }

    // Update booking cards
    const cardsContainer = document.getElementById('calendarBookingsCards');
    if (cardsContainer) {
        if (bookings.length === 0) {
            cardsContainer.innerHTML = '<p style="color: #6B7280; text-align: center; padding: 40px;">' + t('owner.noBookingsForDate') + '</p>';
        } else {
            cardsContainer.innerHTML = bookings.map(booking => `
                <div class="calendar-booking-card">
                    <div class="calendar-booking-avatar" aria-hidden="true">
                        <img class="calendar-booking-avatar-img" src="${escHtml(booking.avatarUrl)}" alt="">
                        <span class="calendar-booking-avatar-fallback">${escHtml(booking.initials)}</span>
                    </div>
                    <div class="calendar-booking-info">
                        <div class="calendar-booking-name">${escHtml(booking.name)}</div>
                        <div class="calendar-booking-field">${escHtml(booking.field)}</div>
                        <div class="calendar-booking-time">${escHtml(booking.time)} • ${escHtml(booking.duration)}</div>
                    </div>
                    <span class="badge ${escHtml(booking.statusBadgeClass || 'badge-pending')}">${escHtml(booking.status)}</span>
                </div>
            `).join('');
            cardsContainer.querySelectorAll('.calendar-booking-avatar-img').forEach(function(img) {
                img.addEventListener('error', function() {
                    var wrap = img.closest('.calendar-booking-avatar');
                    if (wrap) wrap.classList.add('is-img-broken');
                });
            });
        }
    }
}


