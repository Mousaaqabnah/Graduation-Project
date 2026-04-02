// Bookings — owner scope comes from the API (same JWT + API.bookings pattern as player/bookings.js).

var ownerBookingsCache = [];
var calendarBookings = {};

function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

function ownerStatusUiLabel(status) {
    var s = (status || '').toUpperCase();
    if (s === 'PENDING') return 'Pending';
    if (s === 'CONFIRMED' || s === 'UPCOMING') return 'Confirmed';
    if (s === 'COMPLETED') return 'Completed';
    if (s === 'CANCELLED') return 'Cancelled';
    return s || '—';
}

function ownerPaymentUiLabel(b) {
    if (b.paymentMethod === 'ORGANIZER') {
        var o = (b.organizerPaymentStatus || '').toUpperCase();
        return o === 'PAID' ? 'Paid' : 'Pending';
    }
    return 'Split';
}

function renderOwnerBookingsTable() {
    var tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;

    if (!ownerBookingsCache.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;color:#6B7280;">No bookings on your fields yet.</td></tr>';
        return;
    }

    tbody.innerHTML = ownerBookingsCache.map(function(b) {
        var id = String(b.id != null ? b.id : b._id || '');
        var org = b.organizer || {};
        var field = b.field || {};
        var name = org.fullName || 'Player';
        var avatar = org.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=007BFF&color=fff&size=128');
        var dateObj = b.date ? new Date(b.date) : new Date();
        var dateStr = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        var timeStr = (b.timeSlotStart || '') + '-' + (b.timeSlotEnd || '');
        var st = (b.status || '').toUpperCase();
        var statusClass = st === 'CANCELLED' ? 'badge-cancelled' : (st === 'PENDING' ? 'badge-pending' : 'badge-confirmed');
        var payClass = ownerPaymentUiLabel(b) === 'Paid' ? 'badge-paid' : 'badge-pending-payment';

        var actions = '<div class="action-buttons">' +
            '<button type="button" class="action-icon-btn" title="View"><i class="fi fi-rr-eye"></i></button>';
        if (st === 'PENDING') {
            actions += '<button type="button" class="action-icon-btn approve" title="Approve"><i class="fi fi-rr-check"></i></button>' +
                '<button type="button" class="action-icon-btn decline" title="Decline"><i class="fi fi-rr-cross"></i></button>';
        }
        actions += '</div>';

        return '<tr data-booking-id="' + escHtml(id) + '" data-field-sport="' + escHtml(field.sport || '') + '" data-status-label="' + escHtml(ownerStatusUiLabel(b.status)) + '">' +
            '<td><div class="customer-cell"><img src="' + escHtml(avatar) + '" alt="" class="customer-avatar"><span>' + escHtml(name) + '</span></div></td>' +
            '<td>' + escHtml(field.name || '') + '</td>' +
            '<td><div class="date-time-cell"><span class="date-text">' + escHtml(dateStr) + '</span><span class="time-text">' + escHtml(timeStr) + '</span></div></td>' +
            '<td>—</td>' +
            '<td><span class="badge ' + payClass + '">' + ownerPaymentUiLabel(b) + '</span></td>' +
            '<td><span class="badge ' + statusClass + '">' + ownerStatusUiLabel(b.status) + '</span></td>' +
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
        var initials = (org.fullName || 'P').split(/\s+/).map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
        calendarBookings[key].push({
            name: org.fullName || 'Player',
            initials: initials,
            field: field.name || '',
            time: (b.timeSlotStart || '') + ' - ' + (b.timeSlotEnd || ''),
            duration: '—',
            status: ownerStatusUiLabel(b.status),
            avatarColor: '#007BFF'
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
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            filterBookings(searchTerm);
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
            const action = (btn.getAttribute('title') || '').toLowerCase();
            const row = btn.closest('tr');
            const bookingId = row && row.getAttribute('data-booking-id');
            if (action === 'view') {
                viewBooking(row);
            } else if (action === 'approve') {
                approveBookingById(bookingId, row);
            } else if (action === 'decline') {
                declineBookingById(bookingId, row);
            }
        });
    }

    loadOwnerBookingsFromApi();
});

