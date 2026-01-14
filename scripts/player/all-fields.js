// All published fields data (combining popular and nearby)
// In a real app, this would come from an API
const allFields = [
    {
        id: 1,
        name: "Fozi football court",
        sport: "Football",
        image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop&auto=format",
        rating: 4.8,
        reviews: 98,
        location: "Uskudar",
        distance: "2.1 Km",
        type: "outdoor",
        price: 1500,
        isFavorite: false
    },
    {
        id: 2,
        name: "Fozi football court",
        sport: "Tennis",
        image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=400&h=300&fit=crop&auto=format",
        rating: 4.8,
        reviews: 98,
        location: "Uskudar",
        distance: "2.1 Km",
        type: "indoor",
        price: 1500,
        isFavorite: true
    },
    {
        id: 3,
        name: "Fozi football court",
        sport: "Basketball",
        image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=300&fit=crop&auto=format",
        rating: 4.8,
        reviews: 98,
        location: "Uskudar",
        distance: "2.1 Km",
        type: "indoor",
        price: 1500,
        isFavorite: false
    },
    {
        id: 4,
        name: "Fozi football court",
        sport: "Padel",
        image: "https://images.unsplash.com/photo-1622163642992-6b7e3c4e3b3e?w=400&h=300&fit=crop&auto=format",
        rating: 4.8,
        reviews: 98,
        location: "Uskudar",
        distance: "2.1 Km",
        type: "indoor",
        price: 1500,
        isFavorite: true
    },
    {
        id: 5,
        name: "Fozi football court",
        sport: "Volleyball",
        image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&h=300&fit=crop&auto=format",
        rating: 4.8,
        reviews: 98,
        location: "Uskudar",
        distance: "2.1 Km",
        type: "indoor",
        price: 1500,
        isFavorite: false
    },
    {
        id: 6,
        name: "Fozi football court",
        sport: "Ice Hockey",
        image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=300&fit=crop&auto=format",
        rating: 4.8,
        reviews: 98,
        location: "Uskudar",
        distance: "2.1 Km",
        type: "indoor",
        price: 1500,
        isFavorite: true
    },
    {
        id: 7,
        name: "Fozi football court",
        sport: "Football",
        image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop&auto=format",
        rating: 4.8,
        reviews: 98,
        location: "Uskudar",
        distance: "2.1 Km",
        type: "indoor",
        price: 1500,
        isFavorite: false
    },
    {
        id: 8,
        name: "Fozi football court",
        sport: "Tennis",
        image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=400&h=300&fit=crop&auto=format",
        rating: 4.8,
        reviews: 98,
        location: "Uskudar",
        distance: "2.1 Km",
        type: "indoor",
        price: 1500,
        isFavorite: true
    },
    {
        id: 9,
        name: "Fozi football court",
        sport: "Basketball",
        image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=300&fit=crop&auto=format",
        rating: 4.8,
        reviews: 98,
        location: "Uskudar",
        distance: "2.1 Km",
        type: "indoor",
        price: 1500,
        isFavorite: false
    },
    {
        id: 10,
        name: "Elite Sports Center",
        sport: "Futsal",
        image: "https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=400&h=300&fit=crop&auto=format",
        rating: 4.9,
        reviews: 156,
        location: "Kadikoy",
        distance: "3.5 Km",
        type: "indoor",
        price: 1800,
        isFavorite: false
    },
    {
        id: 11,
        name: "City Arena",
        sport: "Volleyball",
        image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&h=300&fit=crop&auto=format",
        rating: 4.7,
        reviews: 87,
        location: "Besiktas",
        distance: "4.2 Km",
        type: "indoor",
        price: 1200,
        isFavorite: true
    },
    {
        id: 12,
        name: "Stadium Pro",
        sport: "Football",
        image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop&auto=format",
        rating: 4.6,
        reviews: 203,
        location: "Sisli",
        distance: "5.8 Km",
        type: "outdoor",
        price: 2000,
        isFavorite: false
    }
];

