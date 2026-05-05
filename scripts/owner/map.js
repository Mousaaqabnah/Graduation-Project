// Owner map: API fields (getMine) + Leaflet via MapService (same stack as player map)

var fieldsData = [];
var allFieldsData = [];
var userLocation = null;

function mapOwnerFieldToView(field, index) {
  var base = window.FieldMapData.mapApiFieldToView(field, index);
  base.isActive = field.isActive !== false;
  return base;
}

function loadOwnerFieldsFromAPI() {
  if (typeof API === 'undefined' || !API.fields || !API.fields.getMine) {
    return Promise.resolve([]);
  }
  return API.fields
    .getMine()
    .then(function (res) {
      var raw = res && res.fields ? res.fields : [];
      allFieldsData = raw.map(function (f, i) {
        return mapOwnerFieldToView(f, i);
      });
      fieldsData = allFieldsData.slice();
      return fieldsData;
    })
    .catch(function (err) {
      console.warn('Owner map: failed to load fields', err);
      return [];
    });
}

function escapeHtml(str) {
  if (str == null) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatPriceTry(n) {
  if (n == null || n === '') return '—';
  return '₺' + n + '/h';
}

document.addEventListener('DOMContentLoaded', function () {
  loadOwnerFieldsFromAPI().then(function () {
    initMapView();
    renderFieldList(fieldsData);
    setupSearch();
    updateFieldCount(fieldsData.length);
    updateMapMarkers(fieldsData);
    setupProfile();
    setupUseLocation();
    setupRecenter();
    setupManageLocationLink();
  });
});

function initMapView() {
  if (typeof MapService === 'undefined') return;
  MapService.init('mapContainer', { center: [41.0082, 28.9784], zoom: 12 });
  MapService.onMarkerClick(function (data) {
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

  if (!fields || fields.length === 0) {
    fieldList.innerHTML =
      '<div class="empty-state">' +
      '<i class="fi fi-rr-map-marker"></i>' +
      '<p>No fields yet</p>' +
      '<a href="fields.html" class="btn-add-field-link">Add your first field</a>' +
      '</div>';
    return;
  }

  fields.forEach(function (field) {
    fieldList.appendChild(createFieldCard(field));
  });
}

function createFieldCard(field) {
  var card = document.createElement('div');
  card.className = 'field-card';
  card.dataset.fieldId = field.id;
  card.dataset.sport = field.sport;

  var priceStr = field.price != null && field.price > 0 ? formatPriceTry(field.price) : '—';
  var rating = field.rating != null ? Number(field.rating).toFixed(1) : '0';
  var reviews = field.reviews || 0;
  var statusLabel = field.isActive ? 'Active' : 'Inactive';
  var statusClass = field.isActive ? 'active' : 'inactive';

  card.innerHTML = [
    '<div class="field-icon"><i class="fi fi-rr-football"></i></div>',
    '<div class="field-content">',
    '<div class="field-header"><h3 class="field-name">' + escapeHtml(field.name) + '</h3></div>',
    '<div class="field-location"><i class="fi fi-rr-marker"></i><span>' + escapeHtml(field.location || '—') + '</span></div>',
    '<div class="field-status-row">',
    '<span class="field-status-badge ' + statusClass + '">' + escapeHtml(statusLabel) + '</span>',
    '</div>',
    '<div class="field-details">',
    '<span class="field-price">' + escapeHtml(priceStr) + '</span>',
    '<div class="field-rating"><i class="fi fi-rr-star"></i><span>' + rating + ' (' + reviews + ')</span></div>',
    '</div>',
    '<div class="field-amenities">',
    (field.amenities || [])
      .slice(0, 2)
      .map(function (a) {
        return '<span class="amenity-tag">' + escapeHtml(a) + '</span>';
      })
      .join(''),
    '</div>',
    '</div>',
    '<div class="field-actions">',
    '<button type="button" class="btn-view" data-field-id="' + escapeHtml(field.id) + '">View</button>',
    '<button type="button" class="btn-manage" data-field-id="' + escapeHtml(field.id) + '">Manage</button>',
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

  card.addEventListener('click', function (e) {
    if (e.target.closest('.btn-view') || e.target.closest('.btn-manage')) return;
    if (typeof MapService !== 'undefined') MapService.setCenter(field.lat, field.lng, 15);
    highlightFieldCard(field.id);
  });

  var viewBtn = card.querySelector('.btn-view');
  var manageBtn = card.querySelector('.btn-manage');
  if (viewBtn) {
    viewBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      viewField(field.id);
    });
  }
  if (manageBtn) {
    manageBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      manageField(field.id);
    });
  }

  return card;
}

