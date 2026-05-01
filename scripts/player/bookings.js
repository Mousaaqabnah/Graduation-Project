// Booking data populated from API / localStorage
// Start empty so UI shows the real state (no fake sample bookings)
const bookingsData = {
    upcoming: [],
    completed: [],
    cancelled: []
};

// Current filter state
var currentFilter = 'upcoming';
var searchQuery = '';
// Raw bookings from API (for payment button / cancel lookup)
var allBookingsCache = [];

function getCurrentUserSafe() {
    if (typeof API !== 'undefined' && typeof API.getCurrentUser === 'function') {
        return API.getCurrentUser();
    }
    try {
        var fromSession = sessionStorage.getItem('currentUser');
        if (fromSession) return JSON.parse(fromSession);
    } catch (_) {}
    try {
        var fromLocal = localStorage.getItem('currentUser');
        if (fromLocal) return JSON.parse(fromLocal);
    } catch (_) {}
    return null;
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadBookingsFromStorage();
    initializeFilters();
    initializeSearch();
    renderBookings();
    initializeProfile();
    initializePaymentStatusModal();
    // Info (i) button: use delegation so it works for dynamically rendered cards
    var listEl = document.getElementById('bookingsList');
    if (listEl) {
        listEl.addEventListener('click', function(e) {
            var btn = e.target.closest('.info-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            var id = btn.getAttribute('data-booking-id');
            if (id) showPaymentStatusInfo(id);
        });
    }
});

// Check if a booking's end time has passed (so it should show as completed)
function isBookingEndTimePassed(booking) {
    if (!booking.date) return false;
    var dateStr = typeof booking.date === 'string'
        ? booking.date.split('T')[0]
        : new Date(booking.date).toISOString().split('T')[0];
    var endTimeStr = '00:00';
    var r = booking.timeSlotRanges && Array.isArray(booking.timeSlotRanges) ? booking.timeSlotRanges : null;
    if (r && r.length > 0) {
        r.forEach(function(x) {
            if ((x.end || '').trim() > endTimeStr) endTimeStr = (x.end || '').trim();
        });
    }
    if (!endTimeStr || endTimeStr === '00:00') endTimeStr = (booking.timeSlotEnd || '').trim() || '23:59';
    if (!/^\d{1,2}:\d{2}/.test(endTimeStr)) return false;
    var endDate = new Date(dateStr + 'T' + endTimeStr);
    return new Date() >= endDate;
}

// Normalize booking id for deduplication (API may return id or _id, string or number)
function getBookingId(b) {
    if (!b) return null;
    var id = b.id != null ? b.id : b._id;
    return id != null ? String(id) : null;
}

// Remove duplicates from an array of display bookings by id
function dedupeById(arr) {
    var seen = {};
    return (arr || []).filter(function(item) {
        var id = getBookingId(item);
        if (!id) return true;
        if (seen[id]) return false;
        seen[id] = true;
        return true;
    });
}

// Fallback: dedupe by same date + field + time (catches duplicates with different ids)
function dedupeByContent(bookings) {
    var seen = {};
    return (bookings || []).filter(function(b) {
        var dateStr = (b.date && new Date(b.date).toISOString ? new Date(b.date).toISOString().slice(0, 10) : '') || '';
        var fieldId = (b.fieldId || b.field && b.field.id) || '';
        var start = (b.timeSlotStart || '').toString();
        var key = dateStr + '|' + fieldId + '|' + start;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    });
}

// Load bookings from API (fallback to localStorage if no API)
function loadBookingsFromStorage() {
    function applyBookings(playerBookings) {
        // Remove duplicates by id (normalize id so string/number or id/_id match)
        var seenIds = {};
        var uniqueBookings = [];
        (playerBookings || []).forEach(function(b) {
            var id = getBookingId(b);
            if (!id) {
                uniqueBookings.push(b);
            } else if (!seenIds[id]) {
                seenIds[id] = true;
                uniqueBookings.push(b);
            }
        });
        // Also remove duplicates by date+field+time (same booking created twice with different ids)
        uniqueBookings = dedupeByContent(uniqueBookings);

        allBookingsCache = uniqueBookings;
        var isUpcomingStatus = function(b) {
            return b.status === 'PENDING' || b.status === 'UPCOMING' || b.status === 'CONFIRMED' || b.status === 'pending' || b.status === 'upcoming' || b.status === 'confirmed';
        };
        var isCompletedStatus = function(b) {
            return b.status === 'COMPLETED' || b.status === 'completed';
        };
        var isCancelledStatus = function(b) {
            return b.status === 'CANCELLED' || b.status === 'cancelled';
        };
        // Cancelled stays cancelled
        var cancelled = uniqueBookings.filter(isCancelledStatus).map(convertBookingToDisplayFormat);
        // Completed: either backend says completed, or end time has passed (booking is finished)
        var completed = uniqueBookings
            .filter(function(b) {
                if (isCancelledStatus(b)) return false;
                return isCompletedStatus(b) || isBookingEndTimePassed(b);
            })
            .map(convertBookingToDisplayFormat);
        // Upcoming: not cancelled, not completed, and end time not yet passed
        var upcoming = uniqueBookings
            .filter(function(b) {
                if (isCancelledStatus(b)) return false;
                if (isCompletedStatus(b) || isBookingEndTimePassed(b)) return false;
                return isUpcomingStatus(b);
            })
            .map(convertBookingToDisplayFormat);

        // Ensure no duplicates in display arrays (same booking in different categories or double-mapped)
        bookingsData.upcoming = dedupeById(upcoming);
        bookingsData.completed = dedupeById(completed);
        bookingsData.cancelled = dedupeById(cancelled);

        // Re-render UI after data arrives from API or storage
        renderBookings();
    }
    if (typeof API !== 'undefined' && API.getAuthToken()) {
        API.bookings.getAll()
            .then(function(res) {
                var list = (res && res.bookings) ? res.bookings : [];
                list = mergePaymentStatusFromLocalStorage(list);
                applyBookings(list);
            })
            .catch(function(err) {
                console.error('Failed to load bookings:', err);
                loadBookingsFromStorageFallback(applyBookings);
            });
        return;
    }
    loadBookingsFromStorageFallback(applyBookings);
}

