// Fields page — API.fields.getMine / create / delete / unavailable-dates (same auth + fetch pattern as player).
// ownerFieldEsc, formatOwnerFieldPrice, view-field modal: scripts/owner/view-field-modal.js (must load before this file)

function renderOwnerFieldsList(fields) {
    const list = document.getElementById('fieldsList');
    if (!list) return;
    if (!fields || !fields.length) {
        list.innerHTML = '<p style="padding:24px;color:#6B7280;">No fields yet. Click <strong>Add new field</strong> to create one (requires verified owner account).</p>';
        return;
    }
    list.innerHTML = fields.map(function(f) {
        const id = String(f.id != null ? f.id : f._id || '');
        const img = (f.images && f.images[0]) || 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop';
        const typeTag = f.type === 'INDOOR' ? 'Indoor' : 'Outdoor';
        const rating = f.rating != null ? f.rating : '—';
        const rc = f.reviewCount != null ? f.reviewCount : 0;
        return (
            '<div class="field-list-card" data-field-name="' + ownerFieldEsc(f.name) + '" data-field-id="' + ownerFieldEsc(id) + '">' +
            '<div class="field-list-image"><img src="' + ownerFieldEsc(img) + '" alt=""></div>' +
            '<div class="field-list-content"><div class="field-list-info">' +
            '<h3 class="field-list-name">' + ownerFieldEsc(f.name) + '</h3>' +
            '<p class="field-list-location"><i class="fi fi-rr-marker"></i> ' + ownerFieldEsc(f.location || '') + '</p>' +
            '<div class="field-list-rating"><span class="field-star-yellow">★</span> ' +
            '<span class="field-rating-value">' + ownerFieldEsc(rating) + '</span> <span class="field-reviews-count">(' + rc + ')</span></div>' +
            '<div class="field-list-tags">' +
            '<span class="field-tag">' + typeTag + '</span>' +
            '<span class="field-tag">' + ownerFieldEsc(f.sport || '') + '</span>' +
            '</div></div>' +
            '<div class="field-list-actions">' +
            '<div class="field-list-price-container">' +
            '<span class="field-list-price-label">Price</span>' +
            '<span class="field-list-price">' + formatOwnerFieldPrice(f.pricePerHour) + '/h</span>' +
            '</div>' +
            '<div class="field-list-buttons">' +
            '<button type="button" class="manage-btn" onclick="openModal(\'' + id + '\')">Manage</button>' +
            '<button type="button" class="action-btn" onclick="viewFieldDetails(this)" title="View"><i class="fi fi-rr-eye"></i></button>' +
            '<button type="button" class="action-btn delete" onclick="deleteField(this)" title="Delete"><i class="fi fi-rr-trash"></i></button>' +
            '</div></div></div></div>'
        );
    }).join('');
}

async function loadOwnerFieldsFromApi() {
    const list = document.getElementById('fieldsList');
    if (typeof API === 'undefined' || !API.fields || !API.fields.getMine) {
        if (list) {
            list.innerHTML =
                '<p style="padding:24px;color:#B45309;">Could not load fields: API is not available. Start the server (<code>npm run dev</code>) and open this page from <code>http://localhost:3000</code>.</p>';
        }
        return;
    }
    try {
        const res = await API.fields.getMine();
        const fields = (res && res.fields) ? res.fields : [];
        renderOwnerFieldsList(fields);
    } catch (e) {
        console.error('loadOwnerFieldsFromApi', e);
        const msg = (e && e.message) ? String(e.message) : 'Request failed';
        if (list) {
            list.innerHTML =
                '<p style="padding:24px;color:#B45309;">Could not load your fields: ' +
                ownerFieldEsc(msg) +
                '. Log in as an <strong>OWNER</strong> (e.g. <code>owner@matchfield.com</code> after <code>npm run db:seed</code>), or check the browser Network tab for <code>/api/fields/me</code>.</p>';
        }
    }
}

// DOM Elements
const notificationPopup = document.getElementById('notificationPopup');
const profileBtn = document.getElementById('profileBtn');
const profilePopup = document.getElementById('profilePopup');
const fieldSearchInput = document.getElementById('fieldSearchInput');
const addFieldBtn = document.getElementById('addFieldBtn');
const fieldsList = document.getElementById('fieldsList');
const editFieldModal = document.getElementById('editFieldModal');

// Current selected date for calendar
let currentModalDate = new Date();
let selectedDate = new Date();

// Notification bell: scripts/player/notifications.js (API). No duplicate toggle here.

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

document.addEventListener('click', (e) => {
    if (profilePopup && profileBtn && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
    }
});

