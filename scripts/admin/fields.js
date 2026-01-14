// Fields Management functionality

// DOM Elements
const notificationBtn = document.getElementById('notificationBtn');
const notificationPopup = document.getElementById('notificationPopup');
const profileBtn = document.getElementById('profileBtn');
const profilePopup = document.getElementById('profilePopup');
const fieldSearch = document.getElementById('fieldSearch');
const fieldFilter = document.getElementById('fieldFilter');
const statusFilter = document.getElementById('statusFilter');
const dateFilter = document.getElementById('dateFilter');
const fieldsTableBody = document.getElementById('fieldsTableBody');
const fieldInfoModal = document.getElementById('fieldInfoModal');
const closeFieldInfoModal = document.getElementById('closeFieldInfoModal');
const fieldInfoContent = document.getElementById('fieldInfoContent');

// Sample fields data
let allFields = [
    {
        id: 1,
        fieldName: 'Sunset Football Field',
        location: 'Central Park',
        owner: 'Maria Garcia',
        ownerVerificationId: 'ID-123456789',
        ownerVerificationDocument: { name: 'Owner ID Verification - ID-123456789.pdf', url: '#' },
        sport: 'football',
        price: '₺1,500',
        status: 'pending',
        description: 'A beautiful football field located in Central Park with excellent facilities.',
        amenities: ['Parking', 'Changing Rooms', 'Lighting'],
        size: 'Full Size',
        surface: 'Artificial Grass',
        images: [
            'https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop'
        ],
        documents: [
            { name: 'Field License.pdf', url: '#' },
            { name: 'Property Deed.pdf', url: '#' },
            { name: 'Insurance Certificate.pdf', url: '#' }
        ]
    },
    {
        id: 2,
        fieldName: 'Sunset Football Field',
        location: 'Central Park',
        owner: 'Maria Garcia',
        ownerVerificationId: 'ID-123456789',
        ownerVerificationDocument: { name: 'Owner ID Verification - ID-123456789.pdf', url: '#' },
        sport: 'football',
        price: '₺1,500',
        status: 'pending',
        description: 'A beautiful football field located in Central Park with excellent facilities.',
        amenities: ['Parking', 'Changing Rooms', 'Lighting'],
        size: 'Full Size',
        surface: 'Artificial Grass',
        images: [
            'https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop'
        ],
        documents: [
            { name: 'Field License.pdf', url: '#' },
            { name: 'Property Deed.pdf', url: '#' }
        ]
    },
    {
        id: 3,
        fieldName: 'Sunset Football Field',
        location: 'Central Park',
        owner: 'Maria Garcia',
        ownerVerificationId: 'ID-987654321',
        ownerVerificationDocument: { name: 'Owner ID Verification - ID-987654321.jpg', url: '#' },
        sport: 'football',
        price: '₺1,500',
        status: 'pending',
        description: 'A beautiful football field located in Central Park with excellent facilities.',
        amenities: ['Parking', 'Changing Rooms', 'Lighting'],
        size: 'Full Size',
        surface: 'Artificial Grass',
        images: [
            'https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop'
        ],
        documents: [
            { name: 'Field License.pdf', url: '#' },
            { name: 'Insurance Certificate.pdf', url: '#' }
        ]
    },
    {
        id: 4,
        fieldName: 'Sunset Football Field',
        location: 'Central Park',
        owner: 'Maria Garcia',
        ownerVerificationId: 'ID-123456789',
        ownerVerificationDocument: { name: 'Owner ID Verification - ID-123456789.pdf', url: '#' },
        sport: 'football',
        price: '₺1,500',
        status: 'pending',
        description: 'A beautiful football field located in Central Park with excellent facilities.',
        amenities: ['Parking', 'Changing Rooms', 'Lighting'],
        size: 'Full Size',
        surface: 'Artificial Grass',
        images: [
            'https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop'
        ],
        documents: [
            { name: 'Field License.pdf', url: '#' },
            { name: 'Property Deed.pdf', url: '#' },
            { name: 'Insurance Certificate.pdf', url: '#' }
        ]
    },
    {
        id: 5,
        fieldName: 'Sunset Football Field',
        location: 'Central Park',
        owner: 'Maria Garcia',
        ownerVerificationId: 'ID-123456789',
        ownerVerificationDocument: { name: 'Owner ID Verification - ID-123456789.pdf', url: '#' },
        sport: 'football',
        price: '₺1,500',
        status: 'pending',
        description: 'A beautiful football field located in Central Park with excellent facilities.',
        amenities: ['Parking', 'Changing Rooms', 'Lighting'],
        size: 'Full Size',
        surface: 'Artificial Grass',
        images: [
            'https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop'
        ],
        documents: [
            { name: 'Field License.pdf', url: '#' }
        ]
    },
    {
        id: 6,
        fieldName: 'Sunset Football Field',
        location: 'Central Park',
        owner: 'Maria Garcia',
        ownerVerificationId: 'ID-123456789',
        ownerVerificationDocument: { name: 'Owner ID Verification - ID-123456789.pdf', url: '#' },
        sport: 'football',
        price: '₺1,500',
        status: 'approved',
        description: 'A beautiful football field located in Central Park with excellent facilities.',
        amenities: ['Parking', 'Changing Rooms', 'Lighting'],
        size: 'Full Size',
        surface: 'Artificial Grass',
        images: [
            'https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop'
        ],
        documents: [
            { name: 'Field License.pdf', url: '#' },
            { name: 'Property Deed.pdf', url: '#' },
            { name: 'Insurance Certificate.pdf', url: '#' }
        ]
    }
];

