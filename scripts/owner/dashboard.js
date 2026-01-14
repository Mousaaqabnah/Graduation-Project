// Dashboard functionality

// Sample bookings data
const bookingsData = {
    today: [
        {
            time: "18:00-19:30",
            team: "Istanbul United",
            field: "Main football field",
            type: "Football",
            price: "₺1,500",
            status: "confirmed"
        },
        {
            time: "20:00-21:00",
            team: "Evening 5v5",
            field: "Indoor futsal court",
            type: "Futsal",
            price: "₺900",
            status: "pending"
        },
        {
            time: "22:00-23:30",
            team: "Night Owls",
            field: "Main football field",
            type: "Football",
            price: "₺1,700",
            status: "confirmed"
        }
    ],
    week: [
        {
            time: "18:00-19:30",
            team: "Istanbul United",
            field: "Main football field",
            type: "Football",
            price: "₺1,500",
            status: "confirmed"
        },
        {
            time: "20:00-21:00",
            team: "Evening 5v5",
            field: "Indoor futsal court",
            type: "Futsal",
            price: "₺900",
            status: "pending"
        },
        {
            time: "22:00-23:30",
            team: "Night Owls",
            field: "Main football field",
            type: "Football",
            price: "₺1,700",
            status: "confirmed"
        },
        {
            time: "14:00-15:30",
            team: "Weekend Warriors",
            field: "Indoor futsal court",
            type: "Futsal",
            price: "₺1,200",
            status: "confirmed"
        },
        {
            time: "16:00-17:30",
            team: "City FC",
            field: "Main football field",
            type: "Football",
            price: "₺1,600",
            status: "pending"
        }
    ]
};

// DOM Elements
const notificationBtn = document.getElementById('notificationBtn');
const notificationPopup = document.getElementById('notificationPopup');
const profileBtn = document.getElementById('profileBtn');
const profilePopup = document.getElementById('profilePopup');
const bookingsTableBody = document.getElementById('bookingsTableBody');
const addFieldBtn = document.getElementById('addFieldBtn');
const manageBtns = document.querySelectorAll('.manage-btn');