function mergePaymentStatusFromLocalStorage(apiBookings) {
    var localBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
    var organizerPaid = {};
    var playerPaid = {};
    try {
        organizerPaid = JSON.parse(localStorage.getItem('organizerPaidBookings') || '{}');
    } catch (e) {}
    try {
        playerPaid = JSON.parse(localStorage.getItem('playerPaidBookings') || '{}');
    } catch (e) {}
    return (apiBookings || []).map(function(b) {
        var local = localBookings.find(function(lb) { return String(lb.id) === String(b.id); });
        var merged = Object.assign({}, b);
        if (local) {
            if (local.organizerPaymentStatus) merged.organizerPaymentStatus = local.organizerPaymentStatus;
            var localParticipants = local.players || local.participants || [];
            var apiParticipants = merged.participants || merged.players || [];
            apiParticipants.forEach(function(apiP) {
                var pid = String(apiP.userId || apiP.id || '');
                var localP = localParticipants.find(function(lp) { return String(lp.userId || lp.id || '') === pid; });
                if (localP && (localP.paymentStatus === 'paid' || localP.paymentStatus === 'PAID')) {
                    apiP.paymentStatus = 'paid';
                }
            });
        }
        var apiParticipants2 = merged.participants || merged.players || [];
        apiParticipants2.forEach(function(apiP) {
            var pid = String(apiP.userId || apiP.id || '');
            var key = String(merged.id) + '_' + pid;
            if (playerPaid[key]) {
                apiP.paymentStatus = 'paid';
            }
        });
        if (organizerPaid[String(merged.id)]) merged.organizerPaymentStatus = 'paid';
        return merged;
    });
}

function loadBookingsFromStorageFallback(applyBookings) {
    var allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
    var playerData = getCurrentUserSafe() || {};
    var playerId = (playerData && (playerData.id || playerData._id)) || 'player_1';
    var pid = String(playerId || '');
    var playerBookings = allBookings.filter(function(booking) {
        var isOrganizer = String(booking.organizerId || '') === pid || String(booking.organizer && booking.organizer.id || '') === pid;
        var list = booking.players || booking.participants || [];
        var isParticipant = list.some(function(p) { return String(p.id || p.userId || '') === pid; });
        return isOrganizer || isParticipant;
    });
    applyBookings(playerBookings);
}

// Convert booking from API or storage format to display format
function convertBookingToDisplayFormat(booking) {
    var date = new Date(booking.date);
    var today = new Date();
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var dateDisplay = date.toDateString() === today.toDateString() ? 'Today'
        : date.toDateString() === tomorrow.toDateString() ? 'Tomorrow'
        : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

    // Build time display: prefer timeSlotRanges (non-contiguous), else single range
    var timeDisplay;
    var ranges = booking.timeSlotRanges && Array.isArray(booking.timeSlotRanges) ? booking.timeSlotRanges : null;
    if (ranges && ranges.length > 0) {
        timeDisplay = ranges.map(function(r) { return (r.start || '') + ' - ' + (r.end || ''); }).join(', ');
    } else if (booking.timeSlotStart && booking.timeSlotEnd) {
        timeDisplay = booking.timeSlotStart + ' - ' + booking.timeSlotEnd;
    } else {
        var timeSlots = booking.timeSlots || (booking.timeSlotStart ? [booking.timeSlotStart] : []);
        timeDisplay = timeSlots.length > 0
            ? (typeof timeSlots[0] === 'string' && timeSlots[0].indexOf(' - ') !== -1
                ? timeSlots[0]
                : timeSlots.map(function(slot) {
                    var hour = parseInt(String(slot).split(':')[0], 10);
                    return slot + ' - ' + (hour + 1).toString().padStart(2, '0') + ':00';
                }).join(', '))
            : 'Not specified';
    }
    var fieldName = (booking.field && booking.field.name) || booking.fieldName;
    var fieldImage = (booking.field && booking.field.images && booking.field.images[0]) || booking.fieldImage;
    var players = booking.participants ? booking.participants.map(function(p) { return { id: p.userId, name: (p.user && p.user.fullName) || 'Player' }; }) : (booking.players || []);
    var teamSize = players.length + 1;
    var displayStatus = booking.status || 'upcoming';
    if (booking.status !== 'CANCELLED' && booking.status !== 'cancelled' && isBookingEndTimePassed(booking)) {
        displayStatus = 'completed';
    }
    var isConfirmed = booking.status === 'CONFIRMED' || booking.status === 'confirmed';

    // Payment-based status label: "Paid" when you (and everyone in shared booking) have paid; else "Pending"
    var paymentStatusLabel = null;
    var displayStatusLower = (displayStatus || '').toLowerCase();
    if (displayStatusLower !== 'completed' && displayStatusLower !== 'cancelled') {
        var currentUser = getCurrentUserSafe();
        var currentUserId = currentUser ? String(currentUser.id || currentUser._id || '') : '';
        var participants = booking.participants || booking.players || [];
        var organizerId = String(booking.organizerId || (booking.organizer && booking.organizer.id) || '');
        var isOrganizer = organizerId === currentUserId;
        var organizerPaidBookingsMap = {};
        try { organizerPaidBookingsMap = JSON.parse(localStorage.getItem('organizerPaidBookings') || '{}'); } catch (e) {}
        var organizerPaid = (booking.organizerPaymentStatus === 'paid' || booking.organizerPaymentStatus === 'PAID') || !!organizerPaidBookingsMap[String(booking.id)];
        var allParticipantsPaid = participants.length === 0 || participants.every(function(p) {
            return (p.paymentStatus === 'paid' || p.paymentStatus === 'PAID');
        });
        if (isOrganizer) {
            paymentStatusLabel = (organizerPaid && allParticipantsPaid) ? 'Paid' : 'Pending';
        } else {
            var me = participants.find(function(p) { return String(p.userId || p.id || '') === currentUserId; });
            paymentStatusLabel = (me && (me.paymentStatus === 'paid' || me.paymentStatus === 'PAID')) ? 'Paid' : 'Pending';
        }
    }

    return {
        id: booking.id,
        fieldName: fieldName || 'Field',
        image: fieldImage || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=400&fit=crop',
        rating: 4.8,
        reviewCount: 98,
        location: (booking.field && booking.field.location) || 'Location',
        distance: 'N/A',
        date: dateDisplay,
        time: timeDisplay,
        teamSize: teamSize,
        price: '₺' + (booking.totalCost || 0),
        duration: (function() {
            var r = booking.timeSlotRanges && Array.isArray(booking.timeSlotRanges) ? booking.timeSlotRanges : null;
            if (r && r.length > 0) {
                var total = 0;
                r.forEach(function(x) {
                    var sh = parseInt(String(x.start).split(':')[0], 10);
                    var eh = parseInt(String(x.end).split(':')[0], 10);
                    total += (eh - sh);
                });
                return (total || 1) + 'h';
            }
            if (booking.timeSlotStart && booking.timeSlotEnd) {
                var startHour = parseInt(String(booking.timeSlotStart).split(':')[0], 10);
                var endHour = parseInt(String(booking.timeSlotEnd).split(':')[0], 10);
                var diff = endHour - startHour;
                return (diff > 0 ? diff : 1) + 'h';
            }
            var timeSlots = booking.timeSlots || [];
            return (timeSlots.length || 1) + 'h';
        })(),
        bookedDate: new Date(booking.createdAt || Date.now()).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        status: isConfirmed ? 'confirmed' : displayStatus.toLowerCase(),
        isConfirmed: isConfirmed,
        paymentStatusLabel: paymentStatusLabel
    };
}

