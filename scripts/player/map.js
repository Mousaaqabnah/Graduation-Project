// Fields data: loaded from API, with coordinates
var fieldsData = [];
var allFieldsData = [];
var userLocation = null;

function mapApiFieldToView(field, index) {
  return window.FieldMapData.mapApiFieldToView(field, index);
}

function loadFieldsFromAPI() {
  if (typeof API === 'undefined' || !API.fields) {
    return Promise.resolve([]);
  }
  return API.fields.getAll({ limit: 100 }).then(function(res) {
    var raw = (res && res.fields) ? res.fields : [];
    allFieldsData = raw.map(function(f, i) { return mapApiFieldToView(f, i); });
    fieldsData = allFieldsData.slice();
    return fieldsData;
  }).catch(function(err) {
    console.warn('Map: failed to load fields', err);
    return [];
  });
}

// Initialize the map page
document.addEventListener('DOMContentLoaded', function() {
  loadFieldsFromAPI().then(function() {
    initMapView();
    renderFieldList(fieldsData);
    setupFilters();
    setupSearch();
    updateFieldCount(fieldsData.length);
    updateMapMarkers(fieldsData);
    setupProfile();
    setupUseLocation();
    setupRecenter();
  });
});

function initMapView() {
  if (typeof MapService === 'undefined') return;
  MapService.init('mapContainer', { center: [41.0082, 28.9784], zoom: 12 });
  MapService.onMarkerClick(function(data) {
    if (data && data.id) {
      highlightFieldCard(data.id);
      var card = document.querySelector('[data-field-id="' + data.id + '"]');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function renderFieldList(fields) {
  var fieldList = document.getElementById('fieldList');
  if (!fieldList) return;
  fieldList.innerHTML = '';

  fields.forEach(function(field) {
    var card = createFieldCard(field);
    fieldList.appendChild(card);
  });
}

function createFieldCard(field) {
  var card = document.createElement('div');
  card.className = 'field-card';
  card.dataset.fieldId = field.id;
  card.dataset.sport = field.sport;

  var priceStr = (field.price != null && field.price > 0) ? ('₺' + field.price + '/h') : 'Price N/A';
  var rating = field.rating != null ? field.rating.toFixed(1) : '0';
  var reviews = field.reviews || 0;

  card.innerHTML = [
    '<div class="field-icon"><i class="fi fi-rr-football"></i></div>',
    '<div class="field-content">',
      '<h3 class="field-name">' + escapeHtml(field.name) + '</h3>',
      '<div class="field-location"><i class="fi fi-rr-marker"></i><span>' + escapeHtml(field.location || 'Location') + '</span></div>',
      '<div class="field-details">',
        '<span class="field-price">' + priceStr + '</span>',
        '<div class="field-rating"><i class="fi fi-rr-star"></i><span>' + rating + ' (' + reviews + ')</span></div>',
      '</div>',
      '<div class="field-amenities">',
        (field.amenities || []).slice(0, 2).map(function(a) { return '<span class="amenity-tag">' + escapeHtml(a) + '</span>'; }).join(''),
      '</div>',
    '</div>',
    '<div class="field-actions">',
      '<span class="field-distance">' + (field.distance || '') + '</span>',
      '<button class="btn-view" data-field-id="' + field.id + '">View</button>',
    '</div>'
  ].join('');

  var icon = card.querySelector('.field-icon i');
  var sportIcons = {
    football: 'fi-rr-football',
    basketball: 'fi-rr-basketball',
    tennis: 'fi-rr-tennis',
    padel: 'fi-rr-tennis',
    futsal: 'fi-rr-football',
    volleyball: 'fi-rr-volleyball'
  };
  if (sportIcons[field.sport]) icon.className = 'fi ' + sportIcons[field.sport];

  card.addEventListener('click', function(e) {
    if (!e.target.classList.contains('btn-view')) {
      if (MapService) MapService.setCenter(field.lat, field.lng, 15);
      highlightFieldCard(field.id);
    }
  });

  var viewBtn = card.querySelector('.btn-view');
  if (viewBtn) {
    viewBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      viewField(field.id);
    });
  }

  return card;
}

function escapeHtml(str) {
  if (str == null) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setupFilters() {
  var filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterButtons.forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      var sport = this.dataset.sport;
      var filtered = sport === 'all' ? allFieldsData.slice() : allFieldsData.filter(function(f) { return f.sport === sport; });
      applySearchAndSportFilter(filtered);
    });
  });
}