// Notification Popup Toggle
if (notificationBtn && notificationPopup) {
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationPopup.classList.toggle('active');
        // Close profile popup if open
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
        // Close notification popup if open
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

// Update Bookings Table - Only shows today's bookings
function updateBookingsTable() {
    if (!bookingsTableBody) return;
    
    const bookings = bookingsData.today;
    
    // Clear existing rows
    bookingsTableBody.innerHTML = '';
    
    // Add new rows
    bookings.forEach(booking => {
        const row = document.createElement('tr');
        
        const statusClass = booking.status === 'confirmed' ? 'badge-confirmed' : 
                           booking.status === 'pending' ? 'badge-pending' : 'badge-cancelled';
        const statusText = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
        
        row.innerHTML = `
            <td>${booking.time}</td>
            <td>${booking.team}</td>
            <td>${booking.field}</td>
            <td>${booking.type}</td>
            <td>${booking.price}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
        `;
        
        bookingsTableBody.appendChild(row);
    });
}

// Add Field Button Handler
const addFieldModal = document.getElementById('addFieldModal');
let currentStep = 1;
const totalSteps = 8;
let fieldImages = [];
let highlights = [];
let unavailableDates = [];

if (addFieldBtn && addFieldModal) {
    addFieldBtn.addEventListener('click', () => {
        openAddFieldModal();
    });
}

// Initialize table with today's bookings
if (bookingsTableBody) {
    updateBookingsTable();
}

// Update greeting based on time of day
function updateGreeting() {
    const greetingElement = document.querySelector('.greeting-section .greeting');
    if (!greetingElement) return;
    
    const hour = new Date().getHours();
    let timeGreeting = '';
    
    if (hour < 12) {
        timeGreeting = 'Good morning';
    } else if (hour < 18) {
        timeGreeting = 'Good afternoon';
    } else {
        timeGreeting = 'Good evening';
    }
    
    // Keep the existing name part
    const currentText = greetingElement.textContent;
    const nameMatch = currentText.match(/, (.+?) 👋/);
    const name = nameMatch ? nameMatch[1] : 'Fozl court';
    
    greetingElement.textContent = `${timeGreeting}, ${name} 👋`;
}

// Update greeting on page load
updateGreeting();

// Format currency helper
function formatCurrency(amount) {
    return `₺${amount.toLocaleString('tr-TR')}`;
}

// Export functions for use in other scripts if needed
window.dashboardUtils = {
    updateBookingsTable,
    formatCurrency
};

// Modal Functions
const editFieldModal = document.getElementById('editFieldModal');
const viewFieldModal = document.getElementById('viewFieldModal');

// Open Edit Field Modal
function openModal(fieldId) {
    if (editFieldModal) {
        editFieldModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Show menu, hide sections
        showManageMenu();
        
        // If fieldId is provided, load field data
        if (fieldId) {
            loadFieldData(fieldId);
        }
    }
}

// Close Edit Field Modal
function closeModal() {
    if (editFieldModal) {
        editFieldModal.classList.remove('active');
        document.body.style.overflow = '';
        // Reset to menu view
        showManageMenu();
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
let currentManageSection = null;

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

// Load field data into modal (placeholder)
function loadFieldData(fieldId) {
    // This would typically fetch data from an API
    console.log(`Loading data for field ${fieldId}`);
}

// View Field Details
function viewFieldDetails(button) {
    try {
        const fieldCard = button.closest('.field-list-card');
        if (!fieldCard) return;
        
        const fieldImage = fieldCard.querySelector('.field-list-image img')?.src;
        const fieldName = fieldCard.querySelector('.field-list-name')?.textContent;
        const fieldLocation = fieldCard.querySelector('.field-list-location')?.textContent.trim();
        const fieldPrice = fieldCard.querySelector('.field-list-price')?.textContent;
        const fieldTags = Array.from(fieldCard.querySelectorAll('.field-tag')).map(tag => tag.textContent);
        
        if (!fieldImage || !fieldName) return;
        
        // Populate view modal
        if (viewFieldModal) {
            // Set main image
            const imageEl = document.getElementById('viewFieldImage');
            if (imageEl) imageEl.src = fieldImage;
        
            // Set title
            const titleEl = document.getElementById('viewFieldName');
            if (titleEl) titleEl.textContent = fieldName;
            
            // Set meta line with rating and reviews
            const metaLine = document.getElementById('viewFieldMeta');
            const headerRating = '4.8';
            const headerReviewsCount = '98';
            if (metaLine) {
                metaLine.innerHTML = `
                    <i class="fi fi-rr-marker field-meta-icon"></i>
                    <span id="viewFieldLocation">${fieldLocation}</span>
                    <span class="field-meta-separator">•</span>
                    <span id="viewFieldCategory">${fieldTags[1] || 'Sport'}</span>
                    <span class="field-meta-separator">•</span>
                    <span id="viewFieldType">${fieldTags[0] || 'Type'}</span>
                    <span class="field-meta-separator">•</span>
                    <span class="field-star-yellow">★</span>
                    <span id="viewFieldHeaderRating">${headerRating}</span>
                    <span> (<span id="viewFieldHeaderReviewsCount">${headerReviewsCount}</span>)</span>
                `;
            }
            
            // Set price
            const priceElement = document.getElementById('viewFieldPrice');
            if (priceElement) {
                priceElement.innerHTML = fieldPrice.replace('/h', '<span class="view-field-price-unit">/h</span>');
            }
            
            // Set feature tags
            const tagsContainer = document.getElementById('viewFieldTags');
            if (tagsContainer && fieldTags.length > 0) {
                tagsContainer.innerHTML = fieldTags.map(tag => 
                    `<span class="view-field-feature-tag">${tag}</span>`
                ).join('');
            }
            
            // Set field details
            const locationFullEl = document.getElementById('viewFieldLocationFull');
            const categoryFullEl = document.getElementById('viewFieldCategoryFull');
            const typeFullEl = document.getElementById('viewFieldTypeFull');
            const capacityEl = document.getElementById('viewFieldCapacity');
            const descriptionEl = document.getElementById('viewFieldDescription');
            
            if (locationFullEl) locationFullEl.textContent = fieldLocation;
            if (categoryFullEl) categoryFullEl.textContent = fieldTags[1] || '-';
            if (typeFullEl) typeFullEl.textContent = fieldTags[0] || '-';
            if (capacityEl) capacityEl.textContent = '22 players';
            
            // Set description
            if (descriptionEl) {
                descriptionEl.textContent = 'Professional sports field with high-quality facilities. Perfect for both casual matches and professional training sessions. The field features high-quality artificial turf, excellent lighting, and modern facilities.';
            }
            
            // Set highlights
            const highlightsList = document.getElementById('viewFieldHighlights');
            if (highlightsList) {
                highlightsList.innerHTML = `
                    <li>Easy access by car and public transport</li>
                    <li>High-quality lighting for night games</li>
                    <li>Clean changing rooms and showers</li>
                    <li>Snacks and drinks available on site</li>
                `;
            }
            
            // Set amenities
            const amenitiesGrid = document.getElementById('viewFieldAmenities');
            if (amenitiesGrid) {
                const amenities = ['Flood lights', 'Showers', 'Team benches', 'Changing rooms', 'Parking', 'Wi-Fi'];
                amenitiesGrid.innerHTML = amenities.map(amenity => `
                    <div class="view-amenity-item">
                        <i class="fi fi-rr-check view-amenity-icon"></i>
                        <span>${amenity}</span>
                    </div>
                `).join('');
            }
            
            // Set reviews summary (also update header if needed)
            const reviewsRating = '4.8';
            const reviewsCount = '98';
            const ratingElement = document.getElementById('viewFieldRating');
            const reviewsCountElement = document.getElementById('viewFieldReviewsCount');
            if (ratingElement) ratingElement.textContent = reviewsRating;
            if (reviewsCountElement) reviewsCountElement.textContent = reviewsCount;
            
            // Populate reviews list
            const reviewsList = document.getElementById('viewReviewsList');
            if (reviewsList) {
            const reviews = [
                {
                    name: 'Ahmed',
                    initial: 'A',
                    rating: 5,
                    text: 'Great field quality, lights are strong and the staff were friendly. Booking was smooth and easy.',
                    context: 'Played 5v5 last week',
                    date: '2 days ago'
                },
                {
                    name: 'Sara',
                    initial: 'S',
                    rating: 5,
                    text: 'Perfect location and easy to reach. Parking area helps a lot during busy hours. Highly recommend!',
                    context: 'Weekend booking',
                    date: '1 week ago'
                },
                {
                    name: 'Mohamed',
                    initial: 'M',
                    rating: 4,
                    text: 'Good facilities overall. The field is well-maintained. Only minor issue was the changing room could be cleaner.',
                    context: 'Regular player',
                    date: '2 weeks ago'
                },
                {
                    name: 'Layla',
                    initial: 'L',
                    rating: 5,
                    text: 'Excellent experience! The booking system is user-friendly and the field exceeded our expectations. Will definitely book again.',
                    context: 'First time booking',
                    date: '3 weeks ago'
                }
            ];
                
                reviewsList.innerHTML = reviews.map(review => {
                    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                    return `
                        <div class="view-review-card">
                            <div class="view-review-header">
                                <div class="view-reviewer-info">
                                    <div class="view-reviewer-avatar">${review.initial}</div>
                                    <div class="view-reviewer-details">
                                        <div class="view-reviewer-name">${review.name}</div>
                                        <div class="view-review-context">${review.context}</div>
                                    </div>
                                </div>
                                <div class="view-review-rating-display">
                                    <span class="view-star-filled">${stars}</span>
                                </div>
                            </div>
                            <p class="view-review-text">${review.text}</p>
                            <div class="view-review-date">${review.date}</div>
                        </div>
                    `;
                }).join('');
            }
            
            viewFieldModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    } catch (error) {
        console.error('Error opening view field modal:', error);
    }
}

function closeViewModal() {
    if (viewFieldModal) {
        viewFieldModal.classList.remove('active');
        document.body.style.overflow = '';
        // Reset reviews list to hidden
        const reviewsList = document.getElementById('viewReviewsList');
        const toggleBtn = document.getElementById('viewToggleReviewsBtn');
        if (reviewsList) reviewsList.style.display = 'none';
        if (toggleBtn) {
            toggleBtn.classList.remove('expanded');
            const toggleText = toggleBtn.querySelector('.view-toggle-text');
            if (toggleText) toggleText.textContent = 'View reviews';
        }
    }
}

function toggleViewReviews() {
    const reviewsList = document.getElementById('viewReviewsList');
    const toggleBtn = document.getElementById('viewToggleReviewsBtn');
    
    if (reviewsList && toggleBtn) {
        const isHidden = reviewsList.style.display === 'none' || !reviewsList.style.display;
        
        if (isHidden) {
            reviewsList.style.display = 'flex';
            toggleBtn.classList.add('expanded');
            const toggleText = toggleBtn.querySelector('.view-toggle-text');
            if (toggleText) toggleText.textContent = 'Hide reviews';
        } else {
            reviewsList.style.display = 'none';
            toggleBtn.classList.remove('expanded');
            const toggleText = toggleBtn.querySelector('.view-toggle-text');
            if (toggleText) toggleText.textContent = 'View reviews';
        }
    }
}

// Close modals when clicking outside
if (editFieldModal) {
    editFieldModal.addEventListener('click', (e) => {
        if (e.target === editFieldModal) {
            closeModal();
        }
    });
}

if (viewFieldModal) {
    viewFieldModal.addEventListener('click', (e) => {
        if (e.target === viewFieldModal) {
            closeViewModal();
        }
    });
}

// Add Field Modal Functions
function openAddFieldModal() {
    if (addFieldModal) {
        addFieldModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        currentStep = 1;
        showStep(1);
        resetAddFieldForm();
    }
}

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
    const form = document.getElementById('addFieldForm');
    if (form) form.reset();
    const imagesGrid = document.getElementById('fieldImagesGrid');
    const highlightsList = document.getElementById('highlightsList');
    const unavailableDatesList = document.getElementById('unavailableDatesList');
    if (imagesGrid) imagesGrid.innerHTML = '';
    if (highlightsList) highlightsList.innerHTML = '';
    if (unavailableDatesList) unavailableDatesList.innerHTML = '';
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
        const ownershipDoc = document.getElementById('ownershipDoc');
        if (ownershipDoc && !ownershipDoc.files.length) {
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
        const latitude = document.getElementById('latitude');
        if (latitude && latitude.textContent === '-') {
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
                if (opening && closing) {
                    if (!opening.value || !closing.value) {
                        alert(`Please set opening and closing times for ${day}`);
                        isValid = false;
                    } else if (opening.value >= closing.value) {
                        alert(`Closing time must be after opening time for ${day}`);
                        isValid = false;
                    }
                }
            });
        }
    }
    
    return isValid;
}

// Add highlight
function addHighlight() {
    const input = document.getElementById('highlightInput');
    const value = input ? input.value.trim() : '';
    
    if (value && !highlights.includes(value)) {
        highlights.push(value);
        renderHighlights();
        if (input) input.value = '';
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
    if (!container) return;
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
    if (!container) return;
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
    const date = input ? input.value : '';
    
    if (date && !unavailableDates.includes(date)) {
        unavailableDates.push(date);
        renderUnavailableDates();
        if (input) input.value = '';
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
    if (!container) return;
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
        ownershipDoc: document.getElementById('ownershipDoc')?.files[0],
        licensesDoc: document.getElementById('licensesDoc')?.files[0],
        
        // Basic info
        fieldName: document.getElementById('fieldName')?.value,
        description: document.getElementById('fieldDescription')?.value,
        highlights: highlights,
        fieldType: document.getElementById('fieldType')?.value,
        capacity: parseInt(document.getElementById('capacity')?.value || '0'),
        
        // Amenities & Features
        amenities: Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map(cb => cb.value),
        features: Array.from(document.querySelectorAll('input[name="features"]:checked')).map(cb => cb.value),
        
        // Media
        images: fieldImages,
        
        // Location
        address: document.getElementById('fieldAddress')?.value,
        city: document.getElementById('fieldCity')?.value,
        district: document.getElementById('fieldDistrict')?.value,
        latitude: document.getElementById('latitude')?.textContent,
        longitude: document.getElementById('longitude')?.textContent,
        
        // Pricing
        pricePerHour: parseFloat(document.getElementById('pricePerHour')?.value || '0'),
        
        // Schedule
        workingDays: Array.from(document.querySelectorAll('input[name="workingDays"]:checked')).map(cb => cb.value),
        unavailableDates: unavailableDates,
        
        // Settings
        bookingType: document.querySelector('input[name="bookingType"]:checked')?.value,
        advanceBooking: document.getElementById('advanceBooking')?.value,
        cancellationPolicy: document.getElementById('cancellationPolicy')?.value,
        visibility: document.getElementById('fieldVisibilityToggle')?.classList.contains('active')
    };
    
    console.log('Submitting field form:', formData);
    
    // Here you would typically send the data to your backend API
    // For now, we'll show a success message
    alert('Field submitted successfully! It will be reviewed and approved by the admin.');
    
    closeAddFieldModal();
}

// Close add field modal when clicking outside
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
                if (preview) {
                    preview.innerHTML = `
                        <div class="file-preview-item">
                            <span>${file.name}</span>
                            <button type="button" onclick="document.getElementById('ownershipDoc').value = ''; document.getElementById('ownershipDocPreview').innerHTML = ''; document.getElementById('ownershipDocPreview').classList.remove('active');">&times;</button>
                        </div>
                    `;
                    preview.classList.add('active');
                }
            }
        });
    }
    
    if (licensesDocInput) {
        licensesDocInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const preview = document.getElementById('licensesDocPreview');
                if (preview) {
                    preview.innerHTML = `
                        <div class="file-preview-item">
                            <span>${file.name}</span>
                            <button type="button" onclick="document.getElementById('licensesDoc').value = ''; document.getElementById('licensesDocPreview').innerHTML = ''; document.getElementById('licensesDocPreview').classList.remove('active');">&times;</button>
                        </div>
                    `;
                    preview.classList.add('active');
                }
            }
        });
    }
    
    // Map click handler (placeholder)
    const mapPicker = document.getElementById('locationMap');
    if (mapPicker) {
        mapPicker.addEventListener('click', (e) => {
            // Placeholder for map integration
            const rect = mapPicker.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const mapPin = document.getElementById('mapPin');
            if (mapPin) {
                mapPin.style.left = x + 'px';
                mapPin.style.top = y + 'px';
            }
            
            // Placeholder coordinates
            const latitude = document.getElementById('latitude');
            const longitude = document.getElementById('longitude');
            if (latitude) latitude.textContent = (41.0082 + (Math.random() - 0.5) * 0.01).toFixed(6);
            if (longitude) longitude.textContent = (28.9784 + (Math.random() - 0.5) * 0.01).toFixed(6);
        });
    }
    
    // Initialize day schedules
    initializeDaySchedules();
    // Update radio labels styling
    updateRadioLabels();
});

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