// Initialize search functionality
function initializeSearch() {
    const searchInput = document.querySelector('.search-input');
    const searchIcon = document.querySelector('.search-icon');
    
    // Function to perform search
    function performSearch() {
        if (searchInput) {
            searchQuery = searchInput.value.toLowerCase().trim();
            renderBookings();
        }
    }
    
    if (searchInput) {
        // Search on Enter key
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    }
    
    // Search on icon click
    if (searchIcon) {
        searchIcon.addEventListener('click', function(e) {
            e.preventDefault();
            performSearch();
        });
    }
}

// Initialize filter tabs
function initializeFilters() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            filterTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Update current filter
            currentFilter = this.getAttribute('data-filter');
            
            // Re-render bookings
            renderBookings();
        });
    });
}

// Filter bookings based on search query
function filterBookingsBySearch(bookings) {
    if (!searchQuery) {
        return bookings;
    }
    
    return bookings.filter(booking => {
        const searchableText = [
            booking.fieldName,
            booking.location,
            booking.date,
            booking.time,
            booking.price,
            booking.bookedDate
        ].join(' ').toLowerCase();
        
        return searchableText.includes(searchQuery);
    });
}

// Render bookings based on current filter and search query
function renderBookings() {
    const bookingsList = document.getElementById('bookingsList');
    const emptyState = document.getElementById('emptyState');
    let bookings = bookingsData[currentFilter] || [];
    
    // Apply search filter
    bookings = filterBookingsBySearch(bookings);
    
    // Clear existing bookings
    bookingsList.innerHTML = '';
    
    // Show empty state if no bookings
    if (bookings.length === 0) {
        bookingsList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    // Hide empty state
    bookingsList.style.display = 'flex';
    emptyState.style.display = 'none';
    
    // Render each booking
    bookings.forEach(booking => {
        const bookingCard = createBookingCard(booking);
        bookingsList.appendChild(bookingCard);
    });
}

function hasPaidForBooking(bookingId, playerIdStr) {
    var paid = JSON.parse(localStorage.getItem('playerPaidBookings') || '{}');
    return paid[String(bookingId) + '_' + playerIdStr] === true;
}

// Get payment button for booking
function getPaymentButton(booking) {
    var status = String((booking.status || '') || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled') return '';
    
    var fullBooking = allBookingsCache.find(function(b) { return String(b.id) === String(booking.id); });
    if (!fullBooking) fullBooking = JSON.parse(localStorage.getItem('playerBookings') || '[]').find(function(b) { return String(b.id) === String(booking.id); });
    if (!fullBooking) return '';
    
    var rawStatus = String((fullBooking.status || '') || '').toLowerCase();
    if (rawStatus === 'completed' || rawStatus === 'cancelled') return '';

    var playerData = getCurrentUserSafe() || {};
    var playerIdStr = String((playerData && (playerData.id || playerData._id)) || '');
    var isOrganizer = String(fullBooking.organizerId || (fullBooking.organizer && fullBooking.organizer.id) || '') === playerIdStr;
    
    // Participant who already paid (from playerPaidBookings) - no Pay button
    if (!isOrganizer && hasPaidForBooking(booking.id, playerIdStr)) return '';
    
    // Check if payment is needed
    if (isOrganizer && (fullBooking.organizerPaymentStatus === 'pending' || fullBooking.organizerPaymentStatus === 'PENDING')) {
        return `
            <button class="pay-now-btn" onclick="payForBooking('${booking.id}', true)">
                <i class="fi fi-rr-credit-card"></i> Pay Now (₺${fullBooking.totalCost})
            </button>
        `;
    } else if (!isOrganizer) {
        var participants = fullBooking.participants || fullBooking.players || [];
        var player = participants.find(function(p) { return String(p.userId || p.id || '') === playerIdStr; });
        var costPerPlayer = fullBooking.totalCost && (participants.length + 1) ? Math.round(fullBooking.totalCost / (participants.length + 1)) : 0;
        var needsPayment = (fullBooking.paymentMethod === 'SPLIT' || fullBooking.paymentMethod === 'split') || (fullBooking.paymentMethod === 'MIXED' || fullBooking.paymentMethod === 'mixed');
        var alreadyPaid = hasPaidForBooking(booking.id, playerIdStr) || (player && (player.paymentStatus === 'paid' || player.paymentStatus === 'PAID'));
        if (player && !alreadyPaid && (player.paymentStatus === 'PENDING' || player.paymentStatus === 'pending') && needsPayment) {
            var amount = player.paymentAmount || costPerPlayer;
            if (fullBooking.paymentMethod === 'MIXED' || fullBooking.paymentMethod === 'mixed') {
                amount = (fullBooking.mixedPaymentDistribution && (fullBooking.mixedPaymentDistribution[player.userId || player.id] || fullBooking.mixedPaymentDistribution[String(player.userId || player.id)])) || costPerPlayer;
            }
            return '<button class="pay-now-btn" onclick="payForBooking(\'' + booking.id + '\', false)"><i class="fi fi-rr-credit-card"></i> Pay Your Share (₺' + amount + ')</button>';
        }
    }
    
    return '';
}

// Pay for booking
function payForBooking(bookingId, isOrganizer) {
    // Try to find booking in API cache first, then localStorage
    var booking = allBookingsCache.find(function(b) { return b.id === bookingId; });
    if (!booking) {
        var allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
        booking = allBookings.find(function(b) { return b.id === bookingId; });
    }
    
    if (!booking) {
        alert('Booking not found. Please refresh the page and try again.');
        return;
    }

    var playerData = (typeof API !== 'undefined' && API.getCurrentUser) ? API.getCurrentUser() : null;
    var participants = booking.participants || booking.players || [];
    var totalPlayers = participants.length + 1;
    var costPerPlayer = booking.totalCost ? Math.round(booking.totalCost / totalPlayers) : 0;
    
    var amount;
    if (isOrganizer) {
        amount = booking.totalCost;
    } else {
        // Find participant's assigned amount
        var player = participants.find(function(p) { 
            return (p.userId || p.id) === (playerData && playerData.id); 
        });
        amount = (player && player.paymentAmount) || costPerPlayer;
    }
    
    if (window.openPaymentModal) {
        window.openPaymentModal({
            amount: amount,
            bookingId: bookingId,
            isOrganizer: isOrganizer,
            booking: booking
        });
    } else {
        // Redirect to home page to use payment modal
        alert('Redirecting to payment page...');
        window.location.href = 'home.html?payBooking=' + bookingId + '&isOrganizer=' + isOrganizer;
    }
}

// Make payForBooking available globally
window.payForBooking = payForBooking;

// Check if current user is organizer of a booking
function isCurrentUserOrganizer(bookingId) {
    var fullBooking = allBookingsCache.find(function(b) { return b.id === bookingId; });
    if (!fullBooking) {
        var allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
        fullBooking = allBookings.find(function(b) { return b.id === bookingId; });
    }
    if (!fullBooking) return false;
    
    var playerData = getCurrentUserSafe() || {};
    var pid = String((playerData && (playerData.id || playerData._id)) || '');
    return String(fullBooking.organizerId || (fullBooking.organizer && fullBooking.organizer.id) || '') === pid;
}

function hasCurrentUserPaidAsParticipant(bookingId) {
    var playerData = getCurrentUserSafe() || {};
    var pid = String((playerData && (playerData.id || playerData._id)) || '');
    if (hasPaidForBooking(bookingId, pid)) return true;
    var fullBooking = allBookingsCache.find(function(b) { return String(b.id) === String(bookingId); });
    if (!fullBooking) fullBooking = JSON.parse(localStorage.getItem('playerBookings') || '[]').find(function(b) { return String(b.id) === String(bookingId); });
    if (!fullBooking) return false;
    var list = fullBooking.participants || fullBooking.players || [];
    var p = list.find(function(x) { return String(x.userId || x.id || '') === pid; });
    return p && (p.paymentStatus === 'paid' || p.paymentStatus === 'PAID');
}

// Create a booking card element
function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = 'booking-card';
    
    const paymentButton = getPaymentButton(booking);
    const isOrganizer = isCurrentUserOrganizer(booking.id);
    const hasPaidAsParticipant = !isOrganizer && hasCurrentUserPaidAsParticipant(booking.id);
    
    // Determine cancel/leave: organizer sees Cancel+Reschedule; participant who hasn't paid sees Leave; participant who paid sees neither
    const cancelButtonText = isOrganizer ? 'Cancel Booking' : 'Leave Booking';
    const cancelAction = isOrganizer ? `cancelBooking('${booking.id}')` : `leaveBooking('${booking.id}')`;
    const showCancelOrLeave = isOrganizer ? true : !hasPaidAsParticipant;
    
    card.innerHTML = `
        <img src="${booking.image}" alt="${booking.fieldName}" class="booking-card-image">
        <div class="booking-card-content">
            <div class="booking-card-header">
                <div class="booking-card-info">
                    <h3 class="booking-card-title">${booking.fieldName}</h3>
                    <div class="booking-card-meta">
                        <div class="booking-rating">
                            <i class="fi fi-rs-star"></i>
                            <span>${booking.rating} (${booking.reviewCount})</span>
                        </div>
                        <div class="booking-location">
                            <i class="fi fi-rr-marker"></i>
                            <span>${booking.location} . ${booking.distance}</span>
                        </div>
                    </div>
                    <div class="booking-details">
                        <div class="booking-detail-item">
                            <i class="fi fi-rr-clock"></i>
                            <span class="booking-detail-label">Time:</span>
                            <span class="booking-detail-value">${booking.date}, ${booking.time}</span>
                        </div>
                        <div class="booking-detail-item">
                            <i class="fi fi-rr-users"></i>
                            <span class="booking-detail-label">Team Size:</span>
                            <span class="booking-detail-value">Team of ${booking.teamSize}</span>
                        </div>
                        <div class="booking-detail-item">
                            <i class="fi fi-rr-money"></i>
                            <span class="booking-detail-label">Price:</span>
                            <span class="booking-detail-value">${booking.price}/${booking.duration}</span>
                        </div>
                        <div class="booking-detail-item">
                            <i class="fi fi-rr-calendar"></i>
                            <span class="booking-detail-label">Booked on:</span>
                            <span class="booking-detail-value">${booking.bookedDate}</span>
                        </div>
                    </div>
                </div>
                <div class="booking-card-actions">
                    <div class="booking-card-actions-top">
                        <div class="booking-status-row">
                            <div class="booking-status ${(booking.status || '').toLowerCase() === 'cancelled' ? 'cancelled' : (booking.status || '').toLowerCase() === 'completed' ? 'completed' : booking.paymentStatusLabel ? (booking.paymentStatusLabel === 'Paid' ? 'paid' : 'pending') : (booking.isConfirmed || booking.status === 'confirmed' ? 'confirmed' : booking.status)}">
                                <span class="booking-status-dot"></span>
                                <span>${(booking.status || '').toLowerCase() === 'cancelled' ? 'Cancelled' : (booking.status || '').toLowerCase() === 'completed' ? 'Completed' : (booking.paymentStatusLabel || (booking.isConfirmed || booking.status === 'confirmed' ? 'Confirmed' : (booking.status && booking.status.charAt(0).toUpperCase() + booking.status.slice(1)) || 'Pending'))}</span>
                            </div>
                            <button type="button" class="info-btn" data-booking-id="${String(booking.id || '').replace(/"/g, '&quot;')}" title="Booking details & payments">
                                <i class="fi fi-rr-info"></i>
                            </button>
                        </div>
                        <div class="booking-actions-buttons">
                            ${paymentButton}
                            ${!(booking.isConfirmed || booking.status === 'confirmed') && booking.status !== 'completed' && booking.status !== 'cancelled' && showCancelOrLeave ? `
                                <button class="cancel-booking-btn" onclick="${cancelAction}">
                                    ${cancelButtonText}
                                </button>
                                ${isOrganizer ? `
                                    <a href="#" class="reschedule-link" onclick="rescheduleBooking('${booking.id}'); return false;">
                                        Reschedule
                                    </a>
                                ` : ''}
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// Cancel booking function (API or localStorage)
function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    function moveToCancelled() {
        var displayIndex = bookingsData.upcoming.findIndex(function(b) { return b.id === bookingId; });
        if (displayIndex !== -1) {
            var booking = bookingsData.upcoming[displayIndex];
            booking.status = 'cancelled';
            bookingsData.cancelled.push(booking);
            bookingsData.upcoming.splice(displayIndex, 1);
            if (currentFilter === 'upcoming') renderBookings();
            alert('Booking cancelled successfully!');
        }
    }
    if (typeof API !== 'undefined' && API.getAuthToken()) {
        API.bookings.updateStatus(bookingId, 'CANCELLED')
            .then(moveToCancelled)
            .catch(function(err) {
                alert(err.message || 'Failed to cancel booking.');
            });
    } else {
        var allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
        var idx = allBookings.findIndex(function(b) { return b.id === bookingId; });
        if (idx !== -1) {
            allBookings[idx].status = 'cancelled';
            localStorage.setItem('playerBookings', JSON.stringify(allBookings));
        }
        moveToCancelled();
    }
}

// Leave booking function (for non-organizers)
function leaveBooking(bookingId) {
    if (!confirm('Are you sure you want to leave this booking? The organizer will be notified.')) return;
    
    var playerData = getCurrentUserSafe() || {};
    var playerId = playerData && playerData.id;
    var playerName = playerData && (playerData.fullName || playerData.name || 'A player');
    
    // Find the booking
    var fullBooking = allBookingsCache.find(function(b) { return b.id === bookingId; });
    if (!fullBooking) {
        var allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
        fullBooking = allBookings.find(function(b) { return b.id === bookingId; });
    }
    
    if (!fullBooking) {
        alert('Booking not found.');
        return;
    }
    
    // Create notification for organizer
    var notification = {
        id: 'notif_' + Date.now(),
        type: 'player_left_booking',
        playerId: fullBooking.organizerId,
        bookingId: bookingId,
        title: 'Player Left Booking',
        message: playerName + ' has left your booking at ' + (fullBooking.field && fullBooking.field.name || 'the field') + '.',
        date: fullBooking.date,
        status: 'unread',
        createdAt: new Date().toISOString()
    };
    
    // Save notification
    var notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    notifications.push(notification);
    localStorage.setItem('playerNotifications', JSON.stringify(notifications));
    try { if (typeof window.matchfieldRefreshNotificationBadge === 'function') window.matchfieldRefreshNotificationBadge(); } catch (_) {}

    function onLeftSuccess() {
        // Remove from display
        var displayIndex = bookingsData.upcoming.findIndex(function(b) { return b.id === bookingId; });
        if (displayIndex !== -1) {
            bookingsData.upcoming.splice(displayIndex, 1);
            if (currentFilter === 'upcoming') renderBookings();
        }
        // Update allBookingsCache so refresh shows correct state
        var cacheIdx = allBookingsCache.findIndex(function(b) { return b.id === bookingId; });
        if (cacheIdx !== -1) allBookingsCache.splice(cacheIdx, 1);
        alert('You have left the booking. The organizer has been notified.');
    }
    
    // Persist: call API or update localStorage
    if (typeof API !== 'undefined' && API.getAuthToken() && API.bookings && API.bookings.removeParticipant) {
        API.bookings.removeParticipant(bookingId)
            .then(onLeftSuccess)
            .catch(function(err) {
                alert(err.message || 'Failed to leave booking. Please try again.');
            });
        return;
    }
    
    // No API: remove user from booking in localStorage
    var allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
    var idx = allBookings.findIndex(function(b) { return b.id === bookingId; });
    if (idx !== -1) {
        var b = allBookings[idx];
        var participants = b.participants || b.players || [];
        var filtered = participants.filter(function(p) {
            var pid = p.userId || p.id;
            return pid !== playerId;
        });
        if (b.participants) b.participants = filtered;
        if (b.players) b.players = filtered;
        allBookings[idx] = b;
        localStorage.setItem('playerBookings', JSON.stringify(allBookings));
    }
    
    onLeftSuccess();
}

// Make leaveBooking and showPaymentStatusInfo available globally
window.leaveBooking = leaveBooking;
window.showPaymentStatusInfo = showPaymentStatusInfo;

// Refresh bookings after payment (called from home.js processPayment)
window.refreshBookingsAfterPayment = function(updatedBooking) {
    if (!updatedBooking) { loadBookingsFromStorage(); return; }
    // Immediately merge the paid booking into cache and re-render (no async wait)
    var idx = allBookingsCache.findIndex(function(b) { return String(b.id) === String(updatedBooking.id); });
    if (idx !== -1) {
        allBookingsCache[idx] = updatedBooking;
    } else {
        allBookingsCache.push(updatedBooking);
    }
    // Re-categorize and re-render
    var uniqueBookings = allBookingsCache;
    var isUpcomingStatus = function(b) {
        return b.status === 'PENDING' || b.status === 'UPCOMING' || b.status === 'CONFIRMED' || b.status === 'pending' || b.status === 'upcoming' || b.status === 'confirmed';
    };
    var isCompletedStatus = function(b) {
        return b.status === 'COMPLETED' || b.status === 'completed';
    };
    var isCancelledStatus = function(b) {
        return b.status === 'CANCELLED' || b.status === 'cancelled';
    };
    bookingsData.cancelled = uniqueBookings.filter(isCancelledStatus).map(convertBookingToDisplayFormat);
    bookingsData.completed = uniqueBookings
        .filter(function(b) {
            if (isCancelledStatus(b)) return false;
            return isCompletedStatus(b) || isBookingEndTimePassed(b);
        })
        .map(convertBookingToDisplayFormat);
    bookingsData.upcoming = uniqueBookings
        .filter(function(b) {
            if (isCancelledStatus(b)) return false;
            if (isCompletedStatus(b) || isBookingEndTimePassed(b)) return false;
            return isUpcomingStatus(b);
        })
        .map(convertBookingToDisplayFormat);
    renderBookings();
};

// Reschedule booking function
// Reschedule booking: only allowed if more than 24h before start
function rescheduleBooking(bookingId) {
    var fullBooking = allBookingsCache.find(function(b) { return String(getBookingId(b)) === String(bookingId); });
    if (!fullBooking) {
        var all = JSON.parse(localStorage.getItem('playerBookings') || '[]');
        fullBooking = all.find(function(b) { return String(getBookingId(b)) === String(bookingId); });
    }
    if (!fullBooking) {
        alert('Booking not found. Please refresh the page and try again.');
        return;
    }

    // Compute original start datetime
    try {
        var dateObj = new Date(fullBooking.date);
        var dateStr = dateObj.toISOString().split('T')[0];
        var startTimeStr = fullBooking.timeSlotStart || (fullBooking.timeSlots && fullBooking.timeSlots[0]);
        if (!startTimeStr) {
            alert('Unable to determine booking start time for reschedule.');
            return;
        }
        var originalStart = new Date(dateStr + 'T' + startTimeStr);
        var now = new Date();
        var hoursUntilStart = (originalStart.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilStart < 24) {
            alert('You cannot reschedule this booking because it starts in less than 24 hours.');
            return;
        }
    } catch (e) {
        console.warn('Failed to compute booking start time for reschedule', e);
    }

    // Open reschedule modal pre-filled with current date/time
    var modal = document.getElementById('rescheduleModal');
    var dateInput = document.getElementById('rescheduleDate');
    var slotsGrid = document.getElementById('rescheduleSlotsGrid');
    if (!modal || !dateInput || !slotsGrid) {
        alert('Reschedule UI not available on this page.');
        return;
    }

    var currentDateStr = new Date(fullBooking.date).toISOString().split('T')[0];
    dateInput.value = currentDateStr;
    modal.dataset.bookingId = bookingId;
    modal.dataset.fieldId = fullBooking.fieldId || (fullBooking.field && fullBooking.field.id) || '';
    modal.dataset.originalStart = startTimeStr;

    // Required duration in hours (original booking length)
    try {
        var durationHours = 1;
        if (fullBooking.timeSlotRanges && Array.isArray(fullBooking.timeSlotRanges) && fullBooking.timeSlotRanges.length > 0) {
            var total = 0;
            fullBooking.timeSlotRanges.forEach(function(r) {
                var sh = parseInt(String(r.start).split(':')[0], 10);
                var eh = parseInt(String(r.end).split(':')[0], 10);
                total += (eh - sh);
            });
            durationHours = total || 1;
        } else {
            var origStartHour = parseInt((fullBooking.timeSlotStart || startTimeStr).split(':')[0], 10);
            var origEndStr = fullBooking.timeSlotEnd;
            if (!origEndStr && fullBooking.timeSlots && fullBooking.timeSlots.length) {
                // Derive from last time slot
                var lastSlotHour = parseInt(String(fullBooking.timeSlots[fullBooking.timeSlots.length - 1]).split(':')[0], 10);
                origEndStr = (lastSlotHour + 1).toString().padStart(2, '0') + ':00';
            }
            var origEndHour = parseInt((origEndStr || '').split(':')[0], 10);
            durationHours = origEndHour > origStartHour ? (origEndHour - origStartHour) : 1;
        }
        modal.dataset.durationHours = String(durationHours);
    } catch (e) {
        modal.dataset.durationHours = '1';
    }

    // Load slots for current date (no preselection)
    loadRescheduleSlots(modal.dataset.fieldId, currentDateStr, null);

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Handle reschedule modal actions
document.addEventListener('DOMContentLoaded', function() {
    var modal = document.getElementById('rescheduleModal');
    if (!modal) return;
    var overlay = document.getElementById('rescheduleOverlay');
    var closeBtn = document.getElementById('closeRescheduleModal');
    var cancelBtn = document.getElementById('cancelRescheduleBtn');
    var saveBtn = document.getElementById('saveRescheduleBtn');

    function closeReschedule() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        delete modal.dataset.bookingId;
        delete modal.dataset.fieldId;
        delete modal.dataset.originalStart;
        delete modal.dataset.selectedStart;
        delete modal.dataset.selectedEnd;
    }

    if (overlay) overlay.addEventListener('click', closeReschedule);
    if (closeBtn) closeBtn.addEventListener('click', closeReschedule);
    if (cancelBtn) cancelBtn.addEventListener('click', closeReschedule);

    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            var bookingId = modal.dataset.bookingId;
            if (!bookingId) {
                closeReschedule();
                return;
            }
            var date = document.getElementById('rescheduleDate').value;
            var container = document.getElementById('rescheduleSlotsGrid');
            if (!container) {
                alert('Unable to read selected time slots.');
                return;
            }
            var selectedButtons = Array.prototype.slice.call(container.querySelectorAll('.time-slot.selected'));
            if (!date || !selectedButtons.length) {
                alert('Please select date and time slots.');
                return;
            }

            // Compute original total hours for this booking (from cache), so we enforce same duration
            var full = null;
            if (Array.isArray(allBookingsCache) && allBookingsCache.length) {
                full = allBookingsCache.find(function(b) { return String(getBookingId(b)) === String(bookingId); });
            }
            if (!full) {
                var allStored = JSON.parse(localStorage.getItem('playerBookings') || '[]');
                full = allStored.find(function(b) { return String(getBookingId(b)) === String(bookingId); });
            }
            var requiredHours = 1;
            if (full) {
                if (full.timeSlotRanges && Array.isArray(full.timeSlotRanges) && full.timeSlotRanges.length > 0) {
                    requiredHours = full.timeSlotRanges.reduce(function(sum, r) {
                        var sh = parseInt(String(r.start).split(':')[0], 10);
                        var eh = parseInt(String(r.end).split(':')[0], 10);
                        return sum + (eh - sh);
                    }, 0) || 1;
                } else if (full.timeSlotStart && full.timeSlotEnd) {
                    var sh0 = parseInt(String(full.timeSlotStart).split(':')[0], 10);
                    var eh0 = parseInt(String(full.timeSlotEnd).split(':')[0], 10);
                    requiredHours = Math.max(1, eh0 - sh0);
                }
            } else if (modal.dataset.durationHours) {
                requiredHours = parseInt(modal.dataset.durationHours, 10) || 1;
            }

            // Build ranges from selected slots (can be non-contiguous)
            selectedButtons.sort(function(a, b) {
                return a.getAttribute('data-start').localeCompare(b.getAttribute('data-start'));
            });
            var ranges = [];
            for (var i = 0; i < selectedButtons.length; i++) {
                var btn = selectedButtons[i];
                var startStr = btn.getAttribute('data-start');
                var startHour = parseInt(startStr.split(':')[0], 10);
                var endHour = startHour + 1;
                while (i + 1 < selectedButtons.length) {
                    var nextBtn = selectedButtons[i + 1];
                    var nextStartStr = nextBtn.getAttribute('data-start');
                    var nextStartHour = parseInt(nextStartStr.split(':')[0], 10);
                    if (nextStartHour !== endHour) break;
                    endHour++;
                    i++;
                }
                ranges.push({
                    start: startStr,
                    end: endHour.toString().padStart(2, '0') + ':00'
                });
            }

            // Total selected hours
            var totalSelectedHours = ranges.reduce(function(sum, r) {
                var sh = parseInt(String(r.start).split(':')[0], 10);
                var eh = parseInt(String(r.end).split(':')[0], 10);
                return sum + (eh - sh);
            }, 0);
            if (totalSelectedHours <= 0) {
                alert('Please select at least one hour.');
                return;
            }

            // Enforce same total hours as original booking
            if (totalSelectedHours !== requiredHours) {
                alert('You must select exactly ' + requiredHours + ' hour(s) for this booking.');
                return;
            }

            if (typeof API === 'undefined' || !API.getAuthToken()) {
                alert('You must be logged in to reschedule a booking.');
                return;
            }

            var firstRange = ranges[0];
            var lastRange = ranges[ranges.length - 1];
            var payload = {
                date: date,
                timeSlotStart: firstRange.start,
                timeSlotEnd: lastRange.end
            };
            if (ranges.length > 1) {
                payload.timeSlotRanges = ranges;
            }

            API.bookings.reschedule(bookingId, payload).then(function(res) {
                closeReschedule();
                // Update local cache to reflect new date/time
                var updated = (res && res.booking) || res;
                if (updated) {
                    var idx = allBookingsCache.findIndex(function(b) { return String(getBookingId(b)) === String(bookingId); });
                    if (idx !== -1) {
                        allBookingsCache[idx] = updated;
                    }
                    // Also update playerBookings cache
                    var allLocal = JSON.parse(localStorage.getItem('playerBookings') || '[]');
                    var localIdx = allLocal.findIndex(function(b) { return String(getBookingId(b)) === String(bookingId); });
                    if (localIdx !== -1) {
                        allLocal[localIdx] = updated;
                        localStorage.setItem('playerBookings', JSON.stringify(allLocal));
                    }
                    // Re-run applyBookings logic via loadBookingsFromStorage
                    loadBookingsFromStorage();
                }
                alert('Booking rescheduled successfully.');
            }).catch(function(err) {
                console.error('Failed to reschedule booking', err);
                var msg = (err && err.error) || (err && err.message) || 'Failed to reschedule booking.';
                alert(msg);
            });
        });
    }

    // When date changes, reload slots
    var dateInput = document.getElementById('rescheduleDate');
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            var fieldId = modal.dataset.fieldId;
            if (!fieldId || !this.value) return;
            loadRescheduleSlots(fieldId, this.value, null);
        });
    }
});