// Search functionality
if (fieldSearchInput) {
    fieldSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const fieldCards = document.querySelectorAll('.field-list-card');
        
        fieldCards.forEach(card => {
            const fieldName = card.getAttribute('data-field-name').toLowerCase();
            const fieldLocation = card.querySelector('.field-list-location').textContent.toLowerCase();
            
            if (fieldName.includes(searchTerm) || fieldLocation.includes(searchTerm)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// Add Field Button Handler
const addFieldModal = document.getElementById('addFieldModal');
let currentStep = 1;
const totalSteps = 8;
let fieldImages = [];
let highlights = [];
let unavailableDates = [];

if (addFieldBtn) {
    addFieldBtn.addEventListener('click', () => {
        openAddFieldModal();
    });
}

// Open Add Field Modal
function openAddFieldModal() {
    if (addFieldModal) {
        addFieldModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        currentStep = 1;
        showStep(1);
        resetAddFieldForm();
    }
}

// Close Add Field Modal
function closeAddFieldModal() {
    if (addFieldModal) {
        addFieldModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Reset form
function resetAddFieldForm() {
    fieldImages = [];
    highlights = [];
    unavailableDates = [];
    document.getElementById('addFieldForm').reset();
    document.getElementById('fieldImagesGrid').innerHTML = '';
    document.getElementById('highlightsList').innerHTML = '';
    document.getElementById('unavailableDatesList').innerHTML = '';
    updateStepButtons();
    // Reinitialize day schedules after reset
    setTimeout(() => {
        initializeDaySchedules();
        updateRadioLabels();
    }, 100);
}

// Show specific step
function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(stepEl => {
        stepEl.classList.remove('active');
    });
    
    // Show current step
    const currentStepEl = document.querySelector(`.form-step[data-step="${step}"]`);
    if (currentStepEl) {
        currentStepEl.classList.add('active');
    }
    
    // Update progress indicators
    document.querySelectorAll('.progress-step').forEach((stepEl, index) => {
        const stepNum = index + 1;
        stepEl.classList.remove('active', 'completed');
        if (stepNum === step) {
            stepEl.classList.add('active');
        } else if (stepNum < step) {
            stepEl.classList.add('completed');
        }
    });
    
    currentStep = step;
    updateStepButtons();
}

// Update step navigation buttons
function updateStepButtons() {
    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    if (prevBtn) {
        prevBtn.style.display = currentStep > 1 ? 'inline-block' : 'none';
    }
    
    if (nextBtn && submitBtn) {
        if (currentStep === totalSteps) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-block';
        } else {
            nextBtn.style.display = 'inline-block';
            submitBtn.style.display = 'none';
        }
    }
}

// Next step
function nextStep() {
    if (validateCurrentStep()) {
        if (currentStep < totalSteps) {
            showStep(currentStep + 1);
        }
    }
}

// Previous step
function previousStep() {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

// Validate current step
function validateCurrentStep() {
    const currentStepEl = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    if (!currentStepEl) return true;
    
    const requiredFields = currentStepEl.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            field.style.borderColor = '#DC2626';
            
            // Remove error style on input
            field.addEventListener('input', function() {
                this.style.borderColor = '#D1D5DB';
            }, { once: true });
        }
    });
    
    // Step-specific validation
    if (currentStep === 1) {
        const ownershipDoc = document.getElementById('ownershipDoc').files.length;
        if (!ownershipDoc) {
            alert('Please upload ownership or rental agreement document');
            isValid = false;
        }
    } else if (currentStep === 4) {
        if (fieldImages.length === 0) {
            alert('Please upload at least one field image');
            isValid = false;
        }
    } else if (currentStep === 5) {
        // Map validation would go here
        const latitude = document.getElementById('latitude').textContent;
        if (latitude === '-') {
            alert('Please select location on the map');
            isValid = false;
        }
    } else if (currentStep === 7) {
        // Validate that at least one day is selected
        const checkedDays = document.querySelectorAll('input[name="workingDays"]:checked');
        if (checkedDays.length === 0) {
            alert('Please select at least one working day');
            isValid = false;
        } else {
            // Validate that all checked days have valid times
            checkedDays.forEach(checkbox => {
                const day = checkbox.value;
                const opening = document.getElementById(`${day}-opening`);
                const closing = document.getElementById(`${day}-closing`);
                if (!opening.value || !closing.value) {
                    alert(`Please set opening and closing times for ${day}`);
                    isValid = false;
                } else if (opening.value >= closing.value) {
                    alert(`Closing time must be after opening time for ${day}`);
                    isValid = false;
                }
            });
        }
    }
    
    return isValid;
}

// Add highlight
function addHighlight() {
    const input = document.getElementById('highlightInput');
    const value = input.value.trim();
    
    if (value && !highlights.includes(value)) {
        highlights.push(value);
        renderHighlights();
        input.value = '';
    }
}

// Remove highlight
function removeHighlight(index) {
    highlights.splice(index, 1);
    renderHighlights();
}

// Render highlights
function renderHighlights() {
    const container = document.getElementById('highlightsList');
    container.innerHTML = highlights.map((highlight, index) => `
        <div class="highlight-tag">
            <span>${highlight}</span>
            <button type="button" onclick="removeHighlight(${index})">&times;</button>
        </div>
    `).join('');
}

// Handle field images upload
function handleFieldImagesUpload(event) {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
        if (file.type.startsWith('image/') && fieldImages.length < 10) {
            const reader = new FileReader();
            reader.onload = (e) => {
                fieldImages.push({
                    file: file,
                    url: e.target.result
                });
                renderFieldImages();
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Reset input
    event.target.value = '';
}

// Render field images
function renderFieldImages() {
    const container = document.getElementById('fieldImagesGrid');
    container.innerHTML = fieldImages.map((image, index) => `
        <div class="image-preview-item">
            <img src="${image.url}" alt="Field image ${index + 1}">
            <button type="button" class="remove-image-btn" onclick="removeFieldImage(${index})">&times;</button>
        </div>
    `).join('');
}

// Remove field image
function removeFieldImage(index) {
    fieldImages.splice(index, 1);
    renderFieldImages();
}


// Toggle day schedule (enable/disable time inputs)
function toggleDaySchedule(day, enabled) {
    const openingInput = document.getElementById(`${day}-opening`);
    const closingInput = document.getElementById(`${day}-closing`);
    const dayRow = openingInput ? openingInput.closest('.schedule-day-row') : null;
    
    if (openingInput && closingInput) {
        if (enabled) {
            openingInput.disabled = false;
            closingInput.disabled = false;
            openingInput.required = true;
            closingInput.required = true;
            if (dayRow) dayRow.classList.remove('disabled');
        } else {
            openingInput.disabled = true;
            closingInput.disabled = true;
            openingInput.required = false;
            closingInput.required = false;
            if (dayRow) dayRow.classList.add('disabled');
        }
    }
}

// Initialize day schedules on page load
function initializeDaySchedules() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
        const checkbox = document.querySelector(`input[name="workingDays"][value="${day}"]`);
        if (checkbox) {
            toggleDaySchedule(day, checkbox.checked);
        }
    });
}

// Add unavailable date
function addUnavailableDate() {
    const input = document.getElementById('unavailableDateInput');
    const date = input.value;
    
    if (date && !unavailableDates.includes(date)) {
        unavailableDates.push(date);
        renderUnavailableDates();
        input.value = '';
    }
}

// Remove unavailable date
function removeUnavailableDate(index) {
    unavailableDates.splice(index, 1);
    renderUnavailableDates();
}

// Render unavailable dates
function renderUnavailableDates() {
    const container = document.getElementById('unavailableDatesList');
    container.innerHTML = unavailableDates.map((date, index) => {
        const formattedDate = new Date(date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        return `
            <div class="date-tag">
                <span>${formattedDate}</span>
                <button type="button" onclick="removeUnavailableDate(${index})">&times;</button>
            </div>
        `;
    }).join('');
}

// Toggle field visibility
function toggleFieldVisibility() {
    const toggle = document.getElementById('fieldVisibilityToggle');
    if (toggle) {
        toggle.classList.toggle('active');
    }
}

// Submit field form
function submitFieldForm() {
    if (!validateCurrentStep()) {
        return;
    }
    
    // Collect all form data
    const formData = {
        // Documents
        ownershipDoc: document.getElementById('ownershipDoc').files[0],
        licensesDoc: document.getElementById('licensesDoc').files[0],
        
        // Basic info
        fieldName: document.getElementById('fieldName').value,
        description: document.getElementById('fieldDescription').value,
        highlights: highlights,
        fieldType: document.getElementById('fieldType').value,
        capacity: parseInt(document.getElementById('capacity').value),
        
        // Amenities & Features
        amenities: Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map(cb => cb.value),
        features: Array.from(document.querySelectorAll('input[name="features"]:checked')).map(cb => cb.value),
        
        // Media
        images: fieldImages,
        
        // Location
        address: document.getElementById('fieldAddress').value,
        city: document.getElementById('fieldCity').value,
        district: document.getElementById('fieldDistrict').value,
        latitude: document.getElementById('latitude').textContent,
        longitude: document.getElementById('longitude').textContent,
        
        // Pricing
        pricePerHour: parseFloat(document.getElementById('pricePerHour').value),
        
        // Schedule
        workingDays: Array.from(document.querySelectorAll('input[name="workingDays"]:checked')).map(cb => cb.value),
        schedule: {
            monday: {
                enabled: document.querySelector('input[name="workingDays"][value="monday"]')?.checked || false,
                opening: document.getElementById('monday-opening')?.value || null,
                closing: document.getElementById('monday-closing')?.value || null
            },
            tuesday: {
                enabled: document.querySelector('input[name="workingDays"][value="tuesday"]')?.checked || false,
                opening: document.getElementById('tuesday-opening')?.value || null,
                closing: document.getElementById('tuesday-closing')?.value || null
            },
            wednesday: {
                enabled: document.querySelector('input[name="workingDays"][value="wednesday"]')?.checked || false,
                opening: document.getElementById('wednesday-opening')?.value || null,
                closing: document.getElementById('wednesday-closing')?.value || null
            },
            thursday: {
                enabled: document.querySelector('input[name="workingDays"][value="thursday"]')?.checked || false,
                opening: document.getElementById('thursday-opening')?.value || null,
                closing: document.getElementById('thursday-closing')?.value || null
            },
            friday: {
                enabled: document.querySelector('input[name="workingDays"][value="friday"]')?.checked || false,
                opening: document.getElementById('friday-opening')?.value || null,
                closing: document.getElementById('friday-closing')?.value || null
            },
            saturday: {
                enabled: document.querySelector('input[name="workingDays"][value="saturday"]')?.checked || false,
                opening: document.getElementById('saturday-opening')?.value || null,
                closing: document.getElementById('saturday-closing')?.value || null
            },
            sunday: {
                enabled: document.querySelector('input[name="workingDays"][value="sunday"]')?.checked || false,
                opening: document.getElementById('sunday-opening')?.value || null,
                closing: document.getElementById('sunday-closing')?.value || null
            }
        },
        unavailableDates: unavailableDates,
        
        // Settings
        bookingType: document.querySelector('input[name="bookingType"]:checked').value,
        advanceBooking: document.getElementById('advanceBooking').value,
        cancellationPolicy: document.getElementById('cancellationPolicy').value,
        visibility: document.getElementById('fieldVisibilityToggle').classList.contains('active')
    };
    
    if (typeof API === 'undefined' || !API.fields || !API.fields.create) {
        alert('Unable to submit: API not loaded.');
        return;
    }

    const sportSelect = document.getElementById('fieldType');
    const sportVal = sportSelect ? sportSelect.value : 'other';
    const sportLabel = sportVal ? sportVal.charAt(0).toUpperCase() + sportVal.slice(1) : 'Football';
    const indoorCb = document.querySelector('input[name="features"][value="indoor"]');
    const outdoorCb = document.querySelector('input[name="features"][value="outdoor"]');
    const isIndoor = indoorCb && indoorCb.checked && !(outdoorCb && outdoorCb.checked);
    const cityEl = document.getElementById('fieldCity');
    const distEl = document.getElementById('fieldDistrict');
    const addrEl = document.getElementById('fieldAddress');
    const locationLine = [cityEl && cityEl.value, distEl && distEl.value].filter(Boolean).join(', ') || (addrEl && addrEl.value) || '—';
    const latEl = document.getElementById('latitude');
    const lngEl = document.getElementById('longitude');
    const latStr = latEl ? latEl.textContent.trim() : '';
    const lngStr = lngEl ? lngEl.textContent.trim() : '';
    const amenities = Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map(function(cb) { return cb.nextElementSibling ? cb.nextElementSibling.textContent.trim() : cb.value; });
    const feat = Array.from(document.querySelectorAll('input[name="features"]:checked')).map(function(cb) { return cb.nextElementSibling ? cb.nextElementSibling.textContent.trim() : cb.value; });
    const features = highlights.concat(amenities).concat(feat).filter(Boolean);

    const payload = {
        name: (document.getElementById('fieldName') && document.getElementById('fieldName').value.trim()) || 'Field',
        sport: sportLabel,
        description: (document.getElementById('fieldDescription') && document.getElementById('fieldDescription').value) || '',
        type: isIndoor ? 'INDOOR' : 'OUTDOOR',
        location: locationLine,
        address: (addrEl && addrEl.value) || undefined,
        pricePerHour: Math.round(parseFloat(document.getElementById('pricePerHour') && document.getElementById('pricePerHour').value) || 0),
        features: features,
        images: [],
        latitude: latStr && latStr !== '-' ? parseFloat(latStr) : undefined,
        longitude: lngStr && lngStr !== '-' ? parseFloat(lngStr) : undefined,
        isActive: document.getElementById('fieldVisibilityToggle') ? document.getElementById('fieldVisibilityToggle').classList.contains('active') : true
    };

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }

    API.fields.create(payload).then(async function(res) {
        const field = res && res.field;
        const fieldId = field && field.id;
        if (fieldId && unavailableDates && unavailableDates.length && API.fields.addUnavailableDate) {
            for (let i = 0; i < unavailableDates.length; i++) {
                try {
                    await API.fields.addUnavailableDate(fieldId, unavailableDates[i]);
                } catch (err) {
                    console.warn('unavailable date', err);
                }
            }
        }
        alert('Field created successfully.');
        closeAddFieldModal();
        loadOwnerFieldsFromApi();
    }).catch(function(err) {
        alert(err.message || 'Could not create field. Owner verification may be required.');
    }).finally(function() {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit for Approval';
        }
    });
}

