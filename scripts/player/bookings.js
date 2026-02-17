// Sample booking data
const bookingsData = {
    upcoming: [
        {
            id: 1,
            fieldName: "Fozi football court",
            image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=400&fit=crop",
            rating: 4.8,
            reviewCount: 98,
            location: "Uskudar",
            distance: "2.1 Km",
            date: "Today",
            time: "19:00 - 21:00",
            teamSize: 10,
            price: "₺3000",
            duration: "2h",
            bookedDate: "21 Nov 2025",
            status: "upcoming"
        },
        {
            id: 2,
            fieldName: "Mousa padel field",
            image: "https://www.italgreen.org/computedimage/campi-da-padel.jpg",
            rating: 4.9,
            reviewCount: 124,
            location: "Kadikoy",
            distance: "3.5 Km",
            date: "Tomorrow",
            time: "14:00 - 16:00",
            teamSize: 4,
            price: "₺2500",
            duration: "2h",
            bookedDate: "22 Nov 2025",
            status: "upcoming"
        },
        {
            id: 3,
            fieldName: "Peach Volleyball court",
            image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&h=400&fit=crop",
            rating: 4.7,
            reviewCount: 87,
            location: "Besiktas",
            distance: "1.8 Km",
            date: "25 Nov 2025",
            time: "18:00 - 20:00",
            teamSize: 12,
            price: "₺3500",
            duration: "2h",
            bookedDate: "20 Nov 2025",
            status: "upcoming"
        }
    ],
    completed: [
        {
            id: 4,
            fieldName: "Elite Basketball Court",
            image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=400&fit=crop",
            rating: 4.6,
            reviewCount: 156,
            location: "Sisli",
            distance: "4.2 Km",
            date: "15 Nov 2025",
            time: "16:00 - 18:00",
            teamSize: 10,
            price: "₺2800",
            duration: "2h",
            bookedDate: "10 Nov 2025",
            status: "completed"
        },
        {
            id: 5,
            fieldName: "Pro Tennis Court",
            image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=400&h=400&fit=crop",
            rating: 4.9,
            reviewCount: 203,
            location: "Bebek",
            distance: "5.1 Km",
            date: "10 Nov 2025",
            time: "10:00 - 12:00",
            teamSize: 2,
            price: "₺2000",
            duration: "2h",
            bookedDate: "5 Nov 2025",
            status: "completed"
        }
    ],
    cancelled: [
        {
            id: 6,
            fieldName: "City Football Field",
            image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=400&fit=crop",
            rating: 4.5,
            reviewCount: 92,
            location: "Fatih",
            distance: "6.3 Km",
            date: "18 Nov 2025",
            time: "20:00 - 22:00",
            teamSize: 11,
            price: "₺3200",
            duration: "2h",
            bookedDate: "12 Nov 2025",
            status: "cancelled"
        }
    ]
};

// Current filter state
var currentFilter = 'upcoming';
var searchQuery = '';
// Raw bookings from API (for payment button / cancel lookup)
var allBookingsCache = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadBookingsFromStorage();
    initializeFilters();
    initializeSearch();
    renderBookings();
    initializeNotifications();
    initializeProfile();
    initializePaymentStatusModal();
});

