// Fields loaded from API
var allFields = [];
const REVIEW_DIRTY_STORAGE_KEY = 'matchfieldReviewDirtyFields';

// Same as home / field-info: list GET does not include distanceKm; compute from coords when needed.
var PLAYER_LOCATION_STORAGE_KEY = 'playerSelectedLocation';
var DEFAULT_PLAYER_LOCATION = { lat: 41.0082, lng: 28.9784 };

function haversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function readPlayerSavedLocation() {
  try {
    var raw = localStorage.getItem(PLAYER_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng))
      return { lat: parsed.lat, lng: parsed.lng };
  } catch (_) {}
  return null;
}

function getPlayerCoordsForDistance() {
  var saved = readPlayerSavedLocation();
  if (saved) return Promise.resolve(saved);
  return new Promise(function(resolve) {
    if (!navigator.geolocation) {
      resolve(DEFAULT_PLAYER_LOCATION);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      function() {
        resolve(DEFAULT_PLAYER_LOCATION);
      },
      { timeout: 6000, enableHighAccuracy: true }
    );
  });
}

function formatDistanceFromKm(km) {
  if (!Number.isFinite(km)) return 'N/A';
  return km.toFixed(1) + ' km';
}

function computeFieldDistance(field, refCoords) {
  var apiKm = field.distanceKm != null ? Number(field.distanceKm) : NaN;
  if (Number.isFinite(apiKm)) return formatDistanceFromKm(apiKm);
  if (!refCoords || !Number.isFinite(refCoords.lat) || !Number.isFinite(refCoords.lng)) return 'N/A';
  var flat = field.latitude != null ? Number(field.latitude) : null;
  var flng = field.longitude != null ? Number(field.longitude) : null;
  if (!Number.isFinite(flat) || !Number.isFinite(flng)) return 'N/A';
  return formatDistanceFromKm(haversineKm(refCoords.lat, refCoords.lng, flat, flng));
}

function mapFieldToVenue(field, favoriteIdSet, refCoords) {
  var id = field.id;
  var idStr = String(id);
  var images = field.images && field.images.length ? field.images : [];
  var img = images[0] || 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop&auto=format';
  var favSet = favoriteIdSet instanceof Set ? favoriteIdSet : new Set((favoriteIdSet || []).map(String));
  return {
    id: id,
    name: field.name,
    sport: field.sport || 'Sport',
    image: img,
    rating: field.rating != null ? field.rating : 0,
    reviews: field.reviewCount != null ? field.reviewCount : 0,
    location: field.location || '',
    distance: computeFieldDistance(field, refCoords),
    type: (field.type || 'OUTDOOR').toLowerCase(),
    price: field.pricePerHour != null ? field.pricePerHour : 0,
    isFavorite: favSet.has(idStr)
  };
}

function dedupeVenues(venueList) {
  const seenIds = new Set();
  const seenFields = new Set();
  return (venueList || []).filter(function(venue) {
    const id = String(venue && venue.id || '').trim();
    const fieldKey = [
      String(venue && venue.name || '').trim().toLowerCase(),
      String(venue && venue.location || '').trim().toLowerCase(),
      String(venue && venue.sport || '').trim().toLowerCase(),
      String(venue && venue.price || '')
    ].join('|');
    if ((id && seenIds.has(id)) || seenFields.has(fieldKey)) return false;
    if (id) seenIds.add(id);
    seenFields.add(fieldKey);
    return true;
  });
}