// Load available time slots for reschedule (similar to booking wizard)
async function loadRescheduleSlots(fieldId, date, originalStart) {
    var container = document.getElementById('rescheduleSlotsGrid');
    var modal = document.getElementById('rescheduleModal');
    if (!container || !modal || !fieldId || !date) return;

    // Generate hourly slots 9–22
    var slots = [];
    for (var hour = 9; hour < 22; hour++) {
        var startTime = hour.toString().padStart(2, '0') + ':00';
        var endTime = (hour + 1).toString().padStart(2, '0') + ':00';
        slots.push({ start: startTime, end: endTime, available: true });
    }

    var bookedSlots = [];
    if (typeof API !== 'undefined' && API.fields && API.fields.getAvailability) {
        try {
            container.innerHTML = '<p style=\"text-align: center; padding: 16px;\">Loading availability...</p>';
            var availability = await API.fields.getAvailability(fieldId, date);
            if (availability && availability.available === false && availability.lockedByOwner) {
                container.innerHTML = '<div style=\"text-align:center; padding:16px; color:#dc3545;\">' +
                  (availability.message || 'This field is not available on the selected date.') +
                  '</div>';
                return;
            }
            bookedSlots = (availability && availability.bookedSlots) || [];
        } catch (e) {
            console.warn('Failed to load availability for reschedule', e);
        }
    }

    slots.forEach(function(slot) {
        if (bookedSlots.indexOf(slot.start) !== -1) slot.available = false;
    });

    container.innerHTML = slots.map(function(slot) {
        return '<button type=\"button\" class=\"time-slot ' +
          (slot.available ? '' : 'unavailable') + '\" ' +
          'data-start=\"' + slot.start + '\" data-end=\"' + slot.end + '\" ' +
          (slot.available ? '' : 'disabled') + '>' +
          slot.start + ' - ' + slot.end +
          '</button>';
    }).join('');

    // Allow selecting multiple consecutive hours – compute start/end from min/max
    container.onclick = function(e) {
        var btn = e.target.closest('.time-slot');
        if (!btn || btn.classList.contains('unavailable')) return;

        // Toggle selection
        btn.classList.toggle('selected');

        var selectedButtons = Array.prototype.slice.call(container.querySelectorAll('.time-slot.selected'));
        if (!selectedButtons.length) {
            delete modal.dataset.selectedStart;
            delete modal.dataset.selectedEnd;
            return;
        }

        // Sort by start time and compute range
        selectedButtons.sort(function(a, b) {
            return a.getAttribute('data-start').localeCompare(b.getAttribute('data-start'));
        });
        var first = selectedButtons[0];
        var last = selectedButtons[selectedButtons.length - 1];

        modal.dataset.selectedStart = first.getAttribute('data-start');
        modal.dataset.selectedEnd = last.getAttribute('data-end');
    };
}