// Current filter state
let currentFilter = {
    sport: 'all',
    searchQuery: '',
    type: 'all',
    price: 'all',
    rating: 'all',
    distance: 'all'
};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    try {
        loadFavoritesFromStorage();
        initializeFilterOptions();
        renderAllFields();
        setupEventListeners();
        initializeBookingModal();
        
        // Check for invite link in URL
        handleInviteLink();
    } catch (error) {
        console.error('Error initializing page:', error);
        alert('An error occurred while loading the page. Please check the console for details.');
    }
});

// Initialize filter options - set "All" as active by default
function initializeFilterOptions() {
    const allOptions = document.querySelectorAll('.filter-option[data-value="all"]');
    allOptions.forEach(option => {
        option.classList.add('active');
    });
    
    // Set initial sport filter
    currentFilter.sport = 'all';
}

// Handle invite link from URL
function handleInviteLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteFieldId = urlParams.get('invite');
    const organizerId = urlParams.get('organizer');
    
    if (inviteFieldId && organizerId) {
        const venue = allFields.find(v => v.id.toString() === inviteFieldId);
        
        if (venue) {
            setTimeout(() => {
                if (confirm(`You've been invited to book ${venue.name}. Would you like to view the booking?`)) {
                    openBookingModal(venue);
                }
            }, 500);
        }
    }
}