// Notification Popup Toggle
if (notificationBtn && notificationPopup) {
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationPopup.classList.toggle('active');
        if (profilePopup) {
            profilePopup.classList.remove('active');
        }
    });
}

// Profile Popup Toggle
if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profilePopup.classList.toggle('active');
        if (notificationPopup) {
            notificationPopup.classList.remove('active');
        }
    });
}

// Close popups when clicking outside
document.addEventListener('click', (e) => {
    if (notificationPopup && !notificationPopup.contains(e.target) && !notificationBtn.contains(e.target)) {
        notificationPopup.classList.remove('active');
    }
    if (profilePopup && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
    }
});

// Render fields table
function renderFields(fields = allFields) {
    if (!fieldsTableBody) return;
    
    if (fields.length === 0) {
        fieldsTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #6B7280;">
                    No fields found matching your criteria.
                </td>
            </tr>
        `;
        return;
    }
    
    fieldsTableBody.innerHTML = fields.map(field => `
        <tr>
            <td>
                <span class="field-name">${escapeHtml(field.fieldName)}</span>
            </td>
            <td>
                <span class="location">${escapeHtml(field.location)}</span>
            </td>
            <td>
                <span class="owner">${escapeHtml(field.owner)}</span>
            </td>
            <td>
                <span class="sport-badge ${field.sport}">${formatSport(field.sport)}</span>
            </td>
            <td>
                <span class="price">${escapeHtml(field.price)}</span>
            </td>
            <td>
                <span class="status-badge ${field.status}">${formatStatus(field.status)}</span>
            </td>
            <td>
                <div class="actions-cell">
                    <div class="action-buttons">
                        <button class="action-icon-btn info" onclick="showFieldInfo(${field.id})" title="View field info">
                            <i class="fi fi-rr-info"></i>
                        </button>
                        ${field.status === 'pending' 
                            ? `<button class="action-icon-btn approve" onclick="approveField(${field.id})" title="Approve field">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </button>
                            <button class="action-icon-btn reject" onclick="rejectField(${field.id})" title="Reject field">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>`
                            : field.status === 'approved'
                            ? `<button class="action-icon-btn reject" onclick="rejectField(${field.id})" title="Reject field">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>`
                            : ''
                        }
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
}

// Format sport for display
function formatSport(sport) {
    const sportMap = {
        'football': 'Football',
        'basketball': 'Basketball',
        'tennis': 'Tennis',
        'volleyball': 'Volleyball'
    };
    return sportMap[sport] || sport;
}

// Format status for display
function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

// Get document icon based on file extension
function getDocumentIcon(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
        return 'fi fi-rr-picture';
    } else if (extension === 'pdf') {
        return 'fi fi-rr-file-pdf';
    }
    return 'fi fi-rr-file';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Filter fields
function filterFields() {
    const searchTerm = fieldSearch ? fieldSearch.value.toLowerCase().trim() : '';
    const selectedSport = fieldFilter ? fieldFilter.value : 'all';
    const selectedStatus = statusFilter ? statusFilter.value : 'all';
    const selectedDate = dateFilter ? dateFilter.value : 'all';
    
    let filtered = allFields.filter(field => {
        // Search filter
        const matchesSearch = !searchTerm || 
            field.fieldName.toLowerCase().includes(searchTerm) ||
            field.location.toLowerCase().includes(searchTerm) ||
            field.owner.toLowerCase().includes(searchTerm);
        
        // Sport filter
        const matchesSport = selectedSport === 'all' || field.sport === selectedSport;
        
        // Status filter
        const matchesStatus = selectedStatus === 'all' || field.status === selectedStatus;
        
        // Date filter (simplified - in real app, you'd parse dates)
        const matchesDate = selectedDate === 'all'; // For now, always true
        
        return matchesSearch && matchesSport && matchesStatus && matchesDate;
    });
    
    renderFields(filtered);
}

// Search functionality
if (fieldSearch) {
    fieldSearch.addEventListener('input', filterFields);
}

// Filter functionality
if (fieldFilter) {
    fieldFilter.addEventListener('change', filterFields);
}

if (statusFilter) {
    statusFilter.addEventListener('change', filterFields);
}

if (dateFilter) {
    dateFilter.addEventListener('change', filterFields);
}

// Approve field
function approveField(fieldId) {
    const field = allFields.find(f => f.id === fieldId);
    if (!field) return;
    
    if (confirm(`Are you sure you want to approve "${field.fieldName}"?`)) {
        field.status = 'approved';
        filterFields(); // Re-render to show updated status
        
        console.log(`Field "${field.fieldName}" has been approved`);
    }
}

// Reject field
function rejectField(fieldId) {
    const field = allFields.find(f => f.id === fieldId);
    if (!field) return;
    
    if (confirm(`Are you sure you want to reject "${field.fieldName}"?`)) {
        field.status = 'rejected';
        filterFields(); // Re-render to show updated status
        
        console.log(`Field "${field.fieldName}" has been rejected`);
    }
}

// Approve field from modal
function approveFieldFromModal(fieldId) {
    const field = allFields.find(f => f.id === fieldId);
    if (!field) return;
    
    if (confirm(`Are you sure you want to approve "${field.fieldName}"?`)) {
        field.status = 'approved';
        filterFields(); // Re-render to show updated status
        
        // Close modal
        if (fieldInfoModal) {
            fieldInfoModal.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        console.log(`Field "${field.fieldName}" has been approved`);
    }
}

// Reject field from modal
function rejectFieldFromModal(fieldId) {
    const field = allFields.find(f => f.id === fieldId);
    if (!field) return;
    
    if (confirm(`Are you sure you want to reject "${field.fieldName}"?`)) {
        field.status = 'rejected';
        filterFields(); // Re-render to show updated status
        
        // Close modal
        if (fieldInfoModal) {
            fieldInfoModal.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        console.log(`Field "${field.fieldName}" has been rejected`);
    }
}

// Show field info modal
function showFieldInfo(fieldId) {
    const field = allFields.find(f => f.id === fieldId);
    if (!field) return;
    
    if (fieldInfoContent) {
        fieldInfoContent.innerHTML = `
            ${field.images && field.images.length > 0 ? `
            <div class="field-info-item field-images-section">
                <div class="field-info-label">Field Pictures</div>
                <div class="field-image-carousel" data-field-id="${field.id}">
                    <button class="carousel-arrow carousel-arrow-left" onclick="navigateImage(${field.id}, -1)" ${field.images.length <= 1 ? 'style="display: none;"' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <div class="carousel-image-container">
                        <img src="${field.images[0]}" alt="Field image 1" class="carousel-image" onclick="openImageModal('${field.images[0]}')">
                        ${field.images.length > 1 ? `
                            <div class="carousel-indicators">
                                ${field.images.map((_, index) => `
                                    <span class="carousel-dot ${index === 0 ? 'active' : ''}" onclick="goToImage(${field.id}, ${index})"></span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <button class="carousel-arrow carousel-arrow-right" onclick="navigateImage(${field.id}, 1)" ${field.images.length <= 1 ? 'style="display: none;"' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </div>
                <input type="hidden" id="currentImageIndex_${field.id}" value="0">
            </div>
            ` : ''}
            <div class="field-info-item">
                <div class="field-info-label">Field Name</div>
                <div class="field-info-value">${escapeHtml(field.fieldName)}</div>
            </div>
            <div class="field-info-item">
                <div class="field-info-label">Location</div>
                <div class="field-info-value">${escapeHtml(field.location)}</div>
            </div>
            <div class="field-info-item">
                <div class="field-info-label">Owner</div>
                <div class="field-info-value">${escapeHtml(field.owner)}</div>
            </div>
            <div class="field-info-item">
                <div class="field-info-label">Sport</div>
                <div class="field-info-value">
                    <span class="sport-badge ${field.sport}">${formatSport(field.sport)}</span>
                </div>
            </div>
            <div class="field-info-item">
                <div class="field-info-label">Price</div>
                <div class="field-info-value">${escapeHtml(field.price)}</div>
            </div>
            <div class="field-info-item">
                <div class="field-info-label">Status</div>
                <div class="field-info-value">
                    <span class="status-badge ${field.status}">${formatStatus(field.status)}</span>
                </div>
            </div>
            ${field.description ? `
            <div class="field-info-item">
                <div class="field-info-label">Description</div>
                <div class="field-info-value">${escapeHtml(field.description)}</div>
            </div>
            ` : ''}
            ${field.size ? `
            <div class="field-info-item">
                <div class="field-info-label">Size</div>
                <div class="field-info-value">${escapeHtml(field.size)}</div>
            </div>
            ` : ''}
            ${field.surface ? `
            <div class="field-info-item">
                <div class="field-info-label">Surface</div>
                <div class="field-info-value">${escapeHtml(field.surface)}</div>
            </div>
            ` : ''}
            ${field.amenities && field.amenities.length > 0 ? `
            <div class="field-info-item">
                <div class="field-info-label">Amenities</div>
                <div class="field-info-value">${field.amenities.map(a => escapeHtml(a)).join(', ')}</div>
            </div>
            ` : ''}
            ${(field.ownerVerificationDocument || (field.documents && field.documents.length > 0)) ? `
            <div class="field-info-item">
                <div class="field-info-label">Documents & Verification ID</div>
                <div class="field-info-value">
                    <div class="documents-list">
                        ${field.ownerVerificationDocument ? `
                            <a href="${field.ownerVerificationDocument.url}" class="document-link verification-document" target="_blank" rel="noopener noreferrer">
                                <i class="${getDocumentIcon(field.ownerVerificationDocument.name)}"></i>
                                <span>${escapeHtml(field.ownerVerificationDocument.name)}</span>
                                <i class="fi fi-rr-external-link"></i>
                            </a>
                        ` : ''}
                        ${field.documents && field.documents.length > 0 ? field.documents.map(doc => `
                            <a href="${doc.url}" class="document-link" target="_blank" rel="noopener noreferrer">
                                <i class="${getDocumentIcon(doc.name)}"></i>
                                <span>${escapeHtml(doc.name)}</span>
                                <i class="fi fi-rr-external-link"></i>
                            </a>
                        `).join('') : ''}
                    </div>
                </div>
            </div>
            ` : ''}
            <div class="field-info-actions">
                ${field.status === 'pending' ? `
                    <button class="btn-approve" onclick="approveFieldFromModal(${field.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Approve Field
                    </button>
                    <button class="btn-reject" onclick="rejectFieldFromModal(${field.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Reject Field
                    </button>
                ` : field.status === 'approved' ? `
                    <button class="btn-reject" onclick="rejectFieldFromModal(${field.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Reject Field
                    </button>
                ` : field.status === 'rejected' ? `
                    <button class="btn-approve" onclick="approveFieldFromModal(${field.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Approve Field
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    if (fieldInfoModal) {
        fieldInfoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Close field info modal
if (closeFieldInfoModal && fieldInfoModal) {
    closeFieldInfoModal.addEventListener('click', () => {
        fieldInfoModal.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    // Close on overlay click
    fieldInfoModal.addEventListener('click', (e) => {
        if (e.target === fieldInfoModal) {
            fieldInfoModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fieldInfoModal.classList.contains('active')) {
            fieldInfoModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// Navigate images in carousel
function navigateImage(fieldId, direction) {
    const field = allFields.find(f => f.id === fieldId);
    if (!field || !field.images || field.images.length === 0) return;
    
    const carousel = document.querySelector(`.field-image-carousel[data-field-id="${fieldId}"]`);
    if (!carousel) return;
    
    const currentIndexInput = document.getElementById(`currentImageIndex_${fieldId}`);
    if (!currentIndexInput) return;
    
    let currentIndex = parseInt(currentIndexInput.value) || 0;
    const totalImages = field.images.length;
    
    // Calculate new index
    currentIndex += direction;
    if (currentIndex < 0) {
        currentIndex = totalImages - 1;
    } else if (currentIndex >= totalImages) {
        currentIndex = 0;
    }
    
    // Update image
    const image = carousel.querySelector('.carousel-image');
    if (image) {
        image.src = field.images[currentIndex];
        image.alt = `Field image ${currentIndex + 1}`;
        image.setAttribute('onclick', `openImageModal('${field.images[currentIndex]}')`);
    }
    
    // Update indicators
    const dots = carousel.querySelectorAll('.carousel-dot');
    dots.forEach((dot, index) => {
        if (index === currentIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
    
    // Update hidden input
    currentIndexInput.value = currentIndex;
}

// Go to specific image
function goToImage(fieldId, index) {
    const field = allFields.find(f => f.id === fieldId);
    if (!field || !field.images || index < 0 || index >= field.images.length) return;
    
    const carousel = document.querySelector(`.field-image-carousel[data-field-id="${fieldId}"]`);
    if (!carousel) return;
    
    const currentIndexInput = document.getElementById(`currentImageIndex_${fieldId}`);
    if (!currentIndexInput) return;
    
    // Update image
    const image = carousel.querySelector('.carousel-image');
    if (image) {
        image.src = field.images[index];
        image.alt = `Field image ${index + 1}`;
        image.setAttribute('onclick', `openImageModal('${field.images[index]}')`);
    }
    
    // Update indicators
    const dots = carousel.querySelectorAll('.carousel-dot');
    dots.forEach((dot, dotIndex) => {
        if (dotIndex === index) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
    
    // Update hidden input
    currentIndexInput.value = index;
}

// Open image in full size modal
function openImageModal(imageUrl) {
    // Create modal overlay if it doesn't exist
    let imageModal = document.getElementById('imageModal');
    if (!imageModal) {
        imageModal = document.createElement('div');
        imageModal.id = 'imageModal';
        imageModal.className = 'modal-overlay image-modal-overlay';
        imageModal.innerHTML = `
            <div class="image-modal-content">
                <button class="image-modal-close" onclick="closeImageModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <img src="${imageUrl}" alt="Field image" class="full-size-image">
            </div>
        `;
        document.body.appendChild(imageModal);
        
        // Close on overlay click
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closeImageModal();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && imageModal.classList.contains('active')) {
                closeImageModal();
            }
        });
    } else {
        const img = imageModal.querySelector('.full-size-image');
        if (img) {
            img.src = imageUrl;
        }
    }
    
    imageModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close image modal
function closeImageModal() {
    const imageModal = document.getElementById('imageModal');
    if (imageModal) {
        imageModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Make functions globally available for onclick handlers
window.approveField = approveField;
window.rejectField = rejectField;
window.approveFieldFromModal = approveFieldFromModal;
window.rejectFieldFromModal = rejectFieldFromModal;
window.showFieldInfo = showFieldInfo;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.navigateImage = navigateImage;
window.goToImage = goToImage;

// Initialize: Render fields on page load
document.addEventListener('DOMContentLoaded', () => {
    renderFields();
});