// Close modal when clicking outside
if (addFieldModal) {
    addFieldModal.addEventListener('click', (e) => {
        if (e.target === addFieldModal) {
            closeAddFieldModal();
        }
    });
}

// File upload preview handlers
document.addEventListener('DOMContentLoaded', () => {
    const ownershipDocInput = document.getElementById('ownershipDoc');
    const licensesDocInput = document.getElementById('licensesDoc');
    
    if (ownershipDocInput) {
        ownershipDocInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const preview = document.getElementById('ownershipDocPreview');
                preview.innerHTML = `
                    <div class="file-preview-item">
                        <span>${file.name}</span>
                        <button type="button" onclick="document.getElementById('ownershipDoc').value = ''; document.getElementById('ownershipDocPreview').innerHTML = ''; document.getElementById('ownershipDocPreview').classList.remove('active');">&times;</button>
                    </div>
                `;
                preview.classList.add('active');
            }
        });
    }
    
    if (licensesDocInput) {
        licensesDocInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const preview = document.getElementById('licensesDocPreview');
                preview.innerHTML = `
                    <div class="file-preview-item">
                        <span>${file.name}</span>
                        <button type="button" onclick="document.getElementById('licensesDoc').value = ''; document.getElementById('licensesDocPreview').innerHTML = ''; document.getElementById('licensesDocPreview').classList.remove('active');">&times;</button>
                    </div>
                `;
                preview.classList.add('active');
            }
        });
    }
    
    // Map click handler (placeholder)
    const mapPicker = document.getElementById('locationMap');
    if (mapPicker) {
        mapPicker.addEventListener('click', (e) => {
            // Placeholder for map integration
            // In a real implementation, this would use a map library like Leaflet or Google Maps
            const rect = mapPicker.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            document.getElementById('mapPin').style.left = x + 'px';
            document.getElementById('mapPin').style.top = y + 'px';
            
            // Placeholder coordinates
            document.getElementById('latitude').textContent = (41.0082 + (Math.random() - 0.5) * 0.01).toFixed(6);
            document.getElementById('longitude').textContent = (28.9784 + (Math.random() - 0.5) * 0.01).toFixed(6);
        });
    }
});