// Manage Modal Helper Functions
function toggleManageDaySchedule(day, enabled) {
    const openingInput = document.getElementById(`manage-${day}-opening`);
    const closingInput = document.getElementById(`manage-${day}-closing`);
    const row = openingInput?.closest('.schedule-day-row');
    
    if (openingInput && closingInput && row) {
        if (enabled) {
            openingInput.required = true;
            closingInput.required = true;
            row.classList.remove('disabled');
            openingInput.disabled = false;
            closingInput.disabled = false;
        } else {
            openingInput.required = false;
            closingInput.required = false;
            row.classList.add('disabled');
            openingInput.disabled = true;
            closingInput.disabled = true;
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
        dateItem.innerHTML = `
            <span>${new Date(date).toLocaleDateString()}</span>
            <button type="button" onclick="removeManageUnavailableDate(this)">&times;</button>
        `;
        datesList.appendChild(dateItem);
        input.value = '';
    }
}

function removeManageUnavailableDate(button) {
    button.parentElement.remove();
}

function handleManageImageUpload(event) {
    const files = Array.from(event.target.files);
    const container = document.querySelector('#edit-info-section .images-container');
    
    if (!container) return;
    
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
                const addImageBtn = container.querySelector('.add-image-btn');
                if (addImageBtn) {
                    container.insertBefore(imagePreview, addImageBtn);
                } else {
                    container.appendChild(imagePreview);
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

function initializeManageMap() {
    const mapPicker = document.getElementById('manageLocationMap');
    if (mapPicker) {
        // Remove existing listeners to avoid duplicates
        const newMapPicker = mapPicker.cloneNode(true);
        mapPicker.parentNode.replaceChild(newMapPicker, mapPicker);
        
        newMapPicker.addEventListener('click', function(e) {
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
    
    const latitudeEl = document.getElementById('manageLatitude');
    const longitudeEl = document.getElementById('manageLongitude');
    if (latitudeEl) latitudeEl.textContent = '41.0082';
    if (longitudeEl) longitudeEl.textContent = '28.9784';
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

function submitManageChanges() {
    const data = {};
    
    console.log('Submitting changes for approval:', data);
    alert('Changes submitted for approval!');
    closeModal();
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imagesContainer = document.querySelector('.images-container');
            if (imagesContainer) {
                const addImageBtn = imagesContainer.querySelector('.add-image-btn');
                
                const imagePreview = document.createElement('div');
                imagePreview.className = 'image-preview';
                imagePreview.innerHTML = `
                    <img src="${e.target.result}" alt="Field">
                    <button class="remove-image" onclick="removeImage(this)">&times;</button>
                `;
                
                if (addImageBtn) {
                    imagesContainer.insertBefore(imagePreview, addImageBtn);
                } else {
                    imagesContainer.appendChild(imagePreview);
                }
            }
        };
        reader.readAsDataURL(file);
    }
}

function removeImage(button) {
    button.closest('.image-preview').remove();
}

function saveChanges() {
    // Collect form data
    const fieldData = {
        name: document.getElementById('fieldName')?.value,
        price: document.getElementById('pricePerHour')?.value,
        location: document.getElementById('location')?.value,
        description: document.getElementById('description')?.value,
        category: document.getElementById('sportCategory')?.value,
        type: document.getElementById('fieldType')?.value,
        capacity: document.getElementById('capacity')?.value
    };
    
    console.log('Saving field data:', fieldData);
    
    // Here you would typically send data to an API
    alert('Field details saved successfully!');
    closeModal();
}

function toggleSetting(settingName) {
    const toggle = document.getElementById(`${settingName}Toggle`);
    if (toggle) {
        toggle.classList.toggle('active');
    }
}

// Calendar Functions for Edit Modal
let currentModalDate = new Date();
let selectedDate = new Date();

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

// Initialize calendar on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize calendar if modal calendar exists
    const calendarDaysContainer = document.getElementById('modalCalendarDays');
    if (calendarDaysContainer) {
        renderModalCalendar();
        updateSelectedDateText();
    }
});

// Make functions globally available
window.openModal = openModal;
window.closeModal = closeModal;
window.viewFieldDetails = viewFieldDetails;
window.closeViewModal = closeViewModal;
window.toggleViewReviews = toggleViewReviews;
window.openAddFieldModal = openAddFieldModal;
window.closeAddFieldModal = closeAddFieldModal;
window.addHighlight = addHighlight;
window.removeHighlight = removeHighlight;
window.handleFieldImagesUpload = handleFieldImagesUpload;
window.removeFieldImage = removeFieldImage;
window.toggleDaySchedule = toggleDaySchedule;
window.addUnavailableDate = addUnavailableDate;
window.removeUnavailableDate = removeUnavailableDate;
window.toggleFieldVisibility = toggleFieldVisibility;
window.submitFieldForm = submitFieldForm;
window.nextStep = nextStep;
window.previousStep = previousStep;
window.handleImageUpload = handleImageUpload;
window.removeImage = removeImage;
window.openManageSection = openManageSection;
window.backToManageMenu = backToManageMenu;
window.toggleManageDaySchedule = toggleManageDaySchedule;
window.addManageHighlight = addManageHighlight;
window.removeManageHighlight = removeManageHighlight;
window.addManageUnavailableDate = addManageUnavailableDate;
window.removeManageUnavailableDate = removeManageUnavailableDate;
window.handleManageImageUpload = handleManageImageUpload;
window.toggleManageSetting = toggleManageSetting;
window.toggleManageFieldVisibility = toggleManageFieldVisibility;
window.removeManageFile = removeManageFile;
window.handleManageDocumentUpload = handleManageDocumentUpload;
window.removeManageDocumentPreview = removeManageDocumentPreview;
window.submitManageChanges = submitManageChanges;
window.toggleSetting = toggleSetting;
window.prevModalMonth = prevModalMonth;
window.nextModalMonth = nextModalMonth;
window.selectAllSlots = selectAllSlots;
window.unselectAllSlots = unselectAllSlots;
window.togglePeakHours = togglePeakHours;
window.copySchedule = copySchedule;