// Load bookings from API (fallback to localStorage if no API)
function loadBookingsFromStorage() {
    function applyBookings(playerBookings) {
        allBookingsCache = playerBookings;
        bookingsData.upcoming = playerBookings
            .filter(function(b) { return b.status === 'PENDING' || b.status === 'UPCOMING' || b.status === 'CONFIRMED' || b.status === 'pending' || b.status === 'upcoming' || b.status === 'confirmed'; })
            .map(convertBookingToDisplayFormat);
        bookingsData.completed = playerBookings
            .filter(function(b) { return b.status === 'COMPLETED' || b.status === 'completed'; })
            .map(convertBookingToDisplayFormat);
        bookingsData.cancelled = playerBookings
            .filter(function(b) { return b.status === 'CANCELLED' || b.status === 'cancelled'; })
            .map(convertBookingToDisplayFormat);
    }
    if (typeof API !== 'undefined' && API.getAuthToken()) {
        API.bookings.getAll()
            .then(function(res) {
                var list = (res && res.bookings) ? res.bookings : [];
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

function loadBookingsFromStorageFallback(applyBookings) {
    var allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
    var playerData = typeof API !== 'undefined' && API.getCurrentUser ? API.getCurrentUser() : JSON.parse(localStorage.getItem('currentUser') || '{}');
    var playerId = (playerData && playerData.id) || 'player_1';
    var playerBookings = allBookings.filter(function(booking) {
        var isOrganizer = booking.organizerId === playerId;
        var isParticipant = booking.players && booking.players.some(function(p) { return p.id === playerId; });
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
    var timeSlots = booking.timeSlots || (booking.timeSlotStart ? [booking.timeSlotStart] : []);
    if (booking.timeSlotStart && booking.timeSlotEnd && timeSlots.length === 0) {
        timeSlots = [booking.timeSlotStart + ' - ' + booking.timeSlotEnd];
    }
    var timeDisplay = timeSlots.length > 0
        ? (typeof timeSlots[0] === 'string' && timeSlots[0].indexOf(' - ') !== -1
            ? timeSlots[0]
            : timeSlots.map(function(slot) {
                var hour = parseInt(String(slot).split(':')[0], 10);
                return slot + ' - ' + (hour + 1).toString().padStart(2, '0') + ':00';
            }).join(', '))
        : (booking.timeSlotStart && booking.timeSlotEnd ? booking.timeSlotStart + ' - ' + booking.timeSlotEnd : 'Not specified');
    var fieldName = (booking.field && booking.field.name) || booking.fieldName;
    var fieldImage = (booking.field && booking.field.images && booking.field.images[0]) || booking.fieldImage;
    var players = booking.participants ? booking.participants.map(function(p) { return { id: p.userId, name: (p.user && p.user.fullName) || 'Player' }; }) : (booking.players || []);
    var teamSize = players.length + 1;
    var displayStatus = booking.status || 'upcoming';
    var isConfirmed = booking.status === 'CONFIRMED' || booking.status === 'confirmed';
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
        duration: (booking.timeSlotStart && booking.timeSlotEnd ? 1 : timeSlots.length) + 'h',
        bookedDate: new Date(booking.createdAt || Date.now()).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        status: isConfirmed ? 'confirmed' : displayStatus.toLowerCase(),
        isConfirmed: isConfirmed
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

// Get payment button for booking
function getPaymentButton(booking) {
    var fullBooking = allBookingsCache.find(function(b) { return b.id === booking.id; });
    if (!fullBooking) fullBooking = JSON.parse(localStorage.getItem('playerBookings') || '[]').find(function(b) { return b.id === booking.id; });
    if (!fullBooking) return '';

    var playerData = (typeof API !== 'undefined' && API.getCurrentUser) ? API.getCurrentUser() : JSON.parse(localStorage.getItem('currentUser') || '{}');
    var isOrganizer = fullBooking.organizerId === (playerData && playerData.id);
    
    // Check if payment is needed
    if (isOrganizer && fullBooking.organizerPaymentStatus === 'pending') {
        return `
            <button class="pay-now-btn" onclick="payForBooking('${booking.id}', true)">
                <i class="fi fi-rr-credit-card"></i> Pay Now (₺${fullBooking.totalCost})
            </button>
        `;
    } else if (!isOrganizer) {
        var participants = fullBooking.participants || fullBooking.players || [];
        var player = participants.find(function(p) { return (p.userId || p.id) === (playerData && playerData.id); });
        var costPerPlayer = fullBooking.totalCost && (participants.length + 1) ? Math.round(fullBooking.totalCost / (participants.length + 1)) : 0;
        if (player && (player.paymentStatus === 'PENDING' || player.paymentStatus === 'pending') && (fullBooking.paymentMethod === 'SPLIT' || fullBooking.paymentMethod === 'split')) {
            return '<button class="pay-now-btn" onclick="payForBooking(\'' + booking.id + '\', false)"><i class="fi fi-rr-credit-card"></i> Pay Your Share (₺' + (player.paymentAmount || costPerPlayer) + ')</button>';
        }
    }
    
    return '';
}

// Pay for booking
function payForBooking(bookingId, isOrganizer) {
    const allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
    const booking = allBookings.find(b => b.id === bookingId);
    
    if (!booking) {
        alert('Booking not found.');
        return;
    }

    const amount = isOrganizer ? booking.totalCost : booking.costPerPlayer;
    
    if (window.openPaymentModal) {
        window.openPaymentModal({
            amount: amount,
            bookingId: bookingId,
            isOrganizer: isOrganizer,
            booking: booking
        });
    } else {
        alert('Payment functionality is not available. Please navigate to the home page.');
    }
}

// Make payForBooking available globally
window.payForBooking = payForBooking;

// Create a booking card element
function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = 'booking-card';
    
    const paymentButton = getPaymentButton(booking);
    
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
                            <div class="booking-status ${booking.isConfirmed || booking.status === 'confirmed' ? 'confirmed' : booking.status}">
                                <span class="booking-status-dot"></span>
                                <span>${booking.isConfirmed || booking.status === 'confirmed' ? 'Confirmed' : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}</span>
                            </div>
                            ${booking.status === 'pending' ? `
                                <button class="info-btn" onclick="showPaymentStatusInfo('${booking.id}')" title="Payment Status">
                                    <i class="fi fi-rr-info"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="booking-actions-buttons">
                            ${paymentButton}
                            ${!(booking.isConfirmed || booking.status === 'confirmed') && booking.status !== 'completed' && booking.status !== 'cancelled' ? `
                                <button class="cancel-booking-btn" onclick="cancelBooking('${booking.id}')">
                                    Cancel Booking
                                </button>
                                <a href="#" class="reschedule-link" onclick="rescheduleBooking('${booking.id}'); return false;">
                                    Reschedule
                                </a>
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

// Reschedule booking function
function rescheduleBooking(bookingId) {
    alert('Reschedule functionality will be implemented soon!');
    // TODO: Implement reschedule modal/functionality
}

// Initialize notifications
function initializeNotifications() {
    const notificationBtn = document.querySelector('.notification-btn');
    const notificationPopup = document.getElementById('notificationPopup');
    const closeNotificationBtn = document.getElementById('closeNotificationBtn');
    
    if (notificationBtn && notificationPopup) {
        notificationBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationPopup.classList.toggle('active');
            // Close profile popup if open
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup && profilePopup.classList.contains('active')) {
                profilePopup.classList.remove('active');
            }
        });
        
        // Close notification button (if it exists)
        if (closeNotificationBtn) {
            closeNotificationBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                notificationPopup.classList.remove('active');
            });
        }
        
        // Close when clicking outside
        document.addEventListener('click', function(e) {
            if (notificationPopup && notificationPopup.classList.contains('active')) {
                if (!notificationPopup.contains(e.target) && !notificationBtn.contains(e.target)) {
                    notificationPopup.classList.remove('active');
                }
            }
        });
    }
}

// Load and display notifications
function loadNotifications() {
    const notificationContent = document.querySelector('.notification-popup-content');
    if (!notificationContent) return;

    const playerData = JSON.parse(localStorage.getItem('playerData') || '{}');
    const playerId = playerData.id;
    
    if (!playerId) {
        notificationContent.innerHTML = '<p style="padding: 20px; text-align: center; color: #6B7280;">No notifications</p>';
        return;
    }

    const allNotifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    const playerNotifications = allNotifications
        .filter(n => n.playerId === playerId && n.status === 'pending')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10); // Show latest 10

    if (playerNotifications.length === 0) {
        notificationContent.innerHTML = '<p style="padding: 20px; text-align: center; color: #6B7280;">No new notifications</p>';
        return;
    }

    notificationContent.innerHTML = playerNotifications.map(notif => {
        const timeAgo = getTimeAgo(new Date(notif.createdAt));
        return `
            <div class="notification-item" data-notification-id="${notif.id}" data-booking-id="${notif.bookingId}">
                <div class="notification-icon">
                    <i class="fi fi-rs-bell"></i>
                </div>
                <div class="notification-text">
                    <p class="notification-title">${notif.message}</p>
                    <p class="notification-time">${timeAgo}</p>
                    ${notif.type === 'booking_invitation' ? `
                        <div class="notification-actions" style="margin-top: 8px; display: flex; gap: 8px;">
                            <button class="accept-invite-btn" style="padding: 4px 12px; background: #10B981; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Accept</button>
                            <button class="decline-invite-btn" style="padding: 4px 12px; background: #EF4444; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Decline</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners for accept/decline buttons
    notificationContent.querySelectorAll('.accept-invite-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const notificationItem = this.closest('.notification-item');
            const notificationId = notificationItem.dataset.notificationId;
            const bookingId = notificationItem.dataset.bookingId;
            handleInvitationResponse(notificationId, bookingId, 'accepted');
        });
    });

    notificationContent.querySelectorAll('.decline-invite-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const notificationItem = this.closest('.notification-item');
            const notificationId = notificationItem.dataset.notificationId;
            const bookingId = notificationItem.dataset.bookingId;
            handleInvitationResponse(notificationId, bookingId, 'declined');
        });
    });
}

