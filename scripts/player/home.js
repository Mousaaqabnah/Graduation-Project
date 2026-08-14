// Venue data loaded from API (full lists for current location; homepage shows first 6 per section)
const venues = { popular: [], nearby: [] };
const HOME_SECTION_PREVIEW_LIMIT = 6;
/** Match routes/fields.js parsePositiveIntOr max for list endpoints */
const HOME_SECTION_FETCH_LIMIT = 48;
const DEFAULT_LOCATION = (typeof MatchFieldGeo !== 'undefined' && MatchFieldGeo.DEFAULT_LOCATION)
  ? Object.assign({}, MatchFieldGeo.DEFAULT_LOCATION)
  : { name: 'Ramallah', lat: 31.9038, lng: 35.2034, source: 'default' };
const LOCATION_STORAGE_KEY = 'playerSelectedLocation';
const LOCATION_OPTIONS = [
  { name: DEFAULT_LOCATION.name, lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng }
];
let activeLocation = null;
let currentPageBySection = { nearby: 1, popular: 1 };
/** Last successful favorites.getAll() ids (never derived from field lat/lng). */
let lastApiFavoriteIdsForHome = [];
const REVIEW_DIRTY_STORAGE_KEY = 'matchfieldReviewDirtyFields';

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Display-only money formatting from user currency preference (no FX conversion). */
function mfMoney(amount) {
  if (typeof MatchFieldPrefs !== 'undefined' && MatchFieldPrefs.formatMoney) {
    return MatchFieldPrefs.formatMoney(amount);
  }
  return '₪' + String(amount == null ? 0 : amount);
}

function mfCurrencySymbol() {
  if (typeof MatchFieldPrefs !== 'undefined' && MatchFieldPrefs.currencySymbol) {
    return MatchFieldPrefs.currencySymbol();
  }
  return '₪';
}

function safeUrlAttr(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:|\/|data:image\/)/i.test(raw) && !/^javascript:/i.test(raw)) {
    return escapeHtml(raw);
  }
  return '';
}

function getFavoriteIdsSet() {
  try {
    const saved = localStorage.getItem('favoriteVenues');
    const parsed = saved ? JSON.parse(saved) : [];
    return new Set((Array.isArray(parsed) ? parsed : []).map(String));
  } catch (_) {
    return new Set();
  }
}

function persistFavoriteIdsSet(set) {
  const favorites = Array.from(set);
  localStorage.setItem('favoriteVenues', JSON.stringify(favorites));
  try {
    window.dispatchEvent(new CustomEvent('matchfield:favorites-updated', { detail: { favorites: favorites } }));
  } catch (_) {}
}

function applyFavoriteIdsToVenueState(favoriteIds) {
  const set = new Set((favoriteIds || []).map(String));
  venues.popular.forEach(function(v) { v.isFavorite = set.has(String(v.id)); });
  venues.nearby.forEach(function(v) { v.isFavorite = set.has(String(v.id)); });
}

function syncFavoriteButtonsFromState() {
  const popularRoot = document.getElementById('popularVenues');
  const nearbyRoot = document.getElementById('nearbyVenues');
  var buttons;
  if (popularRoot && nearbyRoot) {
    buttons = [].slice.call(popularRoot.querySelectorAll('.favorite-btn[data-venue-id]')).concat(
      [].slice.call(nearbyRoot.querySelectorAll('.favorite-btn[data-venue-id]'))
    );
  } else {
    buttons = [].slice.call(document.querySelectorAll('.favorite-btn[data-venue-id]'));
  }
  buttons.forEach(function(btn) {
    const id = String(btn.getAttribute('data-venue-id') || '');
    const venue = venues.popular.find(function(v) { return String(v.id) === id; })
      || venues.nearby.find(function(v) { return String(v.id) === id; });
    btn.classList.toggle('active', !!(venue && venue.isFavorite));
  });
}

function updateReviewRowForCard(card, venue) {
  const reviewSpan = card.querySelector('.venue-rating span:last-child');
  if (!reviewSpan) return;
  reviewSpan.textContent = venue.rating + ' (' + venue.reviews + ') . ' + venue.location + ' . ' + venue.distance;
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
    venues.popular.forEach(function(v) { if (String(v.id) === idStr) { v.rating = rating; v.reviews = reviews; } });
    venues.nearby.forEach(function(v) { if (String(v.id) === idStr) { v.rating = rating; v.reviews = reviews; } });
    document.querySelectorAll('.venue-card[data-venue-id="' + idStr + '"]').forEach(function(card) {
      const venue = venues.popular.find(function(v) { return String(v.id) === idStr; }) || venues.nearby.find(function(v) { return String(v.id) === idStr; });
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

function mapFieldToVenue(field, favoriteIdSet) {
  var id = String(field.id);
  var images = field.images && field.images.length ? field.images : [];
  var img = images[0] || 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop&auto=format';
  var favSet = favoriteIdSet instanceof Set ? favoriteIdSet : new Set((favoriteIdSet || []).map(String));
  return {
    id: id,
    name: field.name,
    sport: field.sport || '',
    image: img,
    rating: field.rating != null ? field.rating : 0,
    reviews: field.reviewCount != null ? field.reviewCount : 0,
    location: field.location || '',
    distance: field.distanceKm != null ? t('player.distanceKm', { km: field.distanceKm.toFixed(1) }) : t('common.na'),
    distanceKm: field.distanceKm != null && Number.isFinite(Number(field.distanceKm)) ? Number(field.distanceKm) : null,
    type: (field.type || 'OUTDOOR').toLowerCase(),
    price: field.pricePerHour != null ? field.pricePerHour : 0,
    isFavorite: favSet.has(id)
  };
}

function saveSelectedLocation(loc) {
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
  } catch (_) {}
}

function readSelectedLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) return parsed;
  } catch (_) {}
  return null;
}

function updateLocationLabel() {
  var label = document.querySelector('.location-selector span');
  if (label && activeLocation) label.textContent = activeLocation.name || t('geo.selectedLocation');
}

function getCurrentCoords() {
  if (!activeLocation) return null;
  return { lat: activeLocation.lat, lng: activeLocation.lng };
}

function resolveActiveLocation() {
  const saved = readSelectedLocation();
  if (saved) {
    activeLocation = { ...saved, source: 'selected' };
    return Promise.resolve(activeLocation);
  }
  return new Promise(function(resolve) {
    if (!navigator.geolocation) {
      activeLocation = { ...DEFAULT_LOCATION };
      return resolve(activeLocation);
    }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        activeLocation = {
          name: t('geo.myLocation'),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: 'geolocation'
        };
        resolve(activeLocation);
      },
      function() {
        activeLocation = { ...DEFAULT_LOCATION };
        resolve(activeLocation);
      },
      { timeout: 6000, enableHighAccuracy: true }
    );
  });
}

function getFavoriteIdsFromResponse(favRes) {
  return (favRes && favRes.favorites)
    ? favRes.favorites
      .map(function(f) { return String(f.fieldId || (f.field && f.field.id) || ''); })
      .filter(Boolean)
    : [];
}

/**
 * Load the user's favorite field ids from the API only (no map coordinates).
 * When logged in, mirrors the result to localStorage so hearts never depend on which lat/lng loaded fields.
 */
function fetchFavoriteIdsForHome() {
  if (typeof API === 'undefined' || !API.getAuthToken || !API.getAuthToken()) {
    lastApiFavoriteIdsForHome = [];
    return Promise.resolve(new Set(Array.from(getFavoriteIdsSet())));
  }
  return API.favorites.getAll()
    .then(function(favRes) {
      const apiIds = getFavoriteIdsFromResponse(favRes);
      lastApiFavoriteIdsForHome = apiIds.slice();
      persistFavoriteIdsSet(new Set(lastApiFavoriteIdsForHome));
      return new Set(lastApiFavoriteIdsForHome);
    })
    .catch(function() {
      lastApiFavoriteIdsForHome = Array.from(getFavoriteIdsSet());
      return new Set(lastApiFavoriteIdsForHome);
    });
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

function loadSectionDataWithLocation(section, favoriteIdSet, page) {
  if (typeof API === 'undefined' || !API.fields || !activeLocation) return Promise.resolve([]);
  const baseParams = {
    lat: activeLocation.lat,
    lng: activeLocation.lng,
    page: page || 1,
    limit: HOME_SECTION_FETCH_LIMIT
  };
  const req = section === 'nearby'
    ? API.fields.getNearby({ ...baseParams, radiusKm: 35 })
    : API.fields.getPopularNow({ ...baseParams });
  return req.then(function(res) {
    const fields = (res && res.fields) ? res.fields : [];
    const mapped = fields.map(function(f) { return mapFieldToVenue(f, favoriteIdSet); });
    return dedupeVenues(mapped);
  });
}

function loadVenuesFromAPI() {
  return fetchFavoriteIdsForHome().then(function(favoriteIdSet) {
    return Promise.all([
      loadSectionDataWithLocation('popular', favoriteIdSet, currentPageBySection.popular),
      loadSectionDataWithLocation('nearby', favoriteIdSet, currentPageBySection.nearby)
    ]).then(function(results) {
      venues.popular = results[0];
      venues.nearby = results[1];
      return venues;
    });
  });
}

function refreshHomepageByLocation() {
  currentPageBySection = { nearby: 1, popular: 1 };
  return loadVenuesFromAPI().then(function() {
    loadFavoritesFromStorage();
    updateLocationLabel();
    renderVenues('popular', venues.popular);
    renderVenues('nearby', venues.nearby);
  });
}

function chooseLocationFromSelector(option) {
  if (option === 'my-location') {
    return new Promise(function(resolve) {
      if (!navigator.geolocation) return resolve();
      navigator.geolocation.getCurrentPosition(function(pos) {
        activeLocation = {
          name: t('geo.myLocation'),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: 'selected'
        };
        saveSelectedLocation(activeLocation);
        refreshHomepageByLocation().finally(resolve);
      }, function() { resolve(); }, { timeout: 6000, enableHighAccuracy: true });
    });
  }
  activeLocation = { ...LOCATION_OPTIONS[0], source: 'selected' };
  saveSelectedLocation(activeLocation);
  return refreshHomepageByLocation();
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  const hasHomeSections = !!(document.getElementById('popularVenues') && document.getElementById('nearbyVenues'));
  if (!hasHomeSections) {
    // home.js is also loaded on other player pages for shared booking utilities.
    setupEventListeners();
    initializeBookingModal();
    initializePaymentModal();
    return;
  }

  function initUI() {
    updateLocationLabel();
    renderVenues('popular', venues.popular);
    renderVenues('nearby', venues.nearby);
    setupEventListeners();
    initializeBookingModal();
    initializePaymentModal();
    handleInviteLink();
    var allCards = document.querySelectorAll('#popularVenues .venue-card, #nearbyVenues .venue-card');
    allCards.forEach(function(card) { card.style.display = 'block'; });
  }
  resolveActiveLocation()
    .then(function() { return loadVenuesFromAPI(); })
    .then(function() {
      loadFavoritesFromStorage();
      initUI();
    })
    .catch(function(err) {
      console.error('Error loading fields:', err);
      loadFavoritesFromStorage();
      initUI();
    });
});

// Handle invite link from URL
function handleInviteLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const inviteFieldId = urlParams.get('invite');
  const organizerId = urlParams.get('organizer');
  
  if (inviteFieldId && organizerId) {
    // Find the venue by ID
    const allVenues = [...venues.popular, ...venues.nearby];
    const venue = allVenues.find(v => v.id.toString() === inviteFieldId);
    
    if (venue) {
      // Show invitation message
      setTimeout(async () => {
        if (await MatchFieldDialog.confirm(t('booking.invitedToBook', { name: venue.name }), {
          type: 'info',
          okText: t('booking.viewBooking')
        })) {
          openBookingModal(venue);
        }
      }, 500);
    }
  }
}