function loadAllFieldsFromAPI() {
  return Promise.all([
    typeof API !== 'undefined' ? API.fields.getAll({ limit: 100 }) : Promise.resolve({ fields: [] }),
    (typeof API !== 'undefined' && API.getAuthToken && API.getAuthToken()) ? API.favorites.getAll().catch(function() { return { favorites: [] }; }) : Promise.resolve({ favorites: [] })
  ]).then(function(results) {
    var fieldsRes = results[0];
    var favRes = results[1];
    var fields = (fieldsRes && fieldsRes.fields) ? fieldsRes.fields : [];
    var favoriteIds = (favRes && favRes.favorites)
      ? favRes.favorites.map(function(f) { return String(f.fieldId || (f.field && f.field.id) || ''); }).filter(Boolean)
      : [];
    if (typeof API !== 'undefined' && API.getAuthToken && API.getAuthToken()) {
      try {
        localStorage.setItem('favoriteVenues', JSON.stringify(favoriteIds));
        window.dispatchEvent(new CustomEvent('matchfield:favorites-updated', { detail: { favorites: favoriteIds } }));
      } catch (_) {}
    }
    var favoriteIdSet = new Set(favoriteIds);
    if (!(typeof API !== 'undefined' && API.getAuthToken && API.getAuthToken())) {
      try {
        var raw = localStorage.getItem('favoriteVenues');
        var parsed = raw ? JSON.parse(raw) : [];
        (Array.isArray(parsed) ? parsed : []).forEach(function(fid) {
          if (fid) favoriteIdSet.add(String(fid));
        });
      } catch (_) {}
    }
    return getPlayerCoordsForDistance().then(function(refCoords) {
      allFields = dedupeVenues(fields.map(function(f) { return mapFieldToVenue(f, favoriteIdSet, refCoords); }));
      return allFields;
    });
  });
}

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
    function initUI() {
        loadFavoritesFromStorage();
        initializeFilterOptions();
        renderAllFields();
        setupEventListeners();
        initializeBookingModal();
        handleInviteLink();
    }
    loadAllFieldsFromAPI()
        .then(initUI)
        .catch(function(err) {
            console.error('Error loading fields:', err);
            initUI();
        });
});

window.addEventListener('pageshow', function() {
    const ids = consumeDirtyReviewFields();
    ids.forEach(function(id) { refreshFieldReviewStats(id); });
});

