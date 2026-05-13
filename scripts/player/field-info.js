// Venue data (should match home-player.js)
const venuesData = {
  popular: [
      {
          id: 1,
          name: "Fozi football court",
          sport: "Football",
          image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "outdoor",
          price: 1500,
          isFavorite: false,
          description: "A premium football field located in the heart of Uskudar. Perfect for both casual matches and professional training sessions. The field features high-quality artificial turf, excellent lighting, and modern facilities.",
          features: ["Parking Available", "Changing Rooms", "Water Station", "First Aid Kit", "Referee Available", "Equipment Rental"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 2,
          name: "Fozi football court",
          sport: "Tennis",
          image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1622162879325-4c0c0c0c0c0?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true,
          description: "Professional indoor tennis court with climate control and high-quality court surface. Suitable for all skill levels.",
          features: ["Air Conditioning", "Changing Rooms", "Pro Shop", "Coaching Available"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 3,
          name: "Fozi football court",
          sport: "Basketball",
          image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false,
          description: "Modern indoor basketball court with professional flooring and excellent lighting.",
          features: ["Air Conditioning", "Changing Rooms", "Scoreboard", "Equipment Rental"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 4,
          name: "Fozi football court",
          sport: "Padel",
          image: "https://images.unsplash.com/photo-1622163642992-6b7e3c4e3b3e?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1622163642992-6b7e3c4e3b3e?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true,
          description: "Premium padel court with glass walls and professional court surface.",
          features: ["Air Conditioning", "Changing Rooms", "Equipment Rental", "Coaching Available"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 5,
          name: "Fozi football court",
          sport: "Volleyball",
          image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false,
          description: "Indoor volleyball court with professional net system and excellent facilities.",
          features: ["Air Conditioning", "Changing Rooms", "Equipment Rental", "Referee Available"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 6,
          name: "Fozi football court",
          sport: "Ice Hockey",
          image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true,
          description: "Professional ice hockey rink with temperature-controlled environment.",
          features: ["Ice Rink", "Equipment Rental", "Changing Rooms", "Pro Shop"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      }
  ],
  nearby: [
      {
          id: 7,
          name: "Fozi football court",
          sport: "Football",
          image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false,
          description: "A premium football field located in the heart of Uskudar.",
          features: ["Parking Available", "Changing Rooms", "Water Station"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 8,
          name: "Fozi football court",
          sport: "Tennis",
          image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1622162879325-4c0c0c0c0c0?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true,
          description: "Professional indoor tennis court with climate control.",
          features: ["Air Conditioning", "Changing Rooms", "Pro Shop"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 9,
          name: "Fozi football court",
          sport: "Basketball",
          image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false,
          description: "Modern indoor basketball court with professional flooring.",
          features: ["Air Conditioning", "Changing Rooms", "Scoreboard"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      }
  ]
};

// Get venue ID from URL parameter (string for API, or number for fallback)
function getVenueIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

// Current field when loaded from API (so handleBooking can use it)
var currentFieldFromAPI = null;
var reviewsRequestToken = 0;
var reviewsByFieldCache = {};
var REVIEW_DIRTY_STORAGE_KEY_FIELDINFO = 'matchfieldReviewDirtyFields';

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

// Find venue by ID (supports string or number for fallback data)
function findVenueById(venueId) {
  if (currentFieldFromAPI && String(currentFieldFromAPI.id) === String(venueId))
    return currentFieldFromAPI;
  const allVenues = [...venuesData.popular, ...venuesData.nearby];
  return allVenues.find(venue => String(venue.id) === String(venueId));
}

// Same keys / default as scripts/player/home.js (list API supplies distanceKm; GET /:id does not).
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

function applyDistanceToVenue(venue, field) {
  if (!venue || !field) return Promise.resolve(venue);
  var apiKm = field.distanceKm != null ? Number(field.distanceKm) : NaN;
  if (Number.isFinite(apiKm)) {
    venue.distance = formatDistanceFromKm(apiKm);
    return Promise.resolve(venue);
  }
  var flat = field.latitude != null ? Number(field.latitude) : null;
  var flng = field.longitude != null ? Number(field.longitude) : null;
  if (!Number.isFinite(flat) || !Number.isFinite(flng)) {
    venue.distance = 'N/A';
    return Promise.resolve(venue);
  }
  return getPlayerCoordsForDistance().then(function(coords) {
    var km = haversineKm(coords.lat, coords.lng, flat, flng);
    venue.distance = formatDistanceFromKm(km);
    return venue;
  });
}

function mergeAmenitiesAndFeatures(field) {
  var a = Array.isArray(field && field.amenities) ? field.amenities : [];
  var f = Array.isArray(field && field.features) ? field.features : [];
  var seen = {};
  var out = [];
  [].concat(a, f).forEach(function (x) {
    var s = String(x || '').trim();
    if (!s) return;
    var k = s.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    out.push(s);
  });
  return out;
}

// Load field from API and map to venue format for rendering
function loadFieldFromAPI(fieldId) {
  if (typeof API === 'undefined' || !fieldId) return Promise.resolve(null);
  var apiField;
  return API.fields.getById(fieldId).then(function(res) {
    // API returns { field: {...} }, extract the actual field
    apiField = (res && res.field) ? res.field : res;
    var field = apiField;
    var images = (field.images && field.images.length) ? field.images : [];
    var img = images[0] || 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop';
    var reviewCount = field.reviewCount != null ? field.reviewCount : (field._count && field._count.reviews) || 0;
    return {
      id: field.id,
      name: field.name || 'Field',
      sport: field.sport || 'Sport',
      image: img,
      images: images,
      rating: field.rating != null ? field.rating : 0,
      reviews: reviewCount,
      location: field.location || '',
      distance: 'N/A',
      type: (field.type || 'OUTDOOR').toLowerCase(),
      price: field.pricePerHour != null ? field.pricePerHour : 0,
      isFavorite: false,
      description: field.description || '',
      features: mergeAmenitiesAndFeatures(field),
      address: field.address || '',
      city: field.city || '',
      district: field.district || '',
      latitude: field.latitude != null ? Number(field.latitude) : null,
      longitude: field.longitude != null ? Number(field.longitude) : null,
      phone: field.phone || '',
      venueResponse: field.venueResponse || '',
      capacity: field.capacity != null ? Number(field.capacity) : null,
      owner: field.owner || null,
      ownerId: field.ownerId || (field.owner && (field.owner.id || field.owner._id)) || null,
      apiReviews: Array.isArray(field.reviews) ? field.reviews : []
    };
  }).then(function(venue) {
    function withDistance(v) {
      return applyDistanceToVenue(v, apiField);
    }
    if (typeof API !== 'undefined' && API.getAuthToken && API.getAuthToken()) {
      return API.favorites.check(venue.id).then(function(res) {
        venue.isFavorite = !!(res && (res.isFavorite || res.isFavorited));
        return venue;
      }).catch(function() { return venue; }).then(withDistance);
    }
    return withDistance(venue);
  });
}

// Load favorites from localStorage
function loadFavoritesFromStorage() {
  try {
    const saved = localStorage.getItem('favoriteVenues');
    const favorites = saved ? JSON.parse(saved) : [];
    const favoriteIds = Array.isArray(favorites) ? favorites.map(String) : [];
    const allVenues = [...venuesData.popular, ...venuesData.nearby];
    allVenues.forEach(v => {
        v.isFavorite = favoriteIds.includes(String(v.id));
    });
    if (currentFieldFromAPI) {
      currentFieldFromAPI.isFavorite = favoriteIds.includes(String(currentFieldFromAPI.id));
    }
  } catch (_) {
    const allVenues = [...venuesData.popular, ...venuesData.nearby];
    allVenues.forEach(v => { v.isFavorite = false; });
    if (currentFieldFromAPI) currentFieldFromAPI.isFavorite = false;
  }
}

// Toggle favorite (API or local)
function toggleFavorite(venueId) {
  const saveBtn = document.getElementById('saveBtn');
  function setSaveLoading(isLoading) {
    if (!saveBtn) return;
    saveBtn.disabled = !!isLoading;
    saveBtn.classList.toggle('is-loading', !!isLoading);
    const textEl = saveBtn.querySelector('span');
    if (textEl && isLoading) textEl.textContent = 'Saving...';
  }

  if (typeof API !== 'undefined' && API.getAuthToken && API.getAuthToken()) {
    var venue = findVenueById(venueId);
    if (!venue) return;
    var isFav = venue.isFavorite;
    var venueIdStr = String(venueId);
    setSaveLoading(true);
    var promise = isFav ? API.favorites.remove(venueIdStr) : API.favorites.add(venueIdStr);
    promise.then(function() {
      venue.isFavorite = !isFav;
      const set = getFavoriteIdsSet();
      if (venue.isFavorite) set.add(venueIdStr);
      else set.delete(venueIdStr);
      persistFavoriteIdsSet(set);
      updateSaveButton(venue.isFavorite);
    }).catch(function(err) {
      var message = (err && err.message ? String(err.message) : '').toLowerCase();
      // Keep UI state correct if backend indicates existing/missing favorite.
      if (!isFav && message.indexOf('already in favorites') !== -1) {
        venue.isFavorite = true;
        const set = getFavoriteIdsSet();
        set.add(venueIdStr);
        persistFavoriteIdsSet(set);
        updateSaveButton(true);
        return;
      }
      if (isFav && message.indexOf('favorite not found') !== -1) {
        venue.isFavorite = false;
        const set = getFavoriteIdsSet();
        set.delete(venueIdStr);
        persistFavoriteIdsSet(set);
        updateSaveButton(false);
        return;
      }
      alert(err.message || 'Failed to update favorite.');
    }).finally(function() {
      setSaveLoading(false);
      updateSaveButton(venue.isFavorite);
    });
    return;
  }
  var venue = findVenueById(venueId);
  if (venue) {
    venue.isFavorite = !venue.isFavorite;
    const set = getFavoriteIdsSet();
    const venueIdStr = String(venueId);
    if (venue.isFavorite) set.add(venueIdStr);
    else set.delete(venueIdStr);
    persistFavoriteIdsSet(set);
    updateSaveButton(venue.isFavorite);
  }
}

// Save favorites to localStorage
function saveFavoritesToStorage() {
  const set = getFavoriteIdsSet();
  if (currentFieldFromAPI) {
    const currentId = String(currentFieldFromAPI.id);
    if (currentFieldFromAPI.isFavorite) set.add(currentId);
    else set.delete(currentId);
  }
  persistFavoriteIdsSet(set);
}

/** Build "5v5" / "6v6" / "5v6" label from total player capacity (e.g. 10 → 5v5). */
function matchFormatLabelFromCapacity(capacity) {
  var n = Number(capacity);
  if (!Number.isFinite(n) || n < 2) return null;
  var a = Math.floor(n / 2);
  var b = n - a;
  return String(a) + 'v' + String(b);
}

// Render field info
function renderFieldInfo(venue) {
  if (!venue) {
      document.getElementById('fieldInfoContent').innerHTML = `
          <div class="error-state">
              <h2>Field not found</h2>
              <p>The field you're looking for doesn't exist.</p>
              <a href="../player/home.html" class="back-btn" style="display: inline-flex; margin-top: 20px;">Back to Home</a>
          </div>
      `;
      return;
  }

  // Create field feature tags for display under image
  var typeRaw = venue.type ? String(venue.type) : 'outdoor';
  var typeLabel = typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1).toLowerCase();
  var fieldFeatureTags = [
    typeLabel,
    venue.sport || 'Sport',
    'Synthetic',
    'Available today'
  ];
  var matchTag = matchFormatLabelFromCapacity(venue.capacity);
  if (matchTag) {
    fieldFeatureTags.push(matchTag);
  }

  const fieldFeatureTagsHTML = fieldFeatureTags.map(tag => `
      <span class="field-feature-tag">${tag}</span>
  `).join('');

  const featuresList = Array.isArray(venue.features) ? venue.features : [];
  const featuresHTML = featuresList.map(feature => `
      <div class="field-feature-item">
          <div class="field-feature-icon">
              <i class="fi fi-rr-check"></i>
          </div>
          <span class="field-feature-text">${feature}</span>
      </div>
  `).join('');

  // Get images array or use single image (ensure at least one for gallery)
  const images = (venue.images && venue.images.length) ? venue.images : (venue.image ? [venue.image] : ['https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop']);
  const imagesHTML = images.map((img, index) => `
      <img src="${img}" alt="${(venue.name || 'Field')} - Image ${index + 1}" class="field-main-image ${index === 0 ? 'active' : ''}" data-index="${index}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'800\\' height=\\'600\\'%3E%3Crect fill=\\'%23f3f4f6\\' width=\\'800\\' height=\\'600\\'/%3E%3Ctext fill=\\'%236b7280\\' font-family=\\'sans-serif\\' font-size=\\'24\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dominant-baseline=\\'middle\\'%3E${encodeURIComponent(venue.sport || 'Sport')}%3C/text%3E%3C/svg%3E'">
  `).join('');

  const ownerAvatar = venue.owner && venue.owner.avatar
    ? '<img src="' + venue.owner.avatar + '" alt="' + ((venue.owner && venue.owner.fullName) || 'Venue Manager') + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
    : ((venue.owner && venue.owner.fullName ? venue.owner.fullName.charAt(0).toUpperCase() : 'N'));
  const html = `
      <!-- Field Title and Metadata -->
      <div class="field-header-top">
          <div class="field-title-row">
              <h1 class="field-title">${venue.name}</h1>
              <div class="field-actions-top">
                  <button class="action-btn share-btn" onclick="handleShare()">
                      <i class="fi fi-rr-share"></i>
                      <span>Share</span>
                  </button>
                  <button class="action-btn save-btn" id="saveBtn">
                      <i class="fi fi-rr-heart"></i>
                      <span>Save</span>
                  </button>
              </div>
          </div>
          <div class="field-meta-line">
              <i class="fi fi-rr-marker field-meta-icon"></i>
              <span>${venue.location}</span>
              <span class="field-meta-separator">•</span>
              <span>${venue.distance}</span>
              <span class="field-meta-separator">•</span>
              <span class="field-star-yellow">★</span>
              <span>${venue.rating} (${venue.reviews})</span>
              <span class="field-meta-separator">•</span>
              <span>${venue.sport}</span>
          </div>
      </div>

      <!-- Image and Booking Card Row -->
      <div class="field-main-row">
          <!-- Field Image Gallery -->
          <div class="field-gallery-wrapper">
              <div class="field-gallery" id="fieldGallery" data-current-index="0" data-total-images="${images.length}">
                  ${imagesHTML}
                  ${images.length > 1 ? `
                  <button class="gallery-nav-btn gallery-nav-left" id="galleryNavLeft">
                      <i class="fi fi-rr-angle-left"></i>
                  </button>
                  <div class="gallery-dots" id="galleryDots"></div>
                  <button class="gallery-nav-btn gallery-nav-right" id="galleryNavRight">
                      <i class="fi fi-rr-angle-right"></i>
                  </button>
                  ` : ''}
              </div>
              <div class="field-feature-tags">
                  ${fieldFeatureTagsHTML}
              </div>
          </div>

          <!-- Booking Card -->
          <div class="field-booking-card">
              <div class="booking-price-section">
                  <div class="booking-price">₺${venue.price}<span class="booking-price-unit">/h</span></div>
                  <div class="booking-price-note">Per hour • Taxes included</div>
              </div>
              
              <div class="booking-location-section">
                  <h3 class="booking-section-title">Location</h3>
                  <p class="booking-location-text">Istanbul, ${venue.location} • Approx. ${venue.distance} from your current location.</p>
                  <div class="booking-map-placeholder" id="bookingFieldMap"></div>
              </div>

              <button class="booking-btn" onclick="handleBooking('${String(venue.id).replace(/'/g, "\\'")}')">Book now</button>
              
              <div class="booking-cancellation">
                  Free cancellation up to 12 hours before your booking.
              </div>
          </div>
      </div>

      <!-- Field Details Grid - Content Below Main Row -->
      <div class="field-content-grid">
          <!-- Left Column - Description, Amenities, Reviews -->
          <div class="field-content-left">
              <!-- Description -->
              <div class="field-description-section">
                  <h2 class="section-title">${venue.name}</h2>
                  <p class="field-description">${venue.description || 'A premium sports facility with excellent amenities and professional-grade equipment.'}</p>
              </div>

              <!-- Amenities -->
              <div class="field-amenities-section">
                  <h3 class="section-title">Amenities</h3>
                  <div class="amenities-grid" id="amenitiesGrid">
                      ${(venue.features && venue.features.length ? venue.features : ['Flood lights', 'Showers', 'Team benches', 'Changing rooms', 'Parking', 'Wi-Fi']).map(function(f) {
                        return '<div class="amenity-item"><i class="fi fi-rr-check amenity-icon"></i><span>' + (typeof f === 'string' ? f : (f.name || f)) + '</span></div>';
                      }).join('')}
                  </div>
              </div>

              <!-- Reviews -->
              <div class="field-reviews-section">
                  <div class="reviews-header-section">
                      <h3 class="section-title">Reviews</h3>
                      <div class="reviews-summary-toggle">
                          <div class="reviews-summary">
                              <span class="field-star-yellow">★</span>
                              <span><span id="reviewsSummaryRating">${venue.rating}</span> • <span id="reviewsSummaryCount">${venue.reviews} total reviews</span></span>
                          </div>
                          <button class="toggle-reviews-btn" id="toggleReviewsBtn" onclick="toggleReviews()">
                              <span class="toggle-text">View reviews</span>
                              <i class="fi fi-rr-angle-down toggle-icon"></i>
                          </button>
                      </div>
                  </div>
                  
                  <!-- Add Review Form -->
                  <div class="add-review-form">
                      <h4 class="add-review-title">Write a review</h4>
                      <div class="review-rating-input">
                          <label>Rating:</label>
                          <div class="star-rating" id="starRating">
                              <span class="star-input" data-rating="1">★</span>
                              <span class="star-input" data-rating="2">★</span>
                              <span class="star-input" data-rating="3">★</span>
                              <span class="star-input" data-rating="4">★</span>
                              <span class="star-input" data-rating="5">★</span>
                          </div>
                          <span class="rating-value" id="ratingValue">0</span>
                      </div>
                      <textarea 
                          class="review-textarea" 
                          id="reviewTextarea" 
                          placeholder="Share your experience..."
                          rows="4"
                      ></textarea>
                      <button class="submit-review-btn" onclick="submitReview('${String(venue.id).replace(/'/g, "\\'")}')">Submit Review</button>
                  </div>

                  <div class="reviews-list" id="reviewsList" style="display: none;">
                      <div class="review-card">
                          <div class="review-header">
                              <div class="reviewer-info">
                                  <div class="reviewer-avatar-small">A</div>
                                  <div>
                                      <div class="reviewer-name">Ahmed</div>
                                      <div class="review-context">Played 5v5 last week</div>
                                  </div>
                              </div>
                              <div class="review-rating-display">
                                  <span class="star-filled">★★★★★</span>
                              </div>
                          </div>
                          <div class="review-text">"Great field quality, lights are strong and the staff were friendly. Booking was smooth."</div>
                      </div>
                      <div class="review-card">
                          <div class="review-header">
                              <div class="reviewer-info">
                                  <div class="reviewer-avatar-small">S</div>
                                  <div>
                                      <div class="reviewer-name">Sara</div>
                                      <div class="review-context">Weekend booking</div>
                                  </div>
                              </div>
                              <div class="review-rating-display">
                                  <span class="star-filled">★★★★★</span>
                              </div>
                          </div>
                          <div class="review-text">"Perfect location and easy to reach. Parking area helps a lot during busy hours."</div>
                      </div>
                  </div>
              </div>
          </div>

          <!-- Right Column - Venue Contact -->
          <div class="field-content-right">
              <div class="venue-contact-card">
                  <h3 class="venue-contact-title">Venue contact</h3>
                  <div class="venue-contact-info">
                      <div class="venue-avatar">${ownerAvatar}</div>
                      <div class="venue-details">
                          <div class="venue-name">${(venue.owner && venue.owner.fullName) || 'Venue Manager'}</div>
                          <div class="venue-response">${venue.venueResponse ? venue.venueResponse : 'Responds within a few hours'}</div>
                      </div>
                  </div>
                  <button class="venue-message-btn" id="messageVenueBtn">Message venue</button>
              </div>
          </div>
      </div>
  `;

  document.getElementById('fieldInfoContent').innerHTML = html;

  // Add event listener to save button (same as favorite)
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
      saveBtn.dataset.venueId = venue.id;
      saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleFavorite(venue.id);
      });
      updateSaveButton(venue.isFavorite);
  }

  // Initialize gallery sliding
  initializeGallerySliding(images.length);
  renderBookingLocationMap(venue);

  // Initialize star rating
  initializeStarRating();
  
  // Display reviews (pass apiReviews from field load, or fetch from API)
  displayReviews(venue.id, venue.apiReviews);

  const messageVenueBtn = document.getElementById('messageVenueBtn');
  if (messageVenueBtn) {
    messageVenueBtn.addEventListener('click', function() {
      var own = venue && venue.owner;
      var ownerId = String(
        (own && (own.id || own._id)) || (venue && venue.ownerId) || ''
      ).trim();
      if (!ownerId) {
        alert('Venue contact is currently unavailable.');
        return;
      }
      window.location.href =
        'chat.html?userId=' +
        encodeURIComponent(ownerId) +
        '&fieldId=' +
        encodeURIComponent(String(venue.id));
    });
  }
}

function renderBookingLocationMap(venue) {
  const mapEl = document.getElementById('bookingFieldMap');
  if (!mapEl) return;
  const lat = Number(venue && venue.latitude);
  const lng = Number(venue && venue.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || typeof MapService === 'undefined') {
    mapEl.innerHTML = '<span class="booking-map-empty">Location not available for this field.</span>';
    return;
  }
  const map = MapService.init('bookingFieldMap', { center: [lat, lng], zoom: 15 });
  if (!map) {
    mapEl.innerHTML = '<span class="booking-map-empty">Unable to load map.</span>';
    return;
  }
  MapService.clearMarkers();
  MapService.addMarker(lat, lng, {
    name: venue.name,
    city: venue.city,
    district: venue.district,
    location: venue.location,
    price: venue.price
  });
  setTimeout(function() {
    if (typeof map.invalidateSize === 'function') map.invalidateSize();
  }, 40);
}

// Update save button state
function updateSaveButton(isFavorite) {
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
      const textEl = saveBtn.querySelector('span');
      saveBtn.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
      if (isFavorite) {
          saveBtn.classList.add('active');
          if (textEl) textEl.textContent = 'Saved';
      } else {
          saveBtn.classList.remove('active');
          if (textEl) textEl.textContent = 'Save';
      }
  }
}

// Handle share
function handleShare() {
  if (navigator.share) {
      navigator.share({
          title: document.querySelector('.field-title')?.textContent || 'Field Details',
          url: window.location.href
      }).catch(console.error);
  } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href).then(() => {
          alert('Link copied to clipboard!');
      }).catch(() => {
          alert('Share feature not available. Please copy the URL manually.');
      });
  }
}

// Handle booking
function handleBooking(venueId) {
  const venue = findVenueById(venueId);
  if (venue) {
      // Use the openBookingModal function from home.js
      if (typeof openBookingModal === 'function') {
          openBookingModal(venue);
      } else {
          // Fallback if function not loaded yet
          alert('Loading booking system...');
          setTimeout(() => {
              if (typeof openBookingModal === 'function') {
                  openBookingModal(venue);
              } else {
                  alert(`Booking ${venue.name}...\n\nPlease refresh the page and try again.`);
              }
          }, 500);
      }
  }
}

// Make handleBooking and submitReview available globally (for inline onclick)
window.handleBooking = handleBooking;
window.submitReview = submitReview;

// Load reviews from localStorage
function loadReviews(venueId) {
  const saved = localStorage.getItem(`reviews_${venueId}`);
  if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
  }
  return [];
}

// Save reviews to localStorage
function saveReviews(venueId, reviews) {
  localStorage.setItem(`reviews_${venueId}`, JSON.stringify(reviews));
}

function formatReviewDate(dateValue) {
  if (!dateValue) return '';
  var date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function normalizeReviewItem(r) {
  if (!r) return null;
  var name = (r.reviewerName || (r.user && r.user.fullName) || 'Anonymous').trim();
  var ratingNum = parseInt(r.rating, 10);
  if (!Number.isFinite(ratingNum) || ratingNum < 1) ratingNum = 1;
  if (ratingNum > 5) ratingNum = 5;
  return {
    id: String(r.id || r._id || ('local_' + Date.now() + '_' + Math.random())),
    userId: r.userId ? String(r.userId) : (r.user && r.user.id ? String(r.user.id) : ''),
    reviewerName: name || 'Anonymous',
    reviewerInitial: (r.reviewerInitial || name.charAt(0) || '?').toUpperCase(),
    reviewerAvatar: (r.reviewerAvatar || (r.user && r.user.avatar) || '').trim(),
    reviewText: String(r.reviewText || '').trim(),
    rating: ratingNum,
    context: String(r.context || 'Player'),
    createdAt: r.createdAt || r.date || null,
    dateLabel: formatReviewDate(r.createdAt || r.date)
  };
}

function mergeReviewsByKey(preferred, secondary) {
  var out = [];
  var seen = new Set();
  (preferred || []).forEach(function(r) {
    var n = normalizeReviewItem(r);
    if (!n) return;
    var key = n.id || (n.userId + '|' + n.reviewText + '|' + n.rating);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(n);
  });
  (secondary || []).forEach(function(r) {
    var n = normalizeReviewItem(r);
    if (!n) return;
    var key = n.id || (n.userId + '|' + n.reviewText + '|' + n.rating);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(n);
  });
  out.sort(function(a, b) {
    var da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    var db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db - da;
  });
  return out;
}

function updateReviewsSummaryUI(reviewsToShow, fallbackRating) {
  var summaryRatingEl = document.getElementById('reviewsSummaryRating');
  var summaryCountEl = document.getElementById('reviewsSummaryCount');
  if (!summaryRatingEl || !summaryCountEl) return;
  if (!reviewsToShow || !reviewsToShow.length) {
    summaryRatingEl.textContent = Number(fallbackRating || 0).toFixed(1);
    summaryCountEl.textContent = '0 total reviews';
    return;
  }
  var sum = reviewsToShow.reduce(function(acc, r) { return acc + (r.rating || 0); }, 0);
  var avg = sum / reviewsToShow.length;
  summaryRatingEl.textContent = avg.toFixed(1);
  summaryCountEl.textContent = reviewsToShow.length + ' total reviews';
}

function renderReviewsState(message, stateClass) {
  var reviewsList = document.getElementById('reviewsList');
  if (!reviewsList) return;
  reviewsList.innerHTML = '<div class="' + stateClass + '">' + message + '</div>';
}

function markReviewFieldDirty(fieldId) {
  try {
    var raw = localStorage.getItem(REVIEW_DIRTY_STORAGE_KEY_FIELDINFO);
    var list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    var id = String(fieldId);
    if (list.indexOf(id) === -1) list.push(id);
    localStorage.setItem(REVIEW_DIRTY_STORAGE_KEY_FIELDINFO, JSON.stringify(list));
  } catch (_) {}
}

// Submit review (API when logged in, else localStorage)
function submitReview(venueId) {
  const textarea = document.getElementById('reviewTextarea');
  const ratingValue = document.getElementById('ratingValue');
  const reviewText = textarea.value.trim();
  const rating = parseInt(ratingValue.textContent, 10);

  if (rating === 0) {
      alert('Please select a rating before submitting.');
      return;
  }
  const submitBtn = document.querySelector('.submit-review-btn');
  function setSubmitLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = !!loading;
    submitBtn.textContent = loading ? 'Submitting...' : 'Submit Review';
  }

  function doLocalSubmit() {
    var reviews = loadReviews(venueId);
    var newReview = {
      id: Date.now(),
      reviewerName: 'You',
      reviewerInitial: 'Y',
      reviewText: reviewText,
      rating: rating,
      date: new Date().toISOString(),
      context: 'Recent booking'
    };
    reviews.unshift(newReview);
    saveReviews(venueId, reviews);
    markReviewFieldDirty(venueId);
    textarea.value = '';
    resetStarRating();
    try {
      window.dispatchEvent(new CustomEvent('matchfield:reviews-updated', { detail: { fieldId: String(venueId) } }));
    } catch (_) {}
    displayReviews(venueId, null);
    alert('Thank you for your review!');
  }

  if (typeof API !== 'undefined' && API.getAuthToken && API.getAuthToken() && API.reviews && API.reviews.create) {
    setSubmitLoading(true);
    API.reviews.create({
      fieldId: venueId,
      rating: rating,
      reviewText: reviewText,
      context: 'Recent booking'
    }).then(function(res) {
      if (res && res.review) {
        var localReviews = loadReviews(venueId).filter(function(r) {
          return String(r.id || '') !== String(res.review.id || '');
        });
        localReviews.unshift(res.review);
        saveReviews(venueId, localReviews);
      }
      markReviewFieldDirty(venueId);
      textarea.value = '';
      resetStarRating();
      try {
        window.dispatchEvent(new CustomEvent('matchfield:reviews-updated', { detail: { fieldId: String(venueId) } }));
      } catch (_) {}
      displayReviews(venueId, null);
      alert('Thank you for your review!');
    }).catch(function(err) {
      alert(err.message || 'Failed to submit review.');
    }).finally(function() {
      setSubmitLoading(false);
    });
    return;
  }
  doLocalSubmit();
}

// Map API review to display format (handles both API { user, reviewText } and local { reviewerName, reviewerInitial })
function mapApiReviewToDisplay(r) {
  return normalizeReviewItem(r);
}

// Display reviews (fetches from API when available, uses preloaded or fallbacks)
function displayReviews(venueId, preloadedApiReviews) {
  var reviewsList = document.getElementById('reviewsList');
  if (!reviewsList) return;
  var venue = findVenueById(venueId);
  var fallbackRating = venue && venue.rating ? venue.rating : 0;
  var requestToken = ++reviewsRequestToken;

  function render(reviewsToShow) {
    if (requestToken !== reviewsRequestToken) return;
    var emptyMsg = '<div class="reviews-empty">No reviews yet. Be the first to leave a review!</div>';
    reviewsList.innerHTML = reviewsToShow.length
      ? reviewsToShow.map(function(r) {
          var rev = normalizeReviewItem(r);
          if (!rev) return '';
          var avatarHtml = rev.reviewerAvatar
            ? ('<img src="' + rev.reviewerAvatar + '" alt="' + (rev.reviewerName || 'User') + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">')
            : (rev.reviewerInitial || '?');
          return '<div class="review-card"><div class="review-header"><div class="reviewer-info"><div class="reviewer-avatar-small">' + avatarHtml + '</div><div><div class="reviewer-name">' + (rev.reviewerName || 'Anonymous') + '</div><div class="review-context">' + ((rev.context || '') + (rev.dateLabel ? ' · ' + rev.dateLabel : '')) + '</div></div></div><div class="review-rating-display"><span class="star-filled">' + ('★'.repeat(rev.rating || 0)) + ('☆'.repeat(5 - (rev.rating || 0))) + '</span></div></div>' + (rev.reviewText ? ('<div class="review-text">' + rev.reviewText + '</div>') : '') + '</div>';
        }).join('')
      : emptyMsg;
    updateReviewsSummaryUI(reviewsToShow, fallbackRating);
    reviewsByFieldCache[String(venueId)] = reviewsToShow.map(normalizeReviewItem).filter(Boolean);
  }

  var localReviews = (loadReviews(venueId) || []).map(normalizeReviewItem).filter(Boolean);
  var preloadedReviews = (preloadedApiReviews || []).map(normalizeReviewItem).filter(Boolean);
  var cached = reviewsByFieldCache[String(venueId)] || [];
  var combined = mergeReviewsByKey(preloadedReviews, mergeReviewsByKey(localReviews, cached));
  if (combined.length) render(combined);
  else renderReviewsState('Loading reviews...', 'loading-state');

  if (typeof API !== 'undefined' && API.reviews && API.reviews.getByField) {
    API.reviews.getByField(venueId, { limit: 20 }).then(function(res) {
      if (requestToken !== reviewsRequestToken) return;
      var apiReviews = (res && res.reviews) ? res.reviews : [];
      combined = mergeReviewsByKey(apiReviews, localReviews);
      render(combined.length ? combined : []);
    }).catch(function() {
      if (requestToken !== reviewsRequestToken) return;
      var fallback = mergeReviewsByKey(localReviews, preloadedReviews);
      if (fallback.length) {
        render(fallback);
        return;
      }
      renderReviewsState('Unable to load reviews right now. Please try again.', 'error-state');
      updateReviewsSummaryUI([], fallbackRating);
    });
    return;
  }

  render(combined.length ? combined : []);
}

// Initialize gallery sliding
function initializeGallerySliding(totalImages) {
  if (totalImages <= 1) return;

  const gallery = document.getElementById('fieldGallery');
  const navLeft = document.getElementById('galleryNavLeft');
  const navRight = document.getElementById('galleryNavRight');
  const dotsWrap = document.getElementById('galleryDots');
  const images = gallery.querySelectorAll('.field-main-image');
  let touchStartX = null;
  
  let currentIndex = 0;

  function showImage(index) {
    images.forEach((img, i) => {
      if (i === index) {
        img.classList.add('active');
      } else {
        img.classList.remove('active');
      }
    });
    currentIndex = index;
    gallery.setAttribute('data-current-index', index);
    updateDots();
  }

  function updateDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = Array.from({ length: totalImages }).map(function(_, idx) {
      return '<button type="button" class="gallery-dot ' + (idx === currentIndex ? 'active' : '') + '" data-idx="' + idx + '" aria-label="Go to image ' + (idx + 1) + '"></button>';
    }).join('');
    dotsWrap.querySelectorAll('.gallery-dot').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(idx)) showImage(idx);
      });
    });
  }

  function nextImage() {
    const nextIndex = (currentIndex + 1) % totalImages;
    showImage(nextIndex);
  }

  function prevImage() {
    const prevIndex = (currentIndex - 1 + totalImages) % totalImages;
    showImage(prevIndex);
  }

  if (navLeft) {
    navLeft.addEventListener('click', (e) => {
      e.stopPropagation();
      prevImage();
    });
  }

  if (navRight) {
    navRight.addEventListener('click', (e) => {
      e.stopPropagation();
      nextImage();
    });
  }

  if (gallery) {
    gallery.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches.length) return;
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    gallery.addEventListener('touchend', function (e) {
      if (touchStartX == null || !e.changedTouches || !e.changedTouches.length) return;
      const endX = e.changedTouches[0].clientX;
      const delta = endX - touchStartX;
      touchStartX = null;
      if (Math.abs(delta) < 35) return;
      if (delta < 0) nextImage();
      else prevImage();
    }, { passive: true });
  }

  updateDots();

  // Optional: Add keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (gallery && document.getElementById('fieldInfoContent').contains(gallery)) {
      if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      }
    }
  });
}