function setupSearch() {
  var searchInput = document.getElementById('fieldSearchInput') || document.querySelector('.search-input');
  if (!searchInput) return;
  searchInput.addEventListener('input', function () {
    var query = this.value.toLowerCase().trim();
    if (query === '') {
      fieldsData = allFieldsData.slice();
    } else {
      fieldsData = allFieldsData.filter(function (f) {
        return (
          (f.name && f.name.toLowerCase().includes(query)) ||
          (f.location && f.location.toLowerCase().includes(query)) ||
          (f.sport && f.sport.toLowerCase().includes(query))
        );
      });
    }
    renderFieldList(fieldsData);
    updateFieldCount(fieldsData.length);
    updateMapMarkers(fieldsData);
  });
}

function updateMapMarkers(fields) {
  if (typeof MapService === 'undefined') return;
  MapService.clearMarkers();
  fields.forEach(function (field) {
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
  cards.forEach(function (card) {
    card.style.borderColor = '#E5E7EB';
    card.style.boxShadow = 'none';
    card.classList.remove('active');
  });
  var card = document.querySelector('[data-field-id="' + fieldId + '"]');
  if (card) {
    card.style.borderColor = '#007BFF';
    card.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.2)';
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function updateFieldCount(count) {
  var el = document.getElementById('fieldCount');
  if (el) el.textContent = count + ' field' + (count !== 1 ? 's' : '');
}

function viewField(fieldId) {
  if (typeof openViewFieldModalForFieldId !== 'function') {
    window.location.href = 'fields.html?view=' + encodeURIComponent(fieldId);
    return;
  }
  openViewFieldModalForFieldId(fieldId).catch(function (err) {
    console.error('viewField', err);
    alert((err && err.message) || 'Could not load field details.');
    if (typeof closeViewModal === 'function') closeViewModal();
  });
}

function manageField(fieldId) {
  window.location.href = 'fields.html?manage=' + encodeURIComponent(fieldId);
}

function setupUseLocation() {
  var btn = document.querySelector('.btn-use-location');
  var locationSpan = document.querySelector('.location-indicator span');
  if (!btn) return;
  btn.addEventListener('click', function () {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    btn.disabled = true;
    var prev = btn.textContent;
    btn.textContent = 'Locating...';
    navigator.geolocation.getCurrentPosition(
      function (position) {
        userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (typeof MapService !== 'undefined') MapService.setCenter(userLocation.lat, userLocation.lng, 14);
        if (locationSpan) locationSpan.textContent = 'Your location';
        btn.disabled = false;
        btn.textContent = prev;
      },
      function () {
        alert('Unable to retrieve your location. Please enable location services.');
        btn.disabled = false;
        btn.textContent = prev;
      }
    );
  });
}

function setupRecenter() {
  var btn = document.querySelector('.btn-recenter');
  if (!btn) return;
  btn.addEventListener('click', function () {
    if (fieldsData.length > 0 && typeof MapService !== 'undefined') {
      MapService.fitMarkers();
    } else if (userLocation && typeof MapService !== 'undefined') {
      MapService.setCenter(userLocation.lat, userLocation.lng, 14);
    } else if (typeof MapService !== 'undefined') {
      MapService.setCenter(41.0082, 28.9784, 12);
    }
  });
}

function setupManageLocationLink() {
  var btn = document.querySelector('.btn-manage-location');
  if (!btn) return;
  btn.addEventListener('click', function () {
    window.location.href = 'fields.html';
  });
}

function setupProfile() {
  var profileBtn = document.getElementById('profileBtn');
  var profilePopup = document.getElementById('profilePopup');
  if (!profileBtn || !profilePopup) return;
  profileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    profilePopup.classList.toggle('active');
    var notificationPopup = document.getElementById('notificationPopup');
    if (notificationPopup) notificationPopup.classList.remove('active');
  });
  document.addEventListener('click', function (e) {
    if (
      profilePopup.classList.contains('active') &&
      !profilePopup.contains(e.target) &&
      !profileBtn.contains(e.target)
    ) {
      profilePopup.classList.remove('active');
    }
  });
}