// Handle image loading errors - defined globally so it can be called from inline onerror
window.handleImageError = function(img, sportName) {
  if (img && !img.dataset.errorHandled) {
      img.dataset.errorHandled = 'true'; // Prevent infinite loop
      const svg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext fill='%236b7280' font-family='sans-serif' font-size='18' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E${encodeURIComponent(sportName)}%3C/text%3E%3C/svg%3E`;
      img.src = svg;
  }
}

/** Ordered list for homepage grid: popular = API popularity order; nearby = nearest first */
function getVenuesForHomepagePreview(containerId, venueList) {
  var list = Array.isArray(venueList) ? venueList.slice() : [];
  if (containerId === 'nearby') {
    list.sort(function (a, b) {
      var da = a && a.distanceKm != null ? a.distanceKm : 1e9;
      var db = b && b.distanceKm != null ? b.distanceKm : 1e9;
      return da - db;
    });
  }
  return list.slice(0, HOME_SECTION_PREVIEW_LIMIT);
}

// Render venue cards (homepage sections only show first HOME_SECTION_PREVIEW_LIMIT)
function renderVenues(containerId, venueList) {
  const containerName = containerId === 'popular' ? 'popularVenues' : 'nearbyVenues';
  const container = document.getElementById(containerName);
  
  if (!container) {
      console.error('Container not found:', containerName);
      return;
  }
  
  container.innerHTML = '';
  const toShow = (containerId === 'popular' || containerId === 'nearby')
    ? getVenuesForHomepagePreview(containerId, venueList)
    : (venueList || []);

  toShow.forEach(venue => {
      try {
          const card = createVenueCard(venue);
          container.appendChild(card);
      } catch (error) {
          console.error('Error creating card for venue:', venue, error);
      }
  });
}

// Create a venue card element
function createVenueCard(venue) {
  const card = document.createElement('div');
  card.className = 'venue-card';
  card.dataset.venueId = venue.id;
  card.dataset.sport = venue.sport.toLowerCase();
  
  card.innerHTML = `
      <div class="venue-image-container">
          <img src="${safeUrlAttr(venue.image)}" alt="${escapeHtml(venue.name)}" class="venue-image" loading="lazy" onerror="window.handleImageError(this, '${escapeHtml(venue.sport)}');">
          <div class="sport-badge">${escapeHtml((window.MatchFieldI18n && MatchFieldI18n.sportLabel(venue.sport)) || venue.sport || '')}</div>
          <button class="favorite-btn ${venue.isFavorite ? 'active' : ''}" data-venue-id="${escapeHtml(venue.id)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
          </button>
      </div>
      <div class="venue-card-content">
          <div class="venue-header">
              <h3 class="venue-name">${escapeHtml(venue.name)}</h3>
              <span class="venue-price">${escapeHtml(mfMoney(venue.price))}${t('common.perHour')}</span>
          </div>
          <div class="venue-rating">
              <span class="star">★</span>
              <span>${escapeHtml(venue.rating)} (${escapeHtml(venue.reviews)}) . ${escapeHtml(venue.location)} . ${escapeHtml(venue.distance)}</span>
          </div>
          <div class="venue-footer-row">
              <span class="venue-type">${escapeHtml((window.MatchFieldI18n && MatchFieldI18n.sportLabel(venue.type)) || venue.type)}</span>
              <button class="book-btn">${t('player.bookShort')}</button>
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
      // Navigate to venue details page
      window.location.href = `field-info.html?id=${venue.id}`;
  });
  
  return card;
}

// Toggle favorite status (API + local state)
function toggleFavorite(venueId) {
  if (typeof API === 'undefined' || !API.getAuthToken()) {
    alert(t('player.pleaseLoginFavorites'));
    return;
  }
  var venueIdStr = String(venueId);
  var popularVenue = venues.popular.find(function(v) { return String(v.id) === venueIdStr; });
  var nearbyVenue = venues.nearby.find(function(v) { return String(v.id) === venueIdStr; });
  var isCurrentlyFavorite = (popularVenue && popularVenue.isFavorite) || (nearbyVenue && nearbyVenue.isFavorite);
  var promise = isCurrentlyFavorite ? API.favorites.remove(venueIdStr) : API.favorites.add(venueIdStr);
  promise.then(function() {
    venues.popular.forEach(function(v) { if (String(v.id) === venueIdStr) v.isFavorite = !isCurrentlyFavorite; });
    venues.nearby.forEach(function(v) { if (String(v.id) === venueIdStr) v.isFavorite = !isCurrentlyFavorite; });
    var favoriteButtons = document.querySelectorAll('.favorite-btn[data-venue-id="' + venueIdStr + '"]');
    favoriteButtons.forEach(function(btn) { btn.classList.toggle('active', !isCurrentlyFavorite); });
    const set = getFavoriteIdsSet();
    if (!isCurrentlyFavorite) set.add(venueIdStr);
    else set.delete(venueIdStr);
    persistFavoriteIdsSet(set);
  }).catch(function(err) {
    alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err.message)) || t('player.favoriteFailed'));
  });
}

// Handle book button click
function handleBookClick(venue) {
  openBookingModal(venue);
}

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
  mixedPaymentDistribution: {} // { playerId: amount }
};

// Open booking modal
function openBookingModal(venue) {
  // Check authentication
  const playerData = getPlayerData();
  if (!playerData) {
    alert(t('player.pleaseLoginBook'));
    window.location.href = '../auth/login.html';
    return;
  }
  
  // Ensure booking modal is initialized (for field-info page)
  if (typeof initializeBookingModal === 'function') {
    const modal = document.getElementById('bookingModal');
    if (modal && !modal.dataset.initialized) {
      initializeBookingModal();
      if (typeof initializePaymentModal === 'function') {
        initializePaymentModal();
      }
      modal.dataset.initialized = 'true';
    }
  }

  // Initialize booking state
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

  // Show modal
  const modal = document.getElementById('bookingModal');
  modal.classList.add('active');

  // Populate field details
  populateFieldDetails(venue);
  
  // Set minimum date to today
  const dateInput = document.getElementById('bookingDate');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
  }

  // Initialize step navigation
  updateStepDisplay();
  
  // Ensure buttons are properly displayed
  updateStepButtons();
}

// Get player data from API auth (currentUser set on login)
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

// Populate field details in step 1
function populateFieldDetails(venue) {
  const container = document.getElementById('fieldDetailsPreview');
  if (!container) return;

  container.innerHTML = `
    <div class="field-preview-card">
      <img src="${safeUrlAttr(venue.image)}" alt="${escapeHtml(venue.name)}" class="field-preview-image">
      <div class="field-preview-info">
        <h4>${escapeHtml(venue.name)}</h4>
        <div class="field-preview-meta">
          <span><i class="fi fi-rr-marker"></i> ${escapeHtml(venue.location)}</span>
          <span><i class="fi fi-rs-star"></i> ${escapeHtml(venue.rating)} (${escapeHtml(venue.reviews)})</span>
          <span><i class="fi fi-rr-tag"></i> ${escapeHtml((window.MatchFieldI18n && MatchFieldI18n.sportLabel(venue.sport)) || venue.sport || '')}</span>
        </div>
        <div class="field-preview-price">
          <span>${t('booking.priceLabel')} <strong>${escapeHtml(mfMoney(venue.price))}${t('common.perHourLong')}</strong></span>
        </div>
      </div>
    </div>
  `;
}

// Update step display
function updateStepDisplay() {
  // Hide all steps
  for (let i = 1; i <= bookingState.totalSteps; i++) {
    const step = document.getElementById(`step${i}`);
    if (step) {
      step.classList.remove('active');
    }
  }

  // Show current step
  const currentStep = document.getElementById(`step${bookingState.currentStep}`);
  if (currentStep) {
    currentStep.classList.add('active');
  }

  // Load step-specific content
  loadStepContent();
  
  // Update button visibility based on step
  updateStepButtons();
}

// Update step buttons visibility
function updateStepButtons() {
  const nextBtn = document.getElementById('nextStepBtn');
  const submitPaymentBtn = document.getElementById('submitPaymentBtn');
  const confirmBtn = document.getElementById('confirmBookingBtn');
  const prevBtn = document.getElementById('prevStepBtn');
  
  // Update previous button
  if (prevBtn) {
    prevBtn.style.display = bookingState.currentStep > 1 ? 'block' : 'none';
  }
  
  // Hide all action buttons first
  if (nextBtn) nextBtn.style.display = 'none';
  if (submitPaymentBtn) submitPaymentBtn.style.display = 'none';
  if (confirmBtn) confirmBtn.style.display = 'none';
  
  // Show appropriate button based on step
  if (bookingState.currentStep < bookingState.totalSteps) {
    if (bookingState.currentStep === 5) {
      // Payment step - show submit payment button
      if (submitPaymentBtn) {
        submitPaymentBtn.style.display = 'flex';
      } else {
        // Fallback to next button if submit button doesn't exist
        if (nextBtn) nextBtn.style.display = 'block';
      }
    } else {
      // Regular step - show next button
      if (nextBtn) {
        nextBtn.style.display = 'block';
      }
    }
  } else {
    // Last step - show confirm button
    if (confirmBtn) {
      confirmBtn.style.display = 'block';
    } else {
      // Fallback to next button if confirm button doesn't exist
      if (nextBtn) nextBtn.style.display = 'block';
    }
  }
}

// Load content for current step
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