// Notifications (including Add Player) are handled by shared notifications.js - loaded on all player pages

// Initialize profile popup
function initializeProfile() {
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    
    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            // Close notification popup if open
            const notificationPopup = document.getElementById('notificationPopup');
            if (notificationPopup && notificationPopup.classList.contains('active')) {
                notificationPopup.classList.remove('active');
            }
        });
        
        // Close when clicking outside
        document.addEventListener('click', function(e) {
            if (profilePopup && profilePopup.classList.contains('active')) {
                if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
                    profilePopup.classList.remove('active');
                }
            }
        });
    }
}

// Show payment status info modal (booking details + who paid)
async function showPaymentStatusInfo(bookingId) {
    let booking = null;

    // Try in-memory cache from API/storage
    if (Array.isArray(allBookingsCache) && allBookingsCache.length) {
        booking = allBookingsCache.find(function(b) {
            return String(getBookingId(b)) === String(bookingId);
        });
    }

    // Fallback to localStorage cache
    if (!booking) {
        const allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
        booking = allBookings.find(function(b) {
            return String(b.id) === String(bookingId) || String(getBookingId(b)) === String(bookingId);
        });
    }

    // Final fallback: fetch from API
    if (!booking && typeof API !== 'undefined' && API.getAuthToken && API.getAuthToken() && API.bookings && API.bookings.getById) {
        try {
            const res = await API.bookings.getById(bookingId);
            booking = (res && (res.booking || res.data || res)) || null;
        } catch (e) {
            console.error('Failed to load booking by id:', e);
        }
    }

    if (!booking) {
        alert('Booking not found.');
        return;
    }

    const currentUser =
        getCurrentUserSafe() ||
        JSON.parse(localStorage.getItem('playerData') || '{}');
    const currentPlayerId = currentUser && (currentUser.id || currentUser._id);

    const players = booking.players || booking.participants || [];
    var organizerPaidBookings = {};
    try {
        organizerPaidBookings = JSON.parse(localStorage.getItem('organizerPaidBookings') || '{}');
    } catch (e) {}
    var organizerIsPaid = (booking.organizerPaymentStatus === 'paid' || booking.organizerPaymentStatus === 'PAID') || !!organizerPaidBookings[String(booking.id)];

    // Calculate payment statistics
    const totalPlayers = players.length + 1; // +1 for organizer
    let playersPaid = 0;
    let playersPending = 0;
    
    if (organizerIsPaid) {
        playersPaid++;
    } else {
        playersPending++;
    }
    
    players.forEach(function(player) {
        if (player.paymentStatus === 'paid' || player.paymentStatus === 'PAID') {
            playersPaid++;
        } else {
            playersPending++;
        }
    });
    
    // Update summary
    document.getElementById('totalPlayers').textContent = totalPlayers;
    document.getElementById('playersPaid').textContent = playersPaid;
    document.getElementById('playersPending').textContent = playersPending;
    
    // Update booking details section
    try {
        const displayBooking = convertBookingToDisplayFormat(booking);
        const detailsField = document.getElementById('bookingDetailsField');
        const detailsDate = document.getElementById('bookingDetailsDate');
        const detailsTime = document.getElementById('bookingDetailsTime');
        const detailsMethod = document.getElementById('bookingDetailsMethod');
        const detailsPrice = document.getElementById('bookingDetailsPrice');

        if (detailsField) detailsField.textContent = displayBooking.fieldName;
        if (detailsDate) detailsDate.textContent = displayBooking.date;
        if (detailsTime) detailsTime.textContent = displayBooking.time;
        if (detailsMethod) {
            const method = booking.paymentMethod || 'organizer';
            detailsMethod.textContent = method.charAt(0).toUpperCase() + method.slice(1);
        }
        if (detailsPrice) detailsPrice.textContent = displayBooking.price;
    } catch (e) {
        console.warn('Failed to populate booking details section', e);
    }
    
    // Build players list
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    // Add organizer
    const isOrganizer = booking.organizerId === currentPlayerId;
    const organizerAmount = booking.paymentMethod === 'organizer' ? booking.totalCost : 
                           booking.paymentMethod === 'split' ? booking.costPerPlayer :
                           booking.paymentMethod === 'mixed' ? (booking.mixedPaymentDistribution && booking.mixedPaymentDistribution[booking.organizerId] || 0) : 0;
    
    const organizerPaymentStatus = organizerIsPaid ? 'paid' : (booking.organizerPaymentStatus || 'pending');
    const organizerItem = createPlayerPaymentItem({
        id: booking.organizerId,
        name: booking.organizerName || (booking.organizer && booking.organizer.fullName) || 'Organizer',
        paymentStatus: organizerPaymentStatus,
        paymentAmount: organizerAmount,
        isOrganizer: true,
        isCurrentUser: isOrganizer
    });
    playersList.appendChild(organizerItem);
    
    // Add players (use players array - API may use participants)
    players.forEach(function(player) {
        const pid = player.userId || player.id;
        const pName = (player.user && player.user.fullName) || player.fullName || player.name || 'Player';
        const isCurrentUser = String(pid) === String(currentPlayerId);
        const playerAmount = booking.paymentMethod === 'split' ? booking.costPerPlayer :
                            booking.paymentMethod === 'mixed' ? (booking.mixedPaymentDistribution && booking.mixedPaymentDistribution[pid] || 0) : 0;
        
        const playerItem = createPlayerPaymentItem({
            id: pid,
            name: pName,
            paymentStatus: player.paymentStatus || 'pending',
            paymentAmount: playerAmount,
            isOrganizer: false,
            isCurrentUser: isCurrentUser
        });
        playersList.appendChild(playerItem);
    });
    
    // Show modal
    const modal = document.getElementById('paymentStatusModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Create player payment item
function createPlayerPaymentItem(player) {
    const item = document.createElement('div');
    item.className = `player-payment-item ${player.isCurrentUser ? 'current-user' : ''}`;
    
    const statusIcon = player.paymentStatus === 'paid' 
        ? '<i class="fi fi-rr-check status-icon paid"></i>' 
        : '<i class="fi fi-rr-clock status-icon pending"></i>';
    
    const statusText = player.paymentStatus === 'paid' ? 'Paid' : 'Pending';
    const amountDisplay = player.paymentAmount > 0 ? `₺${player.paymentAmount}` : '';
    const nameDisplay = player.isCurrentUser ? `${player.name} (You)` : player.name;
    const organizerBadge = player.isOrganizer ? '<span class="organizer-badge">Organizer</span>' : '';
    
    item.innerHTML = `
        <div class="player-info">
            <div class="player-avatar">
                ${player.name.charAt(0).toUpperCase()}
            </div>
            <div class="player-details">
                <div class="player-name-row">
                    <span class="player-name">${nameDisplay}</span>
                    ${organizerBadge}
                </div>
            </div>
        </div>
        <div class="player-payment-info">
            ${amountDisplay ? `<span class="payment-amount">${amountDisplay}</span>` : ''}
            <div class="payment-status ${player.paymentStatus}">
                ${statusIcon}
                <span>${statusText}</span>
            </div>
        </div>
    `;
    
    return item;
}

// Close payment status modal
function closePaymentStatusModal() {
    const modal = document.getElementById('paymentStatusModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Add Player modal is in notifications.js - loaded on all player pages

// Initialize payment status modal
function initializePaymentStatusModal() {
    const modal = document.getElementById('paymentStatusModal');
    const overlay = document.getElementById('paymentStatusOverlay');
    const closeBtn = document.getElementById('closePaymentStatusModal');
    
    if (overlay) {
        overlay.addEventListener('click', closePaymentStatusModal);
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closePaymentStatusModal);
    }
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            closePaymentStatusModal();
        }
    });
}
