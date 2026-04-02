// Owner's fields data (sample data - in real app, this would come from API)
const ownerFieldsData = [
    {
        id: 'fozl',
        name: 'Fozi football court',
        location: 'Üsküdar, Umraniye',
        price: '₺1600/h',
        rating: 4.8,
        reviews: 98,
        distance: '2.1 km',
        amenities: ['Outdoor', 'Lights', 'Parking'],
        sport: 'football',
        status: 'approved',
        latitude: 41.0082,
        longitude: 28.9784
    },
    {
        id: 'indoor',
        name: 'Indoor futsal court',
        location: 'Fozi court - Avcilar',
        price: '₺1100/h',
        rating: 4.9,
        reviews: 210,
        distance: '4.0 km',
        amenities: ['Indoor', 'Changing rooms'],
        sport: 'futsal',
        status: 'approved',
        latitude: 41.0123,
        longitude: 28.9856
    },
    {
        id: 'futsal',
        name: 'Futsal arena',
        location: 'Beşiktaş, İstanbul',
        price: '₺900/h',
        rating: 4.6,
        reviews: 68,
        distance: '3.4 km',
        amenities: ['Indoor', 'Locker room'],
        sport: 'futsal',
        status: 'approved',
        latitude: 41.0056,
        longitude: 28.9723
    }
];

// Initialize the map page
document.addEventListener('DOMContentLoaded', function() {
    renderFieldList();
    setupFilters();
    setupSearch();
    setupMapMarkers();
    updateFieldCount();
    setupProfile();
});

// Render field list
function renderFieldList(fields = ownerFieldsData) {
    const fieldList = document.getElementById('fieldList');
    fieldList.innerHTML = '';

    if (fields.length === 0) {
        fieldList.innerHTML = `
            <div class="empty-state">
                <i class="fi fi-rr-map-marker"></i>
                <p>No fields found</p>
                <a href="fields.html" class="btn-add-field-link">Add your first field</a>
            </div>
        `;
        return;
    }

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
            <div class="field-header">
                <h3 class="field-name">${field.name}</h3>
            </div>
            <div class="field-location">
                <i class="fi fi-rr-marker"></i>
                <span>${field.location}</span>
            </div>
            <div class="field-status-row">
                <span class="field-status-badge ${field.status}">${field.status.charAt(0).toUpperCase() + field.status.slice(1)}</span>
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
            <button class="btn-view" onclick="viewField('${field.id}')">View</button>
            <button class="btn-manage" onclick="manageField('${field.id}')">Manage</button>
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
        highlightFieldCard(field.id);
    });

    return card;
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('fieldSearchInput');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase().trim();
            
            if (query === '') {
                renderFieldList();
                updateFieldCount();
                updateMapMarkers(ownerFieldsData);
                return;
            }
            
            const filteredFields = ownerFieldsData.filter(field => 
                field.name.toLowerCase().includes(query) ||
                field.location.toLowerCase().includes(query) ||
                field.sport.toLowerCase().includes(query)
            );
            
            renderFieldList(filteredFields);
            updateFieldCount(filteredFields.length);
            updateMapMarkers(filteredFields);
        });
    }
}

// Setup map markers
function setupMapMarkers() {
    const markers = document.querySelectorAll('.map-marker');
    
    markers.forEach(marker => {
        marker.addEventListener('click', function() {
            const fieldId = this.dataset.field;
            highlightFieldCard(fieldId);
            highlightMarker(fieldId);
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
        m.classList.remove('active');
    });
    
    const marker = document.querySelector(`[data-field="${fieldId}"]`);
    if (marker) {
        marker.style.transform = 'rotate(-45deg) scale(1.15)';
        marker.style.zIndex = '10';
        marker.classList.add('active');
    }
}

// Highlight field card
function highlightFieldCard(fieldId) {
    const cards = document.querySelectorAll('.field-card');
    cards.forEach(card => {
        card.style.borderColor = '#E5E7EB';
        card.style.boxShadow = 'none';
        card.classList.remove('active');
    });
    
    const card = document.querySelector(`[data-field-id="${fieldId}"]`);
    if (card) {
        card.style.borderColor = '#007BFF';
        card.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.2)';
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Update field count
function updateFieldCount(count = ownerFieldsData.length) {
    const fieldCount = document.getElementById('fieldCount');
    if (fieldCount) {
        fieldCount.textContent = `${count} field${count !== 1 ? 's' : ''}`;
    }
}

// View field (navigate to field info or open modal)
function viewField(fieldId) {
    // In a real app, this would navigate to field details or open a modal
    const field = ownerFieldsData.find(f => f.id === fieldId);
    if (field) {
        alert(`Viewing field: ${field.name}\n\nIn a real app, this would open the field details page or modal.`);
    }
}

// Manage field (navigate to fields page with edit mode)
function manageField(fieldId) {
    // Navigate to fields page with the field ID to manage
    window.location.href = `fields.html?manage=${fieldId}`;
}

// Use my location button
document.querySelector('.btn-use-location')?.addEventListener('click', function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                alert(`Location found: ${position.coords.latitude}, ${position.coords.longitude}\n\nIn a real app, this would update the map center and show nearby fields.`);
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
    alert('In a real app, this would re-center the map to show all your fields.');
});

// Manage location button
document.querySelector('.btn-manage-location')?.addEventListener('click', function() {
    alert('In a real app, this would allow you to edit field locations on the map.');
});

// Notifications: scripts/player/notifications.js

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