function setupSearch() {
  var searchInput = document.querySelector('.search-input');
  if (!searchInput) return;
  searchInput.addEventListener('input', function() {
    var query = this.value.toLowerCase().trim();
    var base = allFieldsData;
    var activeSport = document.querySelector('.filter-btn.active');
    if (activeSport && activeSport.dataset.sport !== 'all') {
      base = base.filter(function(f) { return f.sport === activeSport.dataset.sport; });
    }
    var filtered = query === '' ? base : base.filter(function(f) {
      return (f.name && f.name.toLowerCase().includes(query)) ||
             (f.location && f.location.toLowerCase().includes(query));
    });
    applySearchAndSportFilter(filtered);
  });
}

function applySearchAndSportFilter(filtered) {
  fieldsData = filtered;
  renderFieldList(filtered);
  updateFieldCount(filtered.length);
  updateMapMarkers(filtered);
}

function updateMapMarkers(fields) {
  if (typeof MapService === 'undefined') return;
  MapService.clearMarkers();
  fields.forEach(function(field) {
    if (field.lat != null && field.lng != null) {
      MapService.addMarker(field.lat, field.lng, {
        id: field.id,
        name: field.name,
        city: field.city,
        district: field.district,
        location: field.location,
        price: field.price
      });
    }
  });
  if (fields.length > 0) MapService.fitMarkers();
  else if (userLocation) MapService.setCenter(userLocation.lat, userLocation.lng, 14);
  else MapService.setCenter(41.0082, 28.9784, 12);
}

function highlightFieldCard(fieldId) {
  var cards = document.querySelectorAll('.field-card');
  cards.forEach(function(card) {
    card.style.borderColor = '#E5E7EB';
    card.style.boxShadow = 'none';
  });
  var card = document.querySelector('[data-field-id="' + fieldId + '"]');
  if (card) {
    card.style.borderColor = '#007BFF';
    card.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.2)';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function updateFieldCount(count) {
  var el = document.getElementById('fieldCount');
  if (el) el.textContent = count + ' field' + (count !== 1 ? 's' : '') + ' found';
}

function viewField(fieldId) {
  window.location.href = 'field-info.html?id=' + encodeURIComponent(fieldId);
}

function setupUseLocation() {
  var btn = document.querySelector('.btn-use-location');
  var locationSpan = document.querySelector('.location-indicator span');
  if (!btn) return;
  btn.addEventListener('click', function() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Locating...';
    navigator.geolocation.getCurrentPosition(
      function(position) {
        userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (MapService) MapService.setCenter(userLocation.lat, userLocation.lng, 14);
        if (locationSpan) locationSpan.textContent = 'Your location';
        btn.disabled = false;
        btn.textContent = 'Use my location';
      },
      function() {
        alert('Unable to retrieve your location. Please enable location services.');
        btn.disabled = false;
        btn.textContent = 'Use my location';
      }
    );
  });
}

function setupRecenter() {
  var btn = document.querySelector('.btn-recenter');
  if (!btn) return;
  btn.addEventListener('click', function() {
    if (fieldsData.length > 0 && MapService) {
      MapService.fitMarkers();
    } else if (userLocation && MapService) {
      MapService.setCenter(userLocation.lat, userLocation.lng, 14);
    } else if (MapService) {
      MapService.setCenter(41.0082, 28.9784, 12);
    }
  });
}

function setupProfile() {
  var profileBtn = document.getElementById('profileBtn');
  var profilePopup = document.getElementById('profilePopup');
  if (!profileBtn || !profilePopup) return;
  profileBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    profilePopup.classList.toggle('active');
    var notificationPopup = document.getElementById('notificationPopup');
    if (notificationPopup) notificationPopup.classList.remove('active');
  });
  document.addEventListener('click', function(e) {
    if (profilePopup.classList.contains('active') &&
        !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
      profilePopup.classList.remove('active');
    }
  });
}