// Handle invitation response
function handleInvitationResponse(notificationId, bookingId, response) {
    // Update notification status
    const allNotifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    const notificationIndex = allNotifications.findIndex(n => n.id === notificationId);
    
    if (notificationIndex !== -1) {
        allNotifications[notificationIndex].status = response;
        localStorage.setItem('playerNotifications', JSON.stringify(allNotifications));
    }

    // Update booking if accepted
    if (response === 'accepted') {
        const allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
        const bookingIndex = allBookings.findIndex(b => b.id === bookingId);
        
        if (bookingIndex !== -1) {
            const booking = allBookings[bookingIndex];
            const playerData = JSON.parse(localStorage.getItem('playerData') || '{}');
            const player = booking.players.find(p => p.id === playerData.id);
            if (player) {
                player.status = 'accepted';
                
                // Check if player needs to pay
                if (booking.paymentMethod === 'split' && player.paymentStatus === 'pending') {
                    // Open payment modal for player
                    if (window.openPaymentModal) {
                        window.openPaymentModal({
                            amount: booking.costPerPlayer,
                            bookingId: booking.id,
                            isOrganizer: false,
                            booking: booking
                        });
                    } else {
                        alert('Booking invitation accepted! Please pay your share to confirm.');
                    }
                } else {
                    alert('Booking invitation accepted!');
                }
            }
            localStorage.setItem('playerBookings', JSON.stringify(allBookings));
        }
    } else {
        alert('Booking invitation declined.');
    }

    // Reload notifications
    loadNotifications();
    // Reload bookings if on bookings page
    if (window.location.pathname.includes('bookings.html')) {
        loadBookingsFromStorage();
        renderBookings();
    }
}