window.addEventListener('matchfield:reviews-updated', function(e) {
    const fieldId = e && e.detail && e.detail.fieldId ? String(e.detail.fieldId) : '';
    if (!fieldId) return;
    refreshFieldReviewStats(fieldId);
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
            setTimeout(async () => {
                if (await MatchFieldDialog.confirm(`You've been invited to book ${venue.name}. Would you like to view the booking?`, {
                    type: 'info',
                    okText: 'View Booking'
                })) {
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

function updateReviewRowForCard(card, venue) {
    const reviewSpan = card.querySelector('.venue-rating span:last-child');
    if (!reviewSpan) return;
    reviewSpan.textContent = `${venue.rating} (${venue.reviews}) . ${venue.location} . ${venue.distance}`;
}

async function refreshFieldReviewStats(fieldId) {
    if (typeof API === 'undefined' || !API.fields || !API.fields.getById) return;
    const idStr = String(fieldId);
    try {
        const res = await API.fields.getById(idStr);
        const field = res && res.field ? res.field : null;
        if (!field) return;
        const rating = field.rating != null ? field.rating : 0;
        const reviews = field.reviewCount != null ? field.reviewCount : 0;
        allFields.forEach(function(v) {
            if (String(v.id) === idStr) {
                v.rating = rating;
                v.reviews = reviews;
            }
        });
        document.querySelectorAll('.venue-card[data-venue-id="' + idStr + '"]').forEach(function(card) {
            var venue = allFields.find(function(v) { return String(v.id) === idStr; });
            if (venue) updateReviewRowForCard(card, venue);
        });
    } catch (_) {}
}

function consumeDirtyReviewFields() {
    try {
        const raw = localStorage.getItem(REVIEW_DIRTY_STORAGE_KEY);
        const ids = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(ids) || !ids.length) return [];
        localStorage.removeItem(REVIEW_DIRTY_STORAGE_KEY);
        return ids.map(String);
    } catch (_) {
        return [];
    }
}

// Toggle favorite status (API + local)
function toggleFavorite(venueId) {
    if (typeof API === 'undefined' || !API.getAuthToken || !API.getAuthToken()) {
        alert('Please log in to add favorites.');
        return;
    }
    var venueIdStr = String(venueId);
    var field = allFields.find(function(v) { return String(v.id) === venueIdStr; });
    if (!field) return;
    var isCurrentlyFavorite = field.isFavorite;
    var promise = isCurrentlyFavorite ? API.favorites.remove(venueId) : API.favorites.add(venueId);
    promise.then(function() {
        field.isFavorite = !field.isFavorite;
        var favoriteBtns = document.querySelectorAll('.favorite-btn[data-venue-id="' + venueId + '"]');
        favoriteBtns.forEach(function(btn) { btn.classList.toggle('active'); });
        saveFavoritesToStorage();
    }).catch(function(err) {
        alert(err.message || 'Failed to update favorite.');
    });
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

    // Profile popup (must live here — not inside updateFilterButtonText, or it never binds on first load)
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    if (profileBtn && profilePopup && profileBtn.getAttribute('data-mf-profile-init') !== '1') {
        profileBtn.setAttribute('data-mf-profile-init', '1');
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            var notificationPopup = document.getElementById('notificationPopup');
            if (notificationPopup) notificationPopup.classList.remove('active');
        });
        document.addEventListener('click', function(e) {
            if (profilePopup && profilePopup.classList.contains('active')) {
                if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
                    profilePopup.classList.remove('active');
                }
            }
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
            v.isFavorite = favorites.includes(String(v.id));
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
        
        updateStepDisplay();
        updateStepButtons();
    }
}

// Get player data from API auth
function getPlayerData() {
    if (typeof API === 'undefined') return null;
    var user = API.getCurrentUser && API.getCurrentUser();
    if (!user) return null;
    return {
        id: user.id,
        name: user.fullName || user.name || user.email,
        email: user.email
    };
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
    if (bookingState.currentStep !== 3) {
        setBookingModalOverflowForPlayerSearch(false);
    }

    switch (bookingState.currentStep) {
        case 2:
            loadTimeSlots();
            break;
        case 3:
            updatePlayersList();
            setBookingModalOverflowForPlayerSearch(true);
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

    const addPlayerBtn = document.getElementById('addPlayerBtn');
    const playerSearchInput = document.getElementById('playerSearchInput');

    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', addPlayer);
    }

    if (playerSearchInput) {
        playerSearchInput.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter' || e.isComposing) return;
            e.preventDefault();

            const resultsContainer = document.getElementById('playerSearchResults');
            const firstResult = resultsContainer
                ? resultsContainer.querySelector('.search-result-item')
                : null;

            if (firstResult) {
                const userData = JSON.parse(firstResult.dataset.user);
                addPlayerFromSearch(userData);
                if (resultsContainer) resultsContainer.style.display = 'none';
                playerSearchInput.value = '';
                selectedSearchUser = null;
                return;
            }

            addPlayer();
        });
    }

    setupPlayerSearch();
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
async function loadTimeSlots() {
    const container = document.getElementById('timeSlotsGrid');
    if (!container) return;

    const slots = [];
    let bookedSlots = [];
    let workingSlots = [];

    if (bookingState.selectedDate && bookingState.field && typeof API !== 'undefined') {
        try {
            container.innerHTML = '<p style="text-align: center; padding: 20px;">Loading availability...</p>';
            const availability = await API.fields.getAvailability(bookingState.field.id, bookingState.selectedDate);

            if (!availability.available && availability.lockedByOwner) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #dc3545;">
                        <i class="fi fi-rr-lock" style="font-size: 24px; display: block; margin-bottom: 10px;"></i>
                        <p>${availability.message || 'This field is not available on the selected date.'}</p>
                    </div>
                `;
                return;
            }

            if (!availability.available && availability.closedBySchedule) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #dc3545;">
                        <i class="fi fi-rr-calendar" style="font-size: 24px; display: block; margin-bottom: 10px;"></i>
                        <p>${availability.message || 'This field is closed on the selected day.'}</p>
                    </div>
                `;
                return;
            }

            bookedSlots = availability.bookedSlots || [];
            workingSlots = Array.isArray(availability.workingSlots) ? availability.workingSlots : [];
        } catch (error) {
            console.error('Failed to fetch availability:', error);
        }
    }

    const baseStarts = workingSlots.length
        ? workingSlots
        : (function () {
            const out = [];
            for (let hour = 9; hour < 22; hour++) {
                out.push(`${hour.toString().padStart(2, '0')}:00`);
            }
            return out;
        })();

    baseStarts.forEach(function (startTime) {
        const hour = parseInt(startTime.split(':')[0], 10);
        slots.push({
            start: startTime,
            end: `${(hour + 1).toString().padStart(2, '0')}:00`,
            available: true
        });
    });

    slots.forEach((slot) => {
        if (bookedSlots.includes(slot.start)) slot.available = false;
    });

    const nowForSlots = new Date();
    const todayYmdLocal = `${nowForSlots.getFullYear()}-${String(nowForSlots.getMonth() + 1).padStart(2, '0')}-${String(nowForSlots.getDate()).padStart(2, '0')}`;
    if (bookingState.selectedDate === todayYmdLocal) {
        const minHour = nowForSlots.getHours();
        slots.forEach((slot) => {
            const h = parseInt(String(slot.start).split(':')[0], 10);
            if (!Number.isNaN(h) && h < minHour) slot.available = false;
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
    const organizerName = document.getElementById('organizerName');

    if (organizerName && bookingState.organizer) {
        organizerName.textContent = `${bookingState.organizer.name} (You)`;
    }

    if (!container) return;
    
    if (bookingState.players.length === 0) {
        container.innerHTML = '<p class="no-players">No players added yet. Add players by username.</p>';
        return;
    }
    
    container.innerHTML = bookingState.players.map((player, index) => `
        <div class="player-item">
            <div class="player-info">
                <i class="fi fi-rr-user"></i>
                <span>${player.name}</span>
                <span class="player-id">ID: ${player.playerCode || player.id}</span>
            </div>
            <button class="remove-player-btn" data-index="${index}">
                <i class="fi fi-rr-cross-small"></i>
            </button>
        </div>
    `).join('');

    container.querySelectorAll('.remove-player-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index, 10);
            bookingState.players.splice(index, 1);
            updatePlayersList();
            updateCostSplit();
        });
    });
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

let searchTimeout = null;
let selectedSearchUser = null;
let latestSearchRequestId = 0;

function setBookingModalOverflowForPlayerSearch(enableVisibleOverflow) {
    const modalBody = document.querySelector('.booking-modal-body');
    const step3 = document.getElementById('step3');
    if (modalBody) {
        modalBody.style.overflow = enableVisibleOverflow ? 'visible' : '';
    }
    if (step3) {
        step3.style.overflow = enableVisibleOverflow ? 'visible' : '';
    }
}

function normalizePlayerSearchQuery(query) {
    const trimmed = String(query || '').trim();
    if (/^plr-/i.test(trimmed)) return trimmed.toUpperCase();
    return trimmed;
}

function getPlayerSearchMinLength(query) {
    const q = normalizePlayerSearchQuery(query);
    if (/^PLR-/i.test(q) || /^[a-fA-F0-9]+$/.test(q)) return 4;
    return 2;
}

function getOrCreatePlayerSearchResultsContainer() {
    const input = document.getElementById('playerSearchInput');
    if (!input) return null;

    let resultsContainer = document.getElementById('playerSearchResults');
    if (resultsContainer) return resultsContainer;

    const parent = input.parentElement;
    if (!parent) return null;

    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === 'static') {
        parent.style.position = 'relative';
    }

    resultsContainer = document.createElement('div');
    resultsContainer.id = 'playerSearchResults';
    resultsContainer.className = 'search-results-dropdown';
    resultsContainer.style.display = 'none';
    resultsContainer.style.position = 'absolute';
    resultsContainer.style.top = '100%';
    resultsContainer.style.left = '0';
    resultsContainer.style.right = '0';
    resultsContainer.style.background = 'white';
    resultsContainer.style.border = '1px solid #e0e0e0';
    resultsContainer.style.borderRadius = '8px';
    resultsContainer.style.maxHeight = '200px';
    resultsContainer.style.overflowY = 'auto';
    resultsContainer.style.zIndex = '10050';
    resultsContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

    parent.appendChild(resultsContainer);
    return resultsContainer;
}

function setupPlayerSearch() {
    const input = document.getElementById('playerSearchInput');
    const resultsContainer = getOrCreatePlayerSearchResultsContainer();

    if (!input || !resultsContainer) return;

    input.addEventListener('input', function() {
        const query = normalizePlayerSearchQuery(this.value);
        selectedSearchUser = null;

        if (searchTimeout) clearTimeout(searchTimeout);

        if (query.length < getPlayerSearchMinLength(query)) {
            resultsContainer.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(() => {
            searchUsers(query);
        }, 300);
    });

    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.style.display = 'none';
        }
    });
}