// Load payment step content
function loadPaymentStep() {
  // Calculate amount based on payment method
  let paymentAmount = 0;
  let paymentLabel = '';
  
  if (bookingState.paymentMethod === 'organizer') {
    // Organizer pays full amount
    paymentAmount = bookingState.totalCost;
    paymentLabel = t('booking.fullAmount');
  } else if (bookingState.paymentMethod === 'split') {
    // Organizer pays their share
    const totalPlayers = bookingState.players.length + 1; // +1 for organizer
    paymentAmount = Math.round(bookingState.totalCost / totalPlayers);
    paymentLabel = t('booking.yourShare');
  } else if (bookingState.paymentMethod === 'mixed') {
    // Organizer pays their assigned amount from mixed payment
    paymentAmount = bookingState.mixedPaymentDistribution['organizer'] || 0;
    paymentLabel = t('booking.yourAssigned');
    
    // Validate mixed payment distribution
    const totalAssigned = Object.values(bookingState.mixedPaymentDistribution).reduce((sum, amount) => sum + amount, 0);
    if (Math.abs(totalAssigned - bookingState.totalCost) > 0.01) {
      alert(t('booking.distributionMismatch', { money: mfMoney(bookingState.totalCost), assigned: mfMoney(totalAssigned.toFixed(2)) }));
      return;
    }
  }
  
  // Populate payment summary
  const summary = document.getElementById('paymentInfoSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="payment-summary">
        <div class="payment-amount">
          <span class="amount-label">${t('booking.labelToPay', { label: paymentLabel })}</span>
          <span class="amount-value">${escapeHtml(mfMoney(paymentAmount))}</span>
        </div>
        ${bookingState.paymentMethod === 'split' ? `
          <div class="payment-note">
            <i class="fi fi-rr-info"></i>
            <span>${t('booking.splitNote')}</span>
          </div>
        ` : ''}
        <div class="payment-details">
          <p><strong>${escapeHtml(bookingState.field.name)}</strong></p>
          <p>${escapeHtml(formatDate(bookingState.selectedDate))}</p>
          <p>${bookingState.selectedTimeSlots.map(slot => {
            const hour = parseInt(slot.split(':')[0]);
            return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
          }).join(', ')}</p>
        </div>
      </div>
    `;
  }
  
  // Store payment amount for later use
  bookingState.paymentAmount = paymentAmount;
  
  // Initialize payment form formatting
  initializePaymentFormFormatting();
}

// Load available time slots
async function loadTimeSlots() {
  const container = document.getElementById('timeSlotsGrid');
  if (!container) {
    console.error('Time slots container not found');
    return;
  }
  
  if (!bookingState.field) {
    console.error('Field data not available');
    return;
  }

  // Fetch real availability from API if a date is selected
  const slots = [];
  let bookedSlots = [];
  let workingSlots = [];
  let dayLocked = false;
  
  if (bookingState.selectedDate && typeof API !== 'undefined') {
    try {
      container.innerHTML = '<p style="text-align: center; padding: 20px;">' + t('booking.loadingAvailability') + '</p>';
      console.log('Fetching availability for field:', bookingState.field.id, 'date:', bookingState.selectedDate);
      const availability = await API.fields.getAvailability(bookingState.field.id, bookingState.selectedDate);
      console.log('Availability response:', availability);
      
      if (!availability.available && availability.lockedByOwner) {
        // Entire day is locked by owner
        dayLocked = true;
        container.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #dc3545;">
            <i class="fi fi-rr-lock" style="font-size: 24px; display: block; margin-bottom: 10px;"></i>
            <p>${escapeHtml((availability.message && window.MatchFieldI18n && MatchFieldI18n.localizeError(availability.message)) || t('booking.notAvailableDate'))}</p>
          </div>
        `;
        return;
      }

      if (!availability.available && availability.closedBySchedule) {
        container.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #dc3545;">
            <i class="fi fi-rr-calendar" style="font-size: 24px; display: block; margin-bottom: 10px;"></i>
            <p>${escapeHtml((availability.message && window.MatchFieldI18n && MatchFieldI18n.localizeError(availability.message)) || t('booking.closedDay'))}</p>
          </div>
        `;
        return;
      }
      
      bookedSlots = availability.bookedSlots || [];
      workingSlots = Array.isArray(availability.workingSlots) ? availability.workingSlots : [];
      console.log('Booked slots:', bookedSlots);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      // Continue with all slots available if API fails
    }
  }

  const baseSlots = workingSlots.length
    ? workingSlots
    : Array.from({ length: 13 }, function (_, i) {
        const hour = 9 + i;
        return `${hour.toString().padStart(2, '0')}:00`;
      });

  baseSlots.forEach(function(startTime) {
    const hour = parseInt(startTime.split(':')[0], 10);
    slots.push({
      start: startTime,
      end: `${(hour + 1).toString().padStart(2, '0')}:00`,
      available: true
    });
  });

  // Mark booked slots as unavailable
  slots.forEach(slot => {
    if (bookedSlots.includes(slot.start)) {
      slot.available = false;
    }
  });

  // Same calendar day: cannot book slots starting before the current hour (local)
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

  // Add click handlers
  container.querySelectorAll('.time-slot:not(.unavailable)').forEach(btn => {
    btn.addEventListener('click', function() {
      const start = this.dataset.start;
      const end = this.dataset.end;
      
      // Toggle selection
      if (this.classList.contains('selected')) {
        this.classList.remove('selected');
        bookingState.selectedTimeSlots = bookingState.selectedTimeSlots.filter(t => t !== start);
      } else {
        this.classList.add('selected');
        bookingState.selectedTimeSlots.push(start);
      }
      
      // Update cost
      updateBookingCost();
    });
  });
}

// Update booking cost
function updateBookingCost() {
  if (!bookingState.field) return;

  const hours = bookingState.selectedTimeSlots.length;
  bookingState.totalCost = bookingState.field.price * hours;
  
  updateCostSplit();
}

// Update players list
function updatePlayersList() {
  const container = document.getElementById('playersList');
  const organizerName = document.getElementById('organizerName');
  
  if (organizerName && bookingState.organizer) {
    organizerName.textContent = bookingState.organizer.name + t('booking.youSuffix');
  }

  if (!container) return;

  if (bookingState.players.length === 0) {
    container.innerHTML = '<p class="no-players">' + t('booking.noPlayersYet') + '</p>';
    return;
  }

  container.innerHTML = bookingState.players.map((player, index) => `
    <div class="player-item" style="display: flex; align-items: center; padding: 10px 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
      <div class="player-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin-right: 12px; overflow: hidden;">
        ${player.avatar 
          ? `<img src="${player.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` 
          : `<i class="fi fi-rr-user" style="color: #666;"></i>`}
      </div>
      <div class="player-info" style="flex: 1;">
        <div style="font-weight: 500; color: #333;">${escapeHtml(player.name)}</div>
      </div>
      <div class="player-payment-status" style="margin-right: 12px; padding: 4px 8px; background: #fff3cd; color: #856404; border-radius: 4px; font-size: 12px;">
        <i class="fi fi-rr-clock" style="font-size: 10px;"></i> ${t('status.paymentPending')}
      </div>
      <button class="remove-player-btn" data-index="${index}" style="background: none; border: none; color: #dc3545; cursor: pointer; padding: 4px;">
        <i class="fi fi-rr-cross-small"></i>
      </button>
    </div>
  `).join('');

  // Add remove handlers
  container.querySelectorAll('.remove-player-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.dataset.index);
      bookingState.players.splice(index, 1);
      updatePlayersList();
      updateCostSplit();
    });
  });
}

// Update cost split display
function updateCostSplit() {
  const totalCostEl = document.getElementById('totalCost');
  const playerCountEl = document.getElementById('playerCount');
  const costPerPlayerEl = document.getElementById('costPerPlayer');

  const totalPlayers = bookingState.players.length + 1; // +1 for organizer
  const costPerPlayer = totalPlayers > 0 ? Math.round(bookingState.totalCost / totalPlayers) : bookingState.totalCost;

  if (totalCostEl) totalCostEl.textContent = mfMoney(bookingState.totalCost);
  if (playerCountEl) playerCountEl.textContent = totalPlayers;
  if (costPerPlayerEl) costPerPlayerEl.textContent = mfMoney(costPerPlayer);
  
  // Update mixed payment if active
  if (bookingState.paymentMethod === 'mixed') {
    updateMixedPaymentConfig();
  }
}

// Update mixed payment configuration
function updateMixedPaymentConfig() {
  const configContainer = document.getElementById('mixedPaymentConfig');
  const totalDisplay = document.getElementById('mixedPaymentTotal');
  const paymentList = document.getElementById('mixedPaymentList');
  
  if (!configContainer || !totalDisplay || !paymentList) return;
  
  // Show/hide based on payment method
  configContainer.style.display = bookingState.paymentMethod === 'mixed' ? 'block' : 'none';
  
  // Update total display
  totalDisplay.textContent = bookingState.totalCost;
  
  // Clear existing list
  paymentList.innerHTML = '';
  
  // Add organizer payment input
  const organizerItem = createMixedPaymentItem('organizer', bookingState.organizer.name, bookingState.mixedPaymentDistribution['organizer'] || 0, true);
  paymentList.appendChild(organizerItem);
  
  // Add player payment inputs
  bookingState.players.forEach(player => {
    const playerItem = createMixedPaymentItem(player.id, player.name, bookingState.mixedPaymentDistribution[player.id] || 0, false);
    paymentList.appendChild(playerItem);
  });
  
  // Update summary
  updateMixedPaymentSummary();
}

// Create mixed payment item
function createMixedPaymentItem(id, name, amount, isOrganizer) {
  const item = document.createElement('div');
  item.className = 'mixed-payment-item';
  item.dataset.paymentId = id;
  
  item.innerHTML = `
    <div class="mixed-payment-item-info">
      <div class="mixed-payment-item-name">
        ${isOrganizer ? '<i class="fi fi-rr-crown"></i>' : '<i class="fi fi-rr-user"></i>'}
        <span>${escapeHtml(name)}${isOrganizer ? t('booking.youSuffix') : ''}</span>
      </div>
    </div>
    <div class="mixed-payment-item-input">
      <span class="currency-symbol">${escapeHtml(mfCurrencySymbol())}</span>
      <input 
        type="number" 
        class="mixed-payment-amount-input" 
        value="${amount}" 
        min="0" 
        max="${bookingState.totalCost}"
        data-payment-id="${id}"
        placeholder="0"
      >
    </div>
  `;
  
  // Add input event listener
  const input = item.querySelector('.mixed-payment-amount-input');
  if (input) {
    input.addEventListener('input', function() {
      const value = parseFloat(this.value) || 0;
      bookingState.mixedPaymentDistribution[id] = value;
      updateMixedPaymentSummary();
    });
    
    input.addEventListener('blur', function() {
      const value = parseFloat(this.value) || 0;
      if (value < 0) {
        this.value = 0;
        bookingState.mixedPaymentDistribution[id] = 0;
      } else if (value > bookingState.totalCost) {
        this.value = bookingState.totalCost;
        bookingState.mixedPaymentDistribution[id] = bookingState.totalCost;
      }
      updateMixedPaymentSummary();
    });
  }
  
  return item;
}

// Update mixed payment summary
function updateMixedPaymentSummary() {
  const assignedEl = document.getElementById('mixedPaymentAssigned');
  const remainingEl = document.getElementById('mixedPaymentRemaining');
  
  if (!assignedEl || !remainingEl) return;
  
  // Calculate total assigned
  let totalAssigned = 0;
  Object.values(bookingState.mixedPaymentDistribution).forEach(amount => {
    totalAssigned += amount;
  });
  
  const remaining = bookingState.totalCost - totalAssigned;
  
  assignedEl.textContent = mfMoney(Number(totalAssigned.toFixed(2)));
  remainingEl.textContent = mfMoney(Number(remaining.toFixed(2)));
  
  // Update color based on validation
  if (Math.abs(remaining) < 0.01) {
    remainingEl.style.color = '#10B981';
    remainingEl.textContent = '';
    remainingEl.appendChild(document.createTextNode(mfMoney(Number(remaining.toFixed(2))) + ' '));
    var checkIcon = document.createElement('i');
    checkIcon.className = 'fi fi-rr-check';
    remainingEl.appendChild(checkIcon);
  } else if (remaining < 0) {
    remainingEl.style.color = '#DC2626';
  } else {
    remainingEl.style.color = '#F59E0B';
  }
}

// Show booking summary
function showBookingSummary() {
  const container = document.getElementById('bookingSummary');
  if (!container) return;

  const totalPlayers = bookingState.players.length + 1;
  const costPerPlayer = Math.round(bookingState.totalCost / totalPlayers);
  const paymentMethodText = {
    'split': t('booking.splitPays'),
    'organizer': t('booking.organizerPays'),
    'mixed': t('booking.mixedPays')
  };

  container.innerHTML = `
    <div class="summary-section">
      <h4>${t('booking.fieldInformation')}</h4>
      <div class="summary-item">
        <span>${t('booking.fieldColon')}</span>
        <span><strong>${escapeHtml(bookingState.field.name)}</strong></span>
      </div>
      <div class="summary-item">
        <span>${t('booking.locationColon')}</span>
        <span>${escapeHtml(bookingState.field.location)}</span>
      </div>
      <div class="summary-item">
        <span>${t('booking.sportColon')}</span>
        <span>${escapeHtml((window.MatchFieldI18n && MatchFieldI18n.sportLabel(bookingState.field.sport)) || bookingState.field.sport || '')}</span>
      </div>
    </div>
    <div class="summary-section">
      <h4>${t('payment.bookingDetails')}</h4>
      <div class="summary-item">
        <span>${t('booking.dateLabel')}</span>
        <span><strong>${formatDate(bookingState.selectedDate)}</strong></span>
      </div>
      <div class="summary-item">
        <span>${t('booking.timeColon')}</span>
        <span><strong>${bookingState.selectedTimeSlots.map(slot => {
          const hour = parseInt(slot.split(':')[0]);
          return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
        }).join(', ')}</strong></span>
      </div>
      <div class="summary-item">
        <span>${t('booking.duration')}</span>
        <span>${t('booking.hoursCount', { count: bookingState.selectedTimeSlots.length })}</span>
      </div>
    </div>
    <div class="summary-section">
      <h4>${t('booking.players')}</h4>
      <div class="summary-item">
        <span>${t('booking.organizer')}:</span>
        <span><strong>${escapeHtml(bookingState.organizer.name)}</strong></span>
      </div>
      <div class="summary-item">
        <span>${t('booking.totalPlayersLabel')}</span>
        <span><strong>${totalPlayers}</strong></span>
      </div>
      ${bookingState.players.length > 0 ? `
        <div class="summary-players">
          ${bookingState.players.map(p => `<div class="player-summary-item">${escapeHtml(p.name)}</div>`).join('')}
        </div>
      ` : ''}
    </div>
    <div class="summary-section">
      <h4>${t('booking.payment')}</h4>
      <div class="summary-item">
        <span>${t('booking.totalCostLabel')}</span>
        <span><strong>${escapeHtml(mfMoney(bookingState.totalCost))}</strong></span>
      </div>
      <div class="summary-item">
        <span>${t('booking.costPerPlayer')}</span>
        <span><strong>${escapeHtml(mfMoney(costPerPlayer))}</strong></span>
      </div>
      <div class="summary-item">
        <span>${t('booking.paymentMethodLabel')}</span>
        <span><strong>${paymentMethodText[bookingState.paymentMethod]}</strong></span>
      </div>
      ${bookingState.paymentData ? `
        <div class="summary-item">
          <span>${t('booking.yourPayment')}</span>
          <span><strong style="color: #10B981;">${t('booking.paidAmount', { money: escapeHtml(mfMoney(bookingState.paymentAmount || bookingState.totalCost)) })}</strong></span>
        </div>
      ` : bookingState.paymentMethod === 'split' ? `
        <div class="summary-item">
          <span>${t('booking.yourPayment')}</span>
          <span><strong style="color: #F59E0B;">${t('booking.pendingAmount', { money: escapeHtml(mfMoney(Math.round(bookingState.totalCost / (bookingState.players.length + 1)))) })}</strong></span>
        </div>
      ` : bookingState.paymentMethod === 'mixed' ? `
        <div class="summary-item">
          <span>${t('booking.yourPayment')}</span>
          <span><strong style="color: ${bookingState.paymentData ? '#10B981' : '#F59E0B'};">${bookingState.paymentData ? t('booking.paidAmount', { money: escapeHtml(mfMoney(bookingState.mixedPaymentDistribution['organizer'] || 0)) }) : t('booking.pendingAmount', { money: escapeHtml(mfMoney(bookingState.mixedPaymentDistribution['organizer'] || 0)) })}</strong></span>
        </div>
        <div class="summary-section" style="margin-top: 12px; padding: 12px;">
          <h5 style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: #212529;">${t('booking.paymentDistribution')}</h5>
          <div class="summary-item" style="padding: 4px 0;">
            <span>${t('booking.you')}:</span>
            <span>${escapeHtml(mfMoney(bookingState.mixedPaymentDistribution['organizer'] || 0))}</span>
          </div>
          ${bookingState.players.map(p => `
            <div class="summary-item" style="padding: 4px 0;">
              <span>${escapeHtml(p.name)}:</span>
              <span>${escapeHtml(mfMoney(bookingState.mixedPaymentDistribution[p.id] || 0))}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return t('booking.notSelected');
  const date = new Date(dateString);
  if (typeof MatchFieldPrefs !== 'undefined' && MatchFieldPrefs.formatInTimezone) {
    return MatchFieldPrefs.formatInTimezone(date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: undefined, minute: undefined });
  }
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Close booking modal
function closeBookingModal() {
  const modal = document.getElementById('bookingModal');
  if (modal) {
    modal.classList.remove('active');
    bookingState.currentStep = 1;
  }
}

// Initialize booking modal event listeners
function initializeBookingModal() {
  // Close button
  const closeBtn = document.getElementById('closeBookingModal');
  const cancelBtn = document.getElementById('cancelBookingBtn');
  const overlay = document.querySelector('.booking-modal-overlay');

  if (closeBtn) closeBtn.addEventListener('click', closeBookingModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeBookingModal);
  if (overlay) overlay.addEventListener('click', closeBookingModal);

  // Navigation buttons
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
    // Remove any existing event listeners to prevent duplicates
    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    
    newNextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        // Store current step before validation
        const stepBeforeValidation = bookingState.currentStep;
        console.log('Next button clicked, current step:', stepBeforeValidation);
        
        // Validate current step before moving forward
        if (validateCurrentStep()) {
          // Only increment if validation passed and we're still on the same step
          if (bookingState.currentStep === stepBeforeValidation && bookingState.currentStep < bookingState.totalSteps) {
            bookingState.currentStep++;
            console.log('Moving to step:', bookingState.currentStep);
            updateStepDisplay();
          }
        } else {
          // Validation failed - don't move to next step
          // The validateCurrentStep function already shows an alert
          console.log('Validation failed for step:', stepBeforeValidation);
          return;
        }
      } catch (error) {
        console.error('Error moving to next step:', error);
        alert(t('common.tryAgain'));
      }
    });
  }

  // Submit payment button - handled by initializePaymentModal to avoid duplicate listeners

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

  // Add player functionality
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

      // Prefer selected dropdown result when available, then fallback to search/add flow.
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
  
  // Setup real-time user search
  setupPlayerSearch();

  // Payment method selection
  const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
  paymentRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      bookingState.paymentMethod = this.value;
      
      // Initialize mixed payment distribution if needed
      if (this.value === 'mixed') {
        initializeMixedPaymentDistribution();
      }
      
      // Update cost split display
      updateCostSplit();
    });
  });
}

