// Sample field data
const fieldsData = [
    {
        id: 'fozl',
        name: 'Fozl football court',
        location: 'Üsküdar, İstanbul',
        price: '€1500/h',
        rating: 4.8,
        reviews: 124,
        distance: '2.1 km',
        amenities: ['Outdoor', 'Lights', 'Parking'],
        sport: 'football'
    },
    {
        id: 'sunset',
        name: 'Sunset padel court',
        location: 'Kadıköy, İstanbul',
        price: '€900/h',
        rating: 4.6,
        reviews: 68,
        distance: '3.4 km',
        amenities: ['Outdoor', 'Locker room'],
        sport: 'padel'
    },
    {
        id: 'indoor',
        name: 'Indoor futsal arena',
        location: 'Beşiktaş, İstanbul',
        price: '€1100/h',
        rating: 4.9,
        reviews: 210,
        distance: '4.0 km',
        amenities: ['Indoor', 'Changing rooms'],
        sport: 'futsal'
    }
];

// Initialize the map page
document.addEventListener('DOMContentLoaded', function() {
    renderFieldList();
    setupFilters();
    setupSearch();
    setupMapMarkers();
    updateFieldCount();
    setupNotifications();
    setupProfile();
});

// Render field list
function renderFieldList(fields = fieldsData) {
    const fieldList = document.getElementById('fieldList');
    fieldList.innerHTML = '';

    fields.forEach(field => {
        const fieldCard = createFieldCard(field);
        fieldList.appendChild(fieldCard);
    });
}

// Create field card element
function createFieldCard(field) {
    const card = document.createElement('div');
    card.className = 'field-card';
    card.dataset.fieldId = field.id;
    card.dataset.sport = field.sport;

    card.innerHTML = `
        <div class="field-icon">
            <i class="fi fi-rr-football"></i>
        </div>
        <div class="field-content">
            <h3 class="field-name">${field.name}</h3>
            <div class="field-location">
                <i class="fi fi-rr-marker"></i>
                <span>${field.location}</span>
            </div>
            <div class="field-details">
                <span class="field-price">${field.price}</span>
                <div class="field-rating">
                    <i class="fi fi-rr-star"></i>
                    <span>${field.rating} (${field.reviews})</span>
                </div>
            </div>
            <div class="field-amenities">
                ${field.amenities.slice(0, 2).map(amenity => `<span class="amenity-tag">${amenity}</span>`).join('')}
            </div>
        </div>
        <div class="field-actions">
            <span class="field-distance">${field.distance}</span>
            <button class="btn-view" onclick="viewField('${field.id}')">View</button>
        </div>
    `;

    // Update icon based on sport type
    const icon = card.querySelector('.field-icon i');
    const sportIcons = {
        'football': 'fi-rr-football',
        'basketball': 'fi-rr-basketball',
        'tennis': 'fi-rr-tennis',
        'padel': 'fi-rr-tennis',
        'futsal': 'fi-rr-football',
        'volleyball': 'fi-rr-volleyball'
    };
    if (sportIcons[field.sport]) {
        icon.className = `fi ${sportIcons[field.sport]}`;
    }

    // Add click handler to highlight marker
    card.addEventListener('click', () => {
        highlightMarker(field.id);
    });

    return card;
}

// Setup filter buttons
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Filter fields
            const sport = this.dataset.sport;
            const filteredFields = sport === 'all' 
                ? fieldsData 
                : fieldsData.filter(field => field.sport === sport);
            
            renderFieldList(filteredFields);
            updateFieldCount(filteredFields.length);
            updateMapMarkers(filteredFields);
        });
    });
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.querySelector('.search-input');
    
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        
        if (query === '') {
            renderFieldList();
            updateFieldCount();
            updateMapMarkers(fieldsData);
            return;
        }
        
        const filteredFields = fieldsData.filter(field => 
            field.name.toLowerCase().includes(query) ||
            field.location.toLowerCase().includes(query)
        );
        
        renderFieldList(filteredFields);
        updateFieldCount(filteredFields.length);
        updateMapMarkers(filteredFields);
    });
}

// Setup map markers
function setupMapMarkers() {
    const markers = document.querySelectorAll('.map-marker');
    
    markers.forEach(marker => {
        marker.addEventListener('click', function() {
            const fieldId = this.dataset.field;
            highlightFieldCard(fieldId);
        });
    });
}

// Update map markers visibility
function updateMapMarkers(fields) {
    const markers = document.querySelectorAll('.map-marker');
    const fieldIds = fields.map(f => f.id);
    
    markers.forEach(marker => {
        const fieldId = marker.dataset.field;
        if (fieldIds.includes(fieldId)) {
            marker.style.display = 'flex';
        } else {
            marker.style.display = 'none';
        }
    });
}

// Highlight marker
function highlightMarker(fieldId) {
    const markers = document.querySelectorAll('.map-marker');
    markers.forEach(m => {
        m.style.transform = 'rotate(-45deg)';
        m.style.zIndex = '1';
    });
    
    const marker = document.querySelector(`[data-field="${fieldId}"]`);
    if (marker) {
        marker.style.transform = 'rotate(-45deg) scale(1.15)';
        marker.style.zIndex = '10';
    }
}

// Highlight field card
function highlightFieldCard(fieldId) {
    const cards = document.querySelectorAll('.field-card');
    cards.forEach(card => {
        card.style.borderColor = '#E5E7EB';
        card.style.boxShadow = 'none';
    });
    
    const card = document.querySelector(`[data-field-id="${fieldId}"]`);
    if (card) {
        card.style.borderColor = '#007BFF';
        card.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.2)';
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Update field count
function updateFieldCount(count = fieldsData.length) {
    const fieldCount = document.getElementById('fieldCount');
    fieldCount.textContent = `${count} field${count !== 1 ? 's' : ''} found`;
}

// View field (navigate to field info page)
function viewField(fieldId) {
    // Navigate to field info page with field ID
    window.location.href = `field-info.html?id=${fieldId}`;
}

// Use my location button
document.querySelector('.btn-use-location')?.addEventListener('click', function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                alert(`Location found: ${position.coords.latitude}, ${position.coords.longitude}\n\nIn a real app, this would update the map and field list based on your location.`);
            },
            function(error) {
                alert('Unable to retrieve your location. Please enable location services.');
            }
        );
    } else {
        alert('Geolocation is not supported by your browser.');
    }
});

// Re-center button
document.querySelector('.btn-recenter')?.addEventListener('click', function() {
    alert('In a real app, this would re-center the map to show all visible fields.');
});

// Setup notifications
function setupNotifications() {
    const notificationBtn = document.querySelector('.notification-btn');
    const notificationPopup = document.getElementById('notificationPopup');
    
    if (notificationBtn && notificationPopup) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationPopup.classList.toggle('active');
            // Close profile popup if open
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup && profilePopup.classList.contains('active')) {
                profilePopup.classList.remove('active');
            }
        });
        
        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (notificationPopup && notificationPopup.classList.contains('active')) {
                if (!notificationPopup.contains(e.target) && !notificationBtn.contains(e.target)) {
                    notificationPopup.classList.remove('active');
                }
            }
        });
    }
}

// Setup profile popup
function setupProfile() {
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