async function searchUsers(query) {
    const resultsContainer = getOrCreatePlayerSearchResultsContainer();
    if (!resultsContainer) return;

    const normalizedQuery = normalizePlayerSearchQuery(query);

    if (typeof API === 'undefined' || !API.users || !API.users.search) {
        resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #dc3545;">Search is currently unavailable.</div>';
        resultsContainer.style.display = 'block';
        return [];
    }

    const requestId = ++latestSearchRequestId;

    try {
        resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #666;">Searching...</div>';
        resultsContainer.style.display = 'block';

        const response = await API.users.search(normalizedQuery, { playersOnly: true });
        if (requestId !== latestSearchRequestId) return [];

        const users = response.users || [];
        const currentUser = API.getCurrentUser();
        const filteredUsers = users.filter(user => {
            if (user.role !== 'PLAYER') return false;
            if (currentUser && String(user.id) === String(currentUser.id)) return false;
            if (bookingState.players.some(p => String(p.id) === String(user.id))) return false;
            return true;
        });

        if (filteredUsers.length === 0) {
            const onlySelfMatch = users.some(user =>
                currentUser && String(user.id) === String(currentUser.id)
            );
            resultsContainer.innerHTML = onlySelfMatch
                ? '<div style="padding: 12px; text-align: center; color: #666;">You cannot add yourself. Search for another player\'s ID.</div>'
                : '<div style="padding: 12px; text-align: center; color: #666;">No players found. Use the Player ID from their profile (PLR-...).</div>';
            resultsContainer.style.display = 'block';
            return [];
        }

        resultsContainer.innerHTML = filteredUsers.map(user => `
            <div class="search-result-item" data-user='${JSON.stringify(user).replace(/'/g, "&#39;")}'
                 style="display: flex; align-items: center; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;"
                 onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin-right: 10px; overflow: hidden;">
                    ${user.avatar
                        ? `<img src="${user.avatar}" style="width: 100%; height: 100%; object-fit: cover;">`
                        : `<i class="fi fi-rr-user" style="color: #666;"></i>`}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 500; color: #333;">${user.fullName}</div>
                    <div style="font-size: 12px; color: #666;">${user.playerCode || user.id}</div>
                </div>
                <i class="fi fi-rr-plus" style="color: #007bff;"></i>
            </div>
        `).join('');

        resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function() {
                const userData = JSON.parse(this.dataset.user);
                addPlayerFromSearch(userData);
                resultsContainer.style.display = 'none';
                document.getElementById('playerSearchInput').value = '';
            });
        });
        return filteredUsers;
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #dc3545;">Search failed. Try again.</div>';
        resultsContainer.style.display = 'block';
        return [];
    }
}