// Modal Functions
let currentManageSection = null;
/** Set when opening Manage for a field — used for PUT /fields/:id */
let ownerManagingFieldId = null;

function collectManageFeatureStrings() {
    const out = [];
    document.querySelectorAll('input[name="manageAmenities"]:checked').forEach(function(cb) {
        const label = cb.nextElementSibling;
        if (label && label.textContent) out.push(label.textContent.trim());
    });
    document.querySelectorAll('input[name="manageFeatures"]:checked').forEach(function(cb) {
        const label = cb.nextElementSibling;
        if (label && label.textContent) out.push(label.textContent.trim());
    });
    document.querySelectorAll('#manageHighlightsList .highlight-item span').forEach(function(span) {
        const t = span.textContent.trim();
        if (t) out.push(t);
    });
    return out;
}

function applyManageFeaturesFromField(features) {
    const arr = Array.isArray(features) ? features : [];
    const lower = arr.map(function(s) {
        return String(s).trim().toLowerCase();
    });
    document.querySelectorAll('input[name="manageAmenities"]').forEach(function(cb) {
        const label = (cb.nextElementSibling && cb.nextElementSibling.textContent) || '';
        const l = label.trim().toLowerCase();
        cb.checked = lower.indexOf(l) !== -1;
    });
    document.querySelectorAll('input[name="manageFeatures"]').forEach(function(cb) {
        const label = (cb.nextElementSibling && cb.nextElementSibling.textContent) || '';
        const l = label.trim().toLowerCase();
        cb.checked = lower.indexOf(l) !== -1;
    });
    const known = new Set();
    document.querySelectorAll('input[name="manageAmenities"], input[name="manageFeatures"]').forEach(function(cb) {
        const label = (cb.nextElementSibling && cb.nextElementSibling.textContent) || '';
        if (label.trim()) known.add(label.trim().toLowerCase());
    });
    const hl = document.getElementById('manageHighlightsList');
    if (hl) {
        hl.innerHTML = '';
        arr.forEach(function(f) {
            const ft = String(f).trim();
            if (!ft) return;
            if (known.has(ft.toLowerCase())) return;
            const highlightItem = document.createElement('div');
            highlightItem.className = 'highlight-item';
            highlightItem.innerHTML =
                '<span>' +
                ownerFieldEsc(ft) +
                '</span><button type="button" onclick="removeManageHighlight(this)">&times;</button>';
            hl.appendChild(highlightItem);
        });
    }
}