// Initialize star rating
function initializeStarRating() {
  const stars = document.querySelectorAll('.star-input');
  let currentRating = 0;

  stars.forEach((star, index) => {
      star.addEventListener('click', () => {
          currentRating = index + 1;
          updateStarRating(currentRating);
          document.getElementById('ratingValue').textContent = currentRating;
      });

      star.addEventListener('mouseenter', () => {
          highlightStars(index + 1);
      });
  });

  const starContainer = document.getElementById('starRating');
  if (starContainer) {
      starContainer.addEventListener('mouseleave', () => {
          highlightStars(currentRating);
      });
  }
}

// Update star rating display
function updateStarRating(rating) {
  const stars = document.querySelectorAll('.star-input');
  stars.forEach((star, index) => {
      if (index < rating) {
          star.classList.add('active');
      } else {
          star.classList.remove('active');
      }
  });
}

// Highlight stars on hover
function highlightStars(rating) {
  const stars = document.querySelectorAll('.star-input');
  stars.forEach((star, index) => {
      if (index < rating) {
          star.classList.add('highlight');
      } else {
          star.classList.remove('highlight');
      }
  });
}

// Reset star rating
function resetStarRating() {
  const stars = document.querySelectorAll('.star-input');
  stars.forEach(star => {
      star.classList.remove('active', 'highlight');
  });
  document.getElementById('ratingValue').textContent = '0';
}