// Handle image loading errors
window.handleImageError = function(img, sportName) {
    if (img && !img.dataset.errorHandled) {
        img.dataset.errorHandled = 'true';
        const svg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext fill='%236b7280' font-family='sans-serif' font-size='18' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E${encodeURIComponent(sportName)}%3C/text%3E%3C/svg%3E`;
        img.src = svg;
    }
}

// Render all fields
function renderAllFields() {
    const container = document.getElementById('allFieldsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!container) {
        console.error('Container not found: allFieldsGrid');
        return;
    }
    
    // Filter fields based on current filters
    const filteredFields = getFilteredFields();
    
    container.innerHTML = '';
    
    if (filteredFields.length === 0) {
        container.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    
    container.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    filteredFields.forEach(field => {
        try {
            const card = createVenueCard(field);
            container.appendChild(card);
        } catch (error) {
            console.error('Error creating card for field:', field, error);
        }
    });
}

// Get filtered fields based on current filters
function getFilteredFields() {
    let filtered = [...allFields];
    
    // Filter by sport
    if (currentFilter.sport !== 'all') {
        filtered = filtered.filter(field => 
            field.sport.toLowerCase() === currentFilter.sport.toLowerCase()
        );
    }
    
    // Filter by search query
    if (currentFilter.searchQuery) {
        const query = currentFilter.searchQuery.toLowerCase().trim();
        filtered = filtered.filter(field => {
            const name = field.name.toLowerCase();
            const sport = field.sport.toLowerCase();
            const location = field.location.toLowerCase();
            return name.includes(query) || sport.includes(query) || location.includes(query);
        });
    }
    
    // Filter by type
    if (currentFilter.type !== 'all') {
        filtered = filtered.filter(field => 
            field.type.toLowerCase() === currentFilter.type.toLowerCase()
        );
    }
    
    // Filter by price
    if (currentFilter.price !== 'all') {
        filtered = filtered.filter(field => {
            const price = field.price;
            switch (currentFilter.price) {
                case '0-1000':
                    return price <= 1000;
                case '1000-2000':
                    return price > 1000 && price <= 2000;
                case '2000+':
                    return price > 2000;
                default:
                    return true;
            }
        });
    }
    
    // Filter by rating
    if (currentFilter.rating !== 'all') {
        filtered = filtered.filter(field => {
            const rating = field.rating;
            switch (currentFilter.rating) {
                case '4.5+':
                    return rating >= 4.5;
                case '4.0+':
                    return rating >= 4.0;
                case '3.5+':
                    return rating >= 3.5;
                default:
                    return true;
            }
        });
    }
    
    // Filter by distance
    if (currentFilter.distance !== 'all') {
        filtered = filtered.filter(field => {
            // Extract numeric distance from string (e.g., "2.1 Km" -> 2.1)
            const distanceStr = field.distance.toLowerCase().replace('km', '').trim();
            const distance = parseFloat(distanceStr);
            
            if (isNaN(distance)) return true; // If can't parse, include it
            
            switch (currentFilter.distance) {
                case '0-2':
                    return distance <= 2;
                case '2-5':
                    return distance > 2 && distance <= 5;
                case '5-10':
                    return distance > 5 && distance <= 10;
                case '10+':
                    return distance > 10;
                default:
                    return true;
            }
        });
    }
    
    return filtered;
}

// Create a venue card element
function createVenueCard(venue) {
    const card = document.createElement('div');
    card.className = 'venue-card';
    card.dataset.venueId = venue.id;
    card.dataset.sport = venue.sport.toLowerCase();
    
    card.innerHTML = `
        <div class="venue-image-container">
            <img src="${venue.image}" alt="${venue.name}" class="venue-image" loading="lazy" onerror="window.handleImageError(this, '${venue.sport}');">
            <div class="sport-badge">${venue.sport}</div>
            <button class="favorite-btn ${venue.isFavorite ? 'active' : ''}" data-venue-id="${venue.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
            </button>
        </div>
        <div class="venue-card-content">
            <div class="venue-header">
                <h3 class="venue-name">${venue.name}</h3>
                <span class="venue-price">₺${venue.price}/h</span>
            </div>
            <div class="venue-rating">
                <span class="star">★</span>
                <span>${venue.rating} (${venue.reviews}) . ${venue.location} . ${venue.distance}</span>
            </div>
            <div class="venue-footer-row">
                <span class="venue-type">${venue.type}</span>
                <button class="book-btn">Book</button>
            </div>
        </div>
    `;
    
    // Add event listeners to the card
    const favoriteBtn = card.querySelector('.favorite-btn');
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(venue.id);
    });
    
    const bookBtn = card.querySelector('.book-btn');
    bookBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleBookClick(venue);
    });
    
    card.addEventListener('click', () => {
        window.location.href = `field-info.html?id=${venue.id}`;
    });
    
    return card;
}

// Toggle favorite status
function toggleFavorite(venueId) {
    const field = allFields.find(v => v.id === venueId);
    if (field) {
        field.isFavorite = !field.isFavorite;
    }
    
    // Update UI
    const favoriteBtn = document.querySelector(`.favorite-btn[data-venue-id="${venueId}"]`);
    if (favoriteBtn) {
        favoriteBtn.classList.toggle('active');
    }
    
    // Save to localStorage
    saveFavoritesToStorage();
}

// Handle book button click
function handleBookClick(venue) {
    openBookingModal(venue);
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchIcon = document.querySelector('.search-icon');
    
    const performSearch = () => {
        currentFilter.searchQuery = searchInput.value;
        renderAllFields();
    };
    
    // Search on Enter key press
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
        
        // Search on input change (debounced)
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(performSearch, 300);
        });
    }
    
    // Search on icon click
    if (searchIcon) {
        searchIcon.addEventListener('click', () => {
            performSearch();
        });
    }
    
    // Filter button
    const filterBtn = document.getElementById('filterBtn');
    const filterPopup = document.getElementById('filterPopup');
    const closeFilterBtn = document.getElementById('closeFilterBtn');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    
    if (filterBtn && filterPopup) {
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterPopup.classList.toggle('active');
            filterBtn.classList.toggle('active');
            
            // Close profile popup if open
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup && profilePopup.classList.contains('active')) {
                profilePopup.classList.remove('active');
            }
            
            // Close notification popup if open
            const notificationPopup = document.getElementById('notificationPopup');
            if (notificationPopup && notificationPopup.classList.contains('active')) {
                notificationPopup.classList.remove('active');
            }
        });
        
        if (closeFilterBtn) {
            closeFilterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                filterPopup.classList.remove('active');
                filterBtn.classList.remove('active');
            });
        }
        
        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (filterPopup && filterPopup.classList.contains('active')) {
                if (!filterPopup.contains(e.target) && !filterBtn.contains(e.target)) {
                    filterPopup.classList.remove('active');
                    filterBtn.classList.remove('active');
                }
            }
        });
    }
    
    // Filter options
    const filterOptions = document.querySelectorAll('.filter-option');
    filterOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove active from siblings in same section (for single-select filters)
            const section = this.closest('.filter-section');
            const filterType = this.dataset.filter;
            
            // For single-select filters (sport, type, price, rating, distance), only one can be active
            if (filterType === 'sport' || filterType === 'type' || filterType === 'price' || filterType === 'rating' || filterType === 'distance') {
                const siblings = section.querySelectorAll('.filter-option');
                siblings.forEach(sib => sib.classList.remove('active'));
            }
            
            // Add active to clicked option
            this.classList.add('active');
        });
    });
    
    // Apply filters
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            // Get active filter options
            const activeOptions = document.querySelectorAll('.filter-option.active');
            activeOptions.forEach(option => {
                const filterType = option.dataset.filter;
                const filterValue = option.dataset.value;
                if (filterType && filterValue) {
                    currentFilter[filterType] = filterValue;
                }
            });
            
            // Update filter button text
            updateFilterButtonText();
            
            // Close popup
            if (filterPopup) {
                filterPopup.classList.remove('active');
                filterBtn.classList.remove('active');
            }
            
            // Re-render fields
            renderAllFields();
        });
    }
    
    // Reset filters
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            // Reset filter state
            currentFilter.sport = 'all';
            currentFilter.type = 'all';
            currentFilter.price = 'all';
            currentFilter.rating = 'all';
            currentFilter.distance = 'all';
            
            // Reset UI
            const filterOptions = document.querySelectorAll('.filter-option');
            filterOptions.forEach(option => {
                option.classList.remove('active');
                if (option.dataset.value === 'all') {
                    option.classList.add('active');
                }
            });
            
            // Update filter button text
            updateFilterButtonText();
            
            // Re-render fields
            renderAllFields();
        });
    }
}

// Update filter button text based on active filters
function updateFilterButtonText() {
    const filterBtn = document.getElementById('filterBtn');
    if (!filterBtn) return;
    
    const activeFilters = [];
    if (currentFilter.sport !== 'all') activeFilters.push(currentFilter.sport);
    if (currentFilter.type !== 'all') activeFilters.push(currentFilter.type);
    if (currentFilter.price !== 'all') activeFilters.push('Price');
    if (currentFilter.rating !== 'all') activeFilters.push('Rating');
    if (currentFilter.distance !== 'all') activeFilters.push('Distance');
    
    const filterSpan = filterBtn.querySelector('span');
    if (filterSpan) {
        if (activeFilters.length > 0) {
            filterSpan.textContent = `Filter (${activeFilters.length})`;
        } else {
            filterSpan.textContent = 'Filter';
        }
    }
    
    // Notification popup
    const notificationBtn = document.querySelector('.notification-btn');
    const notificationPopup = document.getElementById('notificationPopup');
    
    if (notificationBtn && notificationPopup) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationPopup.classList.toggle('active');
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup && profilePopup.classList.contains('active')) {
                profilePopup.classList.remove('active');
            }
        });
        
        document.addEventListener('click', (e) => {
            if (notificationPopup && notificationPopup.classList.contains('active')) {
                if (!notificationPopup.contains(e.target) && !notificationBtn.contains(e.target)) {
                    notificationPopup.classList.remove('active');
                }
            }
        });
    }
    
    // Profile popup
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    
    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            if (notificationPopup && notificationPopup.classList.contains('active')) {
                notificationPopup.classList.remove('active');
            }
        });
        
        document.addEventListener('click', (e) => {
            if (profilePopup && profilePopup.classList.contains('active')) {
                if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
                    profilePopup.classList.remove('active');
                }
            }
        });
    }
}

// Save favorites to localStorage
function saveFavoritesToStorage() {
    const favorites = allFields
        .filter(v => v.isFavorite)
        .map(v => v.id);
    localStorage.setItem('favoriteVenues', JSON.stringify(favorites));
}

// Load favorites from localStorage
function loadFavoritesFromStorage() {
    const saved = localStorage.getItem('favoriteVenues');
    if (saved) {
        const favorites = JSON.parse(saved);
        allFields.forEach(v => {
            v.isFavorite = favorites.includes(v.id);
        });
    }
}

// Import booking modal functions from home.js
// Since we can't directly import, we'll need to include the booking modal code
// For now, we'll create a simplified version or reference the home.js functions

// Booking Modal State
let bookingState = {
    currentStep: 1,
    totalSteps: 6,
    field: null,
    selectedDate: null,
    selectedTimeSlots: [],
    organizer: null,
    players: [],
    totalCost: 0,
    paymentMethod: 'split',
    bookingId: null,
    paymentData: null,
    skipPaymentStep: false,
    mixedPaymentDistribution: {}
};

// Open booking modal (simplified - full implementation would be in a shared module)
function openBookingModal(venue) {
    const playerData = getPlayerData();
    if (!playerData) {
        alert('Please log in to book a field.');
        window.location.href = '../auth/login.html';
        return;
    }
    
    bookingState = {
        currentStep: 1,
        totalSteps: 6,
        field: venue,
        selectedDate: null,
        selectedTimeSlots: [],
        organizer: {
            id: playerData.id,
            name: playerData.name,
            email: playerData.email
        },
        players: [],
        totalCost: venue.price || 0,
        paymentMethod: 'split',
        bookingId: null,
        paymentData: null,
        skipPaymentStep: false,
        mixedPaymentDistribution: {},
        paymentAmount: 0
    };
    
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.classList.add('active');
        populateFieldDetails(venue);
        
        const dateInput = document.getElementById('bookingDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
        }
        
        generateInviteLink();
        updateStepDisplay();
        updateStepButtons();
    }
}

// Get player data from localStorage
function getPlayerData() {
    const stored = localStorage.getItem('playerData');
    if (stored) {
        return JSON.parse(stored);
    }
    
    const defaultPlayer = {
        id: 'player_' + Date.now(),
        name: 'John Doe',
        email: 'john.doe@example.com'
    };
    localStorage.setItem('playerData', JSON.stringify(defaultPlayer));
    return defaultPlayer;
}

// Populate field details
function populateFieldDetails(venue) {
    const container = document.getElementById('fieldDetailsPreview');
    if (!container) return;
    
    container.innerHTML = `
        <div class="field-preview-card">
            <img src="${venue.image}" alt="${venue.name}" class="field-preview-image">
            <div class="field-preview-info">
                <h4>${venue.name}</h4>
                <div class="field-preview-meta">
                    <span><i class="fi fi-rr-marker"></i> ${venue.location}</span>
                    <span><i class="fi fi-rs-star"></i> ${venue.rating} (${venue.reviews})</span>
                    <span><i class="fi fi-rr-tag"></i> ${venue.sport}</span>
                </div>
                <div class="field-preview-price">
                    <span>Price: <strong>₺${venue.price}/hour</strong></span>
                </div>
            </div>
        </div>
    `;
}

// Generate invite link
function generateInviteLink() {
    const inviteLink = document.getElementById('inviteLink');
    if (inviteLink && bookingState.field) {
        const link = `${window.location.origin}${window.location.pathname}?invite=${bookingState.field.id}&organizer=${bookingState.organizer.id}`;
        inviteLink.value = link;
    }
}

// Update step display
function updateStepDisplay() {
    for (let i = 1; i <= bookingState.totalSteps; i++) {
        const step = document.getElementById(`step${i}`);
        if (step) {
            step.classList.remove('active');
        }
    }
    
    const currentStep = document.getElementById(`step${bookingState.currentStep}`);
    if (currentStep) {
        currentStep.classList.add('active');
    }
    
    loadStepContent();
    updateStepButtons();
}

// Update step buttons visibility
function updateStepButtons() {
    const nextBtn = document.getElementById('nextStepBtn');
    const submitPaymentBtn = document.getElementById('submitPaymentBtn');
    const confirmBtn = document.getElementById('confirmBookingBtn');
    const prevBtn = document.getElementById('prevStepBtn');
    
    if (prevBtn) {
        prevBtn.style.display = bookingState.currentStep > 1 ? 'block' : 'none';
    }
    
    if (nextBtn) nextBtn.style.display = 'none';
    if (submitPaymentBtn) submitPaymentBtn.style.display = 'none';
    if (confirmBtn) confirmBtn.style.display = 'none';
    
    if (bookingState.currentStep < bookingState.totalSteps) {
        if (bookingState.currentStep === 5) {
            if (submitPaymentBtn) {
                submitPaymentBtn.style.display = 'flex';
            } else if (nextBtn) {
                nextBtn.style.display = 'block';
            }
        } else {
            if (nextBtn) {
                nextBtn.style.display = 'block';
            }
        }
    } else {
        if (confirmBtn) {
            confirmBtn.style.display = 'block';
        } else if (nextBtn) {
            nextBtn.style.display = 'block';
        }
    }
}

// Load content for current step
function loadStepContent() {
    switch (bookingState.currentStep) {
        case 2:
            loadTimeSlots();
            break;
        case 3:
            updatePlayersList();
            break;
        case 4:
            updateCostSplit();
            break;
        case 5:
            loadPaymentStep();
            break;
        case 6:
            showBookingSummary();
            break;
    }
}

// Initialize booking modal
function initializeBookingModal() {
    const closeBtn = document.getElementById('closeBookingModal');
    const cancelBtn = document.getElementById('cancelBookingBtn');
    const overlay = document.querySelector('.booking-modal-overlay');
    
    if (closeBtn) closeBtn.addEventListener('click', closeBookingModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeBookingModal);
    if (overlay) overlay.addEventListener('click', closeBookingModal);
    
    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    const confirmBtn = document.getElementById('confirmBookingBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (bookingState.currentStep > 1) {
                bookingState.currentStep--;
                updateStepDisplay();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (validateCurrentStep()) {
                if (bookingState.currentStep < bookingState.totalSteps) {
                    bookingState.currentStep++;
                    updateStepDisplay();
                }
            }
        });
    }
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            confirmBooking();
        });
    }
    
    // Date selection
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            bookingState.selectedDate = this.value;
            if (bookingState.selectedDate) {
                loadTimeSlots();
            }
        });
    }
}

// Close booking modal
function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.classList.remove('active');
        bookingState.currentStep = 1;
    }
}

// Simplified implementations for booking modal steps
function loadTimeSlots() {
    const container = document.getElementById('timeSlotsGrid');
    if (!container) return;
    
    const slots = [];
    for (let hour = 9; hour < 22; hour++) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
        slots.push({
            start: startTime,
            end: endTime,
            available: Math.random() > 0.3
        });
    }
    
    container.innerHTML = slots.map(slot => `
        <button class="time-slot ${!slot.available ? 'unavailable' : ''} ${bookingState.selectedTimeSlots.includes(slot.start) ? 'selected' : ''}" 
                data-start="${slot.start}" 
                data-end="${slot.end}"
                ${!slot.available ? 'disabled' : ''}>
            ${slot.start} - ${slot.end}
        </button>
    `).join('');
    
    container.querySelectorAll('.time-slot:not(.unavailable)').forEach(btn => {
        btn.addEventListener('click', function() {
            const start = this.dataset.start;
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                bookingState.selectedTimeSlots = bookingState.selectedTimeSlots.filter(t => t !== start);
            } else {
                this.classList.add('selected');
                bookingState.selectedTimeSlots.push(start);
            }
            updateBookingCost();
        });
    });
}

function updateBookingCost() {
    if (!bookingState.field) return;
    const hours = bookingState.selectedTimeSlots.length;
    bookingState.totalCost = bookingState.field.price * hours;
    updateCostSplit();
}

function updatePlayersList() {
    const container = document.getElementById('playersList');
    if (!container) return;
    
    if (bookingState.players.length === 0) {
        container.innerHTML = '<p class="no-players">No players added yet. Add players by username or share the invite link.</p>';
        return;
    }
    
    container.innerHTML = bookingState.players.map((player, index) => `
        <div class="player-item">
            <div class="player-info">
                <i class="fi fi-rr-user"></i>
                <span>${player.name}</span>
                <span class="player-id">ID: ${player.id}</span>
            </div>
            <button class="remove-player-btn" data-index="${index}">
                <i class="fi fi-rr-cross-small"></i>
            </button>
        </div>
    `).join('');
}

function updateCostSplit() {
    const totalCostEl = document.getElementById('totalCost');
    const playerCountEl = document.getElementById('playerCount');
    const costPerPlayerEl = document.getElementById('costPerPlayer');
    
    const totalPlayers = bookingState.players.length + 1;
    const costPerPlayer = totalPlayers > 0 ? Math.round(bookingState.totalCost / totalPlayers) : bookingState.totalCost;
    
    if (totalCostEl) totalCostEl.textContent = `₺${bookingState.totalCost}`;
    if (playerCountEl) playerCountEl.textContent = totalPlayers;
    if (costPerPlayerEl) costPerPlayerEl.textContent = `₺${costPerPlayer}`;
}

function loadPaymentStep() {
    // Simplified payment step
    const summary = document.getElementById('paymentInfoSummary');
    if (summary) {
        const totalPlayers = bookingState.players.length + 1;
        const paymentAmount = Math.round(bookingState.totalCost / totalPlayers);
        summary.innerHTML = `
            <div class="payment-summary">
                <div class="payment-amount">
                    <span class="amount-label">Your Share to Pay</span>
                    <span class="amount-value">₺${paymentAmount}</span>
                </div>
            </div>
        `;
    }
}

function showBookingSummary() {
    const container = document.getElementById('bookingSummary');
    if (!container) return;
    
    container.innerHTML = `
        <div class="summary-section">
            <h4>Field Information</h4>
            <div class="summary-item">
                <span>Field:</span>
                <span><strong>${bookingState.field.name}</strong></span>
            </div>
        </div>
    `;
}

function validateCurrentStep() {
    const currentStep = bookingState.currentStep;
    
    switch (currentStep) {
        case 1:
            return true;
        case 2:
            if (!bookingState.selectedDate) {
                alert('Please select a date.');
                return false;
            }
            if (bookingState.selectedTimeSlots.length === 0) {
                alert('Please select at least one time slot.');
                return false;
            }
            updateBookingCost();
            return true;
        case 3:
            return true;
        case 4:
            return true;
        case 5:
            return true;
        case 6:
            return true;
        default:
            return true;
    }
}

function confirmBooking() {
    alert('Booking functionality would be implemented here. Redirecting to bookings page...');
    closeBookingModal();
    setTimeout(() => {
        window.location.href = 'bookings.html';
    }, 1000);
}