function selectManageSportByName(sportName) {
    const sel = document.getElementById('manageSportCategory');
    if (!sel) return;
    const want = String(sportName || 'Football').trim().toLowerCase();
    for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].text.trim().toLowerCase() === want) {
            sel.selectedIndex = i;
            return;
        }
    }
}

function unavailableYmdFromApi(d) {
    const x = d instanceof Date ? d : new Date(d);
    if (isNaN(x.getTime())) return '';
    return (
        x.getUTCFullYear() +
        '-' +
        String(x.getUTCMonth() + 1).padStart(2, '0') +
        '-' +
        String(x.getUTCDate()).padStart(2, '0')
    );
}

function openModal(fieldId) {
    if (editFieldModal) {
        editFieldModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Show menu, hide sections
        showManageMenu();
        
        if (fieldId) {
            ownerManagingFieldId = String(fieldId);
            loadFieldData(fieldId);
        } else {
            ownerManagingFieldId = null;
        }
    }
}

function closeModal() {
    if (editFieldModal) {
        editFieldModal.classList.remove('active');
        document.body.style.overflow = '';
        showManageMenu();
        ownerManagingFieldId = null;
    }
}

// Show manage menu
function showManageMenu() {
    const optionsContainer = document.querySelector('.manage-options-container');
    const sectionsContainer = document.querySelector('.manage-sections-container');
    const manageBackBtn = document.getElementById('manageBackBtn');
    const manageSubmitBtn = document.getElementById('manageSubmitBtn');
    
    if (optionsContainer) optionsContainer.style.display = 'flex';
    if (sectionsContainer) {
        sectionsContainer.classList.remove('active');
        sectionsContainer.style.display = 'none';
    }
    if (manageBackBtn) manageBackBtn.style.display = 'none';
    if (manageSubmitBtn) manageSubmitBtn.style.display = 'none';
    
    // Remove active class from all option buttons
    document.querySelectorAll('.manage-option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Hide all sections
    document.querySelectorAll('.manage-section').forEach(section => {
        section.classList.remove('active');
    });
    
    currentManageSection = null;
}

// Back to menu
function backToManageMenu() {
    showManageMenu();
}

// Open manage section
function openManageSection(sectionName) {
    const optionsContainer = document.querySelector('.manage-options-container');
    const sectionsContainer = document.querySelector('.manage-sections-container');
    const manageBackBtn = document.getElementById('manageBackBtn');
    const manageSubmitBtn = document.getElementById('manageSubmitBtn');
    const section = document.getElementById(`${sectionName}-section`);
    
    // Hide menu, show sections container
    if (optionsContainer) optionsContainer.style.display = 'none';
    if (sectionsContainer) {
        sectionsContainer.style.display = 'block';
        sectionsContainer.classList.add('active');
    }
    if (manageBackBtn) manageBackBtn.style.display = 'inline-block';
    if (manageSubmitBtn) manageSubmitBtn.style.display = 'inline-block';
    
    // Remove active from all options and sections
    document.querySelectorAll('.manage-option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.manage-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    // Activate clicked option and section
    const clickedBtn = document.querySelector(`[onclick="openManageSection('${sectionName}')"]`);
    if (clickedBtn) clickedBtn.classList.add('active');
    if (section) {
        section.classList.add('active');
        currentManageSection = sectionName;
    }
    
    // Initialize section-specific features
    if (sectionName === 'schedule') {
        initializeManageDaySchedules();
    } else if (sectionName === 'location') {
        initializeManageMap();
    }
}

// Close modal when clicking outside
if (editFieldModal) {
    editFieldModal.addEventListener('click', (e) => {
        if (e.target === editFieldModal) {
            closeModal();
        }
    });
}

// Tab switching
function switchTab(tabName) {
    // Remove active class from all tabs and tab contents
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    const tabBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tabName}')"]`);
    const tabContent = document.getElementById(`${tabName}-tab`);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    
    // If switching to dateSpecific tab, initialize time slots
    if (tabName === 'dateSpecific' && tabContent) {
        renderTimeSlots();
    }
}

async function loadFieldData(fieldId) {
    if (!fieldId || typeof API === 'undefined' || !API.fields || !API.fields.getById) {
        return;
    }
    try {
        const res = await API.fields.getById(fieldId);
        const f = res && res.field;
        if (!f) return;

        const nameEl = document.getElementById('manageFieldName');
        if (nameEl) nameEl.value = f.name || '';

        selectManageSportByName(f.sport || 'Football');

        const typeSel = document.getElementById('manageFieldType');
        if (typeSel) {
            const indoor = String(f.type || '').toUpperCase() === 'INDOOR';
            typeSel.value = indoor ? 'Indoor' : 'Outdoor';
        }

        const pphEl = document.getElementById('managePricePerHour');
        if (pphEl) pphEl.value = f.pricePerHour != null ? String(f.pricePerHour) : '';

        const addrEl = document.getElementById('manageFieldAddress');
        if (addrEl) addrEl.value = f.address || f.location || '';

        const descEl = document.getElementById('manageDescription');
        if (descEl) descEl.value = f.description || '';

        applyManageFeaturesFromField(f.features);

        const latEl = document.getElementById('manageLatitude');
        const lngEl = document.getElementById('manageLongitude');
        if (latEl && f.latitude != null) latEl.textContent = String(f.latitude);
        if (lngEl && f.longitude != null) lngEl.textContent = String(f.longitude);

        const visToggle = document.getElementById('manageVisibilityToggle');
        if (visToggle) {
            visToggle.classList.toggle('active', f.isActive !== false);
        }

        const datesList = document.getElementById('manageUnavailableDatesList');
        if (datesList && API.fields.listUnavailableDates) {
            datesList.innerHTML = '';
            try {
                const ud = await API.fields.listUnavailableDates(fieldId);
                const rows = (ud && ud.unavailableDates) || [];
                rows.forEach(function(row) {
                    const ymd = unavailableYmdFromApi(row.date);
                    if (!ymd) return;
                    const dateItem = document.createElement('div');
                    dateItem.className = 'date-item';
                    dateItem.dataset.ymd = ymd;
                    dateItem.dataset.fromServer = '1';
                    dateItem.innerHTML =
                        '<span>' +
                        ownerFieldEsc(new Date(ymd + 'T12:00:00').toLocaleDateString()) +
                        '</span><button type="button" onclick="removeManageUnavailableDate(this)">&times;</button>';
                    datesList.appendChild(dateItem);
                });
            } catch (e) {
                console.warn('listUnavailableDates', e);
            }
        }
    } catch (e) {
        console.error('loadFieldData', e);
        alert((e && e.message) || 'Could not load field for editing.');
    }
}

// Delete Field
function deleteField(button) {
    if (!confirm('Are you sure you want to delete this field? This action cannot be undone.')) return;
    const fieldCard = button.closest('.field-list-card');
    const fieldId = fieldCard && fieldCard.getAttribute('data-field-id');
    if (!fieldId || typeof API === 'undefined' || !API.fields || !API.fields.delete) {
        if (fieldCard) fieldCard.remove();
        return;
    }
    API.fields.delete(fieldId).then(function() {
        loadOwnerFieldsFromApi();
    }).catch(function(err) {
        alert(err.message || 'Could not delete field');
    });
}

// Calendar Functions
function renderModalCalendar() {
    const calendarDaysContainer = document.getElementById('modalCalendarDays');
    const calendarMonthElement = document.getElementById('calendarMonth');
    
    if (!calendarDaysContainer || !calendarMonthElement) return;
    
    const year = currentModalDate.getFullYear();
    const month = currentModalDate.getMonth();
    
    // Update month display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    calendarMonthElement.textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Clear previous days
    calendarDaysContainer.innerHTML = '';
    
    // Add empty cells for days before first day of month
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day disabled';
        calendarDaysContainer.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        dayElement.addEventListener('click', () => {
            // Remove selected class from all days
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
            // Add selected class to clicked day
            dayElement.classList.add('selected');
            // Update selected date
            selectedDate = new Date(year, month, day);
            updateSelectedDateText();
            renderTimeSlots();
        });
        calendarDaysContainer.appendChild(dayElement);
    }
}