// Filter bookings by search term
function filterBookings(searchTerm) {
    const rows = document.querySelectorAll('#bookingsTableBody tr');
    
    rows.forEach(row => {
        const customerName = row.querySelector('.customer-cell span')?.textContent.toLowerCase() || '';
        const fieldName = row.cells[1]?.textContent.toLowerCase() || '';
        const text = customerName + ' ' + fieldName;
        
        if (text.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

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

        row.style.display = show ? '' : 'none';
    });
}

// View booking details
function viewBooking(row) {
    const customer = row.querySelector('.customer-cell span')?.textContent || '';
    const field = row.cells[1]?.textContent || '';
    const dateTime = row.querySelector('.date-time-cell')?.textContent || '';
    const duration = row.cells[3]?.textContent || '';
    const payment = row.cells[4]?.querySelector('.badge')?.textContent || '';
    const status = row.cells[5]?.querySelector('.badge')?.textContent || '';

    console.log('View booking:', {
        customer,
        field,
        dateTime,
        duration,
        payment,
        status
    });

    // TODO: Open a modal with booking details
    alert(`View booking for ${customer} at ${field}`);
}

async function approveBookingById(bookingId, row) {
    if (!bookingId || typeof API === 'undefined' || !API.bookings || !API.bookings.updateStatus) return;
    const customer = row && row.querySelector('.customer-cell span') ? row.querySelector('.customer-cell span').textContent : '';
    const field = row && row.cells[1] ? row.cells[1].textContent : '';
    if (!confirm('Approve booking for ' + customer + ' at ' + field + '?')) return;
    try {
        await API.bookings.updateStatus(bookingId, 'CONFIRMED');
        await loadOwnerBookingsFromApi();
        if (typeof renderCalendar === 'function') renderCalendar();
    } catch (e) {
        alert((e && e.message) ? e.message : 'Could not approve booking');
    }
}

async function declineBookingById(bookingId, row) {
    if (!bookingId || typeof API === 'undefined' || !API.bookings || !API.bookings.updateStatus) return;
    const customer = row && row.querySelector('.customer-cell span') ? row.querySelector('.customer-cell span').textContent : '';
    const field = row && row.cells[1] ? row.cells[1].textContent : '';
    if (!confirm('Decline booking for ' + customer + ' at ' + field + '?')) return;
    try {
        await API.bookings.updateStatus(bookingId, 'CANCELLED');
        await loadOwnerBookingsFromApi();
        if (typeof renderCalendar === 'function') renderCalendar();
    } catch (e) {
        alert((e && e.message) ? e.message : 'Could not cancel booking');
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
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
        monthYearElement.textContent = `${monthNames[month]} ${year}`;
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
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const dayName = dayNames[date.getDay()];
        const monthName = monthNames[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        titleElement.textContent = `Bookings for ${dayName}, ${monthName} ${day}, ${year}`;
    }

    // Update booking cards
    const cardsContainer = document.getElementById('calendarBookingsCards');
    if (cardsContainer) {
        if (bookings.length === 0) {
            cardsContainer.innerHTML = '<p style="color: #6B7280; text-align: center; padding: 40px;">No bookings for this date</p>';
        } else {
            cardsContainer.innerHTML = bookings.map(booking => `
                <div class="calendar-booking-card">
                    <div class="calendar-booking-avatar" style="background: ${booking.avatarColor}; color: white;">${booking.initials}</div>
                    <div class="calendar-booking-info">
                        <div class="calendar-booking-name">${booking.name}</div>
                        <div class="calendar-booking-field">${booking.field}</div>
                        <div class="calendar-booking-time">${booking.time} • ${booking.duration}</div>
                    </div>
                    <span class="badge ${booking.status === 'Confirmed' ? 'badge-confirmed' : 'badge-pending'}">${booking.status}</span>
                </div>
            `).join('');
        }
    }
}


