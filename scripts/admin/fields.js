// Fields Management functionality

// DOM Elements (notification bell: ../../scripts/player/notifications.js)
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

let allFields = [];
let isLoading = false;

// Profile Popup Toggle
if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profilePopup.classList.toggle('active');
        const notificationPopup = document.getElementById('notificationPopup');
        if (notificationPopup) {
            notificationPopup.classList.remove('active');
        }
    });
}

document.addEventListener('click', (e) => {
    if (profilePopup && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
    }
});

function escapeHtml(text) {
    if (text == null) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatSport(sport) {
    const s = String(sport || '').toLowerCase();
    const sportMap = {
        'football': 'Football',
        'basketball': 'Basketball',
        'tennis': 'Tennis',
        'volleyball': 'Volleyball'
    };
    return sportMap[s] || (sport ? String(sport) : '—');
}

function displayStatus(field) {
    const ms = field.moderationStatus ? String(field.moderationStatus).toUpperCase() : '';
    if (ms === 'PENDING') return 'pending';
    if (ms === 'APPROVED') return 'approved';
    if (ms === 'REJECTED') return 'rejected';
    // Back-compat: old fields w/out moderationStatus
    return field.isActive ? 'approved' : 'pending';
}

function formatStatus(status) {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatPriceTry(pricePerHour) {
    const n = Number(pricePerHour || 0);
    const tryAmount = Math.round(n / 100);
    return '\u20BA' + tryAmount.toLocaleString();
}

function mapField(f) {
    return {
        id: f.id,
        fieldName: f.name || 'Field',
        location: f.location || '—',
        owner: (f.owner && (f.owner.fullName || f.owner.email)) ? (f.owner.fullName || f.owner.email) : '—',
        ownerEmail: (f.owner && f.owner.email) ? f.owner.email : '',
        sport: String(f.sport || '').toLowerCase(),
        pricePerHour: f.pricePerHour || 0,
        price: formatPriceTry(f.pricePerHour),
        status: displayStatus(f),
        isActive: !!f.isActive,
        moderationStatus: f.moderationStatus || null,
        moderationReason: f.moderationReason || '',
        description: f.description || '',
        amenities: Array.isArray(f.features) ? f.features : [],
        images: Array.isArray(f.images) ? f.images : [],
        address: f.address || '',
        phone: f.phone || '',
        type: f.type || '',
        createdAt: f.createdAt || null
    };
}

async function loadFieldsFromAPI() {
    if (isLoading) return;
    isLoading = true;
    if (fieldsTableBody) {
        fieldsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#6B7280">Loading fields...</td></tr>';
    }
    try {
        if (!window.API || !API.admin || !API.admin.getFields) {
            throw new Error('API not available.');
        }
        const params = { limit: 200, page: 1 };
        const sport = fieldFilter && fieldFilter.value && fieldFilter.value !== 'all' ? fieldFilter.value : '';
        const status = statusFilter && statusFilter.value && statusFilter.value !== 'all' ? statusFilter.value : '';
        const search = fieldSearch && fieldSearch.value ? fieldSearch.value.trim() : '';
        if (sport) params.sport = sport;
        if (status) params.status = status;
        if (search) params.search = search;
        const res = await API.admin.getFields(params);
        allFields = (res.fields || []).map(mapField);
        renderFields(allFields);
    } catch (e) {
        console.warn('Load fields failed:', e);
        allFields = [];
        if (fieldsTableBody) {
            fieldsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#DC2626">${escapeHtml(e && e.message ? e.message : 'Failed to load fields')}</td></tr>`;
        }
    } finally {
        isLoading = false;
    }
}

// Render fields table
function renderFields(fields = allFields) {
    if (!fieldsTableBody) return;
    
    if (fields.length === 0) {
        fieldsTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #6B7280;">
                    ${isLoading ? 'Loading fields...' : 'No fields found matching your criteria.'}
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
                        <button class="action-icon-btn info" onclick="showFieldInfo('${escapeHtml(field.id)}')" title="View field info">
                            <i class="fi fi-rr-info"></i>
                        </button>
                        ${field.status === 'pending' 
                            ? `<button class="action-icon-btn approve" onclick="approveField('${escapeHtml(field.id)}')" title="Approve field">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </button>
                            <button class="action-icon-btn reject" onclick="rejectField('${escapeHtml(field.id)}')" title="Reject field">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>`
                            : field.status === 'approved'
                            ? `<button class="action-icon-btn reject" onclick="rejectField('${escapeHtml(field.id)}')" title="Reject field">
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

// Search functionality
if (fieldSearch) {
    fieldSearch.addEventListener('input', () => {
        clearTimeout(fieldSearch._t);
        fieldSearch._t = setTimeout(loadFieldsFromAPI, 300);
    });
}

// Filter functionality
if (fieldFilter) {
    fieldFilter.addEventListener('change', loadFieldsFromAPI);
}

if (statusFilter) {
    statusFilter.addEventListener('change', loadFieldsFromAPI);
}

if (dateFilter) {
    dateFilter.addEventListener('change', loadFieldsFromAPI);
}

// Approve field
async function approveField(fieldId) {
    const field = allFields.find(f => String(f.id) === String(fieldId));
    if (!field) return;
    
    if (confirm(`Are you sure you want to approve "${field.fieldName}"?`)) {
        try {
            await API.admin.moderateField(String(fieldId), 'APPROVED', '');
            await loadFieldsFromAPI();
        } catch (e) {
            alert(e && e.message ? e.message : 'Failed to approve field.');
        }
    }
}

// Reject field
async function rejectField(fieldId) {
    const field = allFields.find(f => String(f.id) === String(fieldId));
    if (!field) return;
    
    if (confirm(`Are you sure you want to reject "${field.fieldName}"?`)) {
        const reason = prompt('Reason for rejection (optional):') || '';
        try {
            await API.admin.moderateField(String(fieldId), 'REJECTED', reason);
            await loadFieldsFromAPI();
        } catch (e) {
            alert(e && e.message ? e.message : 'Failed to reject field.');
        }
    }
}

// Approve field from modal
async function approveFieldFromModal(fieldId) {
    const field = allFields.find(f => String(f.id) === String(fieldId));
    if (!field) return;
    
    if (confirm(`Are you sure you want to approve "${field.fieldName}"?`)) {
        try {
            await API.admin.moderateField(String(fieldId), 'APPROVED', '');
            await loadFieldsFromAPI();
            if (fieldInfoModal) {
                fieldInfoModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        } catch (e) {
            alert(e && e.message ? e.message : 'Failed to approve field.');
        }
    }
}

// Reject field from modal
async function rejectFieldFromModal(fieldId) {
    const field = allFields.find(f => String(f.id) === String(fieldId));
    if (!field) return;
    
    if (confirm(`Are you sure you want to reject "${field.fieldName}"?`)) {
        const reason = prompt('Reason for rejection (optional):') || '';
        try {
            await API.admin.moderateField(String(fieldId), 'REJECTED', reason);
            await loadFieldsFromAPI();
            if (fieldInfoModal) {
                fieldInfoModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        } catch (e) {
            alert(e && e.message ? e.message : 'Failed to reject field.');
        }
    }
}

// Show field info modal
function showFieldInfo(fieldId) {
    const field = allFields.find(f => String(f.id) === String(fieldId));
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
            ${field.ownerEmail ? `
            <div class="field-info-item">
                <div class="field-info-label">Owner Email</div>
                <div class="field-info-value">${escapeHtml(field.ownerEmail)}</div>
            </div>
            ` : ''}
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
            ${field.amenities && field.amenities.length > 0 ? `
            <div class="field-info-item">
                <div class="field-info-label">Amenities</div>
                <div class="field-info-value">${field.amenities.map(a => escapeHtml(a)).join(', ')}</div>
            </div>
            ` : ''}
            <div class="field-info-actions">
                ${field.status === 'pending' ? `
                    <button class="btn-approve" onclick="approveFieldFromModal('${escapeHtml(field.id)}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Approve Field
                    </button>
                    <button class="btn-reject" onclick="rejectFieldFromModal('${escapeHtml(field.id)}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Reject Field
                    </button>
                ` : field.status === 'approved' ? `
                    <button class="btn-reject" onclick="rejectFieldFromModal('${escapeHtml(field.id)}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Reject Field
                    </button>
                ` : field.status === 'rejected' ? `
                    <button class="btn-approve" onclick="approveFieldFromModal('${escapeHtml(field.id)}')">
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
    loadFieldsFromAPI();
});