// Toggle reviews visibility
function toggleReviews() {
  const reviewsList = document.getElementById('reviewsList');
  const toggleBtn = document.getElementById('toggleReviewsBtn');
  const toggleText = toggleBtn.querySelector('.toggle-text');
  const toggleIcon = toggleBtn.querySelector('.toggle-icon');
  
  if (reviewsList.style.display === 'none' || !reviewsList.style.display) {
      reviewsList.style.display = 'flex';
      toggleText.textContent = 'Hide reviews';
      toggleIcon.classList.remove('fi-rr-angle-down');
      toggleIcon.classList.add('fi-rr-angle-up');
  } else {
      reviewsList.style.display = 'none';
      toggleText.textContent = 'View reviews';
      toggleIcon.classList.remove('fi-rr-angle-up');
      toggleIcon.classList.add('fi-rr-angle-down');
  }
}

// Setup profile popup (same as home-player.js)
function setupProfilePopup() {
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
      
      document.addEventListener('click', (e) => {
          if (profilePopup && profilePopup.classList.contains('active')) {
              if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
                  profilePopup.classList.remove('active');
              }
          }
      });
  }
}

// Notification popup handled by shared notifications.js
function setupNotificationPopup() {}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  function showError(msg, title) {
    title = title || 'Error';
    var el = document.getElementById('fieldInfoContent');
    if (el) el.innerHTML = '<div class="error-state"><h2>' + title + '</h2><p>' + (msg || 'An error occurred.') + '</p><a href="home.html" class="back-btn" style="display: inline-flex; margin-top: 20px;">Back to Home</a></div>';
  }
  try {
    loadFavoritesFromStorage();
    setupProfilePopup();
    setupNotificationPopup();
    var venueId = getVenueIdFromURL();
    if (!venueId) {
      showError('Please select a field from the home page.', 'Invalid field ID');
      return;
    }
    loadFieldFromAPI(venueId).then(function(venue) {
      if (venue) {
        currentFieldFromAPI = venue;
        loadFavoritesFromStorage();
        renderFieldInfo(venue);
        return;
      }
      var fallbackId = parseInt(venueId, 10) || venueId;
      var venue = findVenueById(fallbackId);
      renderFieldInfo(venue);
    }).catch(function(err) {
      console.error('Error loading field:', err);
      var venue = findVenueById(venueId);
      if (venue) renderFieldInfo(venue);
      else showError('The field could not be loaded.', 'Error loading field');
    });
  } catch (error) {
    console.error('Error loading field info:', error);
    showError('An error occurred while loading the field details.', 'Error loading field information');
  }
});

window.addEventListener('storage', function(e) {
  if (e.key !== 'favoriteVenues') return;
  loadFavoritesFromStorage();
  if (currentFieldFromAPI) updateSaveButton(!!currentFieldFromAPI.isFavorite);
});

window.addEventListener('matchfield:reviews-updated', function(e) {
  var fieldId = e && e.detail && e.detail.fieldId ? String(e.detail.fieldId) : '';
  if (!currentFieldFromAPI || String(currentFieldFromAPI.id) !== fieldId) return;
  displayReviews(fieldId, null);
});