// Initialize mixed payment distribution
function initializeMixedPaymentDistribution() {
  const totalPlayers = bookingState.players.length + 1;
  const equalShare = Math.round(bookingState.totalCost / totalPlayers);
  
  // Reset distribution
  bookingState.mixedPaymentDistribution = {};
  
  // Set organizer share
  bookingState.mixedPaymentDistribution['organizer'] = equalShare;
  
  // Set equal shares for players
  bookingState.players.forEach(player => {
    bookingState.mixedPaymentDistribution[player.id] = equalShare;
  });
  
  // Update UI
  updateMixedPaymentConfig();
}

// Initialize payment form formatting
function initializePaymentFormFormatting() {
  // Card number formatting
  const cardNumberInput = document.getElementById('cardNumber');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', formatCardNumber);
    cardNumberInput.addEventListener('keypress', (e) => {
      if (!/[0-9\s]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }

  // Expiry date formatting
  const expiryInput = document.getElementById('expiryDate');
  if (expiryInput) {
    expiryInput.addEventListener('input', formatExpiryDate);
    expiryInput.addEventListener('keypress', (e) => {
      if (!/[0-9\/]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }

  // CVV validation
  const cvvInput = document.getElementById('cvv');
  if (cvvInput) {
    cvvInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
    cvvInput.addEventListener('keypress', (e) => {
      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }
}

// Validate current step
function validateCurrentStep() {
  const currentStep = bookingState.currentStep;
  
  // Debug logging
  console.log('Validating step:', currentStep);
  
  switch (currentStep) {
    case 1:
      // Step 1: Field Details - no validation needed, just viewing field info
      console.log('Step 1 validation: passed (no validation required)');
      return true;
    case 2:
      // Step 2: Date & Time Selection
      console.log('Step 2 validation: checking date and time slots');
      if (!bookingState.selectedDate) {
        console.log('Step 2 validation failed: no date selected');
        alert(t('booking.pleaseSelectDate'));
        return false;
      }
      if (bookingState.selectedTimeSlots.length === 0) {
        alert(t('booking.pleaseSelectSlot'));
        return false;
      }
      updateBookingCost();
      return true;
    case 3:
      // Step 3: Add Players - players are optional, so always valid
      return true;
    case 4:
      // Step 4: Payment & Cost Split - validate payment method and mixed payment if selected
      if (bookingState.paymentMethod === 'mixed') {
        const totalAssigned = Object.values(bookingState.mixedPaymentDistribution).reduce((sum, amount) => sum + amount, 0);
        if (Math.abs(totalAssigned - bookingState.totalCost) > 0.01) {
          alert(t('booking.distributionMismatch', { money: mfMoney(bookingState.totalCost), assigned: mfMoney(totalAssigned.toFixed(2)) }));
          return false;
        }
      }
      return true;
    case 5:
      // Step 5: Payment step - validate payment form
      return validatePaymentForm();
    case 6:
      // Step 6: Confirm Booking - no validation needed
      return true;
    default:
      return true;
  }
}

/** Payment UI exists in the booking wizard, the overlay modal, or standalone player pages — avoid duplicate-id bugs by scoping to the active context. */
function getActivePaymentFormRoot() {
  const payModal = document.getElementById('paymentModal');
  if (payModal && payModal.classList.contains('active')) {
    return payModal;
  }
  const bookingModal = document.getElementById('bookingModal');
  if (bookingModal && bookingState.currentStep === 5) {
    return bookingModal;
  }
  if (payModal) {
    return payModal;
  }
  if (bookingModal) {
    return bookingModal;
  }
  return document.body;
}

function getScopedPaymentInput(id) {
  const root = getActivePaymentFormRoot();
  return root.querySelector('#' + id) || document.getElementById(id);
}

// Validate payment form
function validatePaymentForm() {
  const root = getActivePaymentFormRoot();
  const form = root.querySelector('form.payment-form') || root.querySelector('form');
  if (!form) return true; // If form doesn't exist, skip validation
  
  if (!form.checkValidity()) {
    form.reportValidity();
    return false;
  }
  
  // Get form data
  const cardEl = getScopedPaymentInput('cardNumber');
  const expEl = getScopedPaymentInput('expiryDate');
  const cardNumber = (cardEl && cardEl.value ? cardEl.value : '').replace(/\s/g, '');
  const expiryDate = expEl && expEl.value ? expEl.value : '';
  
  // Validate card number
  if (!validateCardNumber(cardNumber)) {
    alert(t('payment.invalidCard'));
    return false;
  }
  
  // Validate expiry date
  if (!validateExpiryDate(expiryDate)) {
    alert(t('payment.invalidExpiry'));
    return false;
  }
  
  return true;
}

// Search timeout for debouncing
let searchTimeout = null;
let selectedSearchUser = null;
let latestSearchRequestId = 0;

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

// Search users as user types
function setupPlayerSearch() {
  const input = document.getElementById('playerSearchInput');
  const resultsContainer = getOrCreatePlayerSearchResultsContainer();
  
  if (!input || !resultsContainer) return;
  
  input.addEventListener('input', function() {
    const query = normalizePlayerSearchQuery(this.value);
    selectedSearchUser = null;
    
    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);
    
    // Hide results if query is too short
    if (query.length < getPlayerSearchMinLength(query)) {
      resultsContainer.style.display = 'none';
      return;
    }
    
    // Debounce search
    searchTimeout = setTimeout(() => {
      searchUsers(query);
    }, 300);
  });
  
  // Hide results when clicking outside
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
      resultsContainer.style.display = 'none';
    }
  });
}

// Search users via API
async function searchUsers(query) {
  const resultsContainer = getOrCreatePlayerSearchResultsContainer();
  if (!resultsContainer) return;

  const normalizedQuery = normalizePlayerSearchQuery(query);

  if (typeof API === 'undefined' || !API.users || !API.users.search) {
    resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #dc3545;">' + t('booking.searchUnavailable') + '</div>';
    resultsContainer.style.display = 'block';
    return [];
  }

  const requestId = ++latestSearchRequestId;
  
  try {
    resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #666;">' + t('booking.searching') + '</div>';
    resultsContainer.style.display = 'block';
    
    const response = await API.users.search(normalizedQuery, { playersOnly: true });
    // Ignore stale responses from older debounced searches.
    if (requestId !== latestSearchRequestId) return [];

    const users = response.users || [];
    
    // Filter out current user, non-players, and already added players
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
        ? '<div style="padding: 12px; text-align: center; color: #666;">' + t('booking.cannotAddSelf') + '</div>'
        : '<div style="padding: 12px; text-align: center; color: #666;">' + t('booking.searchByPlayerId') + '</div>';
      resultsContainer.style.display = 'block';
      return [];
    }
    
    resultsContainer.innerHTML = filteredUsers.map(user => `
      <div class="search-result-item" data-user-id="${escapeHtml(user.id)}"
           style="display: flex; align-items: center; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;"
           onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin-right: 10px; overflow: hidden;">
          ${user.avatar && safeUrlAttr(user.avatar)
            ? `<img src="${safeUrlAttr(user.avatar)}" alt="" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<i class="fi fi-rr-user" style="color: #666;"></i>`}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 500; color: #333;">${escapeHtml(user.fullName)}</div>
          <div style="font-size: 12px; color: #666;">${escapeHtml(user.playerCode || user.id)}</div>
        </div>
        <i class="fi fi-rr-plus" style="color: #007bff;"></i>
      </div>
    `).join('');
    
    // Add click handlers to results
    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', function() {
        const id = this.getAttribute('data-user-id');
        const userData = filteredUsers.find((u) => String(u.id) === String(id));
        if (!userData) return;
        addPlayerFromSearch(userData);
        resultsContainer.style.display = 'none';
        document.getElementById('playerSearchInput').value = '';
      });
    });
    return filteredUsers;
  } catch (error) {
    console.error('Search error:', error);
    resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #dc3545;">' + t('booking.searchFailed') + '</div>';
    resultsContainer.style.display = 'block';
    return [];
  }
}