function prevModalMonth() {
    currentModalDate.setMonth(currentModalDate.getMonth() - 1);
    renderModalCalendar();
}

function nextModalMonth() {
    currentModalDate.setMonth(currentModalDate.getMonth() + 1);
    renderModalCalendar();
}

function updateSelectedDateText() {
    const selectedDateText = document.getElementById('selectedDateText');
    if (!selectedDateText) return;
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = dayNames[selectedDate.getDay()];
    const monthName = monthNames[selectedDate.getMonth()];
    const day = selectedDate.getDate();
    const year = selectedDate.getFullYear();
    
    selectedDateText.textContent = `🕐 ${dayName}, ${monthName} ${day}, ${year}`;
}

// Time Slots Functions
function renderTimeSlots() {
    const timeSlotsGrid = document.getElementById('timeSlotsGrid');
    if (!timeSlotsGrid) return;
    
    // Generate time slots from 8:00 to 23:00 (hourly)
    const slots = [];
    for (let hour = 8; hour <= 23; hour++) {
        const timeString = `${hour.toString().padStart(2, '0')}:00`;
        slots.push({
            time: timeString,
            status: Math.random() > 0.7 ? (Math.random() > 0.5 ? 'booked' : 'disabled') : 'available'
        });
    }
    
    timeSlotsGrid.innerHTML = '';
    slots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = `time-slot ${slot.status}`;
        slotElement.textContent = slot.time;
        if (slot.status === 'available') {
            slotElement.addEventListener('click', () => {
                slotElement.classList.toggle('available');
                slotElement.classList.toggle('disabled');
                updateSlotsSummary();
            });
        }
        timeSlotsGrid.appendChild(slotElement);
    });
    
    updateSlotsSummary();
}

function updateSlotsSummary() {
    const slots = document.querySelectorAll('.time-slot');
    let availableCount = 0;
    let disabledCount = 0;
    let bookedCount = 0;
    
    slots.forEach(slot => {
        if (slot.classList.contains('available')) availableCount++;
        else if (slot.classList.contains('disabled')) disabledCount++;
        else if (slot.classList.contains('booked')) bookedCount++;
    });
    
    const availableCountEl = document.getElementById('availableCount');
    const disabledCountEl = document.getElementById('disabledCount');
    const bookedCountEl = document.getElementById('bookedCount');
    
    if (availableCountEl) availableCountEl.textContent = availableCount;
    if (disabledCountEl) disabledCountEl.textContent = disabledCount;
    if (bookedCountEl) bookedCountEl.textContent = bookedCount;
}

function selectAllSlots() {
    document.querySelectorAll('.time-slot').forEach(slot => {
        if (!slot.classList.contains('booked')) {
            slot.classList.remove('disabled');
            slot.classList.add('available');
        }
    });
    updateSlotsSummary();
}

function unselectAllSlots() {
    document.querySelectorAll('.time-slot').forEach(slot => {
        if (!slot.classList.contains('booked')) {
            slot.classList.remove('available');
            slot.classList.add('disabled');
        }
    });
    updateSlotsSummary();
}

function togglePeakHours() {
    // Toggle peak hours (e.g., 18:00-22:00)
    document.querySelectorAll('.time-slot').forEach(slot => {
        const time = slot.textContent;
        const hour = parseInt(time.split(':')[0]);
        if (hour >= 18 && hour <= 22 && !slot.classList.contains('booked')) {
            slot.classList.toggle('available');
            slot.classList.toggle('disabled');
        }
    });
    updateSlotsSummary();
}

function copySchedule() {
    // Copy schedule from previous day (placeholder)
    alert('Schedule copied from previous day');
}

// Settings Toggle
function toggleSetting(settingName) {
    const toggle = document.getElementById(`${settingName}Toggle`);
    if (toggle) {
        toggle.classList.toggle('active');
    }
}