function addPlayerFromSearch(user) {
    if (!user || user.role !== 'PLAYER') {
        alert('Only players can be added to a booking. Field owners and admins cannot be invited as players.');
        return;
    }

    if (bookingState.players.some(p => p.id === user.id)) {
        alert('This player is already added.');
        return;
    }

    bookingState.players.push({
        id: user.id,
        name: user.fullName,
        email: user.email,
        avatar: user.avatar,
        playerCode: user.playerCode || null
    });
    updatePlayersList();
    updateCostSplit();
}

async function addPlayer() {
    const input = document.getElementById('playerSearchInput');
    const resultsContainer = getOrCreatePlayerSearchResultsContainer();
    if (!input) return;

    const searchValue = normalizePlayerSearchQuery(input.value);
    if (!searchValue) {
        alert('Please enter a username, email, or Player ID to search.');
        return;
    }

    if (selectedSearchUser) {
        addPlayerFromSearch(selectedSearchUser);
        input.value = '';
        selectedSearchUser = null;
        if (resultsContainer) resultsContainer.style.display = 'none';
        return;
    }

    if (searchValue.length >= getPlayerSearchMinLength(searchValue)) {
        const results = await searchUsers(searchValue);
        if (!results || results.length === 0) {
            alert('No players found. Try searching by name, email, Player ID (PLR-...), or account ID.');
            return;
        }

        if (results.length === 1) {
            addPlayerFromSearch(results[0]);
            input.value = '';
            if (resultsContainer) resultsContainer.style.display = 'none';
            return;
        }

        alert('Multiple players found. Please select one from the list.');
    } else {
        alert('Please enter at least 4 characters for a Player ID or account ID, or 2 characters for a name.');
    }
}

function confirmBooking() {
    alert('Booking functionality would be implemented here. Redirecting to bookings page...');
    closeBookingModal();
    setTimeout(() => {
        window.location.href = 'bookings.html';
    }, 1000);
}