// Add player from search result
function addPlayerFromSearch(user) {
  if (!user || user.role !== 'PLAYER') {
    alert(t('booking.onlyPlayers'));
    return;
  }

  // Check if player already added
  if (bookingState.players.some(p => p.id === user.id)) {
    alert(t('booking.alreadyAdded'));
    return;
  }
  
  const player = {
    id: user.id,
    name: user.fullName,
    email: user.email,
    avatar: user.avatar,
    playerCode: user.playerCode || null
  };
  
  bookingState.players.push(player);
  updatePlayersList();
  updateCostSplit();
}

// Add player (fallback for manual entry - now shows search prompt)
async function addPlayer() {
  const input = document.getElementById('playerSearchInput');
  const resultsContainer = getOrCreatePlayerSearchResultsContainer();
  if (!input) return;

  const searchValue = normalizePlayerSearchQuery(input.value);
  if (!searchValue) {
    alert(t('booking.enterSearch'));
    return;
  }
  
  // If user selected from search, add them
  if (selectedSearchUser) {
    addPlayerFromSearch(selectedSearchUser);
    input.value = '';
    selectedSearchUser = null;
    if (resultsContainer) resultsContainer.style.display = 'none';
    return;
  }
  
  // Otherwise, perform search and guide next action.
  if (searchValue.length >= getPlayerSearchMinLength(searchValue)) {
    const results = await searchUsers(searchValue);
    if (!results || results.length === 0) {
      alert(t('booking.noPlayersFound'));
      return;
    }

    if (results.length === 1) {
      addPlayerFromSearch(results[0]);
      input.value = '';
      if (resultsContainer) resultsContainer.style.display = 'none';
      return;
    }

    alert(t('booking.multiplePlayers'));
  } else {
    alert(t('booking.minSearch'));
  }
}

// Confirm booking
function confirmBooking() {
  if (!validateCurrentStep()) {
    return;
  }

  // Determine organizer payment status
  let organizerPaymentStatus = 'not_required';
  if (bookingState.paymentMethod === 'organizer') {
    organizerPaymentStatus = bookingState.paymentData ? 'paid' : 'pending';
  } else if (bookingState.paymentMethod === 'split') {
    organizerPaymentStatus = bookingState.paymentData ? 'paid' : 'pending';
  } else if (bookingState.paymentMethod === 'mixed') {
    organizerPaymentStatus = bookingState.paymentData ? 'paid' : 'pending';
  }
  
  // Prepare player payment data
  const playersWithPayment = bookingState.players.map(p => {
    let paymentStatus = 'pending';
    let paymentAmount = 0;
    
    if (bookingState.paymentMethod === 'split') {
      paymentAmount = Math.round(bookingState.totalCost / (bookingState.players.length + 1));
    } else if (bookingState.paymentMethod === 'mixed') {
      paymentAmount = bookingState.mixedPaymentDistribution[p.id] || 0;
    }
    
    return {
      id: p.id,
      name: p.name,
      paymentStatus: paymentStatus,
      paymentAmount: paymentAmount
    };
  });

  // Create booking object
  const booking = {
    id: 'booking_' + Date.now(),
    fieldId: bookingState.field.id,
    fieldName: bookingState.field.name,
    fieldImage: bookingState.field.image,
    organizerId: bookingState.organizer.id,
    organizerName: bookingState.organizer.name,
    players: playersWithPayment,
    date: bookingState.selectedDate,
    timeSlots: bookingState.selectedTimeSlots,
    totalCost: bookingState.totalCost,
    costPerPlayer: bookingState.paymentMethod === 'mixed' ? null : Math.round(bookingState.totalCost / (bookingState.players.length + 1)),
    paymentMethod: bookingState.paymentMethod,
    status: 'pending',
    createdAt: new Date().toISOString(),
    organizerPaymentStatus: organizerPaymentStatus,
    mixedPaymentDistribution: bookingState.paymentMethod === 'mixed' ? bookingState.mixedPaymentDistribution : null
  };

  // Save booking and send invitations
  saveBookingAndSendInvitations(booking);
}

// Guard to prevent duplicate API create (double-click)
var isBookingSubmissionInProgress = false;

// Save booking via API and show confirmation
function saveBookingAndSendInvitations(booking) {
  if (typeof API === 'undefined' || !API.getAuthToken()) {
    alert(t('player.pleaseLoginBooking'));
    return;
  }
  if (isBookingSubmissionInProgress) {
    return; // Prevent double submission
  }
  var slots = (bookingState.selectedTimeSlots || []).slice().sort();
  if (slots.length === 0) {
    alert(t('booking.pleaseSelectSlot'));
    return;
  }
  isBookingSubmissionInProgress = true;
  var confirmBtn = document.getElementById('confirmBookingBtn');
  var submitPaymentBtn = document.querySelector('#paymentForm button[type="submit"], .payment-step .btn-primary');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = t('common.creating'); }
  if (submitPaymentBtn) { submitPaymentBtn.disabled = true; }

  // Group consecutive hours into ranges (supports non-contiguous: e.g. 13:00-14:00 and 20:00-21:00)
  var ranges = [];
  for (var i = 0; i < slots.length; i++) {
    var start = slots[i];
    var startHour = parseInt(start.split(':')[0], 10);
    var endHour = startHour + 1;
    while (i + 1 < slots.length) {
      var next = slots[i + 1];
      var nextHour = parseInt(next.split(':')[0], 10);
      if (nextHour !== endHour) break;
      endHour++;
      i++;
    }
    ranges.push({ start: start, end: endHour.toString().padStart(2, '0') + ':00' });
  }

  var timeSlotStart = ranges[0].start;
  var timeSlotEnd = ranges[0].end;
  if (ranges.length > 1) {
    timeSlotEnd = ranges[ranges.length - 1].end;
  }
  var payload = {
    fieldId: bookingState.field.id,
    date: bookingState.selectedDate,
    timeSlotStart: timeSlotStart,
    timeSlotEnd: timeSlotEnd,
    paymentMethod: (bookingState.paymentMethod || 'SPLIT').toUpperCase().replace('ORGANIZER', 'ORGANIZER').replace('SPLIT', 'SPLIT').replace('MIXED', 'MIXED'),
    teamSize: (bookingState.players.length + 1) || 1
  };
  if (ranges.length > 1) {
    payload.timeSlotRanges = ranges;
  }
  if (payload.paymentMethod === 'MIXED' && bookingState.mixedPaymentDistribution) {
    payload.mixedPaymentDistribution = bookingState.mixedPaymentDistribution;
  }
  API.bookings.create(payload)
    .then(async function(res) {
      const createdBooking = res.booking;
      console.log('Booking created:', createdBooking);
      
      // If organizer completed the payment step, settle on the SERVER (never trust localStorage alone)
      try {
        if (booking.organizerPaymentStatus === 'paid' && createdBooking && createdBooking.id) {
          if (API.bookings.manualSettle) {
            const settleRes = await API.bookings.manualSettle(String(createdBooking.id));
            if (settleRes && settleRes.booking) {
              Object.assign(createdBooking, settleRes.booking);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to settle organizer payment on server', e);
      }
      
      // Add participants to the booking if there are any players
      if (bookingState.players.length > 0 && createdBooking && createdBooking.id) {
        try {
          // Add each player as a participant
          for (const player of bookingState.players) {
            try {
              await API.bookings.addParticipant(createdBooking.id, player.id);
              console.log('Added participant:', player.name);
            } catch (partErr) {
              console.error('Failed to add participant:', player.name, partErr);
            }
          }
          
          // Create notifications for invited players
          createPaymentNotifications(createdBooking, bookingState.players);
        } catch (err) {
          console.error('Error adding participants:', err);
        }
      }

      const fld = (createdBooking && createdBooking.field) || bookingState.field;
      const serverPaid =
        createdBooking &&
        (String(createdBooking.paymentStatus || '').toUpperCase() === 'PAID' ||
          String(createdBooking.organizerPaymentStatus || '').toLowerCase() === 'paid');
      const statusNow = createdBooking && (createdBooking.statusRaw || createdBooking.status);
      const didAutoConfirm =
        statusNow === 'CONFIRMED' || statusNow === 'UPCOMING';
      const isFullyPaidUi = !!(serverPaid && fieldUsesInstantBooking(fld) && didAutoConfirm);
      showBookingConfirmation(booking, isFullyPaidUi);
      closeBookingModal();
      setTimeout(function() { window.location.href = 'bookings.html'; }, 2000);
    })
    .catch(function(err) {
      isBookingSubmissionInProgress = false;
      var confirmBtn = document.getElementById('confirmBookingBtn');
      var submitPaymentBtn = document.querySelector('#paymentForm button[type="submit"], .payment-step .btn-primary');
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = t('booking.confirmBooking'); }
      if (submitPaymentBtn) { submitPaymentBtn.disabled = false; }
      alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err.message)) || t('booking.createFailed'));
    });
}