// Image Upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imagesContainer = document.querySelector('.images-container');
            const addImageBtn = imagesContainer.querySelector('.add-image-btn');
            
            const imagePreview = document.createElement('div');
            imagePreview.className = 'image-preview';
            imagePreview.innerHTML = `
                <img src="${e.target.result}" alt="Field">
                <button class="remove-image" onclick="removeImage(this)">&times;</button>
            `;
            
            imagesContainer.insertBefore(imagePreview, addImageBtn);
        };
        reader.readAsDataURL(file);
    }
}

function removeImage(button) {
    button.closest('.image-preview').remove();
}

// Save Changes
// Manage modal helper functions
function toggleManageDaySchedule(day, enabled) {
    const openingInput = document.getElementById(`manage-${day}-opening`);
    const closingInput = document.getElementById(`manage-${day}-closing`);
    const row = openingInput?.closest('.schedule-day-row');
    
    if (openingInput && closingInput && row) {
        if (enabled) {
            openingInput.required = true;
            closingInput.required = true;
            row.classList.remove('disabled');
        } else {
            openingInput.required = false;
            closingInput.required = false;
            row.classList.add('disabled');
        }
    }
}

function initializeManageDaySchedules() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
        const checkbox = document.querySelector(`input[name="manageWorkingDays"][value="${day}"]`);
        if (checkbox) {
            toggleManageDaySchedule(day, checkbox.checked);
        }
    });
}

function addManageHighlight() {
    const input = document.getElementById('manageHighlightInput');
    const highlightsList = document.getElementById('manageHighlightsList');
    
    if (!input || !highlightsList) return;
    
    const highlight = input.value.trim();
    if (highlight) {
        const highlightItem = document.createElement('div');
        highlightItem.className = 'highlight-item';
        highlightItem.innerHTML = `
            <span>${highlight}</span>
            <button type="button" onclick="removeManageHighlight(this)">&times;</button>
        `;
        highlightsList.appendChild(highlightItem);
        input.value = '';
    }
}

function removeManageHighlight(button) {
    button.parentElement.remove();
}

function addManageUnavailableDate() {
    const input = document.getElementById('manageUnavailableDateInput');
    const datesList = document.getElementById('manageUnavailableDatesList');
    
    if (!input || !datesList) return;
    
    const date = input.value;
    if (date) {
        const dateItem = document.createElement('div');
        dateItem.className = 'date-item';
        dateItem.dataset.ymd = date;
        dateItem.innerHTML = `
            <span>${new Date(date + 'T12:00:00').toLocaleDateString()}</span>
            <button type="button" onclick="removeManageUnavailableDate(this)">&times;</button>
        `;
        datesList.appendChild(dateItem);
        input.value = '';
    }
}

async function removeManageUnavailableDate(button) {
    const row = button.closest('.date-item');
    if (!row) return;

    const ymd = row.getAttribute('data-ymd');
    const fromServer = row.getAttribute('data-from-server') === '1';

    if (fromServer && ymd && ownerManagingFieldId && typeof API !== 'undefined' && API.fields && API.fields.removeUnavailableDate) {
        try {
            await API.fields.removeUnavailableDate(ownerManagingFieldId, ymd);
        } catch (e) {
            alert((e && e.message) || 'Could not remove blocked date on server.');
            return;
        }
    }

    row.remove();
}

function handleManageImageUpload(event) {
    const files = Array.from(event.target.files);
    const container = document.querySelector('#edit-info-section .images-container');
    
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imagePreview = document.createElement('div');
                imagePreview.className = 'image-preview';
                imagePreview.innerHTML = `
                    <img src="${e.target.result}" alt="Field">
                    <button class="remove-image" onclick="removeImage(this)">&times;</button>
                `;
                container.insertBefore(imagePreview, container.querySelector('.add-image-btn'));
            };
            reader.readAsDataURL(file);
        }
    });
}

function initializeManageMap() {
    const mapPicker = document.getElementById('manageLocationMap');
    if (mapPicker) {
        mapPicker.addEventListener('click', function(e) {
            updateManageMapLocation(e);
        });
    }
}

function updateManageMapLocation(event) {
    const pin = document.getElementById('manageMapPin');
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (pin) {
        pin.style.left = `${x}px`;
        pin.style.top = `${y}px`;
        pin.style.display = 'block';
    }
    
    document.getElementById('manageLatitude').textContent = '41.0082';
    document.getElementById('manageLongitude').textContent = '28.9784';
}

function toggleManageSetting(setting) {
    const toggle = document.getElementById(`manage${setting.charAt(0).toUpperCase() + setting.slice(1)}Toggle`);
    if (toggle) {
        toggle.classList.toggle('active');
    }
}

function toggleManageFieldVisibility() {
    toggleManageSetting('Visibility');
}

function removeManageFile(type) {
    const previewId = type === 'ownership' ? 'manageOwnershipPreview' : 'manageLicensePreview';
    const filePreview = document.getElementById(previewId);
    if (filePreview) {
        filePreview.classList.remove('active');
        const fileItem = filePreview.querySelector('.file-preview-item');
        if (fileItem) {
            fileItem.remove();
        }
    }
}

function handleManageDocumentUpload(type, input) {
    const file = input.files[0];
    if (!file) return;
    
    const previewId = type === 'ownership' ? 'manageOwnershipDocPreview' : 'manageLicensesDocPreview';
    const previewContainer = document.getElementById(previewId);
    if (!previewContainer) return;
    
    // Clear previous preview
    previewContainer.innerHTML = '';
    
    const fileName = file.name;
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    const filePreviewItem = document.createElement('div');
    filePreviewItem.className = 'file-preview-item';
    filePreviewItem.innerHTML = `
        <i class="fi fi-rr-file-pdf" style="color: #DC2626; margin-right: 8px;"></i>
        <span>${fileName}</span>
        <div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
            <span style="font-size: 11px; color: #F59E0B; font-weight: 500;">Pending Review</span>
            <button type="button" onclick="removeManageDocumentPreview('${previewId}')" title="Remove file">&times;</button>
        </div>
        <small style="display: block; margin-top: 4px; color: #6B7280;">${fileSize} MB</small>
    `;
    
    previewContainer.appendChild(filePreviewItem);
    previewContainer.classList.add('active');
    
    // Show info that this will need approval
    const infoBanner = document.querySelector('#documents-section .info-banner');
    if (infoBanner) {
        const infoText = infoBanner.querySelector('p:last-child');
        if (infoText) {
            infoText.textContent = 'Updated documents will be submitted for admin review. Your field will remain active with current documents until new ones are approved.';
        }
    }
}