// Get time ago string
function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
}

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

// Show payment status info modal
function showPaymentStatusInfo(bookingId) {
    const allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
    const booking = allBookings.find(b => b.id === bookingId);
    
    if (!booking) {
        alert('Booking not found.');
        return;
    }

    const playerData = JSON.parse(localStorage.getItem('playerData') || '{}');
    const currentPlayerId = playerData.id;
    
    // Calculate payment statistics
    const totalPlayers = booking.players.length + 1; // +1 for organizer
    let playersPaid = 0;
    let playersPending = 0;
    
    // Check organizer payment
    if (booking.organizerPaymentStatus === 'paid') {
        playersPaid++;
    } else if (booking.organizerPaymentStatus === 'pending') {
        playersPending++;
    }
    
    // Check players payment
    booking.players.forEach(player => {
        if (player.paymentStatus === 'paid') {
            playersPaid++;
        } else if (player.paymentStatus === 'pending') {
            playersPending++;
        }
    });
    
    // Update summary
    document.getElementById('totalPlayers').textContent = totalPlayers;
    document.getElementById('playersPaid').textContent = playersPaid;
    document.getElementById('playersPending').textContent = playersPending;
    
    // Build players list
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    // Add organizer
    const isOrganizer = booking.organizerId === currentPlayerId;
    const organizerAmount = booking.paymentMethod === 'organizer' ? booking.totalCost : 
                           booking.paymentMethod === 'split' ? booking.costPerPlayer :
                           booking.paymentMethod === 'mixed' ? (booking.mixedPaymentDistribution && booking.mixedPaymentDistribution[booking.organizerId] || 0) : 0;
    
    const organizerItem = createPlayerPaymentItem({
        id: booking.organizerId,
        name: booking.organizerName || 'Organizer',
        paymentStatus: booking.organizerPaymentStatus,
        paymentAmount: organizerAmount,
        isOrganizer: true,
        isCurrentUser: isOrganizer
    });
    playersList.appendChild(organizerItem);
    
    // Add players
    booking.players.forEach(player => {
        const isCurrentUser = player.id === currentPlayerId;
        const playerAmount = booking.paymentMethod === 'split' ? booking.costPerPlayer :
                            booking.paymentMethod === 'mixed' ? (booking.mixedPaymentDistribution && booking.mixedPaymentDistribution[player.id] || 0) : 0;
        
        const playerItem = createPlayerPaymentItem({
            id: player.id,
            name: player.name,
            paymentStatus: player.paymentStatus,
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