// Create payment notifications for invited players
function createPaymentNotifications(booking, players) {
  const totalPlayers = players.length + 1; // +1 for organizer
  const equalShare = Math.round(booking.totalCost / totalPlayers);
  const organizerName = bookingState.organizer?.name || t('booking.theOrganizer');
  const fieldName = bookingState.field?.name || booking.field?.name || t('booking.theField');
  const fieldImage = bookingState.field?.image
    || (booking.field && booking.field.images && booking.field.images[0])
    || booking.fieldImage
    || '';
  const isMixed = (bookingState.paymentMethod || booking.paymentMethod || '').toLowerCase() === 'mixed';
  const mixedDist = booking.mixedPaymentDistribution || bookingState.mixedPaymentDistribution || {};
  
  players.forEach(player => {
    const amount = isMixed
      ? (mixedDist[player.id] ?? mixedDist[String(player.id)] ?? equalShare)
      : equalShare;
    const notification = {
      id: 'notif_' + Date.now() + '_' + player.id,
      type: 'booking_payment_request',
      playerId: player.id,
      playerName: player.name || '',
      bookingId: booking.id,
      fieldName: fieldName,
      fieldImage: fieldImage,
      title: t('status.paymentRequired'),
      message: t('booking.invitePaymentMsg', { organizer: organizerName, field: fieldName, money: mfMoney(amount) }),
      date: bookingState.selectedDate,
      time: bookingState.selectedTimeSlots.join(', '),
      paymentAmount: amount,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Store notification in localStorage (will be replaced with real notification system later)
    const notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    notifications.push(notification);
    localStorage.setItem('playerNotifications', JSON.stringify(notifications));
    try { if (typeof window.matchfieldRefreshNotificationBadge === 'function') window.matchfieldRefreshNotificationBadge(); } catch (_) {}

    console.log('Created payment notification for:', player.name, notification);
  });
}

// Check if full payment is received
function paymentMarkedPaid(status) {
  return String(status || '').toLowerCase() === 'paid';
}

function bookingIdString(b) {
  if (!b) return '';
  var id = b.id != null ? b.id : b._id;
  return id != null ? String(id) : '';
}

function organizerPaidFromLocalStorage(bookingId) {
  var bid = String(bookingId || '');
  if (!bid) return false;
  try {
    var m = JSON.parse(localStorage.getItem('organizerPaidBookings') || '{}');
    return !!m[bid];
  } catch (e) {
    return false;
  }
}

function participantPaidFromLocalStorage(bookingId, userId) {
  var bid = String(bookingId || '');
  var uid = String(userId || '');
  if (!bid || !uid) return false;
  try {
    var m = JSON.parse(localStorage.getItem('playerPaidBookings') || '{}');
    return !!m[bid + '_' + uid];
  } catch (e) {
    return false;
  }
}

function participantRecordUserId(p) {
  if (!p) return '';
  return String(p.userId || p.id || (p.user && (p.user.id || p.user._id)) || '');
}

/** Cap local cache size — full API bookings (field images, etc.) can exceed ~5MB localStorage. */
var PLAYER_BOOKINGS_STORAGE_MAX = 40;

function compactFieldSnapshotForStorage(field) {
  if (!field || typeof field !== 'object') return field;
  var imgs = Array.isArray(field.images) ? field.images.filter(Boolean).slice(0, 1) : [];
  return {
    id: field.id,
    name: field.name,
    sport: field.sport,
    location: field.location,
    bookingType: field.bookingType,
    images: imgs
  };
}

function compactBookingForStorage(b) {
  if (!b || typeof b !== 'object') return b;
  var parts = b.participants || b.players || [];
  var slimParts = parts.map(function (p) {
    var u = (p && p.user) || {};
    var o = {
      userId: p.userId || p.id,
      id: p.id,
      paymentStatus: p.paymentStatus,
      paymentAmount: p.paymentAmount
    };
    if (u.fullName != null || u.avatar != null) {
      o.user = {};
      if (u.fullName != null) o.user.fullName = u.fullName;
      if (u.avatar != null) o.user.avatar = u.avatar;
    }
    return o;
  });
  return {
    id: b.id,
    _id: b._id,
    date: b.date,
    status: b.status,
    confirmedAt: b.confirmedAt,
    organizerId: b.organizerId,
    organizerName: b.organizerName,
    organizerPaymentStatus: b.organizerPaymentStatus,
    paymentMethod: b.paymentMethod,
    totalCost: b.totalCost,
    fieldId: b.fieldId,
    fieldName: b.fieldName,
    timeSlotStart: b.timeSlotStart,
    timeSlotEnd: b.timeSlotEnd,
    timeSlotRanges: b.timeSlotRanges,
    timeSlots: b.timeSlots,
    participants: slimParts,
    players: slimParts,
    mixedPaymentDistribution: b.mixedPaymentDistribution,
    field: b.field ? compactFieldSnapshotForStorage(b.field) : undefined
  };
}

function applyPaymentStateOntoStoredBooking(stored, incoming) {
  if (!stored || !incoming) return;
  if (incoming.organizerPaymentStatus != null) stored.organizerPaymentStatus = incoming.organizerPaymentStatus;
  if (incoming.status != null) stored.status = incoming.status;
  if (incoming.confirmedAt != null) stored.confirmedAt = incoming.confirmedAt;
  var incParts = incoming.participants || incoming.players || [];
  var outParts = stored.participants || stored.players;
  if (!Array.isArray(outParts) || outParts.length === 0) {
    var slim = compactBookingForStorage(incoming).participants || [];
    stored.participants = slim;
    stored.players = slim;
    return;
  }
  incParts.forEach(function (ip) {
    var pid = participantRecordUserId(ip);
    if (!pid) return;
    var op = outParts.find(function (p) {
      return participantRecordUserId(p) === pid;
    });
    if (op && ip && ip.paymentStatus != null) op.paymentStatus = ip.paymentStatus;
  });
}

/**
 * Writes playerBookings; compacts and trims if quota is exceeded.
 * @returns {boolean} whether a row was stored (false is OK — playerPaidBookings / API still apply).
 */
function persistPlayerBookings(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    try {
      localStorage.removeItem('playerBookings');
    } catch (e) {
      /* ignore */
    }
    return true;
  }
  function tryWrite(arr) {
    localStorage.setItem('playerBookings', JSON.stringify(arr));
  }
  var attempts = [
    function () {
      return bookings;
    },
    function () {
      var tail =
        bookings.length > PLAYER_BOOKINGS_STORAGE_MAX
          ? bookings.slice(-PLAYER_BOOKINGS_STORAGE_MAX)
          : bookings;
      return tail.map(function (b) {
        return compactBookingForStorage(b);
      });
    },
    function () {
      return bookings.slice(-15).map(function (b) {
        return compactBookingForStorage(b);
      });
    },
    function () {
      return bookings.slice(-5).map(function (b) {
        return compactBookingForStorage(b);
      });
    }
  ];
  for (var i = 0; i < attempts.length; i++) {
    try {
      tryWrite(attempts[i]());
      return true;
    } catch (err) {
      if (!err || err.name !== 'QuotaExceededError') {
        console.warn('persistPlayerBookings', err);
        return false;
      }
    }
  }
  console.warn('persistPlayerBookings: storage quota exceeded; skipped playerBookings cache.');
  return false;
}

function checkFullPayment(booking) {
  if (!booking) return false;
  const bid = bookingIdString(booking);
  const pm = String(booking.paymentMethod || '').toLowerCase();
  if (pm === 'organizer') {
    return paymentMarkedPaid(booking.organizerPaymentStatus) || organizerPaidFromLocalStorage(bid);
  }
  if (pm === 'split' || pm === 'mixed') {
    const parts = booking.players || booking.participants || [];
    const organizerPaid =
      paymentMarkedPaid(booking.organizerPaymentStatus) || organizerPaidFromLocalStorage(bid);
    const allPlayersPaid =
      parts.length === 0 ||
      parts.every(function (p) {
        const pid = participantRecordUserId(p);
        if (!pid) return true;
        return (
          paymentMarkedPaid(p.paymentStatus) ||
          participantPaidFromLocalStorage(bid, pid)
        );
      });
    return organizerPaid && allPlayersPaid;
  }

  return false;
}

function isBookingApprovedLocal(status) {
  const s = String(status || '').toLowerCase();
  return s === 'confirmed' || s === 'upcoming' || s === 'completed';
}

function fieldUsesInstantBooking(field) {
  if (!field) return true;
  const t = String(field.bookingType != null ? field.bookingType : 'instant').toLowerCase();
  return t !== 'request';
}

/** After full payment: confirm on server for instant-booking fields (no owner approval).
 * Prefer manualSettle which auto-confirms when fully paid; updateStatus alone will 402 if unpaid.
 */
function tryAutoConfirmPaidInstantBooking(bookingId, bookingOrFieldHint) {
  if (!bookingId || typeof API === 'undefined' || !API.bookings) return Promise.resolve(false);
  const fieldHint = bookingOrFieldHint && bookingOrFieldHint.field ? bookingOrFieldHint.field : bookingOrFieldHint;
  function afterPaidConfirm() {
    if (fieldHint && fieldHint.bookingType !== undefined && fieldHint.bookingType !== null) {
      if (!fieldUsesInstantBooking(fieldHint)) return Promise.resolve(false);
    }
    // Settlement endpoint already confirms instant bookings when fully paid.
    return API.bookings.getById(String(bookingId)).then(function (res) {
      const b = res && res.booking;
      const st = b && (b.statusRaw || b.status);
      return st === 'CONFIRMED' || st === 'UPCOMING';
    });
  }
  if (API.bookings.manualSettle) {
    return API.bookings
      .manualSettle(String(bookingId))
      .then(function (res) {
        if (res && res.confirmed) return true;
        return afterPaidConfirm();
      })
      .catch(function (e) {
        console.warn('Manual settle / auto-confirm failed', e);
        return false;
      });
  }
  return Promise.resolve(false);
}

// Show booking confirmation message
function showBookingConfirmation(booking, isFullyPaid) {
  // Create confirmation modal
  const confirmationModal = document.createElement('div');
  confirmationModal.className = 'booking-confirmation-modal';
  confirmationModal.id = 'bookingConfirmationModal';
  
  const confirmationContent = isFullyPaid ? `
    <div class="confirmation-content">
      <div class="confirmation-icon success">
        <i class="fi fi-rr-check-circle"></i>
      </div>
      <h2 class="confirmation-title">${t('booking.bookingConfirmed')}</h2>
      <p class="confirmation-message">
        ${escapeHtml(t('booking.confirmedAtField', { name: booking.fieldName }))}
      </p>
      <div class="confirmation-details">
        <div class="confirmation-detail-item">
          <i class="fi fi-rr-calendar"></i>
          <span>${formatDate(booking.date)}</span>
        </div>
        <div class="confirmation-detail-item">
          <i class="fi fi-rr-clock"></i>
          <span>${booking.timeSlots.map(slot => {
            const hour = parseInt(slot.split(':')[0]);
            return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
          }).join(', ')}</span>
        </div>
        <div class="confirmation-detail-item">
          <i class="fi fi-rr-money"></i>
          <span>${escapeHtml(mfMoney(booking.totalCost))}</span>
        </div>
      </div>
      <p class="confirmation-note">
        ${booking.paymentMethod === 'organizer' 
          ? t('booking.fullPaymentConfirmed') 
          : t('booking.yourPaymentReceivedOthers')}
      </p>
      <button class="confirmation-btn" onclick="closeConfirmationModal()">
        ${t('booking.viewMyBookings')}
      </button>
    </div>
  ` : `
    <div class="confirmation-content">
      <div class="confirmation-icon pending">
        <i class="fi fi-rr-hourglass"></i>
      </div>
      <h2 class="confirmation-title">${t('booking.created')}</h2>
      <p class="confirmation-message">
        ${escapeHtml(t('booking.createdAtField', { name: booking.fieldName }))}
      </p>
      <div class="confirmation-details">
        <div class="confirmation-detail-item">
          <i class="fi fi-rr-calendar"></i>
          <span>${formatDate(booking.date)}</span>
        </div>
        <div class="confirmation-detail-item">
          <i class="fi fi-rr-clock"></i>
          <span>${booking.timeSlots.map(slot => {
            const hour = parseInt(slot.split(':')[0]);
            return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
          }).join(', ')}</span>
        </div>
      </div>
      <p class="confirmation-note">
        ${t('booking.invitesSentPending')}
      </p>
      <button class="confirmation-btn" onclick="closeConfirmationModal()">
        ${t('booking.viewMyBookings')}
      </button>
    </div>
  `;
  
  confirmationModal.innerHTML = `
    <div class="confirmation-overlay"></div>
    <div class="confirmation-modal-content">
      ${confirmationContent}
    </div>
  `;
  
  document.body.appendChild(confirmationModal);
  
  // Show modal with animation
  setTimeout(() => {
    confirmationModal.classList.add('active');
  }, 100);
}