function removeManageDocumentPreview(previewId) {
    const previewContainer = document.getElementById(previewId);
    if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.classList.remove('active');
    }
    
    // Reset file input
    const inputId = previewId === 'manageOwnershipDocPreview' ? 'manageOwnershipDoc' : 'manageLicensesDoc';
    const input = document.getElementById(inputId);
    if (input) {
        input.value = '';
    }
}

async function submitManageChanges() {
    if (!ownerManagingFieldId) {
        alert('No field selected. Open Manage from a field card.');
        return;
    }
    if (typeof API === 'undefined' || !API.fields || !API.fields.update) {
        alert('API not available.');
        return;
    }

    const typeSel = document.getElementById('manageFieldType');
    const typeLabel = (typeSel && typeSel.value) || 'Outdoor';
    const typeEnum = String(typeLabel).toLowerCase().indexOf('indoor') >= 0 ? 'INDOOR' : 'OUTDOOR';

    const city = document.getElementById('manageFieldCity')?.value?.trim() || '';
    const dist = document.getElementById('manageFieldDistrict')?.value?.trim() || '';
    const addr = document.getElementById('manageFieldAddress')?.value?.trim() || '';
    const locationLine = [city, dist].filter(Boolean).join(', ') || addr || '—';

    const sportSel = document.getElementById('manageSportCategory');
    const sport =
        sportSel && sportSel.options[sportSel.selectedIndex]
            ? sportSel.options[sportSel.selectedIndex].text.trim()
            : 'Football';

    const latTxt = document.getElementById('manageLatitude')?.textContent?.trim();
    const lngTxt = document.getElementById('manageLongitude')?.textContent?.trim();

    const visOn = document.getElementById('manageVisibilityToggle')?.classList.contains('active');
    const maintOn = document.getElementById('manageMaintenanceToggle')?.classList.contains('active');

    const payload = {
        name: (document.getElementById('manageFieldName')?.value || '').trim() || 'Field',
        sport,
        description: document.getElementById('manageDescription')?.value || '',
        type: typeEnum,
        location: locationLine,
        address: addr || undefined,
        pricePerHour: Math.round(parseFloat(document.getElementById('managePricePerHour')?.value) || 0),
        features: collectManageFeatureStrings(),
        isActive: !!visOn && !maintOn
    };

    if (latTxt && !isNaN(parseFloat(latTxt))) payload.latitude = parseFloat(latTxt);
    if (lngTxt && !isNaN(parseFloat(lngTxt))) payload.longitude = parseFloat(lngTxt);

    const btn = document.getElementById('manageSubmitBtn');
    if (btn) {
        btn.disabled = true;
    }

    try {
        await API.fields.update(ownerManagingFieldId, payload);

        if (API.fields.addUnavailableDate && API.fields.listUnavailableDates) {
            try {
                const existing = await API.fields.listUnavailableDates(ownerManagingFieldId);
                const have = new Set(
                    ((existing && existing.unavailableDates) || []).map(function(r) {
                        return unavailableYmdFromApi(r.date);
                    })
                );
                const domDates = Array.from(
                    document.querySelectorAll('#manageUnavailableDatesList .date-item[data-ymd]')
                )
                    .map(function(el) {
                        return el.getAttribute('data-ymd');
                    })
                    .filter(Boolean);
                for (let i = 0; i < domDates.length; i++) {
                    const ymd = domDates[i];
                    if (!have.has(ymd)) {
                        try {
                            await API.fields.addUnavailableDate(ownerManagingFieldId, ymd);
                        } catch (err) {
                            console.warn('addUnavailableDate', ymd, err);
                        }
                    }
                }
            } catch (e) {
                console.warn('sync unavailable', e);
            }
        }

        alert('Field updated successfully.');
        closeModal();
        loadOwnerFieldsFromApi();
    } catch (e) {
        alert((e && e.message) || 'Could not update field.');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function saveChanges() {
    submitManageChanges();
}

// Update radio label styling on change
function updateRadioLabels() {
    document.querySelectorAll('.radio-label input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const label = this.closest('.radio-label');
            const allLabels = document.querySelectorAll('.radio-label');
            allLabels.forEach(l => {
                l.style.borderColor = '#E5E7EB';
                l.style.background = 'white';
                l.style.boxShadow = 'none';
            });
            if (this.checked && label) {
                label.style.borderColor = '#007BFF';
                label.style.background = '#EFF6FF';
                label.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
            }
        });
        
        // Set initial state
        if (radio.checked) {
            const label = radio.closest('.radio-label');
            if (label) {
                label.style.borderColor = '#007BFF';
                label.style.background = '#EFF6FF';
                label.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
            }
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadOwnerFieldsFromApi();
    selectedDate = new Date();
    initializeDaySchedules();
    updateRadioLabels();
    try {
        const params = new URLSearchParams(window.location.search);
        const manageId = params.get('manage');
        const viewId = params.get('view');
        if (manageId && /^[a-fA-F0-9]{24}$/.test(String(manageId).trim())) {
            openModal(String(manageId).trim());
        } else if (viewId && /^[a-fA-F0-9]{24}$/.test(String(viewId).trim())) {
            openViewFieldModalForFieldId(String(viewId).trim()).catch(function (err) {
                console.error('open view from URL', err);
                alert((err && err.message) || 'Could not load field details.');
                closeViewModal();
            });
        }
    } catch (e) {
        /* ignore */
    }
});

