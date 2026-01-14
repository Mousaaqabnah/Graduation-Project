// Bookings Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Notification toggle
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPopup = document.getElementById('notificationPopup');

    if (notificationBtn && notificationPopup) {
        notificationBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationPopup.classList.toggle('active');
        });

        // Close notification popup when clicking outside
        document.addEventListener('click', function(e) {
            if (!notificationBtn.contains(e.target) && !notificationPopup.contains(e.target)) {
                notificationPopup.classList.remove('active');
            }
        });
    }

    // Profile toggle
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');

    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
        });

        // Close profile popup when clicking outside
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

    // Action buttons
    const actionButtons = document.querySelectorAll('.action-icon-btn');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const action = this.title.toLowerCase();
            const row = this.closest('tr');
            
            if (action === 'view') {
                viewBooking(row);
            } else if (action === 'approve') {
                approveBooking(row);
            } else if (action === 'decline') {
                declineBooking(row);
            }
        });
    });
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

        // Field filter - check if field name contains the selected field type
        if (fieldFilter !== 'All Fields') {
            const fieldNameLower = fieldName.toLowerCase();
            const filterLower = fieldFilter.toLowerCase();
            // Check if field name contains the field type (e.g., "football court" contains "football")
            if (!fieldNameLower.includes(filterLower)) {
                show = false;
            }
        }

        // Status filter
        if (statusFilter !== 'All Status' && statusBadge !== statusFilter) {
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

// Approve booking
function approveBooking(row) {
    const customer = row.querySelector('.customer-cell span')?.textContent || '';
    const field = row.cells[1]?.textContent || '';
    
    if (confirm(`Approve booking for ${customer} at ${field}?`)) {
        // Update status badge
        const statusCell = row.cells[5];
        statusCell.innerHTML = '<span class="badge badge-confirmed">Confirmed</span>';
        
        // Remove approve/decline buttons, keep only view
        const actionsCell = row.cells[6];
        actionsCell.innerHTML = `
            <div class="action-buttons">
                <button class="action-icon-btn" title="View">
                    <i class="fi fi-rr-eye"></i>
                </button>
            </div>
        `;
        
        // Re-attach event listener
        const viewBtn = actionsCell.querySelector('.action-icon-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', function() {
                viewBooking(row);
            });
        }
        
        console.log('Booking approved');
    }
}

// Decline booking
function declineBooking(row) {
    const customer = row.querySelector('.customer-cell span')?.textContent || '';
    const field = row.cells[1]?.textContent || '';
    
    if (confirm(`Decline booking for ${customer} at ${field}?`)) {
        // Update status badge
        const statusCell = row.cells[5];
        statusCell.innerHTML = '<span class="badge badge-cancelled">Cancelled</span>';
        
        // Remove approve/decline buttons, keep only view
        const actionsCell = row.cells[6];
        actionsCell.innerHTML = `
            <div class="action-buttons">
                <button class="action-icon-btn" title="View">
                    <i class="fi fi-rr-eye"></i>
                </button>
            </div>
        `;
        
        // Re-attach event listener
        const viewBtn = actionsCell.querySelector('.action-icon-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', function() {
                viewBooking(row);
            });
        }
        
        console.log('Booking declined');
    }
}

// Calendar functionality
let currentCalendarDate = new Date(2025, 11, 21); // December 21, 2025

// Sample bookings data for calendar
const calendarBookings = {
    '2025-12-21': [
        { name: 'John Smith', initials: 'JS', field: 'Fozi football court', time: '14:00 - 15:30', duration: '1.5 hours', status: 'Confirmed', avatarColor: '#007BFF' },
        { name: 'Emma Wilson', initials: 'EW', field: 'Basketball Court Elite', time: '18:00 - 19:00', duration: '1 hour', status: 'Pending', avatarColor: '#10B981' },
        { name: 'John Smith', initials: 'JS', field: 'Fozi football court', time: '20:00 - 21:30', duration: '1.5 hours', status: 'Confirmed', avatarColor: '#007BFF' },
        { name: 'Emma Wilson', initials: 'EW', field: 'Basketball Court Elite', time: '22:00 - 23:00', duration: '1 hour', status: 'Pending', avatarColor: '#10B981' }
    ],
    '2025-12-22': [
        { name: 'John Smith', initials: 'JS', field: 'Fozi football court', time: '14:00 - 15:30', duration: '1.5 hours', status: 'Confirmed', avatarColor: '#007BFF' }
    ],
    '2025-12-23': [
        { name: 'Emma Wilson', initials: 'EW', field: 'Basketball Court Elite', time: '18:00 - 19:00', duration: '1 hour', status: 'Pending', avatarColor: '#10B981' }
    ],
    '2025-12-24': [
        { name: 'John Smith', initials: 'JS', field: 'Fozi football court', time: '14:00 - 15:30', duration: '1.5 hours', status: 'Confirmed', avatarColor: '#007BFF' }
    ],
    '2025-12-28': [
        { name: 'Emma Wilson', initials: 'EW', field: 'Basketball Court Elite', time: '18:00 - 19:00', duration: '1 hour', status: 'Pending', avatarColor: '#10B981' }
    ],
    '2025-12-29': [
        { name: 'John Smith', initials: 'JS', field: 'Fozi football court', time: '14:00 - 15:30', duration: '1.5 hours', status: 'Confirmed', avatarColor: '#007BFF' }
    ]
};

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