// Close confirmation modal
function closeConfirmationModal() {
  const modal = document.getElementById('bookingConfirmationModal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

// Make function globally available
window.closeConfirmationModal = closeConfirmationModal;

// Notify field owner
function notifyOrganizerOfPayment(booking, payerData, amount) {
  const organizerId = String((booking.organizer && booking.organizer.id) || booking.organizerId || '');
  if (!organizerId) return;
  const fieldName = (booking.field && booking.field.name) || booking.fieldName || t('booking.theField');
  const payerName = payerData && (payerData.fullName || payerData.name || payerData.email || t('booking.aPlayer'));
  const notification = {
    id: 'notif_' + Date.now(),
    type: 'player_paid_booking',
    playerId: organizerId,
    bookingId: booking.id,
    title: t('booking.playerPaidShare'),
    message: t('booking.playerPaidMsg', { name: payerName, money: mfMoney(amount), field: fieldName }),
    date: booking.date,
    status: 'unread',
    createdAt: new Date().toISOString()
  };
  const notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
  notifications.push(notification);
  localStorage.setItem('playerNotifications', JSON.stringify(notifications));
  try { if (typeof window.matchfieldRefreshNotificationBadge === 'function') window.matchfieldRefreshNotificationBadge(); } catch (_) {}
}

function notifyFieldOwner(booking) {
  // In a real app, this would send a notification/email to the field owner
  // For now, we'll store it in localStorage for the owner to see
  
  // Get field owner ID (in real app, this would come from the field data)
  const fieldOwnerId = `owner_${booking.fieldId}`;
  const roster = booking.players || booking.participants || [];
  const playerCount = roster.length > 0 ? roster.length + 1 : 1;
  
  const ownerNotification = {
    id: 'owner_notif_' + Date.now(),
    type: 'new_booking',
    ownerId: fieldOwnerId,
    bookingId: booking.id,
    fieldId: booking.fieldId,
    fieldName: booking.fieldName,
    organizerName: booking.organizerName,
    date: booking.date,
    timeSlots: booking.timeSlots,
    totalCost: booking.totalCost,
    status: booking.status,
    playerCount: playerCount,
    message: booking.status === 'confirmed'
      ? t('booking.ownerNotifConfirmed', { organizer: booking.organizerName, field: booking.fieldName })
      : t('booking.ownerNotifCreated', { organizer: booking.organizerName, field: booking.fieldName }),
    createdAt: new Date().toISOString(),
    read: false
  };
  
  // Save owner notification
  const ownerNotifications = JSON.parse(localStorage.getItem('ownerNotifications') || '[]');
  ownerNotifications.push(ownerNotification);
  localStorage.setItem('ownerNotifications', JSON.stringify(ownerNotifications));
  
  console.log('Field owner notified:', ownerNotification);
}

// Send player invitations
function sendPlayerInvitations(booking) {
  // In a real app, this would send notifications/emails to players
  booking.players.forEach(player => {
    // Create notification for each player
    const notification = {
      id: 'notif_' + Date.now(),
      type: 'booking_invitation',
      playerId: player.id,
      bookingId: booking.id,
      message: t('booking.inviteMsg', { organizer: booking.organizerName, field: booking.fieldName }),
      date: booking.date,
      time: booking.timeSlots.join(', '),
      cost: booking.costPerPlayer,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Save notification (in real app, this would be sent via API)
    const notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    notifications.push(notification);
    localStorage.setItem('playerNotifications', JSON.stringify(notifications));
    try { if (typeof window.matchfieldRefreshNotificationBadge === 'function') window.matchfieldRefreshNotificationBadge(); } catch (_) {}
  });

  console.log('Invitations sent to players:', booking.players.map(p => p.name));
}

// Payment Modal State
let paymentState = {
  amount: 0,
  bookingId: null,
  isOrganizer: false,
  booking: null,
  coverLeftShare: null
};

// Open payment modal
function openPaymentModal(options) {
  paymentState = {
    amount: options.amount || 0,
    bookingId: options.bookingId || null,
    isOrganizer: options.isOrganizer || false,
    booking: options.booking || null,
    coverLeftShare: options.coverLeftShare || null
  };

  const modal = document.getElementById('paymentModal');
  if (!modal) return;

  // Populate payment summary
  const summary = document.getElementById('paymentInfoSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="payment-summary">
        <div class="payment-amount">
          <span class="amount-label">${t('booking.amountToPay')}</span>
          <span class="amount-value">${escapeHtml(mfMoney(paymentState.amount))}</span>
        </div>
        ${paymentState.booking ? `
          <div class="payment-details">
            <p><strong>${escapeHtml((paymentState.booking.field && paymentState.booking.field.name) || paymentState.booking.fieldName || t('booking.fieldColon').replace(':', ''))}</strong></p>
            <p>${formatDate(paymentState.booking.date)}</p>
            <p>${(paymentState.booking.timeSlots && paymentState.booking.timeSlots.length
              ? paymentState.booking.timeSlots.map(slot => {
                  const hour = parseInt(String(slot).split(':')[0], 10);
                  return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
                }).join(', ')
              : (paymentState.booking.timeSlotStart && paymentState.booking.timeSlotEnd)
                ? (paymentState.booking.timeSlotStart + ' - ' + paymentState.booking.timeSlotEnd)
                : paymentState.booking.time || t('common.notSpecified'))}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Reset the overlay payment form (avoid duplicate #paymentForm picking the booking wizard)
  const formInModal = modal.querySelector('form');
  if (formInModal) {
    formInModal.reset();
  }

  // Show modal
  modal.classList.add('active');
}

// Close payment modal
function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) {
    modal.classList.remove('active');
    paymentState = {
      amount: 0,
      bookingId: null,
      isOrganizer: false,
      booking: null,
      coverLeftShare: null
    };
  }
}

// Initialize payment modal
function initializePaymentModal() {
  if (initializePaymentModal._initialized) {
    return;
  }
  initializePaymentModal._initialized = true;

  // Close button
  const closeBtn = document.getElementById('closePaymentModal');
  const cancelBtn = document.getElementById('cancelPaymentBtn');
  const payModalEl = document.getElementById('paymentModal');
  const overlay = payModalEl && payModalEl.querySelector('.payment-modal-overlay');

  if (closeBtn) closeBtn.addEventListener('click', closePaymentModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closePaymentModal);
  if (overlay) overlay.addEventListener('click', closePaymentModal);

  // Submit: duplicate #submitPaymentBtn on home.html — delegate so the visible modal button works
  document.addEventListener('click', function matchfieldPaymentSubmitClick(e) {
    const btn = e.target && e.target.closest && e.target.closest('#submitPaymentBtn');
    if (!btn) return;
    if (!btn.closest('#paymentModal') && !btn.closest('#bookingModal')) return;
    e.preventDefault();
    handlePaymentSubmission();
  });

  // Card number formatting (every visible card field — duplicate ids on home)
  document.querySelectorAll('#cardNumber').forEach(function (cardNumberInput) {
    cardNumberInput.addEventListener('input', formatCardNumber);
    cardNumberInput.addEventListener('keypress', (e) => {
      if (!/[0-9\s]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  });

  // Expiry date formatting
  document.querySelectorAll('#expiryDate').forEach(function (expiryInput) {
    expiryInput.addEventListener('input', formatExpiryDate);
    expiryInput.addEventListener('keypress', (e) => {
      if (!/[0-9\/]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  });

  // CVV validation
  document.querySelectorAll('#cvv').forEach(function (cvvInput) {
    cvvInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
    cvvInput.addEventListener('keypress', (e) => {
      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  });
}

// Format card number with spaces
function formatCardNumber(e) {
  let value = e.target.value.replace(/\s/g, '');
  let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
  if (formattedValue.length > 19) {
    formattedValue = formattedValue.substring(0, 19);
  }
  e.target.value = formattedValue;

  // Detect card type
  detectCardType(value);
}

// Detect card type
function detectCardType(cardNumber) {
  const icon = document.getElementById('cardTypeIcon');
  if (!icon) return;

  const number = cardNumber.replace(/\s/g, '');
  let cardType = 'credit-card';

  if (/^4/.test(number)) {
    cardType = 'visa';
  } else if (/^5[1-5]/.test(number)) {
    cardType = 'mastercard';
  } else if (/^3[47]/.test(number)) {
    cardType = 'amex';
  } else if (/^6/.test(number)) {
    cardType = 'discover';
  }

  // Update icon (in real app, you'd use card brand icons)
  icon.innerHTML = `<i class="fi fi-rr-${cardType === 'credit-card' ? 'credit-card' : 'credit-card'}"></i>`;
}

// Format expiry date
function formatExpiryDate(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length >= 2) {
    value = value.substring(0, 2) + '/' + value.substring(2, 4);
  }
  if (value.length > 5) {
    value = value.substring(0, 5);
  }
  e.target.value = value;
}

// Handle payment submission (booking modal step 5 OR Pay Your Share for existing booking)
function handlePaymentSubmission() {
  const root = getActivePaymentFormRoot();
  const form = root.querySelector('form.payment-form') || root.querySelector('form');
  if (!form) return;

  // If account is suspended, block payment and show message
  try {
    if (window.API && typeof window.API.getCurrentUser === 'function') {
      const currentUser = window.API.getCurrentUser();
      if (currentUser && currentUser.status && String(currentUser.status).toUpperCase() !== 'ACTIVE') {
        alert(t('payment.suspended'));
        return;
      }
    }
  } catch (e) {
    // If we can't read user, continue to normal validation below
  }

  // Validate form
  if (!validatePaymentForm()) {
    return;
  }

  const formData = {
    cardholderName: (getScopedPaymentInput('cardholderName') || {}).value || '',
    cardNumber: ((getScopedPaymentInput('cardNumber') || {}).value || '').replace(/\s/g, ''),
    expiryDate: (getScopedPaymentInput('expiryDate') || {}).value || '',
    cvv: (getScopedPaymentInput('cvv') || {}).value || '',
    billingAddress: (getScopedPaymentInput('billingAddress') || {}).value || '',
    billingCity: (getScopedPaymentInput('billingCity') || {}).value || '',
    billingPostalCode: (getScopedPaymentInput('billingPostalCode') || {}).value || '',
    billingCountry: (getScopedPaymentInput('billingCountry') || {}).value || '',
    amount: paymentState.bookingId ? paymentState.amount : (bookingState.paymentAmount || bookingState.totalCost)
  };

  const submitBtns = document.querySelectorAll('#submitPaymentBtn');
  const payBtnLabel = t('payment.payConfirm');
  submitBtns.forEach(function (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fi fi-rr-spinner"></i> ' + t('common.processing');
  });

  function resetPaySubmitButtons() {
    submitBtns.forEach(function (btn) {
      btn.disabled = false;
      btn.innerHTML = payBtnLabel;
    });
  }

  // Paying for EXISTING booking (Pay Your Share from bookings page)
  if (paymentState.bookingId) {
    setTimeout(function() {
      try {
        processPayment(formData);
      } catch (err) {
        console.error('Payment failed:', err);
        alert(t('payment.couldNotComplete'));
      } finally {
        resetPaySubmitButtons();
      }
    }, 1500);
    return;
  }

  // New booking flow (step 5)
  bookingState.paymentData = formData;
  setTimeout(() => {
    bookingState.currentStep = 6;
    updateStepDisplay();
    resetPaySubmitButtons();
    const summary = document.getElementById('paymentInfoSummary');
    if (summary) {
      const paymentSummary = summary.querySelector('.payment-summary');
      if (paymentSummary) {
        const successMsg = document.createElement('div');
        successMsg.className = 'payment-success';
        successMsg.innerHTML = `
          <i class="fi fi-rr-check-circle"></i>
          <span>${t('booking.proceedingConfirm')}</span>
        `;
        paymentSummary.appendChild(successMsg);
      }
    }
  }, 2000);
}

// Validate card number (accept any 12–19 digits for now; restore Luhn/real validation later)
function validateCardNumber(cardNumber) {
  const number = cardNumber.replace(/\s/g, '');
  if (number.length < 12 || number.length > 19) {
    return false;
  }
  return /^\d+$/.test(number);
}

// Validate expiry date
function validateExpiryDate(expiryDate) {
  const [month, year] = expiryDate.split('/');
  if (!month || !year) return false;

  const expMonth = parseInt(month);
  const expYear = 2000 + parseInt(year);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (expMonth < 1 || expMonth > 12) return false;
  if (expYear < currentYear) return false;
  if (expYear === currentYear && expMonth < currentMonth) return false;

  return true;
}

// Process payment
function markOrganizerCoveredLeftSharePayment(bookingId, coverLeftShare) {
  if (!bookingId || !coverLeftShare) return;
  var notificationId = String(coverLeftShare.notificationId || ('covered_' + Date.now()));
  var paidMap = JSON.parse(localStorage.getItem('playerPaidBookings') || '{}');
  paidMap[String(bookingId) + '_covered_' + notificationId] = true;
  localStorage.setItem('playerPaidBookings', JSON.stringify(paidMap));

  var covered = JSON.parse(localStorage.getItem('organizerCoveredLeftPlayerShares') || '{}');
  covered[notificationId] = {
    bookingId: String(bookingId),
    amount: Number(coverLeftShare.amount || paymentState.amount || 0),
    leftPlayerName: coverLeftShare.leftPlayerName || t('booking.playerFallback'),
    coveredAt: new Date().toISOString()
  };
  localStorage.setItem('organizerCoveredLeftPlayerShares', JSON.stringify(covered));

  var notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
  var remainingNotifications = notifications.filter(function(n) {
    return String(n.id || '') !== notificationId;
  });
  localStorage.setItem('playerNotifications', JSON.stringify(remainingNotifications));
}

function processPayment(paymentData) {
  // Card fields are validated client-side only for UX; they are NEVER sent to the API.
  const num = (paymentData && paymentData.cardNumber) ? String(paymentData.cardNumber).replace(/\D/g, '') : '';
  const cardLast4 = num.length >= 4 ? num.slice(-4) : '----';
  console.log('Processing payment (manual settle):', {
    amount: paymentState.amount,
    bookingId: paymentState.bookingId,
    cardLast4: cardLast4
  });

  const bookingId = String(paymentState.bookingId || '');
  if (!bookingId || typeof API === 'undefined' || !API.bookings || !API.bookings.manualSettle) {
    alert(t('payment.settleFailed'));
    return;
  }

  const isCoveringLeftShare = !!paymentState.coverLeftShare;

  API.bookings
    .manualSettle(bookingId)
    .then(function (settleRes) {
      const updatedBooking = (settleRes && settleRes.booking) || paymentState.booking;
      if (isCoveringLeftShare) {
        markOrganizerCoveredLeftSharePayment(bookingId, paymentState.coverLeftShare);
      }

      try {
        const allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
        const idx = allBookings.findIndex(function (b) {
          return String(b.id) === bookingId;
        });
        if (idx !== -1 && updatedBooking) {
          allBookings[idx] = Object.assign({}, allBookings[idx], updatedBooking);
          persistPlayerBookings(allBookings);
        }
      } catch (_) {}

      function finishPaymentFlow() {
        closePaymentModal();
        if (paymentState.booking) {
          closeBookingModal();
        }
        alert(
          isCoveringLeftShare
            ? t('booking.paymentSuccessfulCover')
            : t('booking.paymentSuccessfulShare')
        );
        window.location.href = 'bookings.html';
      }

      const confirmed =
        settleRes &&
        (settleRes.confirmed ||
          (updatedBooking &&
            (updatedBooking.status === 'UPCOMING' ||
              updatedBooking.status === 'CONFIRMED' ||
              updatedBooking.statusRaw === 'CONFIRMED')));

      if (confirmed && updatedBooking) {
        showBookingConfirmation(
          Object.assign({}, updatedBooking, {
            fieldName:
              (updatedBooking.field && updatedBooking.field.name) ||
              (paymentState.booking && paymentState.booking.fieldName) ||
              'the field',
            timeSlots: paymentState.booking && paymentState.booking.timeSlots
              ? paymentState.booking.timeSlots
              : [],
            date: updatedBooking.date || (paymentState.booking && paymentState.booking.date),
            totalCost: updatedBooking.totalCost,
            paymentMethod: String(updatedBooking.paymentMethod || '').toLowerCase()
          }),
          true
        );
      }

      finishPaymentFlow();
    })
    .catch(function (err) {
      console.error('Server payment settle failed', err);
      alert((window.MatchFieldI18n && err && MatchFieldI18n.localizeError(err.message)) || t('payment.serverFailed'));
    });
}

// Make functions available globally for use from other pages
window.openPaymentModal = openPaymentModal;
window.openBookingModal = openBookingModal;

// Setup event listeners
function setupEventListeners() {
  // Sport filter buttons
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
          // Remove active class from all buttons
          filterButtons.forEach(b => b.classList.remove('active'));
          // Add active class to clicked button
          btn.classList.add('active');
          
          // Filter venues
          const sport = btn.dataset.sport;
          filterVenuesBySport(sport);
      });
  });
  
  // Search functionality
  const searchInput = document.querySelector('.search-input');
  const searchIcon = document.querySelector('.search-icon');
  
  // Function to perform search
  const performSearch = () => {
      const query = searchInput.value.toLowerCase().trim();
      filterVenuesBySearch(query);
  };
  
  // Search on Enter key press
  if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
              e.preventDefault();
              performSearch();
          }
      });
  }
  
  // Search on icon click
  if (searchIcon) {
      searchIcon.addEventListener('click', () => {
          performSearch();
      });
  }
  
  // Location selector
  const locationSelector = document.querySelector('.location-selector');
  const locationMenu = document.getElementById('locationMenu');
  if (locationSelector && locationMenu) {
      locationSelector.addEventListener('click', (e) => {
          e.stopPropagation();
          locationMenu.classList.toggle('active');
          locationSelector.setAttribute('aria-expanded', locationMenu.classList.contains('active') ? 'true' : 'false');
      });
      locationMenu.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-location-option]');
        if (!btn) return;
        const option = btn.getAttribute('data-location-option');
        chooseLocationFromSelector(option).catch(function(err) {
          console.warn('Failed to switch location:', err);
        }).finally(function() {
          locationMenu.classList.remove('active');
          locationSelector.setAttribute('aria-expanded', 'false');
        });
      });
      document.addEventListener('click', function(e) {
        if (!locationMenu.classList.contains('active')) return;
        if (!locationMenu.contains(e.target) && !locationSelector.contains(e.target)) {
          locationMenu.classList.remove('active');
          locationSelector.setAttribute('aria-expanded', 'false');
        }
      });
  }
  
  // Only initialize notification and profile popups on the home page
  // Other pages (like bookings) have their own initialization
  const isHomePage = window.location.pathname.includes('home.html') || 
                     (window.location.pathname.endsWith('/') && !window.location.pathname.includes('bookings.html'));
  
  if (isHomePage) {
      // Notification popup is handled by shared notifications.js
      
      // Profile popup
      const profileBtn = document.getElementById('profileBtn');
      const profilePopup = document.getElementById('profilePopup');
      
      if (profileBtn && profilePopup) {
          profileBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              profilePopup.classList.toggle('active');
              // Close notification popup if open
              const notificationPopup = document.getElementById('notificationPopup');
              if (notificationPopup && notificationPopup.classList.contains('active')) {
                  notificationPopup.classList.remove('active');
              }
          });
          
          // Close popup when clicking outside
          document.addEventListener('click', (e) => {
              if (profilePopup && profilePopup.classList.contains('active')) {
                  if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
                      profilePopup.classList.remove('active');
                  }
              }
          });
      }

  }
}

// Filter venues by sport
function filterVenuesBySport(sport) {
  const allCards = document.querySelectorAll('#popularVenues .venue-card, #nearbyVenues .venue-card');
  
  if (sport === 'all') {
      allCards.forEach(card => {
          card.style.display = 'block';
      });
  } else {
      allCards.forEach(card => {
          const cardSport = card.dataset.sport;
          if (cardSport === sport) {
              card.style.display = 'block';
          } else {
              card.style.display = 'none';
          }
      });
  }
}

// Filter venues by search query
function filterVenuesBySearch(query) {
  const allCards = document.querySelectorAll('#popularVenues .venue-card, #nearbyVenues .venue-card');
  
  // If query is empty, show all cards
  if (!query) {
      allCards.forEach(card => {
          card.style.display = 'block';
      });
      return;
  }
  
  allCards.forEach(card => {
      const venueName = card.querySelector('.venue-name').textContent.toLowerCase();
      const venueRating = card.querySelector('.venue-rating').textContent.toLowerCase();
      const venueSport = card.dataset.sport;
      
      if (venueName.includes(query) || venueRating.includes(query) || venueSport.includes(query)) {
          card.style.display = 'block';
      } else {
          card.style.display = 'none';
      }
  });
}

function getUnifiedFavoriteIds() {
  const favorites = [];
  venues.popular.forEach(v => {
      const id = String(v.id);
      if (v.isFavorite && !favorites.includes(id)) favorites.push(id);
  });
  venues.nearby.forEach(v => {
      const id = String(v.id);
      if (v.isFavorite && !favorites.includes(id)) favorites.push(id);
  });
  return favorites;
}

async function openFavoriteFieldsModal() {
  if (window.MatchFieldProfileFavorites && typeof window.MatchFieldProfileFavorites.openModal === 'function') {
    return window.MatchFieldProfileFavorites.openModal({
      getCachedVenues: function () {
        return [].concat(venues.popular || [], venues.nearby || []);
      }
    });
  }
  const modal = document.getElementById('favoriteFieldsModal');
  const body = document.getElementById('favoriteFieldsModalBody');
  if (!modal || !body) return;
  body.innerHTML = '<div class="favorite-empty-state">' + t('player.favoritesUnavailable') + '</div>';
  modal.classList.add('active');
}

function closeFavoriteFieldsModal() {
  if (window.MatchFieldProfileFavorites && window.MatchFieldProfileFavorites.closeModal) {
    window.MatchFieldProfileFavorites.closeModal();
    return;
  }
  const modal = document.getElementById('favoriteFieldsModal');
  if (modal) modal.classList.remove('active');
}

// Save favorites to localStorage
function saveFavoritesToStorage() {
  const favorites = getUnifiedFavoriteIds();
  persistFavoriteIdsSet(new Set(favorites.map(String)));
}

// Apply heart state from localStorage (kept in sync with API when logged in; never derived from map coords).
function loadFavoritesFromStorage() {
  applyFavoriteIdsToVenueState(Array.from(getFavoriteIdsSet()));
  syncFavoriteButtonsFromState();
}

window.addEventListener('matchfield:favorites-updated', function() {
  loadFavoritesFromStorage();
});

window.addEventListener('storage', function(e) {
  if (e.key !== 'favoriteVenues') return;
  loadFavoritesFromStorage();
});

window.addEventListener('pageshow', function() {
  loadFavoritesFromStorage();
  const ids = consumeDirtyReviewFields();
  ids.forEach(function(id) { refreshFieldReviewStats(id); });
});

window.addEventListener('matchfield:reviews-updated', function(e) {
  const fieldId = e && e.detail && e.detail.fieldId ? String(e.detail.fieldId) : '';
  if (!fieldId) return;
  refreshFieldReviewStats(fieldId);
});

// Notifications are handled by shared notifications.js (loaded on all player pages)











